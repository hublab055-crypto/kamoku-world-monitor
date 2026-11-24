import test from "node:test";
import assert from "node:assert/strict";
import {groundRayHit,stageGroundToWorld,validBoundary,boundaryContains,boundaryPathClear,safeMoveTarget} from "./xr-navigation.mjs";
import {MRRoomLayout} from "./mr-room-layout.mjs";
import {MRAvatarPresence} from "./mr-avatar-presence.mjs";
import {xrIdentity,xrRotateY,xrMul,xrTranslate} from "./xr-spatial.mjs";
const head=[1,0,0,0,0,1,0,0,0,0,1,0,0,1.65,0,1];
const square=[{x:-2,z:-2},{x:2,z:-2},{x:2,z:2},{x:-2,z:2}];
test("ground ray accepts downward rays, rejects horizontal and upward rays",()=>{
 const ray=xrIdentity();ray[13]=1.7;ray[9]=.8;ray[10]=.6;
 const p=groundRayHit(ray,0);
 assert.ok(p&&p.distanceM>0);
 assert.equal(p.y,0);
 assert.equal(groundRayHit(xrIdentity(),0),null);
 assert.equal(groundRayHit(null,0),null);
});
test("VR floor hit follows the same stage matrix as renderer",()=>{
 const stage=xrMul(xrTranslate(2,0,-3),xrRotateY(Math.PI/2));
 const p={x:3,z:-4},cmd=stageGroundToWorld(p,stage,{x:50,z:100});
 assert.ok(Math.abs(cmd.x-51)<1e-8);assert.ok(Math.abs(cmd.z-101)<1e-8);
});
test("polygon rejects crossed and tiny boundaries",()=>{
 assert.equal(validBoundary(square),true);
 assert.equal(validBoundary([{x:0,z:0},{x:1,z:1},{x:0,z:1},{x:1,z:0}]),false);
 assert.equal(validBoundary([{x:0,z:0},{x:.01,z:0},{x:0,z:.01}]),false);
 assert.equal(boundaryContains(square,{x:0,z:0}),true);
 assert.equal(boundaryContains(square,{x:1.9,z:0}),false);
 assert.equal(boundaryContains(square,{x:3,z:0}),false);
});
test("concave perimeter cannot be exited by shortcut through notch",()=>{
 const concave=[{x:0,z:0},{x:4,z:0},{x:4,z:4},{x:3,z:4},{x:3,z:1},{x:1,z:1},{x:1,z:4},{x:0,z:4}];
 assert.equal(validBoundary(concave),true);
 assert.equal(boundaryContains(concave,{x:.5,z:3}),true);
 assert.equal(boundaryContains(concave,{x:3.5,z:3}),true);
 assert.equal(boundaryPathClear(concave,{x:.5,z:3},{x:3.5,z:3}),false);
});
test("MR room persists boundary relative to anchored origin",()=>{
 const room=new MRRoomLayout({version:1,width:8,depth:8});room.setOrigin(5,3,.3);
 const vertices=square.map(p=>room.world(p));
 assert.equal(room.setNavigationBoundary(vertices),true);
 const saved=new MRRoomLayout(room.snapshot());
 assert.equal(saved.ready,false);saved.setOrigin(9,-4,.5);
 assert.equal(saved.navigationBoundary.length,4);
 const centre=saved.world({x:0,z:0});
 assert.equal(boundaryContains(saved.worldBoundary(),centre),true);
});
test("NPC requires boundary and does not walk through obstacles",()=>{
 const room=new MRRoomLayout({version:1,width:8,depth:8});room.setOrigin(0,0);
 const actors=new MRAvatarPresence();actors.place("navigator",head);
 assert.equal(actors.action("navigator","move",{room,point:{x:1,z:-2}}).ok,false);
 room.setNavigationBoundary(square);
 assert.equal(actors.action("navigator","move",{room,point:{x:3,z:-1}}).ok,false);
 const start=actors.get("navigator");start.z=-1.2;
 assert.equal(safeMoveTarget(room,start,{x:0,z:-1}).ok,true);
 assert.equal(actors.action("navigator","move",{room,point:{x:0,z:-1}}).ok,true);
 for(let i=0;i<60;i++){
  actors.tick(head,.05,room);
  assert.equal(boundaryContains(room.worldBoundary(),actors.get("navigator"),.20),true);
 }
 room.add("table",{x:1,z:-1.5},{width:.8,depth:.8});
 assert.equal(actors.action("navigator","move",{room,point:{x:1,z:-1.5}}).ok,false);
});
