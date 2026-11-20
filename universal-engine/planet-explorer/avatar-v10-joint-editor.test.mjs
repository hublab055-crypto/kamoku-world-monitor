import test from "node:test";
import assert from "node:assert/strict";
import {poseAvatarV10JointEditor} from "./avatar-v10-motion.mjs";
const id=[0,0,0,1];
function jointRig(){
 const nodes=[],parents=[],map=new Map();
 const add=(name,parent,translation)=>{
  const i=nodes.length;map.set(name,i);parents.push(parent);
  nodes.push({translation,rotation:[...id]});return i;
 };
 const hips=add("Hips",-1,[0,.90,0]);
 const chest=add("Chest",hips,[0,.50,0]);
 add("Head",chest,[0,.22,0]);
 for(const [side,sign]of [["L",1],["R",-1]]){
  const shoulder=add("UpperArm_"+side,chest,[sign*.20,0,0]);
  const elbow=add("LowerArm_"+side,shoulder,[sign*.29,-.20,0]);
  add("Hand_"+side,elbow,[sign*.21,-.21,.02]);
  const upper=add("UpperLeg_"+side,hips,[sign*.14,-.08,0]);
  const knee=add("LowerLeg_"+side,upper,[0,-.43,.08]);
  add("Foot_"+side,knee,[0,-.40,.02]);
 }
 const rig={jointsByName:map,parents,nodes,scale:1,center:[0,0,0]};
 const pose=nodes.map(n=>({translation:[...n.translation],rotation:[...n.rotation],scale:[1,1,1]}));
 return {rig,pose};
}
test("V10 two-handed pose editor uses skinned arm and leg IK without corrupting other joints",()=>{
 const {rig,pose}=jointRig();
 const before=pose.map(n=>[...n.rotation]);
 const snapshot={touched:{leftElbow:true,leftHand:true,rightKnee:true,rightFoot:true,head:true},
  joints:{leftElbow:[.42,1.29,.09],leftHand:[.52,1.27,.20],
   rightKnee:[-.16,.44,.24],rightFoot:[-.23,.15,.20],head:[.05,1.68,.02]}};
 assert.equal(poseAvatarV10JointEditor(rig,pose,snapshot),true);
 for(const node of pose)for(const n of [...node.rotation,...node.translation])assert.ok(Number.isFinite(n));
 assert.notDeepEqual(pose[rig.jointsByName.get("UpperArm_L")].rotation,before[rig.jointsByName.get("UpperArm_L")]);
 assert.notDeepEqual(pose[rig.jointsByName.get("UpperLeg_R")].rotation,before[rig.jointsByName.get("UpperLeg_R")]);
 assert.deepEqual(pose[rig.jointsByName.get("UpperArm_R")].rotation,before[rig.jointsByName.get("UpperArm_R")]);
});
test("V10 editor leaves every unselected joint and the rest pose untouched",()=>{
 const {rig,pose}=jointRig(),start=JSON.stringify(pose);
 assert.equal(poseAvatarV10JointEditor(rig,pose,{touched:{},joints:{}}),false);
 assert.equal(JSON.stringify(pose),start);
});
