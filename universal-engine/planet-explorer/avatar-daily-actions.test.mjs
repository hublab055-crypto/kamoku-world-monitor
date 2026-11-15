import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
 AVATAR_DAILY_ACTIONS,sampleAvatarDailyPose,NURSING_SITES,avatarNursingSite
} from "./avatar-daily-actions.mjs";
import {applyAvatarDailyRigPose} from "./frontier-animated.mjs";

test("all requested daily motions are available as finite human joint targets",()=>{
 for(const action of ["run","crouch","sleep","eat","pickup","lift","holdBaby"]){
  const pose=sampleAvatarDailyPose(action,{time:.7,progress:.6});
  assert.ok(pose&&Object.values(pose).every(Number.isFinite),action);
  assert.ok(AVATAR_DAILY_ACTIONS[action].label);
 }
 assert.equal(sampleAvatarDailyPose("unknown"),null);
 assert.throws(()=>sampleAvatarDailyPose("pickup",{time:NaN}),TypeError);
});
test("sprint cycles hips and shoulders; crouch and sleep lower body",()=>{
 const a=sampleAvatarDailyPose("run",{time:.2}),b=sampleAvatarDailyPose("run",{time:.6});
 assert.notEqual(a.leftHipX,b.leftHipX);
 assert.notEqual(a.rightShoulderX,b.rightShoulderX);
 const crouch=sampleAvatarDailyPose("crouch");
 assert.ok(crouch.rootY<-.4&&crouch.leftKneeX>1.5&&crouch.rightKneeX>1.5);
 const sleep=sampleAvatarDailyPose("sleep");
 assert.ok(sleep.rootY<-.6&&sleep.torsoX<-.9);
});
test("single-hand pickup changes hand while two-handed lift raises both arms",()=>{
 const right=sampleAvatarDailyPose("pickup",{progress:.82,hand:"right"});
 const left=sampleAvatarDailyPose("pickup",{progress:.82,hand:"left"});
 assert.ok(right.rightShoulderX<right.leftShoulderX);
 assert.ok(left.leftShoulderX<left.rightShoulderX);
 const squat=sampleAvatarDailyPose("lift",{progress:.29});
 const carry=sampleAvatarDailyPose("lift",{progress:.95});
 assert.ok(squat.rootY<-.2&&squat.leftKneeX>.7);
 assert.ok(carry.rootY>-.08);
 assert.equal(carry.leftShoulderX,carry.rightShoulderX);
 assert.ok(carry.leftElbowX<-.9&&carry.rightElbowX<-.9);
});
test("adult chest nursing sites are stable, mirrored and never produce milk resources",()=>{
 assert.deepEqual(Object.keys(NURSING_SITES),["left","right"]);
 assert.equal(avatarNursingSite("left").positionM[0],-avatarNursingSite("right").positionM[0]);
 assert.equal(avatarNursingSite("left").joint,"chest");
 assert.ok(Object.isFrozen(avatarNursingSite("left").positionM));
 assert.throws(()=>avatarNursingSite("other"),RangeError);
});
test("GLB retarget leaves original joints on missing/unknown skeleton intact",()=>{
 const names=["Pelvis","Waist","LeftShoulder","RightShoulder","LeftElbow","RightElbow",
  "LeftHip","RightHip","LeftKnee","RightKnee","LeftWrist","RightWrist","LeftAnkle","RightAnkle","Head"];
 const rig={nodes:names.map(name=>({name})),scale:1.5};
 const base=()=>names.map(()=>({translation:[0,0,0],rotation:[0,0,0,1]}));
 const p=base();
 assert.equal(applyAvatarDailyRigPose(rig,p,"lift",.4,{progress:.3}),true);
 assert.ok(p[0].translation[1]<0);
 assert.notDeepEqual(p[2].rotation,[0,0,0,1]);
 assert.notDeepEqual(p[6].rotation,[0,0,0,1]);
 assert.equal(applyAvatarDailyRigPose(rig,base(),"unknown",.4),false);
 assert.equal(applyAvatarDailyRigPose({nodes:[{name:"pelvis"}]},base(),"pickup",.2),false);
});
test("game/preview wiring and nude-body-only anatomy shader are installed",()=>{
 const read=name=>fs.readFileSync(new URL(name,import.meta.url),"utf8");
 const app=read("./app.mjs"),html=read("./index.html");
 const editor=read("./avatar-v10-ui.mjs"),skinned=read("./frontier-skinned-renderer.mjs");
 assert.match(app,/avatarDailyMotion/);
 assert.match(app,/avatarDailyState/);
 assert.match(app,/keys\.has\("shift"\)/);
 assert.match(html,/viewport-avatar-actions/);
 assert.match(editor,/AVATAR_DAILY_ACTIONS/);
 assert.match(skinned,/uniform bool uAnatomy/);
 assert.match(skinned,/outfit==="base"&&source\.wardrobe\?\.includes\("base"\)/);
});
