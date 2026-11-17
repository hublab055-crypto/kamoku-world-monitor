import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {parseFrontierRig} from "../frontier-animated.mjs";
import {avatarV10Skeleton,avatarV10BodyField,createAvatarV10ProceduralBody} from "../avatar-v10-procedural-body.mjs";

function probeWidth(field,y,z=0){
 let last=0;
 for(let x=0;x<=.39;x+=.002){
  if(field([x,y,z])>0)return last;
  last=x;
 }
 return last;
}
for(const model of ["ren","lyra"]){
 test("real "+model+" torso has smooth axilla and no corset waist",()=>{
  const raw=gunzipSync(readFileSync(new URL("../../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url)));
  const rig=parseFrontierRig(raw);
  rig.studyModelBust=model==="lyra";
  const parts=avatarV10Skeleton(rig);
  assert(parts);
  const p=parts.points;
  const f=avatarV10BodyField(parts,rig.studyModelBust,{includeAuthoredHands:true,includeAuthoredFeet:true});
  const shoulderY=(p.leftShoulder[1]+p.rightShoulder[1])*.5;
  const torsoHeight=shoulderY-p.pelvis[1];
  const waistY=p.pelvis[1]+torsoHeight*.28;
  const ribsY=p.pelvis[1]+torsoHeight*.55;
  const underarmY=p.pelvis[1]+torsoHeight*.80;
  const waist=probeWidth(f,waistY),rib=probeWidth(f,ribsY),axilla=probeWidth(f,underarmY);
  assert(waist>.13 && rib>.13 && axilla>.15,{waist,rib,axilla});
  assert(waist>=rib*.83,"waist pinches sharply relative to ribcage");
  assert(axilla>=rib*.91,"underarm is hollow relative to ribcage");
  // A smooth torso remains solid just medial to the shoulder.
  assert(f([.15,underarmY,p.chest[2]])<0,"visible side underarm indentation");
  // Wrist has enough volume to meet the authored hand or fallback palm.
  for(const side of ["left","right"]){
   const w=p[side+"Wrist"];
   assert(f([w[0],w[1],w[2]+.044])<0,side+" wrist is too thin");
  }
  // Avoid protruding separate glute blobs behind the pelvis.
  const pelvicY=p.pelvis[1]-.05;
  assert(f([p.pelvis[0]+.09,pelvicY,p.pelvis[2]-.23])>0,
   "glute contour protrudes >23cm behind pelvic pivot");
  const body=createAvatarV10ProceduralBody(rig,{resolution:.070});
  assert(body,"contour must remain renderable");
  assert(body.arrays.positions.every(Number.isFinite));
  assert(body.arrays.normals.every(Number.isFinite));
 });
}
