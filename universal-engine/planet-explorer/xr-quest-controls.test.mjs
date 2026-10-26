import test from "node:test";
import assert from "node:assert/strict";
import {xrStick,xrVRMovement,xrVRActorYaw} from "./xr-quest-controls.mjs";
import {xrStage} from "./xr-spatial.mjs";

const source=(handedness,x=0,y=0,mapping="xr-standard")=>({
 handedness,gamepad:{mapping,axes:[0,0,x,y],buttons:[]}
});
const inputs=(x=0,y=0)=>xrVRMovement([source("left",x,y)]);
const toView=(movement,yaw=0)=>{
 // Physics is shared between controller.mjs and custody-facility.mjs.
 const dx=Math.sin(yaw)*movement.forward+Math.cos(yaw)*movement.strafe;
 const dz=Math.cos(yaw)*movement.forward-Math.sin(yaw)*movement.strafe;
 const stage=xrStage({mode:"vr",anchor:{heading:0,vrFloor:[0,0,0]},actorYaw:yaw});
 return {x:stage[0]*dx+stage[8]*dz,z:stage[2]*dx+stage[10]*dz};
};

test("Quest left stick right moves to headset right, not left",()=>{
 const m=inputs(1,0);
 assert.equal(m.strafe,-1);
 const view=toView(m);
 assert.ok(view.x>0.99);
 assert.ok(Math.abs(view.z)<1e-8);
});
test("Quest left stick left moves to headset left",()=>{
 const m=inputs(-1,0);
 assert.equal(m.strafe,1);
 assert.ok(toView(m).x<-.99);
});
test("Quest up walks forward and down walks backward",()=>{
 assert.equal(inputs(0,-1).forward,1);
 assert.ok(toView(inputs(0,-1)).z<-.99);
 assert.equal(inputs(0,1).forward,-1);
 assert.ok(toView(inputs(0,1)).z>.99);
});
test("headset relative motion stays correct after right stick turns avatar",()=>{
 for(const yaw of [Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI]){
  assert.ok(toView(inputs(1,0),yaw).x>.99);
  assert.ok(toView(inputs(-1,0),yaw).x<-.99);
  assert.ok(toView(inputs(0,-1),yaw).z<-.99);
 }
});
test("Quest right stick still turns and rotates RTS table normally",()=>{
 const sources=[source("left",1,-1),source("right",1,0)];
 const vr=xrVRMovement(sources);
 assert.equal(vr.forward,1);assert.equal(vr.strafe,-1);
 assert.equal(vr.turn,1);assert.equal(vr.tableTurn,0);
 const rts=xrVRMovement(sources,{rts:true});
 assert.equal(rts.strafe,0);assert.equal(rts.forward,0);
 assert.equal(rts.turn,0);assert.equal(rts.tableTurn,1);
});
test("Quest standard and legacy axis pairs have matching directions",()=>{
 const standard=source("left",1,-1);
 const legacy={handedness:"left",gamepad:{mapping:"xr-standard",axes:[1,-1],buttons:[]}};
 assert.deepEqual(xrStick(standard.gamepad),{x:1,y:-1});
 assert.deepEqual(xrVRMovement([legacy]),xrVRMovement([standard]));
 assert.equal(inputs(.1,.1).strafe,0);
});
test("custody VR stage follows inmate's local yaw, not outdoor yaw",()=>{
 const renderer={custodyFacility:{player:{yaw:Math.PI/2}},custodyCell:{yaw:0}};
 assert.equal(xrVRActorYaw(renderer,{yaw:-1}),Math.PI/2);
 assert.ok(toView(inputs(1,0),xrVRActorYaw(renderer,{yaw:-1})).x>.99);
 renderer.custodyFacility.player.yaw=0;
 assert.equal(xrVRActorYaw(renderer,{yaw:-1}),0);
});
test("non-custody interiors retain previous heading priority",()=>{
 assert.equal(xrVRActorYaw({custodyCell:{yaw:0},trainInterior:{pose:{yaw:2}}},{yaw:4}),0);
 assert.equal(xrVRActorYaw({trainInterior:{pose:{yaw:2}},townInterior:{pose:{yaw:3}}},{yaw:4}),2);
 assert.equal(xrVRActorYaw({townInterior:{pose:{yaw:3}}},{yaw:4}),3);
 assert.equal(xrVRActorYaw({ferry:{boarded:true,pose:{yaw:5}}},{yaw:4}),5);
 assert.equal(xrVRActorYaw({}, {yaw:4}),4);
});
