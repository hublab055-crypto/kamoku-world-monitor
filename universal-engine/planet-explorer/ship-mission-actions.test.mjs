import test from "node:test";
import assert from "node:assert/strict";
import {ShipMissionActions} from "./ship-mission-actions.mjs";
import {ShipCargoCaches,distanceOnPlanet} from "./ship-cargo-cache.mjs";
import {ShipJourney} from "./ship-journey.mjs";
import {SpaceVoyage} from "./space-voyage.mjs";

const pad={bodyId:"cinder",lat:13.2,lon:140.1,yaw:0,padElevationM:4};
function ship(status="entry"){
 return new ShipJourney({originId:"terra",destinationId:"cinder",status,
  seated:true,hatchOpen:false,landingSite:pad});
}
test("cannon fires a visible bolt with cooldown and capacitor consumption",()=>{
 const v=ship("cruise");
 const before=v.mission.energy;
 const first=v.fireWeapon();
 assert.equal(first.ok,true);assert.equal(v.mission.shots.length,1);
 assert.ok(v.mission.energy<before);assert.equal(v.fireWeapon().ok,false);
 const pos=v.mission.shots[0].z;v.tick(.1);assert.ok(v.mission.shots[0].z<pos);
 for(let i=0;i<55;i++)v.tick(.1);
 assert.equal(v.mission.shots.length,0);
 assert.equal(v.fireWeapon().ok,true);
});
test("gun is locked when docked or standing",()=>{
 const v=ship("landed");assert.equal(v.fireWeapon().ok,false);
 const f=ship("cruise");f.seated=false;
 assert.equal(f.fireWeapon().ok,false);
});
test("cargo drop requires a safe planet landing site and deducts inventory exactly once",()=>{
 const v=ship("entry"),bag={wood:14,stone:4};
 assert.equal(v.dropCargo(bag,"wood",5).ok,true);
 assert.deepEqual(bag,{wood:9,stone:4});
 assert.equal(v.mission.drops.length,1);
 assert.equal(v.dropCargo(bag,"wood",10).ok,false);
 assert.equal(v.dropCargo(bag,"__proto__",1).ok,false);
 assert.equal(v.dropCargo(bag,"wood",1.5).ok,false);
 assert.equal(v.dropCargo(bag,"wood",0).ok,false);
 assert.equal(v.dropCargo(bag,"wood",101).ok,false);
 assert.equal(v.mission.drops.length,1);assert.equal(bag.wood,9);
 const noSite=ship("entry");noSite.landingSite=null;
 assert.equal(noSite.dropCargo(bag,"wood",1).ok,false);
});
test("cargo pods fall and survive save/restore across the surface-to-surface flight",()=>{
 const v=ship("entry"),bag={stone:6};v.dropCargo(bag,"stone",2);
 const height=v.mission.drops[0].height;
 v.tick(.1);assert.ok(v.mission.drops[0].height<height);
 const copy=ShipJourney.fromSnapshot(v.snapshot());
 assert.ok(copy);assert.equal(copy.mission.drops.length,1);
 assert.equal(copy.mission.drops[0].resource,"stone");
 assert.equal(copy.mission.drops[0].quantity,2);
});
test("dropped resources are recoverable only near the correct planet and only once",()=>{
 const v=ship("landed"),bag={ironOre:7};
 assert.equal(v.dropCargo(bag,"ironOre",3).ok,true);
 const depot=new ShipCargoCaches();
 assert.equal(depot.storeDrops(v.mission.drops,"terra"),0);
 assert.equal(depot.storeDrops(v.mission.drops,"cinder"),1);
 assert.equal(depot.storeDrops(v.mission.drops,"cinder"),0);
 const person={lat:pad.lat+.00002,lon:pad.lon};
 assert.ok(distanceOnPlanet(person,pad,3389000)<25);
 assert.equal(depot.near(person,"terra",3389000).length,0);
 assert.equal(depot.near(person,"cinder",3389000).length,1);
 assert.equal(depot.recover(person,"cinder",3389000,bag).ok,true);
 assert.equal(bag.ironOre,7);
 assert.equal(depot.recover(person,"cinder",3389000,bag).ok,false);
 assert.equal(bag.ironOre,7);
});
test("planet-local cargo caches serialize independently of ship inventory",()=>{
 const v=ship("entry"),bag={metal:8};
 v.dropCargo(bag,"metal",4);
 const d=new ShipCargoCaches();d.storeDrops(v.mission.drops,"cinder");
 const restored=new ShipCargoCaches(d.snapshot());
 assert.equal(restored.near({lat:pad.lat,lon:pad.lon},"cinder",3389000).length,1);
 assert.equal(restored.near({lat:pad.lat,lon:pad.lon},"nix",2600000).length,0);
 assert.equal(bag.metal,4);
});
test("old orbital saves load cleanly with new mission state",()=>{
 const v=new SpaceVoyage({originId:"terra",destinationId:"nix",status:"cruise"});
 assert.equal(v.fireWeapon().ok,true);
 const loaded=SpaceVoyage.fromSnapshot(v.snapshot());
 assert.ok(loaded);assert.equal(loaded.mission.shots.length,1);
 const old=v.snapshot();delete old.mission;
 const oldLoaded=SpaceVoyage.fromSnapshot(old);assert.ok(oldLoaded);
 assert.equal(oldLoaded.mission.energy,100);
});
