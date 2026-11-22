import {test} from "node:test";
import assert from "node:assert/strict";
import {SolarSystem,bodyById,createCelestialPlanet,orbitalPosition,skyFromSurface,
 applyCelestialClimate} from "./solar-system.mjs";
import {adjustDryWorld} from "./solar-terrain.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {Weather} from "../planet/weather-engine.mjs";
import {freshCelestialSave,carryCelestialInventory} from "./solar-transition.mjs";

test("orbits repeat every planetary year and the moon follows the parent",()=>{
 const before=orbitalPosition("terra",2),after=orbitalPosition("terra",2+365.25);
 assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<1e-8);
 const moon=orbitalPosition("selene",2);
 assert.ok(Math.hypot(moon.x-before.x,moon.z-before.z)<.003);
});
test("stellar sky follows the shared clock and has finite altitude and azimuth",()=>{
 const planet=createCelestialPlanet("terra",.24);
 const list=skyFromSurface("terra",planet,28,42,.24);
 assert.ok(list.some(v=>v.id==="helios"));
 assert.ok(list.every(v=>Number.isFinite(v.altitudeDeg)&&v.azimuthDeg>=0&&v.azimuthDeg<360));
});
test("travel preserves body-specific saves without recursive payloads",()=>{
 const system=new SolarSystem();
 const terra={format:"ue/explorer-demo",v0_aa:{ignored:"nested"},test:"original colony"};
 system.store("terra",terra);
 const dest=system.travelPlan("selene");
 assert.equal(dest.ok,true);
 system.arrive("selene",dest.flightDays);
 assert.equal(system.currentId,"selene");
 assert.ok(system.days>0);
 assert.equal(system.load("terra").test,"original colony");
 assert.equal(system.load("terra").v0_aa,undefined);
 const restored=SolarSystem.fromSnapshot(system.snapshot());
 assert.equal(restored.load("terra").test,"original colony");
});
test("airless surfaces have no water, rain or clouds",()=>{
 for(const id of ["selene","cinder","nix"]){
  const planet=createCelestialPlanet(id,.24);
  const terrain=new Terrain(planet);adjustDryWorld(terrain,id);
  const sample=terrain.sample(30,40);
  assert.equal(sample.water,false);assert.equal(sample.river,false);
  const weather=applyCelestialClimate(new Weather(planet),id).sample(30,40,350);
  assert.equal(weather.precipitation,"none");
  assert.equal(weather.cloudCover,0);
 }
});
test("asteroid mining increases metals and advances the clock",()=>{
 const system=new SolarSystem();
 for(let k=0;k<3;k++)assert.equal(system.mineBelt().rare,0);
 const fourth=system.mineBelt();
 assert.equal(fourth.rare,1);
 assert.ok(system.days>=2.4);
});
test("new planet leaves buildings behind but carries player resources and gear",()=>{
 const current={format:"ue/explorer-demo",version:1,
  planet:createCelestialPlanet("terra",.24).snapshot(),
  explorer:{origin:{lat:28,lon:42},x:77,z:8,altitudeM:2.5},
  actions:{resources:{wood:9,stone:2},structures:[{id:3}],active:null},
  v0_7g:{furnishings:[{id:1}],chestContents:{"1":{wood:5}},initializedHuts:[3]},
  v0_7d:{squad:{frontier:{nodes:[{id:"a"}],people:{player:{inventory:{wood:1}}}}}},
  v0_7b:{appearance:"example"},v0_8w:{owner:{buildings:[1]}},
  v0_8s:{coins:123},v0_8r:{destinationId:"pioneer"}};
 const next=freshCelestialSave(current,"cinder",.24);
 carryCelestialInventory(next,current);
 assert.equal(next.planet.id,"cinder");assert.equal(next.actions.structures.length,0);
 assert.equal(next.v0_8w,undefined);
 assert.equal(next.v0_7g.furnishings.length,0);
 assert.equal(next.actions.resources.wood,9);
 assert.equal(next.v0_7d.squad.frontier.people.player.inventory.wood,1);
 assert.equal(next.explorer.altitudeM,16000000);
 assert.equal(bodyById(next.planet.id).gravity,3.71);
});
