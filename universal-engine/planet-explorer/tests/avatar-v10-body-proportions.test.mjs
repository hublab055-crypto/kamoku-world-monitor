import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {parseFrontierRig} from "../frontier-animated.mjs";
import {createAvatarV10ProceduralBody,avatarV10Skeleton} from "../avatar-v10-procedural-body.mjs";
import {isAvatarHandDetail,preserveAvatarSkinDetail} from "../avatar-v10-skin-detail.mjs";

test("author-created palm, finger, foot and face meshes are preserved",()=>{
 for(const name of ["Palm_L","Palm_R","ThumbTip_L","Index1_R","Finger_Index_L"])
  assert.equal(isAvatarHandDetail({name}),true,name);
 for(const name of ["Bare_foot_R","Face and skull"])
  assert.equal(preserveAvatarSkinDetail({name}),true,name);
 for(const name of ["Casual pants","Fitting body","Work jacket","Work glove"])
  assert.equal(preserveAvatarSkinDetail({name}),false,name);
});
for(const model of ["ren","lyra"]){
 test("real "+model+" rig keeps pectoral and crotch above misplaced landmarks",()=>{
  const gz=readFileSync(new URL("../../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url));
  const rig=parseFrontierRig(gunzipSync(gz));rig.studyModelBust=model==="lyra";
  const skel=avatarV10Skeleton(rig);assert(skel);
  const p=skel.points;
  const body=createAvatarV10ProceduralBody(rig,{resolution:.070});
  assert(body,"body generated");
  const shoulder=(p.leftShoulder[1]+p.rightShoulder[1])*.5;
  const knee=(p.leftKnee[1]+p.rightKnee[1])*.5;
  const a=rig.studyLandmarks;
  assert(a.chestY<shoulder-.07,"chest too close to clavicle");
  assert(a.chestY>p.pelvis[1]+.12,"chest too low");
  assert(a.crotchY<p.pelvis[1],"crotch above pelvis");
  assert(a.crotchY>knee+.07,"crotch at knee");
  assert(body.arrays.positions.every(Number.isFinite));
  assert(body.arrays.weights.every(Number.isFinite));
 });
}
