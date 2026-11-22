import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {parseFrontierRig,poseFrontierRig} from "../frontier-animated.mjs";
import {createAvatarV10InspectionMeshes} from "../avatar-v10-inspection-mesh.mjs";
import {ANATOMY_LAYERS,ANATOMY_REGIONS,normalizeAvatarAnatomy,visibleAnatomyRegions}
 from "../avatar-anatomy-schema.mjs";
import {AVATAR_DAILY_ACTIONS,sampleAvatarDailyPose} from "../avatar-daily-actions.mjs";

test("obstetric study is optional and labeled non-clinical",()=>{
 assert(ANATOMY_LAYERS.obstetric);
 assert.equal(normalizeAvatarAnatomy({layer:"obstetric",preset:"uterine"}).layer,"obstetric");
 const labels=visibleAnatomyRegions({layer:"obstetric",preset:"uterine"}).map(x=>x.id);
 for(const id of ["maternal-pelvis","uterine-body","cervix","birth-canal","pelvic-floor"])
  assert(labels.includes(id),id);
 assert.equal(normalizeAvatarAnatomy({}).layer,"skin");
 assert(!visibleAnatomyRegions({layer:"skin"}).some(x=>x.layer==="obstetric"));
 assert(ANATOMY_REGIONS.filter(x=>x.layer==="obstetric").every(x=>x.preset==="uterine"));
});
for(const model of ["ren","lyra"]){
 test(model+" ships pelvic anatomical study meshes with finite skin weights",()=>{
  const raw=gunzipSync(readFileSync(new URL("../../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url)));
  const rig=parseFrontierRig(raw);
  const meshes=createAvatarV10InspectionMeshes(rig);
  const obstetric=meshes.find(x=>x.inspectLayer==="organs-obstetric");
  assert(obstetric,"expected optional obstetric models");
  assert(obstetric.indices.length>1000);
  assert(obstetric.arrays.positions.every(Number.isFinite));
  assert(obstetric.arrays.weights.every(Number.isFinite));
  const rigPose=poseFrontierRig(rig,"idle",.3);
  assert(rigPose.world.length===rig.nodes.length);
 });
}
for(const action of ["wave","stretch","kneel","pelvicTilt","supportedSquat","laborBreathing","sideRest","rockBaby"]){
 test("educational/daily motion "+action+" is defined and finite",()=>{
  assert(AVATAR_DAILY_ACTIONS[action]?.label);
  for(const t of [0,.45,1.6,3]){
   const v=sampleAvatarDailyPose(action,{time:t,progress:.35,hand:"right"});
   assert(v&&Object.values(v).every(Number.isFinite));
   assert(Math.abs(v.rootY)<1);
   assert(Math.abs(v.leftHipX)<2.5);
   assert(Math.abs(v.rightHipX)<2.5);
  }
 });
}
