import test from "node:test";
import assert from "node:assert/strict";
import {XR_HOTAS,XR_HOTAS_TRAVEL_M,VRShipHotas,xrShipLocalPoint,xrShipLiftAxis} from "./ship-hotas-vr.mjs";

const pose=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const stage=pose(0,0,0);
const voyage=()=>({
 active:true,seated:true,throttle:0,autopilot:true,inWarp:false,
 attitudeYawDeg:0,pitchDeg:0,
 setThrottle(n){this.throttle=n;},
 setAutopilot(b){this.autopilot=b;},
 steer(n){this.attitudeYawDeg+=n;},
 pitch(n){this.pitchDeg+=n;}
});
test("Quest grips latch only near the actual seated left/right HOTAS knobs",()=>{
 const hotas=new VRShipHotas(),v=voyage();
 assert.equal(hotas.grab("left",pose(4,1,0),stage,v),false);
 assert.equal(hotas.grab("left",null,stage,v),false);
 assert.equal(hotas.grab("left",pose(...Object.values(XR_HOTAS.left)),stage,{seated:false}),false);
 assert.equal(hotas.grab("left",pose(...Object.values(XR_HOTAS.left)),stage,v),true);
 assert.equal(hotas.isHeld("left"),true);
 hotas.release("left");
 assert.equal(hotas.isHeld("left"),false);
});
test("Left grip follows a physical rail: pull back adds thrust and push forward reverses",()=>{
 const h=new VRShipHotas(),v=voyage(),b=XR_HOTAS.left;
 assert.ok(h.grab("left",pose(b.x,b.y,b.z),stage,v));
 const state=h.update({left:pose(b.x,b.y,b.z+XR_HOTAS_TRAVEL_M)},stage,.05,v);
 assert.equal(v.throttle,1);
 assert.equal(state.leverTravel,XR_HOTAS_TRAVEL_M);
 assert.equal(v.autopilot,false);
 h.release("left");
 h.update({},stage,.05,v);
 assert.equal(v.throttle,1);
 assert.ok(h.grab("left",pose(b.x,b.y,b.z+XR_HOTAS_TRAVEL_M),stage,v));
 h.update({left:pose(b.x,b.y,b.z-XR_HOTAS_TRAVEL_M)},stage,.05,v);
 assert.equal(v.throttle,-1);
});
test("Right grip provides proportional pitch and heading and springs back",()=>{
 const h=new VRShipHotas(),v=voyage(),b=XR_HOTAS.right;
 assert.ok(h.grab("right",pose(b.x,b.y,b.z),stage,v));
 const state=h.update({right:pose(b.x+.18,b.y,b.z+.18)},stage,.05,v);
 assert.ok(state.yaw>.999);
 assert.ok(state.pitch>.999);
 assert.ok(v.attitudeYawDeg>0);
 assert.ok(v.pitchDeg>0);
 h.release("right");
 assert.equal(h.snapshot().yaw,0);
 assert.equal(h.snapshot().pitch,0);
});
test("Untracked controller fails closed without moving the ship",()=>{
 const h=new VRShipHotas(),v=voyage(),b=XR_HOTAS.right;
 h.grab("right",pose(b.x,b.y,b.z),stage,v);
 h.update({right:null},stage,.05,v);
 assert.equal(h.isHeld("right"),false);
 assert.equal(v.attitudeYawDeg,0);
});
test("Stage-space positions correctly invert ship origin translation and yaw",()=>{
 const rotated=[0,0,-1,0,0,1,0,0,1,0,0,0,2,0,3,1];
 const local={x:.42,y:1.08,z:-11.47};
 const world=pose(2+local.z,local.y,3-local.x);
 const out=xrShipLocalPoint(world,rotated);
 assert.ok(Math.abs(out.x-local.x)<1e-8);
 assert.ok(Math.abs(out.y-local.y)<1e-8);
 assert.ok(Math.abs(out.z-local.z)<1e-8);
});

test("VR pitch: pushing right stick forward lowers the nose",()=>{
 const h=new VRShipHotas(),v=voyage(),b=XR_HOTAS.right;
 assert.ok(h.grab("right",pose(b.x,b.y,b.z),stage,v));
 h.update({right:pose(b.x,b.y,b.z-.18)},stage,.05,v);
 assert.ok(v.pitchDeg<0);
});
test("VOL thumbstick up produces positive lift and down produces negative lift",()=>{
 assert.equal(xrShipLiftAxis({y:-1}),1);
 assert.equal(xrShipLiftAxis({y:1}),-1);
 assert.equal(xrShipLiftAxis({y:0}),0);
 assert.equal(xrShipLiftAxis(null),0);
});
