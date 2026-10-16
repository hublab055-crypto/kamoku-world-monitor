import test from "node:test";
import assert from "node:assert/strict";
import {SocialEquipment} from "../planet-explorer/social-equipment.mjs";
import {samplePose,point} from "../planet-explorer/rig.mjs";
import {EQUIPMENT_SCALE,heldItemTransform} from "../planet-explorer/render.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";
import {Lifestyle} from "../planet-explorer/lifestyle.mjs";

function scene(){
 const terrain=new Terrain(new Planet({seed:77}));
 const control=new ExplorerController(terrain);
 const actions=new Actions(),squad=new SquadEngine(terrain,control,actions);
 squad.attachLifestyle(new Lifestyle());
 return {control,actions,squad,equipment:new SocialEquipment(),life:new Lifestyle()};
}
test("scaled weapons point forward, while bow remains upright",()=>{
 assert.ok(EQUIPMENT_SCALE.sword<.5);
 assert.ok(EQUIPMENT_SCALE.axe<.5);
 assert.ok(EQUIPMENT_SCALE.pickaxe<.4);
 for(const name of ["sword","axe","pickaxe"]){
  const pommel=point(heldItemTransform(name),[0,0,0]);
  const tip=point(heldItemTransform(name),[0,1,0]);
  assert.ok(tip[2]>pommel[2]+.95,name+" should point ahead");
  assert.ok(Math.abs(tip[1]-pommel[1])<.001,name+" should not point downward");
 }
 const grip=point(heldItemTransform("bow"),[0,0,0]);
 const upper=point(heldItemTransform("bow"),[0,.5,0]);
 assert.ok(upper[1]>grip[1]+.49);
});
test("sword and axe wind up before a downward strike",()=>{
 for(const action of ["sword","axe"]){
  const ready=samplePose({action,progress:0});
  const raised=samplePose({action,progress:.30});
  const descended=samplePose({action,progress:.74});
  const recovered=samplePose({action,progress:1});
  assert.ok(raised.rightShoulderX<ready.rightShoulderX-.8);
  assert.ok(descended.rightShoulderX>raised.rightShoulderX+1);
  assert.ok(recovered.rightShoulderX<descended.rightShoulderX-.5);
 }
 const bow=samplePose({action:"bow",progress:.4});
 assert.equal(bow.tool,"bow");
 assert.ok(bow.rightShoulderX<-.9);
 assert.ok(bow.leftElbowX<-1);
});
test("bow uses consumable arrows, legacy saves get starter ammunition",()=>{
 const {squad,life,equipment}=scene(),actor=squad.get("player");
 assert.ok(equipment.inventoryFor(actor,life,squad.frontier).some(i=>i.id==="bow"));
 assert.equal(equipment.equipHand(actor,"left","bow",life,squad.frontier).ok,true);
 assert.equal(equipment.handItem("player","left"),"bow");
 assert.equal(equipment.actor("player").arrows,12);
 const ready=equipment.useHand(actor,"left",life,squad.frontier);
 assert.equal(ready.action,"bow");
 assert.equal(ready.usesArrow,true);
 assert.equal(equipment.actor("player").arrows,12,"aiming does not consume ammo");
 assert.equal(equipment.spendArrow("player"),true);
 assert.equal(equipment.actor("player").arrows,11);
 const snapshot=equipment.snapshot();
 assert.equal(new SocialEquipment(snapshot).actor("player").arrows,11);
 delete snapshot.actors.player.arrows;
 assert.equal(new SocialEquipment(snapshot).actor("player").arrows,12);
});
test("arrow crafting costs resources and depleted quivers cannot shoot",()=>{
 const {squad,life,equipment,actions}=scene(),actor=squad.get("player");
 assert.equal(equipment.equipHand(actor,"right","bow",life,squad.frontier).ok,true);
 actions.resources.wood=1;actions.resources.stone=1;
 assert.equal(equipment.craftArrows("player",actions.resources).ok,true);
 assert.equal(actions.resources.wood,0);
 assert.equal(actions.resources.stone,0);
 assert.equal(equipment.actor("player").arrows,18);
 assert.equal(equipment.craftArrows("player",actions.resources).ok,false);
 for(let i=0;i<18;i++)assert.equal(equipment.spendArrow("player"),true);
 assert.equal(equipment.spendArrow("player"),false);
 assert.equal(equipment.useHand(actor,"right",life,squad.frontier).ok,false);
});
test("player and NPC can start bow animations without mining resources",()=>{
 const {control,actions,squad}=scene();
 control.altitudeM=2.5;control.targetAltitudeM=2.5;
 const before={...actions.resources};
 assert.equal(actions.start("bow",control,()=>({water:false,river:false})),true);
 assert.equal(actions.getAnimation().action,"bow");
 const saved=Actions.fromSnapshot(actions.snapshot());
 assert.equal(saved.getAnimation().action,"bow");
 actions.advance(1);
 actions.advance(1);
 assert.equal(actions.active,null);
 assert.deepEqual(actions.resources,before);
 const npc=squad.get("scout");
 npc.control.altitudeM=2.5;npc.control.targetAltitudeM=2.5;
 assert.equal(squad.performEquippedAction("scout","bow","left"),true);
 assert.deepEqual({action:squad.getMotion(npc).action,hand:squad.getMotion(npc).hand},{action:"bow",hand:"left"});
});
