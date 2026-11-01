import {test} from "node:test";
import assert from "node:assert/strict";
import {hallWorldPoint,hallLocalPoint,syncHallActorWorld,isSharedHallRoom} from "./music-hall-world.mjs";
import {musicHallInteriorGeometry} from "./music-hall-geometry.mjs";
import {musicHallShellGeometry,musicHallRoofGeometry} from "./scenery-geometry.mjs";
import {settlementLayout} from "./settlements.mjs";
import {TownLife} from "./town-life.mjs";
import {hallDoor} from "./music-hall-portal.mjs";
const townId="capital",layout=settlementLayout(townId);
const index=layout.buildings.findIndex(s=>s.type==="theater"),site={...layout.buildings[index],id:"village-"+index};
const actor=()=>({x:0,z:site.z+10,yaw:0,nearGround:true,travelMode:"walk",
 origin:{lat:28,lon:42},lat:28,lon:42,moving:false,blocked:false,
 locationAt(x,z){return {lat:this.origin.lat+z/100000,lon:this.origin.lon+x/100000}},
 clearMoveTarget(){}});
test("local hall coordinates match settlement metres, also with arbitrary yaw",()=>{
 const rotated={type:"theater",x:170,z:-86,angle:Math.PI/4};
 const original={x:1.25,z:-3.9,yaw:.7};
 const p=hallWorldPoint(rotated,original),r=hallLocalPoint(rotated,p);
 assert.ok(Math.abs(r.x-original.x)<1e-9);
 assert.ok(Math.abs(r.z-original.z)<1e-9);
 assert.ok(Math.abs(r.yaw-original.yaw)<1e-9);
 assert.deepEqual(hallWorldPoint(site,{x:0,z:0,yaw:0}),{x:site.x,z:site.z,yaw:0});
});
test("walking through a hall door does not snap x or z and keeps planet origin",()=>{
 const a=actor(),town=new TownLife(),door=hallDoor(site);
 a.x=.35;a.z=door.z+.45;a.lat=a.locationAt(a.x,a.z).lat;a.lon=a.locationAt(a.x,a.z).lon;
 assert.equal(town.toggleHallDoor(townId,site.id,a).ok,true);
 const previous={x:a.x,z:a.z};a.z=door.front+.18;
 const result=town.hallStep(townId,previous,a);
 assert.equal(result.entered,true);
 const oldOrigin={...a.origin},before={x:a.x,z:a.z};
 assert.equal(syncHallActorWorld(town,a),true);
 assert.ok(Math.abs(a.x-before.x)<1e-8);
 assert.ok(Math.abs(a.z-before.z)<1e-8);
 assert.deepEqual(a.origin,oldOrigin);
 assert.equal(a.lat,oldOrigin.lat+a.z/100000);
});
test("room walking updates same planetary world avatar coordinates",()=>{
 const t=new TownLife(),a=actor();
 a.x=site.x;a.z=hallDoor(site).z;
 assert.equal(t.toggleHallDoor(townId,site.id,a).ok,true);
 assert.equal(t.enter(townId,site.id,a).ok,true);
 assert.equal(syncHallActorWorld(t,a),true);
 const z=a.z;
 assert.equal(t.walk(.1,{forward:-1}),true);
 assert.equal(syncHallActorWorld(t,a),true);
 assert.ok(a.z<z);
 assert.ok(a.moving);
 assert.equal(a.lat,28+a.z/100000);
});
test("only purpose-built music halls share the outdoor WebGL frame",()=>{
 assert.equal(isSharedHallRoom({type:"theater"}),true);
 assert.equal(isSharedHallRoom({type:"school"}),true);
 assert.equal(isSharedHallRoom({type:"lodge"}),false);
 assert.equal(isSharedHallRoom(null),false);
});
test("world furniture mesh is different from full-room cutaway",()=>{
 for(const type of ["theater","school"]){
  const full=musicHallInteriorGeometry(type),world=musicHallInteriorGeometry(type,{furnishingsOnly:true});
  assert.ok(world.indices.length>0);
  assert.ok(world.indices.length<full.indices.length);
  assert.equal(world.colors.length,world.positions.length);
  assert.ok(world.indices.every(i=>i<world.positions.length/3));
 }
});
test("building shell and detachable roof are separate valid world meshes",()=>{
 for(const type of ["theater","school"]){
  const b={type,localX:15,localZ:-10,elevationM:220};
  const shell=musicHallShellGeometry(b),roof=musicHallRoofGeometry(b);
  assert.ok(shell.indices.length>0&&roof.indices.length>0);
  assert.ok(shell.indices.every(i=>i<shell.positions.length/3));
  assert.ok(roof.indices.every(i=>i<roof.positions.length/3));
  assert.ok(shell.positions.length+roof.positions.length>shell.positions.length);
 }
});
