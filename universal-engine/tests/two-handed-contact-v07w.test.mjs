import test from "node:test";
import assert from "node:assert/strict";
import {attackStrokes,weaponCapsule,capsuleTouch,sweptWeaponContacts,
 contactDamage} from "../planet-explorer/melee-contact.mjs";
import {BattleTest} from "../planet-explorer/battle-test.mjs";
import {samplePose} from "../planet-explorer/rig.mjs";
import {SmoothAnimator} from "../planet-explorer/animator.mjs";
import {actionDuration} from "../planet-explorer/actions.mjs";
import {enemyMotion} from "../planet-explorer/enemy-motion.mjs";
import {applyWeaponRigPose} from "../planet-explorer/frontier-animated.mjs";

const actor=(yaw=0)=>({id:"player",name:"開拓者",x:0,z:0,yaw,altitudeM:2.5,jumpY:0});
const target=(id,x,z,radius=.6)=>({id,x,z,hp:80,radius});
test("spear extends through its target corridor then retreats",()=>{
 assert.equal(weaponCapsule("spear","thrust",.12),null);
 assert.equal(weaponCapsule("spear","thrust",.84),null);
 const early=weaponCapsule("spear","thrust",.30);
 const extended=weaponCapsule("spear","thrust",.69);
 assert.ok(extended.b.z>early.b.z+2.5);
 const ready=samplePose({action:"spear",variant:"thrust",progress:.15});
 const stabbing=samplePose({action:"spear",variant:"thrust",progress:.56});
 const returned=samplePose({action:"spear",variant:"thrust",progress:.99});
 assert.ok(stabbing.leftElbowX>ready.leftElbowX+.4);
 assert.ok(returned.leftElbowX<stabbing.leftElbowX-.4);
 assert.equal(returned.tool,"spear");
});
test("swept weapon capsules hit only within moving blade trajectory",()=>{
 const p=actor();
 const front=target(1,0,4.5),side=target(2,4.6,2.4),
  behind=target(3,0,-2.5),flank=target(4,2,1,.84);
 const linear=sweptWeaponContacts(p,[front,side,behind,flank],"spear","thrust");
 assert.ok(linear.some(hit=>hit.target.id===front.id));
 assert.ok(!linear.some(hit=>hit.target.id===side.id));
 assert.ok(!linear.some(hit=>hit.target.id===behind.id));
 assert.equal(sweptWeaponContacts(p,[front],"spear","thrust",{from:0,to:.20}).length,0);
 const sweep=sweptWeaponContacts(p,[flank],"greatsword","sweep");
 assert.equal(sweep.length,1);
 assert.ok(Number.isFinite(sweep[0].phase));
 assert.equal(sweptWeaponContacts(actor(Math.PI/2),[target(6,4.5,0)],
  "spear","thrust").length,1);
 assert.equal(capsuleTouch({x:4,z:1,radius:.5},
  {a:{x:0,z:0},b:{x:0,z:2},width:.12}),null);
 assert.deepEqual(attackStrokes("spear","combo"),["sweep","thrust"]);
 assert.deepEqual(attackStrokes("greatsword","combo"),["overhead","sweep"]);
});
test("greatsword has deliberate wind-up, body weight and heavy recovery",()=>{
 assert.ok(actionDuration("greatsword","sweep")>actionDuration("spear","sweep"));
 assert.ok(actionDuration("greatsword","combo")>actionDuration("spear","combo"));
 for(const style of ["overhead","sweep","thrust","combo"]){
  const pose=samplePose({action:"greatsword",variant:style,progress:.45});
  assert.ok(pose.leftShoulderX<-.6&&pose.rightShoulderX<-.6);
 }
 const animator=new SmoothAnimator();
 const ready=animator.update(.10,{action:"greatsword",variant:"overhead",progress:.45});
 assert.equal(ready.tool,"greatsword");
 assert.ok(Math.abs(ready.leftHipX)>0.0001,"weight transfer reaches smoothed rig");
 const idle=new SmoothAnimator().update(.1,{
  action:"idle",equipped:{right:"greatsword",left:"greatsword"}});
 assert.ok(idle.leftShoulderX<-.1&&idle.rightShoulderX<-.1,"both hands ready");
});
test("weapon contact drives guarded damage, stagger, knockback and once-per-stroke hits",()=>{
 const p=actor(),battle=new BattleTest();
 const enemy=battle.spawn(p,"orc").enemy;enemy.x=0;enemy.z=2.5;
 const initialZ=enemy.z;
 const hit=battle.hitWeapon(p,"greatsword","overhead");
 assert.equal(hit.length,1);
 assert.equal(hit[0].damage,contactDamage("greatsword","overhead"));
 assert.equal(hit[0].weapon,"greatsword");
 assert.ok(Number.isFinite(hit[0].contact.x));
 assert.ok(enemy.z>initialZ,"heavy blade knocks target backward");
 assert.ok(enemy.hitStun>.5);
 battle.clear();
 const guarded=battle.spawn(p,"goblin").enemy;guarded.x=0;guarded.z=2;
 guarded.anim="guard";guarded.animTime=0;
 const blocked=battle.hitWeapon(p,"spear","thrust");
 assert.equal(blocked.length,1);
 assert.ok(blocked[0].guarded);
 assert.ok(blocked[0].damage<contactDamage("spear","thrust"));
 battle.clear();
 const foe=battle.spawn(p,"demon").enemy;foe.x=0;foe.z=4.4;
 const active={kind:"spear",variant:"thrust",time:0,duration:1};
 assert.deepEqual(battle.resolveAttack(active,p),[]);
 active.time=.66;
 assert.ok(battle.resolveAttack(active,p).some(hit=>hit.id===foe.id));
 assert.deepEqual(battle.resolveAttack(active,p),[],"repeated render frames never duplicate damage");
});

test("defenders keep their guard raised until a heavy blade makes contact",()=>{
 const p=actor(),battle=new BattleTest();
 const foe=battle.spawn(p,"orc").enemy;
 foe.x=0;foe.z=2.6;foe.guardCooldown=0;foe.attackCooldown=3;
 const incoming={kind:"greatsword",duration:1.47,time:.35};
 battle.advance(.1,p,incoming);
 assert.equal(foe.anim,"guard");
 assert.ok(foe.guardHold>1,"greatsword anticipation extends guard window");
 for(let i=0;i<5;i++)battle.advance(.1,p,null);
 assert.equal(foe.anim,"guard","guard does not expire halfway through slow cut");
 const pose=enemyMotion(foe);
 assert.ok(pose.leftArmX<-.3,"defender's guard pose is still raised");
});

test("Frontier GLB standard skeleton receives both-hand spear and greatsword motions",()=>{
 const names=["waist","leftShoulder","rightShoulder","leftElbow","rightElbow",
  "leftWrist","rightWrist","leftHip","rightHip","leftKnee","rightKnee"];
 const rig={nodes:names.map(name=>({name}))};
 for(const kind of ["spear","greatsword"]){
  const poses=names.map(()=>({rotation:[0,0,0,1]}));
  const updated=applyWeaponRigPose(rig,poses,kind,.48,"thrust","left");
  assert.equal(updated,true);
  const left=poses[names.indexOf("leftShoulder")].rotation;
  const right=poses[names.indexOf("rightShoulder")].rotation;
  assert.ok(left.every(Number.isFinite)&&right.every(Number.isFinite));
  assert.notDeepEqual(left,[0,0,0,1]);
  assert.notDeepEqual(right,[0,0,0,1]);
  assert.notDeepEqual(poses[names.indexOf("leftHip")].rotation,[0,0,0,1]);
 }
});
