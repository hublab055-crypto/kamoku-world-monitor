import test from "node:test";
import assert from "node:assert/strict";
import {walkableSegment,chooseWorkPoint,MAX_WALK_SLOPE_DEG} from "../planet-explorer/terrain-collision.mjs";
import {groundCloudGeometry} from "../planet-explorer/ground-clouds.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";
import {Lifestyle} from "../planet-explorer/lifestyle.mjs";
import {ResourceHarvest} from "../planet-explorer/resource-harvest.mjs";
import {hutDoor} from "../planet-explorer/buildings.mjs";

const setup=()=>{
 const terrain=new Terrain(new Planet({seed:77})),controller=new ExplorerController(terrain);
 controller.altitudeM=2.5;controller.targetAltitudeM=2.5;
 const actions=new Actions(),squad=new SquadEngine(terrain,controller,actions),life=new Lifestyle();
 squad.attachLifestyle(life);
 return {terrain,controller,actions,squad,life};
};

test("steep hills stop motion while climbable grades pass",()=>{
 assert.equal(MAX_WALK_SLOPE_DEG,38);
 const from={x:0,z:0,y:100},to={x:2,z:0};
 const pass=walkableSegment(from,to,(x,z)=>({elevationM:100+x*.28}));
 assert.equal(pass.ok,true);
 const cliff=walkableSegment(from,to,(x,z)=>({elevationM:100+x*2.8}));
 assert.equal(cliff.ok,false);
 assert.equal(cliff.reason,"steep-slope");
 const water=walkableSegment(from,to,(x,z)=>({elevationM:100,river:x>1.0}));
 assert.equal(water.ok,false);
});
test("a nearby resource position stays in tool reach; impassable rings are rejected",()=>{
 const a={x:0,z:0},tree={x:9,z:2};
 assert.equal(chooseWorkPoint(a,tree,()=>false),null);
 const p=chooseWorkPoint(a,tree,()=>true);
 assert.ok(Math.hypot(p.x-tree.x,p.z-tree.z)<2.6);
});
test("named chests are independently persisted, distance-sortable, and transfer bags atomically",()=>{
 const life=new Lifestyle(),huts=[
 {id:1,kind:"hut",x:20,z:1,progress:1},
 {id:2,kind:"hut",x:80,z:1,progress:1}
 ];
 const a={x:15,z:1};let chests=life.listChests(huts,a,"distance");
 assert.equal(chests.length,2);
 const chosen=chests[0];
 assert.equal(life.renameChest(chosen.id,"木材の倉庫").ok,true);
 chests=life.listChests(huts,a,"name");
 assert.ok(chests.some(c=>c.name==="木材の倉庫"));
 const bag={wood:5,stone:2,clay:1,food:3};
 const stored=life.storeBackpack(chosen.id,bag);
 assert.equal(stored.ok,true);assert.equal(stored.moved,11);
 assert.deepEqual(bag,{wood:0,stone:0,clay:0,food:0});
 assert.equal(life.chestInventory(chosen.id).wood,5);
 assert.equal(life.chestInventory(chests.find(c=>c.id!==chosen.id).id).wood,undefined);
 assert.equal(new Lifestyle(life.snapshot()).chestInventory(chosen.id).wood,5);
});
test("always gather automatically targets real nodes, switches axe/pick and fills the backpack",()=>{
 const {squad,actions}=setup(),a=squad.get("player"),f=squad.frontier;
 const harvest=new ResourceHarvest();
 const tree={id:"oak-test",type:"broadleaf",kind:"wood",x:a.control.x+1,z:a.control.z};
 const rock={id:"rock-test",type:"boulder",kind:"stone",x:a.control.x+1,z:a.control.z+1};
 let nodes=[tree,rock],kinds=[],hits=0;
 f.attachWorld({
  list:()=>nodes.filter(n=>harvest.visual(n)),
  hit:(node,kind)=>{kinds.push(kind);hits++;return harvest.hit(node,kind);},
  effect:()=>{}
 });
 f.applyPreset("player");
 const p=f.person("player");p.radius=30;p.stamina=100;a.auto=true;
 assert.equal(a.rules[2].metric,"always");
 assert.equal(f.start(a,"gather_nearby",2),true);
 for(let i=0;i<90&&a.task;i++)f.tick(a,.2);
 assert.equal(harvest.visual(tree),null);
 assert.equal(harvest.visual(rock),null);
 assert.ok(kinds.includes("axe")&&kinds.includes("mine"));
 assert.ok(p.inventory.wood>0&&p.inventory.stone>0);
 assert.equal(actions.resources.wood,12,"gathered inventory remains in backpack until stored");
});
test("chosen named chest is the actual storage destination once backpack is too heavy",()=>{
 const {squad,actions,life}=setup(),a=squad.get("player"),f=squad.frontier;
 a.auto=true;
 actions.structures.push({id:1,kind:"hut",x:a.control.x,z:a.control.z,progress:1});
 const chest=life.listChests(actions.structures,a.control)[0];
 assert.ok(chest);
 f.attachWorld({list:()=>[],hit:()=>({ok:false}),storageChanged:()=>{}});
 f.person("player").inventory={wood:8,stone:1,food:0,water:0,fiber:0,metal:0,clay:0,soil:0};
 assert.ok(f.loadKg("player")>18);
 assert.equal(f.setChest("player",chest.id),true);
 assert.equal(f.start(a,"store_chest",1),true);
 // The actor walks to the hut door; test places it in reach to complete storage.
 const door=hutDoor(f.selectedChest(a).hut);
 a.control.x=door.x;a.control.z=door.z;
 for(let i=0;i<20&&a.task;i++)f.tick(a,.1);
 assert.equal(f.loadKg("player"),0);
 assert.equal(life.chestInventory(chest.id).wood,8);
 assert.equal(actions.resources.wood,12);
});
test("mobile-friendly cloud bank geometry is deterministic and small enough for 16-bit indices",()=>{
 const a=groundCloudGeometry({radius:450,seed:77,baseElevation:400}),
  b=groundCloudGeometry({radius:450,seed:77,baseElevation:400});
 assert.ok(a.indices.length>0);
 assert.deepEqual(a,b);
 assert.ok(a.positions.length/3<65535);
 assert.ok(a.indices.every(i=>i>=0&&i<a.positions.length/3));
 assert.equal(groundCloudGeometry({radius:12000}).indices.length,0);
});
