import test from "node:test";
import assert from "node:assert/strict";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {descentVisuals,smoothAltitude,ORBIT_GROUND_CUTOFF_M} from "../planet-explorer/descent-visuals.mjs";
import {orbitalTerrainTier,buildOrbitalTerrainTile} from "../planet-explorer/orbit-terrain-lod.mjs";

test("altitude sequence exposes atmosphere, cloud, mountains, forest and surface",()=>{
 const heights=[16000000,120000,35000,19000,6000,800,2.5];
 const states=heights.map(descentVisuals);
 assert.deepEqual(states.map(s=>s.stage),[
  "宇宙空間","大気圏に接近","大気圏上層","雲海を通過",
  "山脈と海岸","森林と地形","地表"]);
 assert.equal(states[0].ground,false);
 assert.equal(descentVisuals(ORBIT_GROUND_CUTOFF_M).ground,true);
 assert.equal(states.at(-1).ground,true);
 assert.ok(states.every(s=>[s.fog,s.clouds,s.atmosphere,s.glow].every(
  value=>Number.isFinite(value)&&value>=0&&value<=1)));
});
test("handoff fog peaks at the renderer seam and clears on the surface",()=>{
 assert.ok(descentVisuals(23000).fog>.85);
 assert.ok(descentVisuals(23000).fog>descentVisuals(120000).fog);
 assert.ok(descentVisuals(2.5).fog<.001);
 assert.ok(descentVisuals(9500).clouds>.4);
 assert.ok(descentVisuals(2.5).clouds<.001);
});
test("camera descent is monotone, bounded and reaches the actual terrain",()=>{
 let h=16000000;
 for(let i=0;i<220;i++){
  const next=smoothAltitude(h,2.5,.05);
  assert.ok(next<=h&&next>=2.5);
  assert.ok(Math.abs(Math.log(next/h))<=.17000001);
  h=next;
 }
 assert.equal(h,2.5);
 let rise=2.5;
 for(let i=0;i<220;i++){
  const next=smoothAltitude(rise,15000000,.05);
  assert.ok(next>=rise&&next<=15000000);
  rise=next;
 }
 assert.ok(rise>5000000);
 assert.equal(smoothAltitude(100,2.5,0),100);
 assert.throws(()=>smoothAltitude(-1,2.5,.05),RangeError);
 assert.throws(()=>descentVisuals(NaN),RangeError);
});
test("spherical terrain LOD refines in fixed bands and deallocates in orbit",()=>{
 assert.equal(orbitalTerrainTier(500000),null);
 const low=orbitalTerrainTier(25000),mid=orbitalTerrainTier(100000);
 assert.ok(mid.radiusM>low.radiusM);
 assert.ok(mid.resolution<=96&&low.resolution<=96);
 const planet=new Planet({seed:77}),terrain=new Terrain(planet);
 const tile=buildOrbitalTerrainTile(terrain,{
  lat:32.5,lon:179.95,renderRadius:600,radiusM:20000,resolution:8
 });
 assert.equal(tile.vertexCount,81);
 assert.equal(tile.positions.length,81*3);
 assert.equal(tile.normals.length,81*3);
 assert.equal(tile.indices.length,8*8*6);
 assert.ok(tile.indices.every(i=>i>=0&&i<tile.vertexCount));
 assert.ok(tile.positions.every(Number.isFinite));
 assert.ok(tile.normals.every(Number.isFinite));
 assert.ok(tile.colors.every(Number.isFinite));
 assert.ok(tile.positions.every(v=>Math.abs(v)<601));
 const center=4*9+4;
 assert.ok(Math.abs(Math.hypot(...tile.positions.slice(center*3,center*3+3))-600)<2);
});
