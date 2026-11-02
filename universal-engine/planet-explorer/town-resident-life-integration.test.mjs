import {test} from "node:test";
import assert from "node:assert/strict";
import {TownLife} from "./town-life.mjs";
import {settlementLayout} from "./settlements.mjs";
import {sharedDoor} from "./town-shared-world.mjs";
const id="capital",layout=settlementLayout(id),town=()=>new TownLife();
function actor(x=0,z=0){
 return {x,z,nearGround:true,travelMode:"walk",moving:false,
  locationAt(x,z){return {lat:28+z/100000,lon:42+x/100000}},
  clearMoveTarget(){}};
}
function enterCabin(t){
 const i=layout.buildings.findIndex(b=>b.type==="cabin"),site={...layout.buildings[i],id:"village-"+i};
 const door=sharedDoor(site),a=actor(door.x,door.z);
 assert.equal(t.toggleHallDoor(id,site.id,a).ok,true);
 assert.equal(t.enter(id,site.id,a).ok,true);
 return a;
}
test("NPC work schedule and resident lookup expose the same moving world position",()=>{
 const t=town(),r=layout.residents[0];
 for(const hour of [3,7.5,10,13,18.5,23]){
  const p=t.residentAt(id,r.id,61+hour/24);
  assert.ok(p&&Number.isFinite(p.x)&&Number.isFinite(p.z));
  assert.ok(p.occupation&&p.activity&&p.kind==="resident");
 }
});
test("NPC behind a closed house wall is not remotely conversational",()=>{
 const t=town(),r=t.residentAt(id,layout.residents[0].id,61+2/24);
 assert.equal(r.inside,true);
 const a=actor(r.x,r.z);
 assert.equal(t.dialogue(id,r.id,"greeting",a,61+2/24).ok,false);
});
test("NPC may be greeted inside the same building, friendship is awarded once daily",()=>{
 const t=town(),now=61+2/24,r=t.residentAt(id,layout.residents[0].id,now);
 const a=actor(r.x,r.z);
 t.inside={townId:id,buildingId:r.buildingId,pose:{x:0,z:0,yaw:0,moving:false}};
 assert.equal(t.dialogue(id,r.id,"greeting",a,now).ok,true);
 const relation=t.friendship[id+":"+r.id];
 assert.equal(t.dialogue(id,r.id,"greeting",a,now).ok,true);
 assert.equal(t.friendship[id+":"+r.id],relation);
});
test("actual cabin bed resting and sitting use existing life stamina and room movement",()=>{
 const t=town(),a=enterCabin(t),life={activity:"idle",inventory:{meal:2},stats:{stamina:10,hunger:40},rest(n){this.stats.stamina=Math.min(100,this.stats.stamina+n);}};
 t.inside.pose.x=-2;t.inside.pose.z=-.4;
 assert.equal(t.useTownFurniture("sleep",life).ok,true);
 assert.equal(life.stats.stamina,80);
 assert.equal(life.activity,"sleep");
 assert.equal(t.walk(.1,{forward:1}),false);
 assert.equal(t.useTownFurniture("stand",life).ok,true);
 t.inside.pose.x=2.6;t.inside.pose.z=2.55;
 assert.equal(t.useTownFurniture("sit",life).ok,true);
 assert.equal(t.walk(.1,{forward:1}),false);
 assert.equal(t.useTownFurniture("stand",life).ok,true);
 assert.equal(t.leave(a,life).ok,true);
 assert.equal(life.activity,"idle");
});
test("meal requires inventory, reduces only one unit and never overdrafts",()=>{
 const t=town(),a=enterCabin(t),life={activity:"idle",inventory:{meal:1},stats:{hunger:60},rest(){}};
 t.inside.pose.x=1.45;t.inside.pose.z=.4;
 assert.equal(t.useTownFurniture("eat",life).ok,true);
 assert.equal(life.inventory.meal,0);
 assert.equal(life.stats.hunger,90);
 t.useTownFurniture("stand",life);
 assert.equal(t.useTownFurniture("eat",life).ok,false);
 assert.equal(life.inventory.meal,0);
 t.leave(a,life);
});
test("furniture only works indoors at the physical object, no extra save schema",()=>{
 const t=town(),life={activity:"idle",inventory:{meal:1},stats:{hunger:30},rest(){}};
 assert.equal(t.useTownFurniture("sleep",life).ok,false);
 const a=enterCabin(t);
 t.inside.pose.x=0;t.inside.pose.z=2.77;
 assert.equal(t.useTownFurniture("sleep",life).ok,false);
 const saved=t.snapshot();
 assert.equal(saved.schemaVersion,1);
 assert.equal(saved.inside,undefined);
 assert.equal(saved.furnitureAction,undefined);
 t.leave(a,life);
});
