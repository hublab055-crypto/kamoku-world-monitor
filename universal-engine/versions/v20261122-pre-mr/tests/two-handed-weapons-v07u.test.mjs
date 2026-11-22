import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SocialEquipment,normalizeEquipmentHands,TWO_HANDED_ITEMS} from "../planet-explorer/social-equipment.mjs";
import {ActionSlots} from "../planet-explorer/action-slots.mjs";
import {Actions,actionDuration} from "../planet-explorer/actions.mjs";
import {BattleTest} from "../planet-explorer/battle-test.mjs";
import {samplePose} from "../planet-explorer/rig.mjs";
import {SmoothAnimator} from "../planet-explorer/animator.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";

const player=()=>({id:"player",name:"開拓者",x:0,z:0,yaw:0,altitudeM:2.5,jumpY:0});
test("two-handed equipment pairs hands, clears offhand, and survives save/restore",()=>{
 const gear=new SocialEquipment(),p=player();
 assert.deepEqual(TWO_HANDED_ITEMS,["spear","greatsword"]);
 for(const weapon of TWO_HANDED_ITEMS){
  assert.ok(gear.quantity(p,weapon,null,null)>=1);
  assert.equal(gear.equipHand(p,"left",weapon,null,null).ok,true);
  assert.deepEqual(gear.actor("player").hands,{right:weapon,left:weapon});
  assert.equal(gear.useHand(p,"right",null,null).action,weapon);
  assert.equal(gear.useHand(p,"left",null,null).action,weapon);
  assert.deepEqual(new SocialEquipment(gear.snapshot()).actor("player").hands,{right:weapon,left:weapon});
  assert.equal(gear.equipHand(p,"left","shield",null,null).ok,true);
  assert.deepEqual(gear.actor("player").hands,{right:"none",left:"shield"});
  assert.equal(gear.equipHand(p,"right",weapon,null,null).ok,true);
  assert.equal(gear.equipHand(p,"left","none",null,null).ok,true);
  assert.deepEqual(gear.actor("player").hands,{right:"none",left:"none"});
 }
 assert.deepEqual(normalizeEquipmentHands({right:"spear",left:"shield"}),{right:"spear",left:"spear"});
 const legacy=gear.snapshot();
 legacy.actors.player.hands={right:"spear",left:"none"};
 assert.deepEqual(new SocialEquipment(legacy).actor("player").hands,{right:"spear",left:"spear"});
});
test("action deck setting keeps spear and greatsword as a paired loadout",()=>{
 const deck=new ActionSlots();
 assert.equal(deck.configure(0,{hands:{right:"spear"}}),true);
 assert.deepEqual(deck.current().hands,{right:"spear",left:"spear"});
 const reloaded=new ActionSlots(deck.snapshot());
 assert.deepEqual(reloaded.current().hands,{right:"spear",left:"spear"});
 assert.equal(reloaded.configure(0,{hands:{left:"greatsword"}}),true);
 assert.deepEqual(reloaded.current().hands,{right:"greatsword",left:"greatsword"});
 assert.equal(reloaded.configure(0,{hands:{left:"shield"}}),true);
 assert.deepEqual(reloaded.current().hands,{right:"none",left:"shield"});
});
test("spear and greatsword both have timed attacks without resource duplication",()=>{
 const ctrl=player(),actions=new Actions(),before={...actions.resources};
 for(const weapon of TWO_HANDED_ITEMS){
  assert.ok(actionDuration(weapon,"thrust")>0);
  assert.ok(actionDuration(weapon,"combo")>actionDuration(weapon,"thrust"));
  assert.equal(actions.start(weapon,ctrl,()=>null,"thrust"),true);
  assert.equal(actions.start(weapon,ctrl,()=>null),false,"no overlapping actions");
  assert.equal(Actions.fromSnapshot(actions.snapshot()).active.kind,weapon);
  for(let i=0;i<15;i++)actions.advance(.1);
  assert.equal(actions.active,null);
 }
 assert.deepEqual(actions.resources,before);
});
test("spear thrust outranges greatsword; sweeping attacks affect a wider arc",()=>{
 const battle=new BattleTest(),p=player();
 const foe=battle.spawn(p,"goblin").enemy;
 foe.x=0;foe.z=4.6;
 assert.equal(battle.hitWeapon(p,"greatsword","thrust").length,0);
 assert.equal(battle.hitWeapon(p,"spear","thrust").length,1);
 assert.equal(foe.hp,foe.maxHp-27);
 const side=battle.spawn(p,"orc").enemy;
 side.x=2;side.z=1;
 const wide=battle.hitWeapon(p,"greatsword","sweep");
 assert.ok(wide.some(x=>x.id===side.id),"wide greatsword sweep catches the side target");
 const far=battle.spawn(p,"orc").enemy;
 far.x=0;far.z=4.45;
 const active={kind:"spear",variant:"thrust",time:0,duration:1};
 assert.deepEqual(battle.resolveAttack(active,p),[]);
 active.time=.66;
 assert.ok(battle.resolveAttack(active,p).some(x=>x.id===far.id));
 assert.deepEqual(battle.resolveAttack(active,p),[],"same impact only lands once");
});
test("animated spear and greatsword use both arms, including combo moves",()=>{
 for(const weapon of TWO_HANDED_ITEMS){
  for(const variant of ["thrust","sweep","overhead","combo"]){
   const pose=samplePose({action:weapon,variant,progress:.45});
   assert.equal(pose.tool,weapon);
   assert.ok(pose.leftShoulderX<-.6);
   assert.ok(pose.rightShoulderX<-.6);
  }
  const animator=new SmoothAnimator();
  assert.equal(animator.update(.1,{action:weapon,progress:.4,hand:"right"}).tool,weapon);
 }
});
test("allied spear combos emit two impact events, not one per frame",()=>{
 const terrain=new Terrain(new Planet({seed:63}));
 const ctrl=new ExplorerController(terrain),actions=new Actions();
 const squad=new SquadEngine(terrain,ctrl,actions),ally=squad.get("scout");
 ally.control.altitudeM=2.5;ally.control.targetAltitudeM=2.5;
 assert.equal(squad.performEquippedAction("scout","spear","right","combo"),true);
 const events=[];
 squad.onEquippedImpact=(agent,task)=>events.push({id:agent.id,kind:task.kind,style:task.style});
 for(let i=0;i<20;i++)squad.advance(.1);
 assert.deepEqual(events.map(e=>e.style),["sweep","thrust"]);
});
test("browser equipment and renderer expose two-handed weapons without duplicate offhand meshes",()=>{
 const ui=readFileSync(new URL("../planet-explorer/frontier-interaction-ui.mjs",import.meta.url),"utf8");
 const render=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 for(const kind of TWO_HANDED_ITEMS){
  assert.ok(ui.includes(kind),"loadout dropdown includes "+kind);
  assert.ok(render.includes(kind+"Geometry"),"geometry for "+kind);
 }
 assert.match(render,/if\(paired&&hand==="left"\)continue/);
 assert.match(ui,/function meleeOrder/);
 assert.match(html,/両手武器|両手剣/);
 assert.match(app,/battle\?\.hitWeapon/);
});
