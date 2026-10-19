import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ArrowProjectiles,ARROW_RECOVERY_SECONDS} from "../planet-explorer/arrow-projectiles.mjs";
import {MarineWorld,BOATS,resolveLanding} from "../planet-explorer/marine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {sailingShipGeometry} from "../planet-explorer/sailing-ship-geometry.mjs";
import {terrainSurface} from "../planet-explorer/geo.mjs";

function coast(){
 const planet={seed:77,radiusM:6371000,gravity:9.8};
 return {planet,sample(lat,lon){
  const water=lon>0;
  return {water,river:false,elevationM:water?0:150,category:water?"ocean":"plain"};
 }};
}
function actor(terrain=coast()){
 const c=new ExplorerController(terrain,{startLat:0,startLon:-.01});
 c.altitudeM=2.5;c.targetAltitudeM=2.5;return c;
}
test("arrows embed, remain pickable for 90 simulation seconds then disappear",()=>{
 const arrows=new ArrowProjectiles(),shot=arrows.launch({shooterId:"player",actor:{x:0,z:0,yaw:0},groundY:0});
 assert.ok(shot);
 let impact=null;
 for(let i=0;i<130;i++){
  arrows.advance(.1,{groundHeight:()=>0});
  if(arrows.embedded.length){impact=arrows.embedded[0];break;}
 }
 assert.ok(impact,"a ground impact must create one recoverable arrow");
 assert.equal(impact.recoverLeft,ARROW_RECOVERY_SECONDS);
 arrows.advance(40,{groundHeight:()=>0});
 assert.ok(Math.abs(arrows.embedded[0].recoverLeft-50)<.01);
 arrows.advance(0,{groundHeight:()=>0});
 assert.ok(arrows.embedded.length===1);
 arrows.advance(49.8,{groundHeight:()=>0});
 assert.ok(arrows.embedded.length===1);
 arrows.advance(.25,{groundHeight:()=>0});
 assert.equal(arrows.embedded.length,0);
 assert.equal(arrows.recover(impact.id),null);
});
test("recoverable arrow TTL survives saves and old saves are given a finite lifespan",()=>{
 const p=new ArrowProjectiles();
 p.embedded=[{id:12,x:0,y:0,z:0,dx:0,dy:0,dz:1,
  surface:"ground",ownerId:"player",arrowType:"iron",recoverLeft:7.5}];
 const restored=new ArrowProjectiles(JSON.parse(JSON.stringify(p.snapshot())));
 assert.equal(restored.embedded[0].recoverLeft,7.5);
 assert.equal(restored.recover(12).arrowType,"iron");
 assert.equal(restored.recover(12),null);
 const legacy=new ArrowProjectiles({...p.snapshot(),embedded:[{
  id:22,x:1,y:0,z:2,dx:0,dy:0,dz:1,surface:"ground"
 }]});
 assert.equal(legacy.embedded[0].recoverLeft,ARROW_RECOVERY_SECONDS);
 const expired=new ArrowProjectiles({...p.snapshot(),embedded:[{
  id:23,x:1,y:0,z:2,dx:0,dy:0,dz:1,recoverLeft:0
 }]});
 assert.equal(expired.embedded.length,0);
});
test("sea-descent offers water-surface and medium ship choices but no land ship",()=>{
 const t=coast();
 assert.equal(resolveLanding(t,0,.03,"sea").mode,"sea");
 assert.equal(resolveLanding(t,0,.03,"sea-ship").mode,"sea-ship");
 assert.equal(resolveLanding(t,0,-.03,"sea-ship").ok,false);
 assert.ok(BOATS.sailing_ship.speed>BOATS.canoe.speed);
 assert.equal(BOATS.sailing_ship.deckY,1.65);
});
test("landing on ship is free scenario spawn, retains ocean position and enables controls",()=>{
 const t=coast(),c=actor(t),m=new MarineWorld();
 c.setLanding(0,.04,{allowWater:true});c.yaw=.45;
 const r=m.spawnLandingShip(c,t);
 assert.equal(r.ok,true,r.message);
 assert.equal(m.boats.length,1);
 assert.equal(m.boardedId,r.boat.id);
 assert.equal(c.travelMode,"boat");
 assert.equal(r.boat.kind,"sailing_ship");
 assert.equal(m.spawnLandingShip(c,t).ok,false,"cannot spawn repeatedly while boarded");
 assert.equal(m.setSails(.75).ok,true);
 assert.equal(m.boarded.sailTrim,.75);
 assert.equal(m.setCruise(true).ok,true);
 assert.equal(m.boarded.cruise,true);
 assert.equal(m.steer(Math.PI/15,c).ok,true);
 assert.ok(Math.abs(c.yaw-(.45+Math.PI/15))<.01);
 c.boatSpeed=m.sailingSpeed();
 const z=c.z,x=c.x;c.update(.1,{forward:1});
 m.update(.1,c,t);
 assert.ok(Math.hypot(c.x-x,c.z-z)>.2);
 assert.ok(Math.abs(m.boarded.lat-c.lat)<.001);
 const p=m.snapshot();
 const restored=new MarineWorld(p);
 assert.equal(restored.boarded.sailTrim,.75);
 assert.equal(restored.boarded.cruise,true);
 assert.equal(restored.boarded.yaw,m.boarded.yaw);
});
test("the ship can drop anchor, adjust sail, and steer while under way",()=>{
 const t=coast(),c=actor(t),m=new MarineWorld();
 c.setLanding(0,.04,{allowWater:true});assert.ok(m.spawnLandingShip(c,t).ok);
 assert.equal(m.setSails(1.2).ok,false);
 assert.equal(m.setSails(.5).ok,true);
 assert.equal(m.sailingSpeed(),BOATS.sailing_ship.speed*.5);
 assert.equal(m.setCruise(true).ok,true);
 assert.equal(m.setAnchor(true).ok,true);
 assert.equal(m.boarded.cruise,false);
 assert.equal(m.sailingSpeed(),0);
 assert.equal(m.setCruise(true).ok,false);
 assert.equal(m.setAnchor(false).ok,true);
 assert.equal(m.setSails(0).ok,true);
 assert.equal(m.setCruise(true).ok,false);
 assert.equal(m.setSails(.6).ok,true);
 assert.equal(m.setCruise(true).ok,true);
});
test("mid-voyage disembarking to the ocean keeps cruising ship; it can be reboarded",()=>{
 const t=coast(),c=actor(t),m=new MarineWorld();
 c.setLanding(0,.03,{allowWater:true});
 assert.ok(m.spawnLandingShip(c,t).ok);
 assert.ok(m.setSails(1).ok);assert.ok(m.setCruise(true).ok);
 const id=m.boardedId,before={lat:m.boarded.lat,lon:m.boarded.lon};
 assert.equal(m.leave(c,t).ok,true);
 assert.equal(c.travelMode,"swim");
 assert.equal(m.boardedId,null);
 m.update(.25,c,t);
 assert.ok(m.boats.some(b=>b.id===id&&b.cruise));
 assert.notDeepEqual({lat:m.boats[0].lat,lon:m.boats[0].lon},before);
 const boarded=m.board(c,t);
 assert.equal(boarded.ok,true,boarded.message);
 assert.equal(m.boardedId,id);
});
test("ocean ship model is visibly more detailed than canoe, and all reefing meshes are valid",()=>{
 const models=[sailingShipGeometry(0),sailingShipGeometry(.5),sailingShipGeometry(1)];
 for(const mesh of models){
  assert.ok(mesh.positions.length>1000);
  assert.equal(mesh.positions.length,mesh.normals.length);
  assert.equal(mesh.positions.length,mesh.colors.length);
  assert.ok(mesh.indices.every(i=>i>=0&&i<mesh.positions.length/3));
  assert.ok(mesh.positions.every(Number.isFinite));
  assert.ok(mesh.positions.length/3<65000);
 }
 assert.notDeepEqual(models[0].positions,models[2].positions);
});
test("published app and UI expose working ship controls and arrow recovery expiry",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 const app=readFileSync(new URL("app.mjs",base),"utf8");
 const html=readFileSync(new URL("index.html",base),"utf8");
 const render=readFileSync(new URL("render.mjs",base),"utf8");
 for(const id of ["landing-water-mode","marine-sail-controls","marine-sail-trim","marine-sail-value",
  "marine-helm-status","marine-cruise","marine-anchor","marine-steer-left","marine-steer-right",
  "marine-leave","marine-board"])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/option value="sea-ship"/);
 assert.match(html,/option value="sailing_ship"/);
 assert.match(app,/marine\.spawnLandingShip\(controller,terrain\)/);
 assert.match(app,/marine\.setCruise/);
 assert.match(app,/marine\.setSails/);
 assert.match(app,/marine\.steer/);
 assert.match(render,/sailingShipGeometry/);
 assert.match(render,/this\.sailingShipMeshes/);
 assert.match(render,/s\.travelMode==="boat"\?waterY\+/);
 assert.match(app,/ARROW_RECOVERY_SECONDS/);
});
