import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {TownLife,TOWN_WARES,TOWN_TOPICS} from "../planet-explorer/town-life.mjs";
import {townInteriorGeometry} from "../planet-explorer/settlement-geometry.mjs";
import {settlementLayout} from "../planet-explorer/settlements.mjs";
import {installTownInteractionUI} from "../planet-explorer/town-interaction-ui.mjs";
const makeActor=(x=0,z=0)=>({
 x,z,nearGround:true,travelMode:"walk",moveTarget:{x:4,z:1},
 clearMoveTarget(){this.moveTarget=null;}
});
const market=()=>settlementLayout("tower").buildings.findIndex(b=>b.type==="market");
test("each city has residents and building IDs that resolve independently",()=>{
 const town=new TownLife(),layout=settlementLayout("tower");
 assert.ok(layout.residents.length>10);
 assert.ok(layout.buildings.length>20);
 const resident=town.find("tower","resident-0","resident");
 const building=town.find("tower","village-"+market(),"village");
 assert.equal(resident.kind,"resident");
 assert.equal(building.type,"market");
 assert.equal(town.find("tower","village-99999","village"),null);
 assert.equal(town.find("pioneer","resident-0","resident"),null);
 assert.equal(town.find("wilderness","resident-0","resident"),null);
});
test("town conversation is contextual and relationship increases once per day/topic",()=>{
 const town=new TownLife(),resident=town.find("tower","resident-0","resident");
 const actor=makeActor(resident.x,resident.z);
 const one=town.dialogue("tower",resident.id,"greeting",actor,1.4);
 assert.equal(one.ok,true);assert.match(one.message,/ルミナス/);
 assert.equal(town.friendship["tower:resident-0"],1);
 town.dialogue("tower",resident.id,"greeting",actor,1.9);
 assert.equal(town.friendship["tower:resident-0"],1);
 assert.equal(town.dialogue("tower",resident.id,"rumor",actor,1.9).ok,true);
 assert.equal(town.friendship["tower:resident-0"],2);
 town.dialogue("tower",resident.id,"greeting",actor,2.2);
 assert.equal(town.friendship["tower:resident-0"],3);
 assert.equal(town.dialogue("tower",resident.id,"nonsense",actor,2).ok,false);
 assert.equal(TOWN_TOPICS.length,3);
});
test("remote, sea or orbit access is refused without mutating relationships",()=>{
 const town=new TownLife(),resident=town.find("tower","resident-0","resident");
 const actor=makeActor(1000,1000);
 assert.equal(town.dialogue("tower",resident.id,"greeting",actor).ok,false);
 actor.x=resident.x;actor.z=resident.z;actor.travelMode="swim";
 assert.equal(town.dialogue("tower",resident.id,"greeting",actor).ok,false);
 assert.deepEqual(town.friendship,{});
});
test("town shop buys and sells with real inventory, limits and prices",()=>{
 const town=new TownLife(),id="village-"+market(),shop=town.find("tower",id,"village");
 const actor=makeActor(shop.x,shop.z);
 const actions={resources:{apple:0}},life={inventory:{meal:0}};
 assert.equal(town.trade("tower",id,"apple","buy",actor,actions,life).ok,true);
 assert.equal(actions.resources.apple,1);assert.equal(town.coins,37);
 assert.equal(town.trade("tower",id,"apple","sell",actor,actions,life).ok,true);
 assert.equal(actions.resources.apple,0);assert.equal(town.coins,38);
 assert.equal(town.trade("tower",id,"dragonRelic","buy",actor,actions,life).ok,false);
 assert.equal(town.trade("tower",id,"apple","sell",actor,actions,life).ok,false);
 town.coins=0;
 assert.equal(town.trade("tower",id,"apple","buy",actor,actions,life).ok,false);
 assert.equal(TOWN_WARES.market.some(w=>w.item==="meal"),true);
});
test("entry requires proximity and can be exited without teleporting or corrupting saves",()=>{
 const town=new TownLife(),id="village-"+market(),shop=town.find("tower",id,"village");
 const actor=makeActor(900,900),original={...actor};
 assert.equal(town.enter("tower",id,actor).ok,false);
 actor.x=shop.x;actor.z=shop.z;
 assert.equal(town.enter("tower",id,actor).ok,true);
 assert.equal(actor.moveTarget,null);
 assert.equal(town.inside.buildingId,id);
 assert.equal(town.enter("tower","village-0",actor).ok,false);
 const saved=town.snapshot();
 assert.equal(saved.inside,undefined);
 assert.equal(new TownLife(saved).inside,null);
 assert.equal(town.leave().ok,true);
 assert.equal(town.inside,null);
 assert.equal(town.leave().ok,false);
 assert.equal(actor.x,shop.x);
 assert.notEqual(original.x,actor.x);
});
test("town room is indexed 3D geometry for shops and residences",()=>{
 for(const kind of ["market","cabin","workshop","lodge"]){
  const mesh=townInteriorGeometry(kind);
  assert.ok(mesh.indices.length>100);
  assert.equal(mesh.positions.length,mesh.normals.length);
  assert.equal(mesh.positions.length,mesh.colors.length);
  assert.ok(Math.max(...mesh.positions.filter((_,i)=>i%3===1))>2);
 }
});
test("game wires town overlay, save key, renderer and 3D picking",()=>{
 assert.equal(typeof installTownInteractionUI,"function");
 const base=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",base),"utf8");
 const app=readFileSync(new URL("app.mjs",base),"utf8");
 const render=readFileSync(new URL("render.mjs",base),"utf8");
 const css=readFileSync(new URL("style.css",base),"utf8");
 for(const id of ["viewport-town","town-interaction-panel","town-interaction-close","town-interaction-title",
  "town-interaction-detail","town-interaction-actions","town-interaction-status"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/townUI=installTownInteractionUI/);
 assert.match(app,/v0_8s:townLife\.snapshot\(\)/);
 assert.match(app,/townLife\.dialogue|installTownInteractionUI/);
 assert.match(render,/pickTownTarget/);
 assert.match(render,/renderTownInterior\(/);
 assert.match(css,/\.town-interaction-panel/);
});
