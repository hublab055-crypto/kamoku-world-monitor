import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Lifestyle,CATALOG} from "../planet-explorer/lifestyle.mjs";
import {furnitureGeometry,campGeometry,flameGeometry} from "../planet-explorer/lifestyle-geometry.mjs";
import {Actions} from "../planet-explorer/actions.mjs";

const make=()=>{
 const actions=new Actions();
 const hut={id:1,kind:"hut",x:0,z:0,lat:28,lon:42,height:100,progress:1};
 actions.structures=[hut];
 const actor={x:0,z:0,lat:28,lon:42,yaw:0,altitudeM:2.5,jumpY:0,moving:false,
  clearMoveTarget(){this.moveTarget=null;},locationAt(x,z){return {lat:28+x/10000,lon:42+z/10000};}};
 const life=new Lifestyle();
 return {actions,hut,actor,life};
};
test("all craft recipes use supported nonnegative resources and each 3D item has a type",()=>{
 const categories=new Set(["furniture","item","deployable"]);
 for(const [key,item] of Object.entries(CATALOG)){
  assert.ok(item.name&&item.emoji);
  assert.ok(categories.has(item.category),key);
  assert.ok(Object.values(item.cost).every(v=>Number.isInteger(v)&&v>0),key);
  assert.ok(Object.keys(item.cost).every(k=>["wood","stone","fiber","clay","metal"].includes(k)),key);
 }
 for(const key of ["bed","chair","table","fireplace","kitchen","bookshelf","lamp","tent","bedroll",
  "plate","cup","bowl","pot","spoon"])assert.ok(CATALOG[key]);
});
test("old cabin creates functional starter furniture only once",()=>{
 const {hut,life}=make();
 life.ensureHut(hut);
 assert.equal(life.atHut(hut).length,7);
 assert.deepEqual(life.atHut(hut).map(x=>x.kind).sort(),
  ["bed","chest","table","chair","chair","lamp","bookshelf"].sort());
 const snapshot=life.snapshot();
 const again=new Lifestyle(snapshot);again.ensureHut(hut);
 assert.equal(again.atHut(hut).length,7);
 assert.equal(again.nextId,life.nextId);
});
test("crafting deducts materials and placing/removing furniture preserves inventories",()=>{
 const {actions,life,hut}=make();life.ensureHut(hut);
 const old=actions.resources.wood;
 assert.equal(life.craft("chair",actions.resources).ok,true);
 assert.equal(actions.resources.wood,old-3);
 assert.equal(life.count("chair"),1);
 const p=life.placeFurniture("chair",hut,-1.78,1.35,90);
 assert.equal(p.ok,true,p.message);
 assert.equal(life.count("chair"),0);
 const created=life.atHut(hut).find(f=>f.kind==="chair"&&f.rotation===90);
 assert.ok(created);
 assert.equal(life.placeFurniture("chair",hut,-1.78,1.35,90).ok,false);
 assert.equal(life.pickUpFurniture(created.id,hut).ok,true);
 assert.equal(life.count("chair"),1);
 assert.equal(life.atHut(hut).some(f=>f.id===created.id),false);
});
test("placement rejects door obstruction and exterior wall",()=>{
 const {life,hut}=make();
 assert.equal(life.canPlace("chair",hut,0,1.85),false);
 assert.equal(life.canPlace("bed",hut,3,0),false);
 assert.equal(life.canPlace("chair",hut,0,0),false);
 assert.equal(life.canPlace("chair",hut,-1.8,1.4),true);
});
test("sleep, chair use, table meal, dishes, fire and cooking have real state transitions",()=>{
 const {life,hut,actor,actions}=make();life.ensureHut(hut);
 const choose=kind=>life.atHut(hut).find(f=>f.kind===kind).id;
 const bed=choose("bed"),chair=choose("chair"),table=choose("table");
 life.stats.stamina=18;
 assert.equal(life.use(bed,"sleep",hut,actor,actions.resources).ok,true);
 assert.equal(life.activity,"sleep");assert.equal(life.stats.stamina,88);
 assert.equal(life.use(chair,"sit",hut,actor,actions.resources).ok,true);
 assert.equal(life.activity,"sit");
 assert.equal(life.use(chair,"stand",hut,actor,actions.resources).ok,true);
 assert.equal(life.activity,"idle");
 assert.equal(life.craft("plate",actions.resources).ok,true);
 life.inventory.meal=2;
 assert.equal(life.use(table,"serve",hut,actor,actions.resources).ok,true);
 assert.equal(life.count("served"),1);
 assert.equal(life.use(table,"eat",hut,actor,actions.resources).ok,true);
 assert.equal(life.count("dirtyPlate"),1);
 assert.equal(life.craft("fireplace",actions.resources).ok,true);
 assert.equal(life.placeFurniture("fireplace",hut,-1.75,1.28).ok,true);
 const fireplace=choose("fireplace");
 assert.equal(life.use(fireplace,"cook",hut,actor,actions.resources).ok,false);
 assert.equal(life.use(fireplace,"light",hut,actor,actions.resources).ok,true);
 assert.equal(life.use(fireplace,"cook",hut,actor,actions.resources).ok,true);
 assert.equal(life.count("meal"),2);
});
test("cups, bowl, spoons and kitchen washing form a repeatable food loop",()=>{
 const {life,actions,hut,actor}=make();life.ensureHut(hut);
 assert.equal(life.useItem("cup").ok,true);
 assert.equal(life.count("dirtyCup"),1);
 life.inventory.meal=2;
 assert.equal(life.useItem("bowl").ok,true);
 assert.equal(life.count("servedBowl"),1);
 assert.equal(life.useItem("spoon").ok,true);
 assert.equal(life.count("dirtyBowl"),1);
 assert.equal(life.craft("kitchen",actions.resources).ok,true);
 assert.equal(life.placeFurniture("kitchen",hut,-1.78,1.30).ok,true);
 const kitchen=life.atHut(hut).find(f=>f.kind==="kitchen").id;
 assert.equal(life.use(kitchen,"wash",hut,actor,actions.resources).ok,true);
 assert.equal(life.count("dirtyCup"),0);assert.equal(life.count("dirtyBowl"),0);
 assert.equal(life.use(kitchen,"fetchWater",hut,actor,actions.resources).ok,true);
});
test("craft deploy use and pack portable tent and bedroll with no item duplication",()=>{
 const {life,actions,actor}=make();actions.structures=[];
 assert.equal(life.craft("tent",actions.resources).ok,true);
 assert.equal(life.craft("bedroll",actions.resources).ok,true);
 assert.equal(life.count("tent"),1);assert.equal(life.count("bedroll"),1);
 const terrain=()=>({water:false,river:false,elevationM:100});
 assert.equal(life.deploy("tent",actor,terrain,[]).ok,true);
 assert.equal(life.count("tent"),0);
 const tent=life.deployments[0];assert.equal(tent.kind,"tent");
 actor.z=tent.z;
 assert.equal(life.useCamp(tent.id,"enter",actor).ok,true);
 assert.equal(life.insideTentId,tent.id);
 assert.equal(life.pack(tent.id,actor).ok,false);
 assert.equal(life.exitTent(actor).ok,true);
 assert.equal(life.pack(tent.id,actor).ok,true);
 assert.equal(life.count("tent"),1);assert.equal(life.deployments.length,0);
 assert.equal(life.deploy("bedroll",actor,terrain,[]).ok,true);
 const bedroll=life.deployments[0];actor.z=bedroll.z;actor.x=bedroll.x;
 life.stats.stamina=1;
 assert.equal(life.useCamp(bedroll.id,"sleep",actor).ok,true);
 assert.ok(life.stats.stamina>40);
 assert.equal(life.useCamp(bedroll.id,"pack",actor).ok,true);
 assert.equal(life.count("bedroll"),1);
});
test("portable deployment cannot happen on water, near houses or indoors",()=>{
 const {life,actions,actor}=make();
 life.inventory.tent=1;
 const count=life.count("tent");
 assert.equal(life.deploy("tent",actor,()=>({water:true,river:false,elevationM:0}),[]).ok,false);
 assert.equal(life.deploy("tent",actor,()=>({water:false,river:false,elevationM:100}),actions.structures).ok,false);
 assert.equal(life.count("tent"),count);
});
test("life state, furnished hut and deployments survive JSON snapshot and old saves",()=>{
 const {life,actions,hut,actor}=make();
 life.ensureHut(hut);life.inventory.tent=1;actions.structures=[];
 const sample=()=>({water:false,river:false,elevationM:100});
 assert.equal(life.deploy("tent",actor,sample,[]).ok,true);
 life.readPage("iroha",1);
 const state=JSON.parse(JSON.stringify(life.snapshot()));
 const restored=new Lifestyle(state);
 assert.equal(restored.deployments.length,1);
 assert.equal(restored.furnishings.length,7);
 assert.equal(restored.stats.knowledge,.25);
 assert.equal(restored.readPage("iroha",1),false);
 assert.equal(restored.count("tent"),0);
 const old=new Lifestyle();assert.equal(old.deployments.length,0);
});
test("all furniture and campsite shapes have valid indexed triangle geometry",()=>{
 for(const kind of Object.keys(CATALOG).filter(k=>CATALOG[k].inside)){
  const m=furnitureGeometry(kind);
  assert.ok(m.indices.length>=3,kind);
  assert.equal(m.positions.length,m.normals.length,kind);
  assert.equal(m.positions.length,m.colors.length,kind);
  assert.ok(m.indices.every(i=>i>=0&&i<m.positions.length/3),kind);
 }
 for(const m of [campGeometry("tent"),campGeometry("tent",true),campGeometry("bedroll"),flameGeometry()]){
  assert.ok(m.indices.length>0);
  assert.equal(m.positions.length,m.colors.length);
 }
});
test("life UI, character animations, renderer and legacy saves are wired together",()=>{
 const dir=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",dir),"utf8");
 const app=readFileSync(new URL("app.mjs",dir),"utf8");
 const render=readFileSync(new URL("render.mjs",dir),"utf8");
 const animator=readFileSync(new URL("animator.mjs",dir),"utf8");
 for(const id of ["viewport-life","life-overlay","life-list","life-place","life-rotate",
  "life-place-confirm","life-close","toolbar-life","import-v07d-save"])
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 assert.match(app,/installLifestyleUI/);
 assert.match(app,/v0_7g:life.snapshot\(\)/);
 assert.match(app,/V07D_SAVE_KEY/);
 assert.match(render,/drawLifestyle/);
 assert.match(render,/pickLife/);
 assert.match(animator,/lifeAction/);
});
