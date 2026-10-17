import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {Weather} from "../planet/weather-engine.mjs";
import {geoNormal,geoOffset,geoLocal,wrapLon,findLand,samplePatch,terrainSurface} from "../planet-explorer/geo.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {ExplorerRenderer,lookAt,multiply4,perspective} from "../planet-explorer/render.mjs";

function setup(){
 const p=new Planet({id:"test",seed:77,timeDays:.26});
 const t=new Terrain(p);return {p,t};
}
test("geo coordinate normal is unit length",()=>{
 const n=geoNormal(51,121);assert.ok(Math.abs(Math.hypot(...n)-1)<1e-12);
});
test("geo offset north/east matches local inverse to within a centimetre",()=>{
 const {p}=setup(),lat=42.5,lon=-73.3;
 const point=geoOffset(lat,lon,350,240,p.radiusM);
 const local=geoLocal(lat,lon,point.lat,point.lon,p.radiusM);
 assert.ok(Math.abs(local.eastM-350)<.01);
 assert.ok(Math.abs(local.northM-240)<.01);
});
test("longitude crosses dateline without a discontinuity",()=>{
 const {p}=setup();
 const point=geoOffset(0,179.999,400,0,p.radiusM);
 assert.ok(point.lon< -179.99);
 const local=geoLocal(0,179.999,point.lat,point.lon,p.radiusM);
 assert.ok(Math.abs(local.eastM-400)<.05);
 assert.equal(wrapLon(181),-179);
});
test("spherical local coordinates remain finite near high latitude",()=>{
 const point=geoOffset(88,177,8000,-2000);
 assert.ok(Math.abs(point.lat)<=90);
 assert.ok(point.lon>=-180&&point.lon<180);
});
test("landing site lies on land sampled by existing planet terrain",()=>{
 const {t}=setup();
 const site=findLand(t,28,42);
 const sample=t.sample(site.lat,site.lon);
 assert.equal(sample.water,false);
 assert.ok(sample.elevationM>120&&sample.elevationM<1700);
});
test("ground mesh height uses EXACT same sample as global planet",()=>{
 const {t}=setup(),site=findLand(t);
 const mesh=samplePatch(t,site.lat,site.lon,900,20);
 const centerIndex=10*21+10;
 const sample=terrainSurface(t,site.lat,site.lon);
 assert.ok(Math.abs(mesh.vertices[centerIndex*3+1]-sample.elevationM)<.0002);
 assert.equal(mesh.indices.length,20*20*6);
 assert.equal(mesh.vertexCount,441);
});
test("adjacent ground mesh offsets share global terrain coordinates",()=>{
 const {p,t}=setup(),s=findLand(t),radius=600;
 const east=geoOffset(s.lat,s.lon,radius,0,p.radiusM);
 const one=samplePatch(t,s.lat,s.lon,radius,8),two=samplePatch(t,east.lat,east.lon,radius,8);
 const rightMid=one.vertices[(4*9+8)*3+1],otherMid=two.vertices[(4*9+4)*3+1];
 assert.ok(Math.abs(rightMid-otherMid)<.0005);
});
test("controller preserves grounded lat/lon from x/z walking offsets",()=>{
 const {t,p}=setup(),ctrl=new ExplorerController(t);
 ctrl.altitudeM=2.5;ctrl.targetAltitude(2.5);
 const lat0=ctrl.lat,lon0=ctrl.lon;
 for(let i=0;i<30;i++)ctrl.update(.05,{forward:1});
 const expected=geoOffset(ctrl.origin.lat,ctrl.origin.lon,ctrl.x,ctrl.z,p.radiusM);
 assert.ok(Math.abs(expected.lat-ctrl.lat)<1e-12);
 assert.ok(Math.abs(expected.lon-ctrl.lon)<1e-12);
 assert.ok(ctrl.totalDistanceM>=0);
 assert.ok(Math.abs(ctrl.lat-lat0)+Math.abs(ctrl.lon-lon0)<.01);
});
test("controller descent interpolates from orbit to ground",()=>{
 const {t}=setup(),ctrl=new ExplorerController(t);
 ctrl.targetAltitude(2.5);
 let prev=ctrl.altitudeM;
 for(let i=0;i<180;i++){ctrl.update(.05);assert.ok(ctrl.altitudeM<=prev);prev=ctrl.altitudeM;}
 assert.ok(ctrl.altitudeM<12);
 assert.equal(ctrl.targetAltitudeM,2.5);
});
test("zoom target clamps to valid physical range",()=>{
 const {t}=setup(),ctrl=new ExplorerController(t);
 ctrl.targetAltitude(2.5);
 assert.equal(ctrl.zoom(.01),2.5);
 assert.equal(ctrl.targetAltitude(9e9),50000000);
 assert.throws(()=>ctrl.zoom(-1),/Invalid/);
});
test("steep terrain and water are rejected by walking collision",()=>{
 const {t}=setup(),ctrl=new ExplorerController(t);
 ctrl.altitudeM=2.5;ctrl.targetAltitude(2.5);
 const old={lat:ctrl.lat,lon:ctrl.lon,x:ctrl.x,z:ctrl.z};
 const sample=t.sample.bind(t);
 t.sample=(lat,lon)=>{
  const s=sample(lat,lon);
  return Math.abs(lat-old.lat)+Math.abs(lon-old.lon)<1e-10?s:{...s,water:true};
 };
 ctrl.update(.1,{forward:1});
 assert.equal(ctrl.blocked,true);
 assert.equal(ctrl.x,old.x);assert.equal(ctrl.z,old.z);
 t.sample=sample;
});
test("explorer snapshot restores geographic identity and progress",()=>{
 const {t}=setup(),ctrl=new ExplorerController(t);
 ctrl.targetAltitude(2.5);
 for(let i=0;i<80;i++)ctrl.update(.08);
 const clone=ExplorerController.fromSnapshot(t,ctrl.snapshot());
 assert.deepEqual(clone.snapshot(),ctrl.snapshot());
 assert.ok(Math.abs(clone.lat-ctrl.lat)<1e-10);
});
test("camera matrices transform finite values with nonzero perspective",()=>{
 const m=multiply4(perspective(Math.PI/3,1.5,.1,1000),lookAt([0,15,30],[0,0,0]));
 assert.equal(m.length,16);
 assert.ok(m.every(Number.isFinite));
 assert.notEqual(m[0],0);
});
test("globe and ground renderer submit real indexed 3D triangles",()=>{
 const {p,t}=setup();
 const calls={draws:0,uploaded:0,instanced:0};
 const gl={
  VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,
  ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,STATIC_DRAW:35044,
  FLOAT:5126,TRIANGLES:4,UNSIGNED_SHORT:5123,DEPTH_TEST:2929,
  COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256,BLEND:3042,SRC_ALPHA:770,ONE_MINUS_SRC_ALPHA:771,
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,
  getUniformLocation:()=>({}),createVertexArray:()=>({}),bindVertexArray(){},
  createBuffer:()=>({}),bindBuffer(){},bufferData:(_type,v)=>{assert.ok(v.length>0);calls.uploaded++;},
  enableVertexAttribArray(){},vertexAttribPointer(){},vertexAttribDivisor(){},enable(){},disable(){},
  uniformMatrix4fv(){},uniform3fv(){},uniform1f(){},useProgram(){},viewport(){},clearColor(){},clear(){},
  blendFunc(){},depthMask(){},drawElements:(_mode,count)=>{assert.ok(count>0);calls.draws++;},
  drawElementsInstanced:(_mode,count,_type,_offset,instances)=>{assert.ok(count>0&&instances>0);calls.instanced+=instances;},
  deleteBuffer(){},deleteVertexArray(){},deleteProgram(){}
 };
 const canvas={clientWidth:720,clientHeight:420,width:720,height:420,
  getContext:()=>gl};
 const renderer=new ExplorerRenderer(canvas,p,t);
 const ctrl=new ExplorerController(t);
 assert.equal(renderer.frame(ctrl),"orbit");
 ctrl.altitudeM=100000;ctrl.targetAltitude(100000);
 assert.equal(renderer.frame(ctrl),"orbit");
 assert.ok(renderer.orbitDetail,"orbital approach should create a detailed spherical tile");
 ctrl.altitudeM=2.5;ctrl.targetAltitude(2.5);
 assert.equal(renderer.frame(ctrl),"ground");
 assert.equal(renderer.orbitDetail,null,"orbital LOD GPU mesh must be freed after handoff");
 assert.ok(calls.uploaded>8);
 assert.ok(calls.draws>=3);
 assert.ok(calls.instanced>100,"dense nature should use hardware instancing");
 renderer.destroy();
});
