import test from "node:test";
import assert from "node:assert/strict";
import {groundRegionKey,replaceGroundRenderFrame,rebaseCameraHistory,groundHitToWorld} from "../planet-explorer/ground-render-frame.mjs";
import {ExplorerRenderer,lookAt,perspective,multiply4,projectScreen} from "../planet-explorer/render.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";

const request=(n,regionKey="terra/start")=>({key:`${regionKey}/${n}`,regionKey,cx:n*110,cz:-n*110,radius:450});
function stage(own,tag,onDestroy=()=>{}){
 const mesh=()=>own({tag,destroy(){onDestroy(this);}});
 return {patch:mesh(),groundPatchData:{vertices:[0,0,0],indices:[0]},ownerRoadMesh:null,
  riverWater:null,lakeWater:null,groundClouds:mesh(),oceanWave:null,
  trees:[mesh()],meadow:[mesh()],settlement:[mesh()],settlementDecor:[],residentMeshes:[mesh()],
  resourceNodes:[{id:"tree-0",x:100,z:200}],townSites:[{id:"village-0",x:54,z:44}],
  sceneryStats:{trees:1},cloudOriginEast:0,cloudOriginNorth:0,cloudCoverBand:0,lastWaveAt:-1,
  distantLandscape:null,distantCenter:null,distantKey:null};
}
test("all new ground meshes are published with one revision before old meshes retire",()=>{
 const renderer={cameraController:{smoothEye:[1,2,3],smoothTarget:[4,5,6]}};
 let retired=0;
 assert.equal(replaceGroundRenderFrame(renderer,request(0),own=>stage(own,"old",()=>{
  assert.equal(renderer.groundFrame.revision,2);assert.equal(renderer.cx,110);retired++;
 })).ok,true);
 const oldPatch=renderer.patch;
 const next=replaceGroundRenderFrame(renderer,request(1),own=>{
  assert.equal(renderer.patch,oldPatch);assert.equal(renderer.groundFrame.revision,1);
  assert.equal(retired,0);return stage(own,"new");
 });
 assert.equal(next.ok,true);assert.equal(renderer.groundFrame.revision,2);
 assert.equal(renderer.patch.tag,"new");assert.equal(renderer.cx,110);assert.equal(renderer.cz,-110);
 assert.equal(retired,6);assert.ok(Object.isFrozen(renderer.groundFrame));
});
test("failed allocation rolls back the complete visible frame and frees partial work",()=>{
 const renderer={};let oldRetired=0,partialRetired=0;
 replaceGroundRenderFrame(renderer,request(0),own=>stage(own,"old",()=>oldRetired++));
 renderer.pickVP=[1];renderer.groundPickFrame={saved:true};
 const before={...renderer};
 const result=replaceGroundRenderFrame(renderer,request(1),own=>{
  own({destroy(){partialRetired++;}});throw Error("injected upload failure");
 });
 assert.equal(result.ok,false);assert.equal(result.retained,true);
 for(const key of Object.keys(before))if(key!=="groundRebaseError")assert.equal(renderer[key],before[key],key);
 assert.equal(oldRetired,0);assert.equal(partialRetired,1);
 assert.match(renderer.groundRebaseError.message,/injected/);
});
test("incomplete batches and untracked meshes cannot become visible",()=>{
 const renderer={};
 assert.equal(replaceGroundRenderFrame(renderer,request(0),()=>({patch:{}})).ok,false);
 assert.equal(renderer.groundFrame,undefined);
 const result=replaceGroundRenderFrame(renderer,request(1),own=>{
  const data=stage(own,"new");data.patch={destroy(){}};return data;
 });
 assert.equal(result.ok,false);assert.equal(renderer.groundFrame,undefined);
});
test("a failed switch to another region never authorizes drawing the preceding region",()=>{
 const renderer={};replaceGroundRenderFrame(renderer,request(0),own=>stage(own,"old"));
 renderer.pickVP=[1];renderer.groundPickFrame={old:true};renderer.screenResources=[{id:"old-tree"}];
 const result=replaceGroundRenderFrame(renderer,request(0,"selene/arrival"),()=>{throw Error("unavailable");});
 assert.equal(result.ok,false);assert.equal(result.retained,false);
 assert.equal(renderer.groundFrame.regionKey,"terra/start");
 assert.equal(renderer.pickVP,null);assert.equal(renderer.groundPickFrame,null);
 assert.deepEqual(renderer.screenResources,[]);
});
test("moving render centres 100 times cannot mutate gameplay addresses or saved progression",()=>{
 const world={origin:{lat:28,lon:42},player:{x:60,z:30},npc:{id:"resident-1",x:8,z:10},
  building:{id:"home",x:54,z:44},train:{id:"local",progress:.25},
  scenario:{mode:"story",generation:4,chapter:"stellar"},distanceM:123};
 const before=JSON.stringify(world),renderer={};
 for(let i=0;i<100;i++){
  assert.equal(replaceGroundRenderFrame(renderer,request(i),own=>stage(own,i)).ok,true);
  assert.deepEqual(groundHitToWorld(renderer.groundFrame,renderer.groundFrame,
   [world.npc.x-renderer.cx,0,world.npc.z-renderer.cz]),{x:8,z:10,elevationM:0});
 }
 assert.equal(JSON.stringify(world),before);assert.equal(renderer.groundFrame.revision,100);
});
test("camera smoothing and screen projection stay continuous across a render-origin shift",()=>{
 const camera={smoothEye:[15,20,30],smoothTarget:[0,3,0]};
 const previous=request(0),next=request(1);
 const proj=perspective(Math.PI/3,1.5,.1,1000);
 const point=[4,5,2];
 const before=projectScreen(multiply4(proj,lookAt(camera.smoothEye,camera.smoothTarget)),point);
 rebaseCameraHistory(camera,previous,next);
 assert.deepEqual(camera.smoothEye,[-95,20,140]);
 const after=projectScreen(multiply4(proj,lookAt(camera.smoothEye,camera.smoothTarget)),
  [point[0]-110,point[1],point[2]+110]);
 assert.ok(Math.abs(before.u-after.u)<1e-12&&Math.abs(before.v-after.v)<1e-12);
 rebaseCameraHistory(camera,previous,request(1,"other"));
 assert.equal(camera.smoothEye,null);assert.equal(camera.smoothTarget,null);
});
test("picking rejects stale revisions and invalid hits instead of applying a new origin",()=>{
 const a=Object.freeze({...request(0),revision:1}),b=Object.freeze({...request(1),revision:2});
 assert.deepEqual(groundHitToWorld(a,a,[4,7,2]),{x:4,z:2,elevationM:7});
 assert.equal(groundHitToWorld(a,b,[4,7,2]),null);
 assert.equal(groundHitToWorld(b,b,[NaN,7,2]),null);
});
test("cache namespaces include body, seed, fixed origin and settlement",()=>{
 const planet={id:"terra",seed:77},origin={lat:28,lon:42};
 const keys=[groundRegionKey(planet,origin,"pioneer"),
  groundRegionKey({...planet,id:"selene"},origin,"pioneer"),
  groundRegionKey({...planet,seed:78},origin,"pioneer"),
  groundRegionKey(planet,{lat:29,lon:42},"pioneer"),groundRegionKey(planet,origin,"tower")];
 assert.equal(new Set(keys).size,5);assert.deepEqual(origin,{lat:28,lon:42});
 assert.throws(()=>groundRegionKey(planet,{lat:NaN,lon:42},"pioneer"));
});
test("shared retained panorama and replaced dynamic clouds are retired exactly once",()=>{
 const renderer={};let retired=0;
 replaceGroundRenderFrame(renderer,request(0),own=>{
  const data=stage(own,"old");data.distantLandscape=own({destroy(){retired++;}});return data;
 });
 const panorama=renderer.distantLandscape;
 replaceGroundRenderFrame(renderer,request(1),own=>({...stage(own,"next"),distantLandscape:panorama}));
 assert.equal(retired,0);assert.equal(renderer.distantLandscape,panorama);
 // Weather owns replacement clouds after publication; retire the live mesh,
 // rather than the disposed mesh from the original staging record.
 let cloudsRetired=0;
 renderer.groundClouds={destroy(){cloudsRetired++;}};
 replaceGroundRenderFrame(renderer,request(2),own=>stage(own,"final"));
 assert.equal(retired,1);assert.equal(cloudsRetired,1);
});

