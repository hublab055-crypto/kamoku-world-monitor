import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {xrButtonEdges,xrVRMovement,xrStick} from "../planet-explorer/xr-quest-controls.mjs";
import {xrTableHit,xrPointerYaw,xrIdentity,xrStage} from "../planet-explorer/xr-spatial.mjs";
const source=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
const gamepad=(axes=[],pressed=[])=>({mapping:"xr-standard",axes,
 buttons:Array.from({length:6},(_,i)=>({pressed:pressed.includes(i)}))});
const sourceFor=(hand,axes=[],buttons=[])=>({handedness:hand,gamepad:gamepad(axes,buttons)});
test("Quest 3S left thumbstick walks and right thumbstick turns with drift deadzone",()=>{
 const left=sourceFor("left",[0,0,0.7,-0.8]);
 const right=sourceFor("right",[0,0,-0.6,0]);
 const a=xrVRMovement([left,right]);
 assert.ok(a.forward>.5);assert.ok(a.strafe>.5);assert.ok(a.turn<-.4);
 assert.equal(xrStick(gamepad([0,0,.05,-.06])).x,0);
 assert.equal(xrStick(gamepad([0,0,.05,-.06])).y,0);
});
test("Quest tabletop RTS disables walking and redirects right thumbstick to model rotation",()=>{
 const a=xrVRMovement([sourceFor("left",[0,0,.8,-.9]),sourceFor("right",[0,0,.5,0])],{rts:true});
 assert.equal(a.forward,0);assert.equal(a.strafe,0);assert.equal(a.turn,0);
 assert.ok(a.tableTurn>.3);
});
test("A/B/X/Y and stick clicks emit one edge per press, never repeat while held",()=>{
 const keys=[sourceFor("left",[0,0,0,0],[3,4,5]),sourceFor("right",[0,0,0,0],[3,4,5])];
 let e=xrButtonEdges(keys);
 assert.equal(e.pressed.length,6);
 e=xrButtonEdges(keys,e.next);
 assert.deepEqual(e.pressed,[]);
 const released=xrButtonEdges([],e.next);
 assert.equal(released.next.size,0);
 assert.deepEqual(xrButtonEdges(keys,released.next).pressed.length,6);
});
test("Unknown gamepad mapping cannot accidentally drive avatar or buttons",()=>{
 const alien=sourceFor("left",[0,0,1,-1],[4]);
 alien.gamepad.mapping="standard";
 assert.deepEqual(xrButtonEdges([alien]).pressed,[]);
 assert.equal(xrVRMovement([alien]).forward,0);
});
test("VR tabletop controller hit preserves original unrotated placement",()=>{
 const ray=xrIdentity();
 ray[12]=0;ray[13]=1.5;ray[14]=0;
 // XR gaze down -Y, from 1.5m to 0.8m tabletop
 ray[5]=0;ray[6]=-1;ray[9]=1;ray[10]=0;
 const anchor={position:[0,.8,0],heading:0,vrFloor:[0,0,0]};
 const actor={x:12,z:30};
 const hit=xrTableHit(ray,anchor,0,actor,.0014);
 assert.ok(hit);assert.equal(hit.x,12);assert.equal(hit.z,30);
 const rotated=xrTableHit(ray,anchor,0,actor,.0014,.8);
 assert.ok(rotated);assert.equal(rotated.x,12);assert.equal(rotated.z,30);
});
test("VR controller pointing yaw uses game-stage basis, independent of head orientation",()=>{
 const ray=xrIdentity();ray[8]=0;ray[10]=-1;
 assert.ok(Math.abs(xrPointerYaw(ray,xrIdentity()))<.0001);
 const stage=xrStage({mode:"vr",anchor:{vrFloor:[0,0,0],heading:0,position:[0,.8,-1]}});
 const pointed=xrPointerYaw(ray,stage);
 assert.ok(Number.isFinite(pointed));
});
test("XR controller triggers call existing right/left equipped hand and guard/bow commands",()=>{
 const u=source("xr-ui.mjs"),app=source("app.mjs"),frontier=source("frontier-interaction-ui.mjs");
 assert.match(u,/onVRHand\(hand\)/);
 assert.match(u,/onVRCommand\(event\.inputSource\?\.handedness==="right"\?"guard":"shoot"\)/);
 assert.match(app,/onVRHand:hand=>/);
 assert.match(app,/frontierUI\?\.useHand\(hand\)/);
 assert.match(app,/frontierUI\?\.runCommand\(command\)/);
 assert.match(frontier,/useHand,runCommand,selectDeck,activeHand:/);
});
test("VR controller can switch head-tracked third-person / VR tactical and issue selection and movement",()=>{
 const u=source("xr-ui.mjs"),app=source("app.mjs"),render=source("render.mjs");
 assert.match(u,/button==="right:4"/);
 assert.match(u,/button==="right:5"/);
 assert.match(u,/onVRToggleRTS\(nextMode\)/);
 assert.match(u,/onRTSSelect\(point\.x,point\.z/);
 assert.match(u,/onRTSMove\(point\.x,point\.z\)/);
 assert.match(u,/onVRAim\(yaw,hand\)/);
 assert.match(u,/vrCurrentStage=stage/);
 assert.match(render,/this\.xrView\.showAvatar/);
 assert.match(app,/if\(rtsMode!==nextMode\)toggleRts\(\)/);
});
test("MR planet and MR tabletop selection continue to use their own unchanged routes",()=>{
 const u=source("xr-ui.mjs");
 assert.match(u,/if\(activeMode==="mr-planet"\)/);
 assert.match(u,/if\(activeMode==="mr-rts"\)/);
 assert.match(u,/xrPlanetHit\(ray\.transform\.matrix,anchor/);
 assert.match(u,/const usingProjection=mode==="vr"&&Boolean\(projection\)/);
 assert.match(u,/vrRTS=false;vrThird=false;vrTableYaw=0/);
});
test("Game entrypoints invalidate Quest headset cached modules",()=>{
 const app=source("app.mjs"),index=source("index.html");
 assert.match(app,/xr-ui\.mjs\?v=.*controls-v09r/);
 assert.match(app,/frontier-interaction-ui\.mjs\?v=.*xr-v09r/);
 assert.match(index,/controls-v09r/);
});
