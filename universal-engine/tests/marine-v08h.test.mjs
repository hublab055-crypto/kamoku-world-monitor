import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {BOATS,MarineWorld,resolveLanding,waveHeight,oceanWavePatch,fishAt} from "../planet-explorer/marine.mjs";
import {terrainSurface} from "../planet-explorer/geo.mjs";

// Synthetic coastline at longitude zero: stable and cheap regression fixture.
function coast(){
 const planet={seed:77,radiusM:6371000,gravity:9.8};
 return {planet,sample(lat,lon){
  const water=lon>0;
  return {water,river:false,elevationM:water?0:150,category:water?"ocean":"plain"};
 }};
}
function actor(terrain=coast(),startLon=-.00006){
 const controller=new ExplorerController(terrain,{startLat:0,startLon});
 controller.altitudeM=2.5;controller.targetAltitudeM=2.5;
 return controller;
}
test("land-selected orbit descent cannot silently place the avatar in water",()=>{
 const terrain=coast();
 const sea=resolveLanding(terrain,0,.005,"land");
 assert.equal(sea.ok,true);
 assert.equal(terrainSurface(terrain,sea.lat,sea.lon).water,false);
 assert.ok(sea.movedM>0);
 const land=resolveLanding(terrain,0,-.005,"land");
 assert.equal(land.ok,true);
 assert.equal(land.movedM,0);
 const openSea=resolveLanding(terrain,0,.01,"sea");
 assert.equal(openSea.ok,true);
 assert.equal(openSea.mode,"sea");
 assert.equal(resolveLanding(terrain,0,-.01,"sea").ok,false);
 assert.equal(resolveLanding(terrain,95,0,"land").ok,false);
});
test("open ocean without nearby shore refuses dry landing, does not teleport",()=>{
 const t={planet:{seed:77,radiusM:6371000},sample:()=>({
  water:true,river:false,elevationM:0,category:"ocean"})};
 const chosen=resolveLanding(t,0,0,"land");
 assert.equal(chosen.ok,false);
});
test("sailors can swim through ocean and are prevented from taking a boat on land",()=>{
 const terrain=coast(),c=actor(terrain);
 c.setLanding(0,.01,{allowWater:true});c.yaw=Math.PI/2;
 c.update(.1,{forward:1});
 assert.equal(c.travelMode,"swim");
 assert.ok(c.x>.1);
 const x=c.x;
 c.travelMode="boat";c.update(.1,{forward:1});
 assert.ok(c.x>x);
 c.setLanding(0,-.01);
 assert.equal(c.travelMode,"walk");
 assert.throws(()=>c.setLanding(0,.01),/陸地/);
});
test("boat crafting requires shore and resources; boarding, steering, landing and save work",()=>{
 const terrain=coast(),c=actor(terrain),m=new MarineWorld();
 const notEnough={wood:2,fiber:3};
 assert.equal(m.craft("raft",c,terrain,notEnough).ok,false);
 assert.deepEqual(notEnough,{wood:2,fiber:3});
 const resources={wood:30,fiber:20};
 const built=m.craft("raft",c,terrain,resources);
 assert.equal(built.ok,true,built.message);
 assert.equal(resources.wood,30-BOATS.raft.cost.wood);
 assert.equal(resources.fiber,20-BOATS.raft.cost.fiber);
 assert.equal(m.boats.length,1);
 assert.equal(m.board(c,terrain).ok,true);
 assert.equal(m.update(.1,c,terrain),"boat");
 assert.equal(c.travelMode,"boat");
 const left=m.leave(c,terrain);
 assert.equal(left.ok,true,left.message);
 assert.equal(c.travelMode,"walk");
 const restored=new MarineWorld(m.snapshot());
 assert.equal(restored.boats.length,1);
 assert.equal(restored.boats[0].kind,"raft");
});
test("diving consumes air and surfaces when oxygen runs out",()=>{
 const terrain=coast(),c=actor(terrain),m=new MarineWorld();
 c.setLanding(0,.02,{allowWater:true});
 assert.equal(m.dive(c,terrain).ok,true);
 m.update(2,c,terrain);
 assert.equal(c.travelMode,"dive");
 assert.ok(m.depthM>0);
 assert.ok(m.oxygen<100);
 m.update(30,c,terrain);
 assert.equal(m.diving,false);
 assert.equal(m.oxygen,0);
 m.update(2,c,terrain);
 assert.ok(m.oxygen>0);
});
test("sea waves and fish use compact finite procedural geometry",()=>{
 const terrain=coast();
 assert.notEqual(waveHeight(14,3,0),waveHeight(14,3,4));
 const mesh=oceanWavePatch(terrain,{lat:0,lon:.02},0,0,4,{radius:90,cells:18});
 assert.ok(mesh.indices.length>0);
 assert.equal(mesh.positions.length,mesh.normals.length);
 assert.equal(mesh.positions.length,mesh.colors.length);
 assert.ok(mesh.indices.every(i=>i>=0&&i<mesh.positions.length/3));
 assert.ok(mesh.positions.every(Number.isFinite));
 const fish=fishAt(77,0,0,0);
 assert.equal(fish.length,11);
 assert.ok(fish.every(f=>f.depthM>0&&Number.isFinite(f.x)));
});
test("HTML controls, code imports and save format have marine integration",()=>{
 const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 const render=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");
 for(const id of ["landing-water-mode","marine-toggle","marine-panel","marine-craft",
  "marine-board","marine-leave","marine-dive","marine-oxygen"])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/resolveLanding\(/);
 assert.match(app,/marine\.snapshot\(\)/);
 assert.match(app,/farm\.snapshot\(\)/);
 assert.match(render,/drawMarineSurface/);
 assert.match(render,/drawMarineWildlife/);
});