function realScene(){
 const buffers=new Set(),vaos=new Set();let nextId=0,failAfter=Infinity,created=0;
 const alloc=set=>{const v={id:++nextId};set.add(v);return v;};
 const gl={VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,
  ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,STATIC_DRAW:35044,DYNAMIC_DRAW:35048,FLOAT:5126,TRIANGLES:4,
  UNSIGNED_SHORT:5123,DEPTH_TEST:2929,COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256,BLEND:3042,SRC_ALPHA:770,ONE_MINUS_SRC_ALPHA:771,
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,
  getUniformLocation:()=>({}),createVertexArray:()=>alloc(vaos),bindVertexArray(){},
  createBuffer(){if(++created===failAfter){failAfter=Infinity;return null;}return alloc(buffers);},
  bindBuffer(){},bufferData(){},bufferSubData(){},enableVertexAttribArray(){},vertexAttribPointer(){},vertexAttribDivisor(){},
  enable(){},disable(){},uniformMatrix4fv(){},uniform3fv(){},uniform1f(){},useProgram(){},viewport(){},clearColor(){},clear(){},blendFunc(){},depthMask(){},
  drawElements(){},drawElementsInstanced(){},
  deleteBuffer(v){assert.ok(buffers.delete(v),"buffer must be deleted exactly once");},
  deleteVertexArray(v){assert.ok(vaos.delete(v),"VAO must be deleted exactly once");},deleteProgram(){}
 };
 const canvas={clientWidth:960,clientHeight:560,width:960,height:560,getContext:()=>gl,
  getBoundingClientRect:()=>({left:0,top:0,width:960,height:560})};
 const planet=new Planet({seed:77}),terrain=new Terrain(planet),actor=new ExplorerController(terrain);
 actor.altitudeM=2.5;actor.targetAltitudeM=2.5;
 const renderer=new ExplorerRenderer(canvas,planet,terrain);
 renderer.adaptiveTerrainLOD.level=2;
 return {renderer,actor,planet,terrain,buffers,vaos,failNextBatch:()=>{failAfter=created+10;}};
}

