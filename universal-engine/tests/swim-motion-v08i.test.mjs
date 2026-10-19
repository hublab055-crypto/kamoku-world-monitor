import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {AQUATIC_ACTIONS,swimStroke,swimmingPresentation} from "../planet-explorer/swim-motion.mjs";
import {SmoothAnimator} from "../planet-explorer/animator.mjs";
import {poseFrontierRig,applyAquaticRigPose} from "../planet-explorer/frontier-animated.mjs";
import {SkinnedFrontierAsset} from "../planet-explorer/frontier-skinned-renderer.mjs";

const near=(a,b,tolerance=1e-6)=>Math.abs(a-b)<=tolerance;
test("surface moving swimming rotates body horizontally but treading stays upright",()=>{
 const move=swimmingPresentation("swim",true,0,0,1);
 const still=swimmingPresentation("swim",false,0,0,1);
 assert.equal(move.action,"swim");assert.ok(move.pitch>1.1&&move.pitch<Math.PI/2);
 assert.equal(still.action,"tread");assert.equal(still.pitch,0);
 assert.ok(move.baseY>still.baseY);
 // At normalized character height 1.8 m, the swimmer's head clears sea level.
 assert.ok(move.baseY+Math.cos(move.pitch)*1.8>0.07);
 assert.ok(still.baseY+1.8>0);
 const dive=swimmingPresentation("dive",true,4.5,3.5,1);
 assert.equal(dive.action,"dive");assert.ok(dive.baseY<4.5-3);
});
test("crawling stroke actually moves opposite arms and alternating legs over time",()=>{
 for(const mode of AQUATIC_ACTIONS){
  const a=swimStroke(mode,.1,mode!=="tread");
  const b=swimStroke(mode,.7,mode!=="tread");
  for(const joint of ["leftShoulderX","rightShoulderX","leftHipX","rightHipX",
   "leftKneeX","rightKneeX","leftElbowX","rightElbowX"]){
   assert.ok(Number.isFinite(a[joint]),joint);
  }
  assert.notEqual(a.leftShoulderX,b.leftShoulderX);
  assert.notEqual(a.rightHipX,b.rightHipX);
  if(mode==="breast")assert.equal(a.leftHipX,a.rightHipX,"breaststroke uses a symmetric frog kick");
  else assert.ok(a.leftHipX*a.rightHipX<=0);
 }
});
test("procedural articulated rigs animate treading and swimming, even if stationary",()=>{
 const animator=new SmoothAnimator();
 let tread1=animator.update(.06,{action:"tread",moving:false,speedMps:0});
 let tread2=tread1;
 for(let i=0;i<20;i++)tread2=animator.update(.06,{action:"tread",moving:false,speedMps:0});
 assert.equal(animator.state,"tread");
 assert.notEqual(tread1.leftShoulderX,tread2.leftShoulderX);
 const stroke=animator.update(.06,{action:"swim",moving:true,speedMps:2.3});
 assert.equal(animator.state,"swim");
 assert.ok(Number.isFinite(stroke.leftHipX));
 assert.ok(Number.isFinite(stroke.leftShoulderX));
});
const makeRig=()=>{
 const names=["pelvis","waist","leftShoulder","rightShoulder","leftElbow","rightElbow",
 "leftHip","rightHip","leftKnee","rightKnee","leftWrist","rightWrist","leftAnkle","rightAnkle"];
 return {nodes:names.map(name=>({name,children:[],translation:[0,0,0],rotation:[0,0,0,1],scale:[1,1,1]})),
  clips:[],primitives:[]};
};
test("GLB skeleton joints actually receive a different position every swimming cycle",()=>{
 const rig=makeRig();
 const a=poseFrontierRig(rig,"swim",.12,"faceIdle",0,{moving:true});
 const b=poseFrontierRig(rig,"swim",.54,"faceIdle",0,{moving:true});
 assert.notDeepEqual(a.world[2],b.world[2],"left shoulder animates");
 assert.notDeepEqual(a.world[3],b.world[3],"right shoulder animates");
 assert.notDeepEqual(a.world[6],b.world[6],"leg kicking animates");
 const idle=poseFrontierRig(rig,"idle",.12);
 assert.notDeepEqual(a.world[2],idle.world[2],"aquatic isn't bind pose");
 assert.equal(applyAquaticRigPose(rig,rig.nodes.map(()=>({rotation:[0,0,0,1]})),"walk",1),false);
});
test("shared GLB pose method forwards movement flags and has an aquatic clip pipeline",()=>{
 const src=readFileSync(new URL("../planet-explorer/frontier-skinned-renderer.mjs",import.meta.url),"utf8");
 const render=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 assert.match(src,/state\.face,\{motionProgress,variant,hand,moving\}/);
 assert.match(render,/const baseMotion=marinePose\?/);
 assert.match(render,/swimmingPresentation\(s\.travelMode,s\.moving/);
 assert.match(render,/if\(aquatic&&\(!rig/);
 assert.match(app,/marine\?\.update\(0,controller,terrain\)/);
 assert.equal(typeof SkinnedFrontierAsset,"function");
});
