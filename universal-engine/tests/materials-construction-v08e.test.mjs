import test from "node:test";
import assert from "node:assert/strict";
import {RESOURCE_PROFILES,harvestYield} from "../planet-explorer/resource-economy.mjs";
import {ResourceHarvest} from "../planet-explorer/resource-harvest.mjs";
import {planWorldScenery} from "../planet-explorer/world-scenery.mjs";
import {sceneryPrototype} from "../planet-explorer/scenery-geometry.mjs";
import {ConstructionSystem,blockedByStoneWall,FACILITIES} from "../planet-explorer/construction-system.mjs";
import {placedBuildingGeometry} from "../planet-explorer/placed-buildings-geometry.mjs";
import {ConstructionPlacement} from "../planet-explorer/construction-ui.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {Lifestyle} from "../planet-explorer/lifestyle.mjs";

const demo=(type,kind)=>({id:"test-"+type,type,kind,x:0,z:0,scale:1.3});
function fullyHarvest(node,tool){
 const h=new ResourceHarvest();let r;
 for(let i=0;i<16;i++){
  r=h.hit(node,tool);
  if(r.stage==="felled"||r.stage==="broken")break;
 }
 assert.ok(["felled","broken"].includes(r.stage));
 return {h,collected:h.hit(node,tool)};
}
test("specific node sizes yield exact kilograms regardless of old crafting unit counts",()=>{
 for(const [type,kind,kg] of [["shrub","wood",5],["large-oak","wood",80],["pebble","stone",.5],["iron-deposit","stone",50]]){
  const {collected}=fullyHarvest(demo(type,kind),kind==="wood"?"axe":"mine");
  assert.equal(collected.stage,"collected");assert.equal(collected.massKg,kg);
  assert.ok(Object.values(collected.drops).every(Number.isSafeInteger));
  assert.ok(sceneryPrototype(type).indices.length>0);
 }
 assert.equal(RESOURCE_PROFILES["large-oak"].kg,80);
 const iron=harvestYield(demo("iron-deposit","stone"));
 assert.deepEqual(iron.drops,{ironOre:50});
});
test("saw works on fallen trees and produces planks without duplicating axe drops",()=>{
 const tree=demo("large-oak","wood"),h=new ResourceHarvest();
 assert.equal(h.hit(tree,"saw").ok,false);
 for(let i=0;i<7;i++)h.hit(tree,"axe");
 const result=h.hit(h.visual(tree),"saw");
 assert.equal(result.massKg,80);
 assert.equal(result.drops.plank,75);
 assert.equal(result.drops.wood,undefined);
 assert.equal(h.hit(tree,"saw").ok,false);
 const actions=new Actions(),actor={altitudeM:2.5,jumpY:0};
 assert.equal(actions.start("saw",actor,()=>({elevationM:300})),true);
 assert.equal(actions.getAnimation().action,"axe");
 const snapshot=actions.snapshot();
 assert.equal(Actions.fromSnapshot(snapshot).active.kind,"saw");
});
test("scenery includes new harvestable sizes without losing stable ids",()=>{
 const p=planWorldScenery({seed:77,radius:450,groundAt:()=>390,
   biomeAt:()=>({elevationM:390,category:"forest",water:false,river:false})});
 for(const type of ["shrub","large-oak","pebble","iron-deposit"]){
  assert.ok(p.trees.some(n=>n.type===type),type+" must appear");
 }
 const h=new ResourceHarvest(),n=p.trees.find(x=>x.type==="large-oak");
 assert.equal(h.visual(n).id,n.id);
});
test("single stone segments, named facilities, line tools and costs are persistent",()=>{
 const surface=(x,z)=>({lat:32+x*.00001,lon:42+z*.00001,elevationM:300});
 const cash={wood:100,stone:400,metal:40};
 const c=new ConstructionSystem();
 const wall=c.place("stone-wall",4,7,surface,cash);
 assert.equal(wall.ok,true);assert.equal(wall.created.length,1);assert.equal(cash.stone,398);
 const line=c.placeLine({x:11,z:11},{x:29,z:11},surface,cash);
 assert.equal(line.ok,true);assert.equal(line.created.length,9);
 assert.equal(cash.stone,380);
 assert.ok(c.structures.every(n=>n.progress===1));
 const shop=c.place("bookshop",70,20,surface,cash);
 assert.equal(shop.ok,true);assert.equal(FACILITIES["bookshop"].name,"本屋");
 const copy=new ConstructionSystem(c.snapshot());
 assert.deepEqual(copy.snapshot(),c.snapshot());
 assert.equal(c.place("bookshop",70,20,surface,cash).ok,false,"overlaps rejected");
 for(const type of ["stone-wall",...Object.keys(FACILITIES)]){
  const geo=placedBuildingGeometry(type);
  assert.ok(geo.indices.length>0);
  assert.ok(geo.positions.length/3<65535);
  assert.ok(geo.indices.every(i=>i>=0&&i<geo.positions.length/3));
 }
});
test("an invalid RTS line does not partially spend stone or save segments",()=>{
 const c=new ConstructionSystem(),money={wood:100,stone:100};
 const slope=(x,z)=>({elevationM:x<6?300:300+Math.floor(x)*2,lat:30,lon:40});
 const result=c.placeLine({x:0,z:0},{x:20,z:0},slope,money);
 assert.equal(result.ok,false);
 assert.equal(c.structures.length,0);assert.equal(money.stone,100);
 const fail=c.placeLine({x:0,z:0},{x:132,z:0},slope,money);
 assert.equal(fail.ok,false);
});
test("a 2-m wall blocks walking across but permits walking beside and between ends",()=>{
 const structures=[{id:1,kind:"stone-wall",x:1,z:0,rotation:0}];
 assert.equal(blockedByStoneWall({x:1,z:-2},{x:1,z:2},structures),true);
 assert.equal(blockedByStoneWall({x:6,z:-2},{x:6,z:2},structures),false);
 assert.equal(blockedByStoneWall({x:4,z:3},{x:4,z:4},structures),false);
});
test("real inventory chest can store measured mass alongside legacy item counts",()=>{
 const life=new Lifestyle(),hut={id:8,kind:"hut",x:4,z:3,progress:1};
 const chest=life.listChests([hut])[0],bag={wood:75,fiber:5};
 assert.equal(life.storeBackpack(chest.id,bag,80).ok,true);
 assert.equal(life.chestWeightsKg[String(chest.id)],80);
 const restored=new Lifestyle(life.snapshot());
 assert.equal(restored.chestWeightsKg[String(chest.id)],80);
 assert.equal(restored.chestInventory(chest.id).wood,75);
});

test("shared warehouse accepts a nearby backpack and retains material stock and kilograms",()=>{
 const c=new ConstructionSystem(),materials={wood:60,stone:40,metal:10};
 const surface=()=>({lat:28,lon:41,elevationM:300});
 const result=c.place("warehouse",8,12,surface,materials);
 assert.equal(result.ok,true);
 const site=c.nearestWarehouse(8,16);
 assert.equal(site?.id,result.created[0].id);
 assert.equal(c.nearestWarehouse(80,100),null);
 const bag={wood:75,fiber:5,ironOre:0};
 const deposited=c.depositWarehouse(site.id,bag,80);
 assert.equal(deposited.ok,true);
 assert.equal(deposited.moved,80);
 assert.equal(bag.wood,0);assert.equal(bag.fiber,0);
 assert.equal(c.warehouseStocks[String(site.id)].wood,75);
 assert.equal(c.warehouseWeightKg[String(site.id)],80);
 const restored=new ConstructionSystem(c.snapshot());
 assert.equal(restored.warehouseStocks[String(site.id)].wood,75);
 assert.equal(restored.warehouseWeightKg[String(site.id)],80);
});
