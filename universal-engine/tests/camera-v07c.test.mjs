import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {CameraController,CAMERA_MODES,sanitizeCamera} from "../planet-explorer/camera-controller.mjs";
import {ExplorerRenderer,lookAt,perspective,multiply4,projectScreen} from "../planet-explorer/render.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";

const actor={x:142,z:-63,yaw:.7,altitudeM:2.5,lat:28,lon:42,jumpY:0,moving:false,
  totalDistanceM:0,walkSpeed:5,origin:{lat:28,lon:42}};
const glStub=()=>{
 const calls={draw:0,uploads:0};
 const gl={
 VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,
 ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,STATIC_DRAW:35044,FLOAT:5126,TRIANGLES:4,
 UNSIGNED_SHORT:5123,DEPTH_TEST:2929,COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256,
 BLEND:3042,SRC_ALPHA:770,ONE_MINUS_SRC_ALPHA:771,
 createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
 createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,
 getUniformLocation:()=>({}),createVertexArray:()=>({}),bindVertexArray(){},
 createBuffer:()=>({}),bindBuffer(){},bufferData(){calls.uploads++},enableVertexAttribArray(){},
 vertexAttribPointer(){},enable(){},disable(){},uniformMatrix4fv(){},uniform3fv(){},
 uniform1f(){},useProgram(){},viewport(){},clearColor(){},clear(){},blendFunc(){},
 depthMask(){},drawElements(){calls.draw++},deleteBuffer(){},deleteVertexArray(){},deleteProgram(){}
 };
 return {canvas:{clientWidth:960,clientHeight:560,width:960,height:560,getContext:()=>gl,
 getBoundingClientRect:()=>({left:0,top:0,width:960,height:560})},calls};
};
test("camera catalog contains six requested modes",()=>{
 assert.deepEqual(CAMERA_MODES.map(x=>x[0]),
  ["legacy","follow","shoulder","free","orbitTarget","tactical"]);
});
test("six camera modes operate without moving the character",()=>{
 for(const [mode] of CAMERA_MODES){
  const cam=new CameraController();
  const original=JSON.stringify(actor);
  cam.setMode(mode,actor,100);
  const v=cam.groundView(actor,{groundM:100,focusGroundM:100,dt:.016});
  assert.equal(JSON.stringify(actor),original);
  assert.ok([...v.eye,...v.target].every(Number.isFinite),mode);
  assert.ok(Math.hypot(...v.eye)>0);
 }
});
test("free camera pan changes camera not avatar; zoom acts on camera",()=>{
 const cam=new CameraController();
 cam.setMode("free",actor,100);
 const original=JSON.stringify(actor),x=cam.config.freeX;
 cam.pan(.08,1,0);
 assert.notEqual(cam.config.freeX,x);
 assert.equal(JSON.stringify(actor),original);
 const height=cam.config.freeHeightM;
 cam.zoom(1.4);
 assert.ok(cam.config.freeHeightM>height);
 const v=cam.groundView(actor,{groundM:100,focusGroundM:100,dt:.05});
 assert.equal(v.focusX,cam.config.freeX);
});
test("tactical camera can follow at 100m, 1km and 10km",()=>{
 const cam=new CameraController();
 cam.setMode("tactical",actor,100);
 const stable=JSON.stringify(actor);
 for(const height of [100,1000,10000]){
  cam.setValue("tacticalHeightM",height);
  const view=cam.groundView(actor,{groundM:100,focusGroundM:100,dt:.05});
  assert.equal(view.heightM,height);
  assert.deepEqual(view.actorPos,[actor.x,101.2,actor.z]);
  assert.equal(view.marker,true);
  assert.equal(JSON.stringify(actor),stable);
 }
});
test("camera perspective, distance, yaw and pitch are bounded",()=>{
 const cam=new CameraController();
 assert.throws(()=>cam.setMode("debug"),/Unknown/);
 assert.throws(()=>cam.setValue("fieldOfViewDeg",Infinity),/Invalid/);
 assert.throws(()=>cam.setValue("distanceM",0),/Invalid/);
 cam.setMode("orbitTarget",actor,100);
 cam.rotate(10000,10000);
 assert.ok(Math.abs(cam.config.pitchRad)<=1.42);
 cam.zoom(0.0001);
 assert.equal(cam.config.distanceM,1);
});
test("all view states roundtrip and reject corrupt data",()=>{
 for(const [mode] of CAMERA_MODES){
  const camera=new CameraController();
  camera.setMode(mode,actor,100);
  const snap=camera.snapshot();
  assert.deepEqual(CameraController.fromSnapshot(JSON.parse(JSON.stringify(snap))).snapshot(),snap);
 }
 const bad={...new CameraController().snapshot(),freeX:Infinity};
 assert.throws(()=>sanitizeCamera(bad),/Invalid/);
 assert.throws(()=>sanitizeCamera({...new CameraController().snapshot(),mode:"unknown"}),/Invalid/);
});
test("view projected marker is finite, and objects behind camera are rejected",()=>{
 const vp=multiply4(perspective(Math.PI/3,1,.1,100),lookAt([0,5,10],[0,0,0]));
 const p=projectScreen(vp,[0,0,0]);
 assert.ok(p&&p.onScreen);
 assert.ok(Math.abs(p.u-.5)<.01);
 assert.equal(projectScreen(vp,[0,5,50]),null);
});
test("renderer shows marker from ground tactical and planet orbit views",()=>{
 const {canvas,calls}=glStub(),planet=new Planet({seed:77}),terrain=new Terrain(planet);
 const renderer=new ExplorerRenderer(canvas,planet,terrain);
 const landed={...actor};
 renderer.cameraController.setMode("tactical",landed,100);
 renderer.cameraController.setValue("tacticalHeightM",100);
 assert.equal(renderer.frame(landed,.016),"ground");
 assert.ok(renderer.actorMarker&&renderer.actorMarker.onScreen);
 assert.ok(calls.draw>0);
 const orbit={...landed,altitudeM:16000000};
 assert.equal(renderer.frame(orbit,.016),"orbit");
 assert.ok(renderer.actorMarker&&renderer.actorMarker.onScreen);
 renderer.cameraController.setValue("indicator",false);
 renderer.frame(orbit,.016);
 assert.equal(renderer.actorMarker,null);
 renderer.destroy();
});
test("v0.7c has independent save and rollback UI paths",()=>{
 const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 const archive=readFileSync(new URL("../versions/v0.7b/planet-explorer/app.mjs",import.meta.url),"utf8");
 for(const id of ["camera-mode","camera-distance","camera-height","camera-fov","camera-indicator",
   "camera-face","camera-home","actor-marker","import-v07b-save"])
   assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/versions\/v0\.7b\/planet-explorer/);
 assert.match(app,/SAVE_KEY="universal-engine:explorer:v0\.7d"/);
 assert.match(app,/V07C_SAVE_KEY="universal-engine:explorer:v0\.7c"/);
 assert.match(app,/V07B_SAVE_KEY="universal-engine:explorer:v0\.7b"/);
 assert.match(archive,/SAVE_KEY="universal-engine:explorer:v0\.7b"/);
 assert.ok(!archive.includes("camera-controller.mjs"));
});