test("real WebGL renderer publishes cache, camera and picking together without moving origin",()=>{
 const {renderer,actor}=realScene();
 const originalOrigin={...actor.origin};
 try{
  renderer.frame(actor,.016);
  const initial=renderer.groundFrame,patch=renderer.patch;
  assert.ok(initial);assert.equal(renderer.groundPickFrame.frame,initial);
  const before=renderer.resourceNodes.map(n=>({id:n.id,x:n.x,z:n.z}));
  renderer.cameraController.smoothEye=[30,20,40];renderer.cameraController.smoothTarget=[0,3,0];
  // Shift the render centre through the actual free-camera path, keeping
  // physics/player at the same place in the fixed legacy chart.
  renderer.cameraController.setMode("free",actor,100);
  renderer.cameraController.config.freeX=120;
  renderer.frame(actor,.016);
  assert.ok(renderer.groundFrame.revision>initial.revision);
  assert.equal(patch.destroyed,true);assert.equal(renderer.cx,110);
  assert.equal(renderer.groundPickFrame.frame,renderer.groundFrame);
  const nodes=new Map(renderer.resourceNodes.map(n=>[n.id,n]));
  const shared=before.filter(n=>nodes.has(n.id));
  assert.ok(shared.length>20);
  for(const n of shared){assert.equal(nodes.get(n.id).x,n.x);assert.equal(nodes.get(n.id).z,n.z);}
  assert.deepEqual(actor.origin,originalOrigin);assert.equal(actor.x,0);assert.equal(actor.z,0);
 }finally{renderer.destroy();}
});
test("real failed buffer allocation preserves old patch, centre and revision without leaks",()=>{
 const {renderer,actor,buffers,vaos,failNextBatch}=realScene();
 try{
  renderer.frame(actor,.016);
  const frame=renderer.groundFrame,patch=renderer.patch,originalBuffers=new Set(buffers),originalVaos=new Set(vaos);
  renderer.cameraController.setMode("free",actor,100);renderer.cameraController.config.freeX=120;
  failNextBatch();
  renderer.frame(actor,.016);
  assert.equal(renderer.groundFrame,frame);assert.equal(renderer.patch,patch);assert.equal(patch.destroyed,false);
  assert.equal(renderer.cx,frame.cx);assert.equal(renderer.cz,frame.cz);
  assert.equal(renderer.groundPickFrame.frame,frame);assert.ok(renderer.groundRebaseError);
  assert.deepEqual(buffers,originalBuffers);assert.deepEqual(vaos,originalVaos);
  renderer.frame(actor,.016);
  assert.ok(renderer.groundFrame.revision>frame.revision);assert.equal(patch.destroyed,true);
 }finally{renderer.destroy();}
 assert.equal(buffers.size,0);assert.equal(vaos.size,0);
});
test("real renderer changes cache identity when the fixed landing origin changes",()=>{
 const {renderer,actor}=realScene();
 try{
  renderer.frame(actor,.016);const first=renderer.groundFrame,panorama=renderer.distantLandscape;
  actor.origin={lat:actor.origin.lat+.1,lon:actor.origin.lon};
  actor.lat=actor.origin.lat;actor.lon=actor.origin.lon;
  renderer.frame(actor,.016);
  assert.notEqual(renderer.groundFrame.regionKey,first.regionKey);
  assert.notEqual(renderer.distantLandscape,panorama);assert.equal(panorama.destroyed,true);
  assert.equal(renderer.groundPickFrame.frame,renderer.groundFrame);
 }finally{renderer.destroy();}
});
