import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {fogForGround,normalizeFogMode,sceneryRadiusForQuality,AdaptiveTerrainLOD,
 buildDistantTerrainRing} from "../planet-explorer/atmosphere-lod.mjs";

test("Fog defaults to auto and OFF never fogs",()=>{
 assert.equal(normalizeFogMode("unknown"),"auto");
 assert.deepEqual(normalizeFogMode("off"),"off");
 assert.equal(fogForGround({mode:"off",weather:{precipitation:"rain"}}).opacity,0);
 for(const mode of ["light","realistic","auto"]){
  const fog=fogForGround({mode});
  assert.ok(fog.enabled&&fog.startM<fog.endM&&fog.opacity>0&&fog.opacity<=1);
  assert.equal(fog.color.length,3);
 }
});
test("Weather, height and underwater visibility adjust fog",()=>{
 const clear=fogForGround({weather:{cloudCover:0,precipitation:"none"}});
 const storm=fogForGround({weather:{cloudCover:.9,precipitation:"rain",precipitationIntensity:1}});
 assert.ok(storm.endM<clear.endM);
 assert.ok(fogForGround({cameraHeightM:5500}).endM>clear.endM);
 assert.ok(fogForGround({underwater:true}).endM<clear.endM);
});
test("LOD adapts after persistent low FPS, recovers slowly, and keeps resource interaction radius",()=>{
 const lod=new AdaptiveTerrainLOD();
 lod.observe(25,1);assert.equal(lod.level,0);
 lod.observe(25,1);lod.observe(25,.6);assert.equal(lod.level,1);
 lod.observe(25,2.5);assert.equal(lod.level,2);
 lod.observe(60,7);assert.equal(lod.level,1);
 lod.observe(60,7);assert.equal(lod.level,0);
 assert.equal(sceneryRadiusForQuality(450,1),355);
 assert.equal(sceneryRadiusForQuality(450,2),270);
});
test("Distant ring meets detailed patch boundaries and stays within 16-bit mesh indexing",()=>{
 const p=new Planet({seed:77}),terrain=new Terrain(p);
 const radius=450;
 const geo={lat:28,lon:42};
 const ring=buildDistantTerrainRing(terrain,{...geo,innerRadiusM:radius,
  nearHeightAt:(x,z)=>345,segments:36,bands:6});
 assert.equal(ring.vertexCount,37*7);
 assert.equal(ring.indices.length,36*6*6);
 assert.ok(Math.max(...ring.indices)<ring.vertexCount);
 assert.ok(ring.positions.every(Number.isFinite));
 assert.ok(ring.colors.every(x=>x>=0&&x<=1));
 for(let i=0;i<=36;i++){
  const x=ring.positions[i*3],z=ring.positions[i*3+2];
  assert.ok(Math.abs(Math.max(Math.abs(x),Math.abs(z))-radius)<.001);
  assert.equal(ring.positions[i*3+1],345);
 }
});
