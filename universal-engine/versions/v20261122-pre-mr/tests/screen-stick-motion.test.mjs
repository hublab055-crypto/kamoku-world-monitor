import test from "node:test";
import assert from "node:assert/strict";
import {screenStickFacing,screenHeadingForStick,keepStickCameraHeading} from "../planet-explorer/screen-stick-motion.mjs";

const TAU=Math.PI*2;
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const worldVector=(yaw,{forward,strafe})=>({
 east:Math.sin(yaw)*forward+Math.cos(yaw)*strafe,
 north:Math.cos(yaw)*forward-Math.sin(yaw)*strafe
});
const within=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<tolerance,`expected ${a} ~= ${b}`);

test("physical screen-up moves toward the top of the camera, regardless of avatar facing",()=>{
 for(const cameraYaw of [0,Math.PI/4,Math.PI/2,Math.PI,-Math.PI/2]){
  for(const actorYaw of [-2.3,0,1.1,2.8]){
   const r=screenStickFacing({x:0,y:-1},actorYaw,cameraYaw,1/60);
   const movement=worldVector(actorYaw+r.turn,r);
   within(movement.east,Math.sin(cameraYaw));
   within(movement.north,Math.cos(cameraYaw));
   assert.ok(r.turn<=.15+1e-8&&r.turn>=-.15-1e-8);
  }
 }
});

test("screen right/left/down and diagonal preserve visible direction while avatar turns",()=>{
 // lookAt() uses screen-right = camera forward cross world-up, i.e. -X at yaw 0.
 const axes=[
  [{x:1,y:0},-1,0],
  [{x:-1,y:0},1,0],
  [{x:0,y:1},0,-1],
  [{x:1,y:-1},-Math.SQRT1_2,Math.SQRT1_2],
  [{x:-1,y:-1},Math.SQRT1_2,Math.SQRT1_2]
 ];
 for(const [stick,east,north] of axes){
  const r=screenStickFacing(stick,Math.PI/3,0,.016);
  const w=worldVector(Math.PI/3+r.turn,r);
  within(w.east,east);within(w.north,north);
 }
});

test("avatar turns smoothly to travel direction without changing movement heading",()=>{
 let yaw=0;
 const camera={mode:"follow",config:{yawOffset:.37}};
 const stick={x:1,y:0}; // screen-right; this camera's right is world-west
 const initial=screenHeadingForStick(camera,yaw);
 for(let i=0;i<50;i++){
  const movement=screenStickFacing(stick,yaw,initial,1/60);
  yaw+=movement.turn;
  keepStickCameraHeading(camera,movement.turn);
  const world=worldVector(yaw,movement);
  within(world.east,-Math.cos(.37));
  within(world.north,Math.sin(.37));
  within(angleDiff(screenHeadingForStick(camera,yaw),initial),0);
 }
 within(angleDiff(yaw,initial-Math.PI/2),0,1e-6);
});

test("camera mode and paused input guards retain other controls",()=>{
 const camera={mode:"free",config:{yawOffset:2}};
 keepStickCameraHeading(camera,Math.PI/2);
 within(camera.config.yawOffset,2);
 for(const mode of ["follow","shoulder","orbitTarget","tactical"]){
  camera.mode=mode;camera.config.yawOffset=2;
  const before=screenHeadingForStick(camera,.5);
  keepStickCameraHeading(camera,.2);
  within(angleDiff(screenHeadingForStick(camera,.7),before),0);
 }
 camera.mode="tactical";camera.config.yawOffset=0;
 within(angleDiff(screenHeadingForStick(camera,0),Math.PI),0);
 assert.equal(screenStickFacing({x:.01,y:.01},0,0,.1).active,false);
 assert.equal(screenStickFacing({x:1,y:0},0,0,NaN).active,false);
 assert.equal(screenStickFacing({x:0,y:0},0,0,.1).turn,0);
});
