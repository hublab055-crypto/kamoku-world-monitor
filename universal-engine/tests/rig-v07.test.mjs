import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RIG_V2,RIG_V2_IDS,LEGACY_JOINTS,validateRig,jointTransformsV2} from "../planet-explorer/rig-v2.mjs";
import {samplePose,jointTransforms} from "../planet-explorer/rig.mjs";
import {SmoothAnimator,blendPose} from "../planet-explorer/animator.mjs";
import {makeJointCovers} from "../planet-explorer/joint-covers.mjs";

test("v0.7a rig has exactly sixty unique joints, including every original pivot",()=>{
 assert.equal(RIG_V2.length,60);
 assert.equal(new Set(RIG_V2_IDS).size,60);
 assert.equal(LEGACY_JOINTS.length,21);
 assert.ok(LEGACY_JOINTS.every(k=>RIG_V2_IDS.includes(k)));
 assert.equal(validateRig(),true);
 const root=RIG_V2.filter(x=>x.parentId===null);
 assert.deepEqual(root.map(x=>x.id),["pelvis"]);
});
test("rig validates duplicate ids, parent cycles and missing references",()=>{
 const base=RIG_V2.map(x=>({...x}));
 assert.throws(()=>validateRig([...base,base[0]]),/duplicate/);
 const bad=base.map(x=>({...x}));
 bad[1].parentId=bad[1].id;
 assert.throws(()=>validateRig(bad),/cycle/);
 const missing=base.map(x=>({...x}));
 missing[1].parentId="ghost";
 assert.throws(()=>validateRig(missing),/unknown parent/);
});
test("legacy 21 joint matrices remain unchanged for six existing animation kinds",()=>{
 for(const action of ["idle","sword","axe","mine","build","jump"]){
  const p=samplePose({moving:true,phase:1.1,jumpHeight:action==="jump"?.7:0,action,progress:.56});
  const old=jointTransforms(p,.35),next=jointTransformsV2(p,.35);
  for(const id of LEGACY_JOINTS){
   assert.equal(next[id].length,16);
   for(let i=0;i<16;i++)assert.ok(Math.abs(next[id][i]-old[id][i])<1e-9,id+" "+action+" "+i);
  }
 }
});
test("v2 matrices for face, fingers, spine, toe stay finite",()=>{
 const p=new SmoothAnimator().update(.02,{moving:true,phase:1.3,action:"axe",progress:.4});
 const matrices=jointTransformsV2(p,.55);
 for(const id of RIG_V2_IDS){
  assert.ok(matrices[id].every(Number.isFinite),"non-finite "+id);
 }
 assert.ok(matrices.leftThumb2);
 assert.ok(matrices.rightLittle2);
 assert.ok(matrices.jaw);
 assert.ok(matrices.leftToe);
});
test("animator smooths abrupt stop and action start",()=>{
 const a=new SmoothAnimator();
 let p=a.update(.016,{moving:true,phase:Math.PI/2});
 const prev=p.leftHipX;
 p=a.update(.016,{moving:false,phase:Math.PI/2});
 assert.ok(p.leftHipX>0&&p.leftHipX<.54);
 assert.ok(Math.abs(p.leftHipX-prev)<.20);
 const start=p.rightShoulderX;
 p=a.update(.016,{action:"sword",progress:.5});
 assert.ok(Math.abs(p.rightShoulderX-start)<.40);
 assert.equal(p.tool,"sword");
 p=a.update(.016);
 assert.equal(p.tool,null);
});
test("frame-rate independent exponential smoothing for constant input",()=>{
 const x=new SmoothAnimator(),y=new SmoothAnimator();
 let a,b;
 for(let i=0;i<30;i++)a=x.update(1/30,{moving:true,phase:Math.PI/2});
 for(let i=0;i<60;i++)b=y.update(1/60,{moving:true,phase:Math.PI/2});
 for(const k of ["leftHipX","rightHipX","leftShoulderX","rightShoulderX","chestX"]){
  assert.ok(Math.abs(a[k]-b[k])<.018,k);
 }
});
test("finger poses bend during tool actions but do not exceed limits",()=>{
 const a=new SmoothAnimator();
 for(let i=0;i<20;i++)a.update(.016,{action:"axe",progress:.25});
 const p=a.pose,m=jointTransformsV2(p);
 assert.ok(p.leftIndex1X<-.35);
 assert.ok(p.rightThumb2X<-.2);
 assert.ok(m.rightThumb2.every(Number.isFinite));
});
test("joint gap fillers are distinct for all three costume styles",()=>{
 const p=makeJointCovers("pioneer");
 const s=makeJointCovers("scout");
 const a=makeJointCovers("artisan");
 assert.ok(p.length>=30);
 assert.equal(p.length,s.length);
 assert.notDeepEqual(p[0].geometry.colors,s[0].geometry.colors);
 assert.notDeepEqual(s[0].geometry.colors,a[0].geometry.colors);
 assert.ok(p.some(x=>x.pivot==="leftElbow"));
 assert.ok(p.some(x=>x.pivot==="rightToe"));
 assert.ok(p.some(x=>x.pivot==="leftThumb2"));
});
test("animator pose is serializable and validates invalid inputs",()=>{
 const x=new SmoothAnimator();
 x.update(.12,{moving:true,phase:1});
 const loaded=SmoothAnimator.fromSnapshot(x.snapshot());
 assert.deepEqual(loaded.snapshot(),x.snapshot());
 assert.throws(()=>x.update(-1),/Invalid/);
 assert.throws(()=>x.update(.05,{phase:Infinity}),/Invalid/);
 assert.throws(()=>blendPose({a:1},{a:2},NaN),/Invalid/);
});
test("v0.6 legacy archive contains independent runtime and original save key",()=>{
 const archiveUrl=new URL("../versions/v0.6/planet-explorer/app.mjs",import.meta.url);
 const v6=readFileSync(archiveUrl,"utf8");
 const v7=readFileSync(new URL("../versions/v0.7a/planet-explorer/app.mjs",import.meta.url),"utf8");
 assert.match(v6,/SAVE_KEY="universal-engine:explorer:v1"/);
 assert.match(v7,/SAVE_KEY="universal-engine:explorer:v0\.7a"/);
 assert.match(v7,/LEGACY_SAVE_KEY="universal-engine:explorer:v1"/);
 assert.match(v7,/import-v06-save/);
 assert.ok(!v6.includes("rig-v2.mjs"));
 const oldCore=readFileSync(new URL("../versions/v0.6/core.mjs",import.meta.url),"utf8");
 assert.ok(oldCore.includes("class Multiverse"));
 const legacy=readFileSync(new URL("../versions/v0.6/planet-explorer/index.html",import.meta.url),"utf8");
 assert.match(legacy,/V0\.6 保存版/);
 assert.match(legacy,/v0\.7a/);
});
test("new v0.7a page visibly links to legacy v0.6",()=>{
 const html=readFileSync(new URL("../versions/v0.7a/planet-explorer/index.html",import.meta.url),"utf8");
 assert.match(html,/id="version-back"/);
 assert.match(html,/versions\/v0\.6\/planet-explorer/);
 assert.match(html,/id="import-v06-save"/);
 assert.match(html,/V0\.7a 保存版/);
});
