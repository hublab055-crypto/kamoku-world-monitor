import test from "node:test";
import assert from "node:assert/strict";
import {ResourceHarvest,HARVEST_TYPES} from "../planet-explorer/resource-harvest.mjs";
import {Earthworks} from "../planet-explorer/earthworks.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {landformAt,terrainSurface} from "../planet-explorer/geo.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {planWorldScenery} from "../planet-explorer/world-scenery.mjs";
import {sceneryPrototype} from "../planet-explorer/scenery-geometry.mjs";

test("autumn species and shrubs render and remain deterministically generated",()=>{
 const input={seed:77,radius:450,groundAt:()=>435,
  biomeAt:()=>({water:false,river:false,elevationM:435,category:"forest"})};
 const nodes=planWorldScenery(input).trees;
 for(const type of ["maple-red","maple-orange","oak-yellow","birch","shrub","boulder"]){
  assert.ok(nodes.some(x=>x.type===type),type+" populated");
  const mesh=sceneryPrototype(type);
  assert.ok(mesh.indices.length>0 && mesh.positions.length>0);
 }
});
test("standing trees take real hits, fall, convert to logs and yield resources only on collection",()=>{
 const n={id:"vegetation-1-2-3",type:"maple-red",kind:"wood",x:1,z:2};
 const h=new ResourceHarvest();
 assert.equal(HARVEST_TYPES[n.type].tool,"axe");
 assert.equal(h.hit(n,"mine").ok,false);
 assert.equal(h.hit(n,"axe").stage,"damaged");
 assert.equal(h.hit(n,"axe").stage,"damaged");
 const fell=h.hit(n,"axe");
 assert.equal(fell.stage,"felled");assert.deepEqual(fell.drops,{});
 assert.equal(h.visual(n).type,"fallen-log");
 assert.ok(sceneryPrototype("fallen-log").indices.length>0);
 const restored=new ResourceHarvest(h.snapshot());
 const picked=restored.hit(n,"axe");
 assert.equal(picked.stage,"collected");
 assert.ok(picked.drops.wood>=2);
 assert.equal(restored.visual(n),null);
 assert.equal(new ResourceHarvest(restored.snapshot()).hit(n,"axe").ok,false);
});
test("stones chip, break into selectable rubble, and are eventually collected",()=>{
 const h=new ResourceHarvest(),rock={id:"vegetation-stone-8",type:"boulder",kind:"stone"};
 for(let i=0;i<3;i++)assert.equal(h.hit(rock,"mine").stage,"damaged");
 assert.equal(h.hit(rock,"mine").stage,"broken");
 assert.equal(h.visual(rock).type,"rubble");
 assert.ok(h.hit(rock,"mine").drops.stone>=1);
});
test("excavation changes shared collision/render height and persists exactly",()=>{
 const p=new Planet({seed:77}),t=new Terrain(p),lat=25,lon=40;
 const earth=new Earthworks();t.earthworks=earth;
 const before=terrainSurface(t,lat,lon).elevationM;
 const changed=earth.change(lat,lon,"dig",14);
 assert.equal(changed.ok,true);
 assert.ok(Math.abs(terrainSurface(t,lat,lon).elevationM-(before-1.5))<.0001);
 const copy=new Earthworks(earth.snapshot());
 t.earthworks=copy;
 assert.equal(terrainSurface(t,lat,lon).elevationM,before-1.5);
 assert.equal(copy.change(lat,lon,"fill",14).ok,true);
 assert.ok(terrainSurface(t,lat,lon).elevationM>before-1.5);
 assert.ok(Math.abs(copy.deltaAt(lat,lon+.05))<.0001);
});
test("legacy action defaults remain and world-harvest mode grants no magical resources",()=>{
 const actions=new Actions(),actor={altitudeM:2.5,jumpY:0};
 const original=actions.resources.wood;
 actions.worldHarvestEnabled=true;
 assert.equal(actions.start("axe",actor,()=>({elevationM:200})),true);
 for(let i=0;i<4;i++)actions.advance(.25);
 assert.equal(actions.resources.wood,original);
 assert.equal(actions.start("dig",actor,()=>({elevationM:200})),true);
 for(let i=0;i<5;i++)actions.advance(.25);
 assert.equal(actions.resources.soil,0);
});
test("biome landform families cover oceans coasts mountains rivers canyons plains and grasslands",()=>{
 const seed=77;
 for(const [category,out] of [["ocean",["ocean"]],["coast",["coast"]],["river",["river"]],
 ["mountain",["mountain","mountain-range"]],["highland",["hills","mountain-range"]],
 ["valley",["valley","canyon"]],["plains",["plain","grassland"]]]){
  const fake={planet:{seed},sample:()=>({category,water:category==="ocean",river:category==="river",elevationM:350})};
  assert.ok(out.includes(landformAt(fake,20,40)),category);
 }
});
