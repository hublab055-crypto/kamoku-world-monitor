import test from "node:test";
import assert from "node:assert/strict";
import {mobileJoystickMotion,wrapAngle} from "./mobile-joystick-direction.mjs";
import {defaultMobileUI,normalizeMobileUI} from "./mobile-hud-actions.mjs";
test("stick up walks camera-forward; right walks screen-right and avatar faces right",()=>{
 const forward=mobileJoystickMotion({stick:{x:0,y:-1},cameraYaw:0,actorYaw:0,dt:1/60});
 assert.equal(forward.forward,1);assert.equal(forward.strafe,0);
 const right=mobileJoystickMotion({stick:{x:1,y:0},cameraYaw:0,actorYaw:0,dt:1});
 assert.ok(Math.abs(wrapAngle(right.targetYaw-Math.PI/2))<1e-8);
 assert.ok(right.forward>.99);assert.ok(Math.abs(right.strafe)<1e-8);
});
test("diagonals normalize and turning is bounded; deadzone is stationary",()=>{
 const diagonal=mobileJoystickMotion({stick:{x:1,y:-1},cameraYaw:1,actorYaw:0,dt:.016});
 assert.ok(Math.hypot(diagonal.forward,diagonal.strafe)<=1.000001);
 assert.ok(Math.abs(diagonal.turn)<=9*.016+1e-8);
 assert.equal(mobileJoystickMotion({stick:{x:0.02,y:-0.03},cameraYaw:0,actorYaw:0,dt:.02}),null);
});
test("camera yaw offsets joystick direction without changing world walking semantics",()=>{
 const m=mobileJoystickMotion({stick:{x:0,y:-1},cameraYaw:Math.PI/2,actorYaw:Math.PI/2,dt:.01});
 assert.ok(Math.abs(wrapAngle(m.targetYaw-Math.PI/2))<1e-8);
 assert.ok(m.forward>.99);
});
test("custom buttons, missing settings, invalid values and extras sanitize",()=>{
 const a=normalizeMobileUI({buttons:[{tap:"shoot",hold:"guard"},{tap:"bad",hold:"invalid"}],
  extras:{vitals:true,evil:true},size:100,opacity:75});
 assert.deepEqual(a.buttons[0],{tap:"shoot",hold:"guard"});
 assert.deepEqual(a.buttons[1],defaultMobileUI().buttons[1]);
 assert.equal(a.extras.vitals,true);
 assert.equal(Object.hasOwn(a.extras,"evil"),false);
 assert.equal(a.size,56);assert.equal(a.opacity,75);
 assert.equal(normalizeMobileUI(null).buttons.length,4);
});
