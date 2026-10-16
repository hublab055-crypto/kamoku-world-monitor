import test from "node:test";
import assert from "node:assert/strict";
import {samplePose,bowDrawState} from "../planet-explorer/rig.mjs";
import {SmoothAnimator} from "../planet-explorer/animator.mjs";
import {Actions,actionDuration} from "../planet-explorer/actions.mjs";
import {SocialEquipment} from "../planet-explorer/social-equipment.mjs";
import {applyWeaponRigPose} from "../planet-explorer/frontier-animated.mjs";

test("sword and axe cuts are faster than v0.7l; combo length remains playable",()=>{
 assert.equal(actionDuration("sword"),.58);
 assert.equal(actionDuration("axe"),.78);
 assert.ok(actionDuration("sword","combo")>actionDuration("sword"));
 assert.ok(actionDuration("axe","combo")>actionDuration("axe"));
 assert.equal(actionDuration("bow"),1.62);
});
test("four bow phases occur in order and string relaxes on release",()=>{
 const raise=bowDrawState(.10),nock=bowDrawState(.31);
 const draw=bowDrawState(.72),shot=bowDrawState(.79);
 assert.ok(raise.raised>0&&!raise.visible);
 assert.ok(nock.nocked>0&&nock.drawn===0);
 assert.ok(draw.drawn===1&&draw.tension===1&&!draw.released);
 assert.ok(shot.released>0&&shot.tension<1&&shot.flight>0);
 assert.ok(bowDrawState(.95).flight>bowDrawState(.80).flight);
});
test("melee variant produces sweep, thrust, overhead and multi-hit combo poses",()=>{
 const overhead=samplePose({action:"sword",progress:.30});
 const down=samplePose({action:"sword",progress:.72});
 assert.ok(overhead.rightShoulderX<-1.8);
 assert.ok(down.rightShoulderX>overhead.rightShoulderX+1.2);
 const sweep=samplePose({action:"sword",variant:"sweep",progress:.65});
 assert.ok(sweep.torsoY>.3);
 const retract=samplePose({action:"sword",variant:"thrust",progress:.24});
 const extend=samplePose({action:"sword",variant:"thrust",progress:.64});
 assert.ok(extend.rightElbowX>retract.rightElbowX+.75);
 for(const weapon of ["sword","axe"]){
  for(let step=0;step<=100;step++){
   const pose=samplePose({action:weapon,variant:"combo",progress:step/100});
   assert.equal(pose.tool,weapon);
   assert.ok(Object.values(pose).every(x=>x===null||typeof x==="string"||Number.isFinite(x)));
  }
 }
});
test("left-handed bow and slash are mirrored, not anatomically double-flipped",()=>{
 for(const action of ["bow","sword"]){
  const right=new SmoothAnimator(),left=new SmoothAnimator();
  for(let i=0;i<20;i++){
   right.update(.02,{action,progress:.54,hand:"right",variant:"sweep"});
   left.update(.02,{action,progress:.54,hand:"left",variant:"sweep"});
  }
  assert.ok(Math.abs(right.pose.rightShoulderX-left.pose.leftShoulderX)<.001,action);
  assert.ok(Math.abs(right.pose.rightShoulderZ+left.pose.leftShoulderZ)<.001,action);
 }
});
test("attack mode is per character and old v0.7l saves stay compatible",()=>{
 const e=new SocialEquipment();
 assert.equal(e.setAttackMode("player","combo"),true);
 assert.equal(e.setAttackMode("scout","sweep"),true);
 assert.equal(e.setAttackMode("artisan","unknown"),false);
 const saved=e.snapshot();
 assert.equal(new SocialEquipment(saved).actor("player").attackMode,"combo");
 assert.equal(new SocialEquipment(saved).actor("scout").attackMode,"sweep");
 assert.equal(new SocialEquipment(saved).attackVariant("scout","axe"),"sweep");
 assert.equal(e.setAttackMode("player","thrust"),true);
 assert.equal(e.attackVariant("player","axe"),"overhead");
 delete saved.actors.player.attackMode;
 assert.equal(new SocialEquipment(saved).actor("player").attackMode,"overhead");
});
test("action variant, bow duration and old saves remain valid",()=>{
 const actions=new Actions(),controller={altitudeM:2.5,jumpY:0};
 assert.equal(actions.start("sword",controller,null,"thrust"),true);
 assert.equal(actions.getAnimation().variant,"thrust");
 assert.equal(Actions.fromSnapshot(actions.snapshot()).getAnimation().variant,"thrust");
 for(let i=0;i<3;i++)actions.advance(.25);
 assert.equal(actions.active,null);
 assert.equal(actions.start("bow",controller,null),true);
 for(let i=0;i<6;i++)actions.advance(.25);
 assert.ok(actions.active);
 actions.advance(.25);
 assert.equal(actions.active,null);
});
test("standard named GLB can adopt procedural bow arms, unknown rigs are untouched",()=>{
 const names=["root","waist","rightShoulder","rightElbow","rightWrist","leftShoulder","leftElbow","leftWrist"];
 const nodes=names.map(name=>({name,rotation:[0,0,0,1]}));
 const fresh=()=>nodes.map(n=>({rotation:[...n.rotation]}));
 const right=fresh(),left=fresh();
 assert.equal(applyWeaponRigPose({nodes},right,"bow",.64,"overhead","right"),true);
 assert.equal(applyWeaponRigPose({nodes},left,"bow",.64,"overhead","left"),true);
 assert.notDeepEqual(right[2].rotation,[0,0,0,1]);
 assert.notDeepEqual(left[5].rotation,[0,0,0,1]);
 assert.notDeepEqual(right[2].rotation,left[2].rotation);
 assert.equal(applyWeaponRigPose({nodes:[{name:"hips"}]},[{}],"bow",.64),false);
});
