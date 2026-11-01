import {test} from "node:test";
import assert from "node:assert/strict";
import {MUSIC_HALL_SITES,hallRoom,hallSeats,nearestHallSeat,hallOccupancy} from "./music-hall.mjs";
import {settlementLayout} from "./settlements.mjs";
import {TownLife} from "./town-life.mjs";
import {MusicCulture,musicVenue} from "./music-culture.mjs";
import {musicHallInteriorGeometry} from "./music-hall-geometry.mjs";
import {musicStageHandHit} from "./music-world.mjs";

test("all existing town layouts append music venues without moving old buildings",()=>{
 for(const town of ["capital","port","tower","mountain","meadow","forest"]){
  const buildings=settlementLayout(town).buildings;
  assert.deepEqual(buildings.slice(-2).map(x=>x.type),["theater","school"]);
  assert.deepEqual(buildings.slice(-2).map(x=>[x.x,x.z]),MUSIC_HALL_SITES.map(x=>[x.x,x.z]));
  assert.ok(buildings.some(x=>x.type==="market"));
 }
});
test("culture venues use the same actual outdoor building coordinates",()=>{
 const c=new MusicCulture();
 for(const type of ["theater","school"]){
  const venue=c.venue("capital",type);
  const physical=settlementLayout("capital").buildings.find(s=>s.type===type);
  assert.deepEqual(venue.site,{x:physical.x,z:physical.z});
 }
});
test("theater and school layouts create ordered seating and open central aisles",()=>{
 assert.equal(hallSeats("theater").length,16);
 assert.equal(hallSeats("school").length,9);
 assert.ok(hallSeats("theater").every(s=>Math.abs(s.x)>2));
 assert.ok(hallOccupancy("theater",99).length===16);
 assert.equal(nearestHallSeat("theater",{x:0,z:4.15}),null);
 assert.equal(nearestHallSeat("theater",{x:3.4,z:4.15})?.x,3.4);
});
test("town interior theater supports walking, sitting, standing and leaving",()=>{
 const town=new TownLife(),layout=town.layout("capital");
 const i=layout.buildings.findIndex(b=>b.type==="theater"),site=layout.buildings[i];
 const controller={x:site.x,z:site.z,nearGround:true,travelMode:"walk",clearMoveTarget(){}};
 assert.equal(town.enter("capital","village-"+i,controller).ok,true);
 assert.equal(town.inside.pose.z,hallRoom("theater").entranceZ);
 for(let n=0;n<16;n++)town.walk(.1,{forward:-1,strafe:1});
 assert.ok(town.inside.pose.x>2.5);
 town.inside.pose.x=3.4;town.inside.pose.z=4.15;
 assert.equal(town.sitMusicSeat().ok,true);
 assert.ok(town.inside.seat);
 const before={...town.inside.pose};
 assert.equal(town.walk(.1,{forward:1}),false);
 assert.deepEqual(town.inside.pose,before);
 assert.equal(town.standMusicSeat().ok,true);
 assert.equal(town.inside.seat,null);
 assert.equal(town.walk(.1,{forward:-1}),true);
 assert.equal(town.leave().ok,true);
 assert.equal(town.inside,null);
});
test("music classroom has a larger room and seat interactions, existing cabins remain unchanged",()=>{
 const town=new TownLife(),layout=town.layout("capital"),
  index=layout.buildings.findIndex(b=>b.type==="school"),site=layout.buildings[index];
 const actor={x:site.x,z:site.z,nearGround:true,travelMode:"walk"};
 assert.equal(town.enter("capital","village-"+index,actor).ok,true);
 assert.equal(town.inside.pose.z,5.2);
 town.inside.pose.x=0;town.inside.pose.z=3.2;
 assert.equal(town.sitMusicSeat().ok,true);
 town.leave();
 const cabin=layout.buildings.findIndex(b=>b.type==="cabin"),house=layout.buildings[cabin];
 actor.x=house.x;actor.z=house.z;
 assert.equal(town.enter("capital","village-"+cabin,actor).ok,true);
 assert.equal(town.inside.pose.z,2.4);
 assert.equal(town.sitMusicSeat().ok,false);
});
test("theater and classroom geometry have valid triangles and color vertex data",()=>{
 for(const kind of ["theater","school"]){
  const g=musicHallInteriorGeometry(kind);
  assert.ok(g.positions.length>1000);
  assert.equal(g.positions.length,g.normals.length);
  assert.equal(g.positions.length,g.colors.length);
  assert.ok(g.indices.every(i=>i>=0&&i<g.positions.length/3));
  assert.ok(g.colors.every(Number.isFinite));
 }
});
test("index fingertip position hits a narrow custom key while grip approximation misses",()=>{
 const m=[1,0,0,0,0,1,0,0,0,0,1,0,0,1.02,0,1],
  stage=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  controls=[{x:0,y:1,height:.02,z:0,width:.045,depth:.045,yaw:0,track:"keys",pitch:64}];
 assert.equal(musicStageHandHit(m,stage,[0,0,0],0,{controls,tipOffset:0,tolerance:.065})?.pitch,64);
 assert.equal(musicStageHandHit(m,stage,[0,0,0],0,{controls}),null);
 assert.equal(musicStageHandHit(null,stage,[0,0,0],0,{controls}),null);
});
