import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {AgricultureWorld,CROPS} from "../planet-explorer/agriculture.mjs";
import {agricultureGeometry} from "../planet-explorer/agriculture-geometry.mjs";
import {FaunaWorld} from "../planet-explorer/fauna.mjs";
import {faunaGeometry} from "../planet-explorer/fauna-geometry.mjs";
import {ResourceHarvest,logLengthCm} from "../planet-explorer/resource-harvest.mjs";
import {harvestYield} from "../planet-explorer/resource-economy.mjs";

const player=()=>({x:0,z:0,nearGround:true,mountRiding:false});
const prepare=(kind)=>{
 const farm=new AgricultureWorld(),actor=player();
 const till=farm.till(3,0,actor,()=>true,0);
 assert.ok(till.ok);
 assert.ok(farm.sow(till.plot.id,kind,actor,0).ok);
 return {farm,actor,id:till.plot.id};
};
test("tillage requires safe nearby ground, an unmounted player, and plot spacing",()=>{
 const farm=new AgricultureWorld(),actor=player();
 assert.equal(farm.till(3,0,{...actor,mountRiding:true}).ok,false);
 assert.equal(farm.till(3,0,actor,()=>false).ok,false);
 assert.equal(farm.till(30,0,actor).ok,false);
 assert.equal(farm.till(3,0,actor).ok,true);
 assert.equal(farm.till(4,0,actor).ok,false);
 assert.equal(farm.plots.length,1);
});
test("wheat ripens by planet day, gives grain and straw, then leaves reusable soil",()=>{
 const {farm,actor,id}=prepare("wheat"),bag={};
 assert.equal(farm.harvest(id,actor,5.99,bag).ok,false);
 assert.equal(farm.growth(farm.plots[0],6),1);
 assert.equal(farm.harvest(id,actor,6,bag).ok,true);
 assert.equal(bag.wheat,CROPS.wheat.harvest.wheat);
 assert.equal(bag.straw,CROPS.wheat.harvest.straw);
 assert.equal(farm.seeds.wheat,5);
 assert.equal(farm.plots[0].crop,null);
 assert.ok(farm.sow(id,"carrot",actor,6).ok);
 assert.equal(farm.harvest(id,actor,10,bag).ok,true);
 assert.equal(bag.carrot,CROPS.carrot.harvest.carrot);
});
test("orchard takes space and produces repeat apple harvests without replanting",()=>{
 const {farm,actor,id}=prepare("apple");
 assert.equal(farm.harvest(id,actor,15,{}).ok,false);
 const bag={};
 assert.equal(farm.harvest(id,actor,16,bag).ok,true);
 assert.equal(bag.apple,6);
 assert.equal(farm.plots[0].crop,"apple");
 assert.equal(farm.harvest(id,actor,17,bag).ok,false);
 assert.equal(farm.harvest(id,actor,28,bag).ok,true);
 assert.equal(bag.apple,12);
});
test("farming save/restore preserves seeds, dates, orchards and prior saves",()=>{
 const {farm,actor,id}=prepare("carrot");
 const restored=new AgricultureWorld(JSON.parse(JSON.stringify(farm.snapshot())));
 assert.equal(restored.plots[0].id,id);
 assert.equal(restored.growth(restored.plots[0],2),.5);
 assert.equal(restored.harvest(id,actor,4,{}).ok,true);
 assert.equal(new AgricultureWorld().seeds.apple,2);
});
test("horses and aurochs eat farm foods, feed consumes exactly one item",()=>{
 const fauna=new FaunaWorld(),horse=fauna.animals.find(a=>a.kind==="horse");
 const cattle=fauna.animals.find(a=>a.kind==="cattle");
 const bag={straw:2,carrot:1,apple:1,wheat:1};
 horse.hunger=20;
 let r=fauna.feed(horse.id,"carrot",{x:horse.x,z:horse.z},bag);
 assert.equal(r.ok,true);
 assert.equal(bag.carrot,0);
 assert.equal(horse.hunger,60);
 assert.equal(fauna.feed(horse.id,"carrot",{x:horse.x,z:horse.z},bag).ok,false);
 cattle.hunger=12;
 r=fauna.feed(cattle.id,"straw",{x:cattle.x,z:cattle.z},bag);
 assert.equal(r.ok,true);
 assert.equal(bag.straw,1);
 assert.equal(fauna.feed(cattle.id,"wheat",{x:cattle.x,z:cattle.z},bag).ok,false);
 const restored=new FaunaWorld(fauna.snapshot());
 assert.equal(restored.get(horse.id).hunger,60);
});
test("grazing is visible and increases hunger of foraging wild herbivores",()=>{
 const fauna=new FaunaWorld(),horse=fauna.animals.find(a=>a.kind==="horse");
 horse.hunger=5;
 let grazed=false;
 for(let i=0;i<50;i++){fauna.advance(.1,{x:0,z:0,moving:false},()=>true);grazed ||=horse.grazing;}
 assert.ok(grazed);
 assert.ok(horse.hunger>5);
 assert.notDeepEqual(faunaGeometry("horse",{}, {grazing:true}).positions,
  faunaGeometry("horse").positions);
});
test("saw cuts exact 0.1m segments, persists remainder and cannot duplicate planks",()=>{
 const node={id:"timber1",type:"large-oak",kind:"wood",scale:1.2};
 const world=new ResourceHarvest();
 for(let i=0;i<7;i++)world.hit(node,"axe");
 assert.equal(world.visual(node).state,"fallen");
 const before=world.cutLog(node,1.3);
 assert.equal(before.ok,true);assert.equal(before.segment.lengthM,1.3);
 const restored=new ResourceHarvest(world.snapshot());
 assert.equal(restored.pieces.length,1);
 const second=restored.cutLog(node,2.1);
 assert.equal(second.ok,true);
 let earned=(before.drops.plank||0)+(second.drops.plank||0),iter=0;
 while(restored.visual(node)&&iter++<40){
  const r=restored.cutLog(node,.7);
  assert.ok(r.ok);earned+=(r.drops.plank||0);
 }
 assert.ok(iter<40);
 assert.equal(restored.visual(node),null);
 assert.equal(earned,harvestYield(node,{saw:true}).drops.plank);
 assert.equal(restored.cutLog(node,1).ok,false);
 const length=restored.pieces.reduce((sum,p)=>sum+p.lengthM,0);
 assert.ok(Math.abs(length-logLengthCm(node)/100)<.001);
});
test("axe collection after partial saw only awards the uncut remaining wood",()=>{
 const node={id:"timber2",type:"large-oak",kind:"wood",scale:1};
 const world=new ResourceHarvest();
 for(let i=0;i<7;i++)world.hit(node,"axe");
 const cut=world.cutLog(node,2);
 const remainder=world.hit(node,"axe");
 assert.equal(remainder.ok,true);
 assert.equal(remainder.stage,"collected");
 assert.equal(remainder.drops.wood+cut.drops.plank,75);
 assert.equal(world.visual(node),null);
});
test("agriculture meshes and browser entrypoints are valid and linked",()=>{
 for(const kind of ["field","wheat","carrot","apple"]){
  const m=agricultureGeometry(kind,1);
  assert.ok(m.positions.length>0,kind);
  assert.equal(m.positions.length,m.normals.length);
  assert.equal(m.positions.length,m.colors.length);
  assert.ok(m.indices.every(i=>i<m.positions.length/3));
 }
 const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 const render=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");
 for(const id of ["farm-toggle","farm-panel","farm-till","farm-sow","farm-harvest","farm-cut-length",
   "farm-saw","fauna-feed","fauna-feed-food"])assert.ok(html.includes('id="'+id+'"'));
 for(const key of ["installAgricultureUI","new AgricultureWorld","farm.snapshot()",
   "harvest.cutLog(node,attackInProgress.cutLengthM||1)"])assert.ok(app.includes(key),key);
 assert.ok(render.includes("drawAgriculture(vp,light,s,radius)"));
 assert.ok(render.includes("pickFarm(clientX,clientY)"));
});
