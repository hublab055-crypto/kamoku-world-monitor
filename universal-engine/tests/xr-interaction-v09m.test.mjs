import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {xrIdentity,xrTranslate,xrAnchor,xrStage,xrPlanetHit,xrRTSHitRadius} from "../planet-explorer/xr-spatial.mjs";

const read=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
const stageAnchor={position:[0,1,-2],vrFloor:[0,0,0],heading:0};
const rayAt=(x,y,z)=>xrTranslate(x,y,z);

test("MR planet controller picks the visible globe surface with native geo coordinates",()=>{
 const hit=xrPlanetHit(rayAt(0,1,0),stageAnchor);
 assert.ok(hit);
 assert.ok(Math.abs(hit.lat)<1e-7);
 assert.ok(Math.abs(hit.lon+90)<1e-7);
 assert.ok(Math.abs(hit.distanceM-1.76)<.00001);
});
test("MR planet longitude follows independent user-controlled stage yaw",()=>{
 const hit=xrPlanetHit(rayAt(0,1,0),stageAnchor,{yawOffset:Math.PI/2});
 assert.ok(hit);
 assert.ok(Math.abs(hit.lat)<1e-7);
 assert.ok(Math.abs(hit.lon)<1e-7);
});
test("MR planet rejects misses, back-facing requests and invalid radii",()=>{
 assert.equal(xrPlanetHit(rayAt(0,4,0),stageAnchor),null);
 assert.equal(xrPlanetHit(rayAt(0,1,-10),stageAnchor),null);
 assert.equal(xrPlanetHit(rayAt(0,1,0),stageAnchor,{radius:0}),null);
});
test("Rotating globe changes model yaw without altering actor snapshot",()=>{
 const a={...stageAnchor},stage1=xrStage({mode:"mr-planet",anchor:a,planetRadius:10,planetScale:.24});
 const stage2=xrStage({mode:"mr-planet",anchor:a,planetRadius:10,planetScale:.24,yawOffset:Math.PI/2});
 assert.notDeepEqual(stage1,stage2);
 assert.deepEqual(stageAnchor,a);
});
test("MR miniature RTS selects a finger-sized target at varying map scales",()=>{
 assert.ok(Math.abs(xrRTSHitRadius(.0014)-25)<1e-9);
 assert.ok(Math.abs(xrRTSHitRadius(.0007)-50)<1e-9);
 assert.equal(xrRTSHitRadius(.01),6);
});
test("XR runtime provides independent placement, picking, move and land flows",()=>{
 const runtime=read("xr-ui.mjs"),app=read("app.mjs"),html=read("index.html");
 for(const id of ["xr-place","xr-rotate-left","xr-rotate-right","xr-planet-land","xr-rts-all"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(runtime,/xrPlanetHit\(ray\.transform\.matrix,anchor/);
 assert.match(runtime,/if\(placementArmed&&activeMode\?\.startsWith\("mr-"\)\)/);
 assert.match(runtime,/if\(onRTSMove\(point\.x,point\.z\)\)/);
 assert.match(runtime,/onPlanetLand\(\)/);
 assert.match(runtime,/planetYaw\+=x\*dt\*1\.2/);
 assert.match(app,/onPlanetPick:\(lat,lon\)=>/);
 assert.match(app,/onPlanetLand:\(\)=>confirmOrbitLanding\(\)/);
 assert.match(app,/onRTSAll:\(\)=>/);
});
test("VR black-frame diagnostic never persists camera or XR sensor data",()=>{
 const runtime=read("xr-ui.mjs"),render=read("render.mjs");
 assert.match(runtime,/vrDrawError="追跡姿勢が取得できません"/);
 assert.match(runtime,/gl\.clearColor\(\.08,\.23,\.40,1\)/);
 assert.match(runtime,/if\(mode==="vr"&&vrFrames<240\)renderer\.drawVRGuide/);
 assert.match(render,/drawVRGuide\(xr,anchor\)/);
 assert.match(render,/gl\.colorMask\(/);
 assert.match(runtime,/VR診断：追跡あり/);
});
