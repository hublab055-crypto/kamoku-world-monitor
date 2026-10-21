import test from "node:test";
import assert from "node:assert/strict";
import {fogForGround,normalizeFogMode,sceneryRadiusForQuality,AdaptiveTerrainLOD} from "../planet-explorer/atmosphere-lod.mjs";

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
