import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {xrIdentity} from "../planet-explorer/xr-spatial.mjs";
import {VRPhysicalControls,xrBodyAnchors} from "../planet-explorer/xr-physical-controls.mjs";
import {vrLoadSpeedFactor,vrCanCarry,vrNearestPickup,vrHandAtBag,
 vrWorldToHeadset,VR_BACKPACK_CAPACITY_KG} from "../planet-explorer/xr-backpack.mjs";
import {SocialEquipment,ITEM_MAP} from "../planet-explorer/social-equipment.mjs";
const source=f=>readFileSync(new URL("../planet-explorer/"+f,import.meta.url),"utf8");
const matrixAt=p=>{const m=xrIdentity();m[12]=p[0];m[13]=p[1];m[14]=p[2];return m;};
const head=matrixAt([0,1.7,0]);
function physical(hand,point){
 const c=new VRPhysicalControls();
 const h=xrBodyAnchors(head,{floorY:0});
 c.setPose({head,left:matrixAt(hand==="left"?point:[-.8,.9,0]),
  right:matrixAt(hand==="right"?point:[.8,.9,0])},0,{floorY:0});
 return {c,h};
}
test("No load penalty under 12kg; continuous slowdown at heavier weights",()=>{
 assert.equal(vrLoadSpeedFactor(0),1);
 assert.equal(vrLoadSpeedFactor(12),1);
 assert.ok(vrLoadSpeedFactor(18)<1&&vrLoadSpeedFactor(18)>.8);
 assert.ok(vrLoadSpeedFactor(35)<vrLoadSpeedFactor(18));
 assert.equal(vrLoadSpeedFactor(60),.4);
 assert.equal(vrLoadSpeedFactor(Number.NaN),1);
});
test("Backpack enforces its kilogram capacity without rounding or duplication",()=>{
 assert.ok(vrCanCarry(51,4));
 assert.ok(!vrCanCarry(51.01,4));
 assert.ok(!vrCanCarry(55,.5));
 assert.ok(!vrCanCarry(-1,1));
 assert.equal(VR_BACKPACK_CAPACITY_KG,55);
});
test("VR pickup requires both local player proximity and physical hand proximity",()=>{
 const actor={x:4,z:7},stage=xrIdentity(),near={id:"a",x:4,z:7,quantity:2,kind:"stone"};
 const hand=matrixAt([0,.43,0]);
 const result=vrNearestPickup(hand,stage,actor,[near]);
 assert.equal(result.item.id,"a");
 assert.equal(vrWorldToHeadset(near,actor,stage)[1],.43);
 assert.equal(vrNearestPickup(matrixAt([1,.43,0]),stage,actor,[near]),null);
 assert.equal(vrNearestPickup(hand,stage,actor,[{...near,x:actor.x+3.2}]),null);
 assert.equal(vrNearestPickup(hand,stage,actor,[{...near,quantity:0}]),null);
});
test("Backpack has shoulder and accessible front chest openings",()=>{
 const a=xrBodyAnchors(head,{floorY:0});
 assert.equal(vrHandAtBag(matrixAt([20,20,20]),a),false);
 const p=[a.chest[0]+a.forward[0]*.16,a.chest[1]-.03,a.chest[2]+a.forward[2]*.16];
 assert.equal(vrHandAtBag(matrixAt(p),a),true);
});
test("Right Touch grip retrieves axe from belt and returns it on a second grip",()=>{
 const anchors=xrBodyAnchors(head,{floorY:0});
 const {c}=physical("right",anchors.toolBeltRight);
 const first=c.grab("right",()=>true);
 assert.deepEqual({kind:first.kind,item:first.item},{kind:"tool",item:"axe"});
 assert.equal(c.snapshot().toolHeld.right,"axe");
 const second=c.grab("right",()=>true);
 assert.equal(second.kind,"stowTool");assert.equal(c.snapshot().toolHeld.right,null);
});
test("Right Touch grip takes pickaxe from shoulder when bow is not held",()=>{
 const anchors=xrBodyAnchors(head,{floorY:0});
 const {c}=physical("right",anchors.pickShoulder);
 const result=c.grab("right",()=>true);
 assert.equal(result.kind,"tool");assert.equal(result.item,"pickaxe");
});
test("Left Touch belt and carry strap retrieve hammer and fishing rod",()=>{
 const anchors=xrBodyAnchors(head,{floorY:0});
 for(const [slot,kind] of [["toolBeltLeft","hammer"],["rodCarry","fishingRod"]]){
  const {c}=physical("left",anchors[slot]);
  const r=c.grab("left",()=>true);
  assert.equal(r.kind,"tool");assert.equal(r.item,kind);
 }
});
test("Unauthorized hand equipment is not visually conjured",()=>{
 const anchors=xrBodyAnchors(head,{floorY:0});
 const {c}=physical("right",anchors.toolBeltRight);
 const r=c.grab("right",()=>false);
 assert.equal(r.kind,"unavailable");assert.equal(c.snapshot().toolHeld.right,null);
});
test("Hammer is an equippable persistent shared item executing ordinary build action",()=>{
 assert.equal(ITEM_MAP.get("hammer").name,"金槌");
 const model=new SocialEquipment();
 const who={id:"player",name:"開拓者"};
 const equipped=model.equipHand(who,"right","hammer",{},null);
 assert.equal(equipped.ok,true);
 const action=model.useHand(who,"right",{},null);
 assert.equal(action.ok,true);assert.equal(action.action,"build");
});
test("VR backpack callbacks are tied to real Frontier nodes and arrow recovery",()=>{
 const u=source("xr-ui.mjs"),app=source("app.mjs");
 assert.match(u,/vrNearestPickup\(/);
 assert.match(u,/vrHandAtBag\(/);
 assert.match(u,/onVRStow\(carried\.item\)/);
 assert.match(app,/onVRHasBag:\(\)=>appearance\?\.bag!=="none"/);
 assert.match(app,/projectiles\.recover\(arrow\.id\)/);
 assert.match(app,/node\.quantity--;/);
 assert.match(app,/player\.inventory\[node\.kind\]/);
 assert.match(app,/vrCanCarry\(squad\.frontier\.loadKg\("player"\),massKg\)/);
 assert.match(app,/controller\.walkSpeed=5\*vrLoadSpeedFactor/);
});
test("VR body visibly includes backpack, held loot and tool meshes; MR remains intact",()=>{
 const render=source("render.mjs"),u=source("xr-ui.mjs");
 assert.match(render,/if\(rig\.backpack\)/);
 assert.match(render,/if\(rig\.heldDrop\)/);
 assert.match(render,/rig\.toolHeld\?\.\[side\]/);
 assert.match(u,/if\(activeMode==="mr-planet"\)/);
 assert.match(u,/if\(activeMode==="mr-rts"\)/);
});
