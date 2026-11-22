import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {XRMotionActorRecorder,MOTION_ACTOR_SCHEMA,MOTION_ACTOR_LIMIT,
 motionPoseFromMatrix,setXRMotionPlayback,sampleXRMotionTrack,
 currentXRMotionActorPose,getXRMotionTextSummary} from "../xr-motion-actor.mjs";
import {parseFrontierRig,poseFrontierRig} from "../frontier-animated.mjs";

const mat=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
test("Quest 3-point recorder saves local-floor head and both real controller positions",()=>{
 const r=new XRMotionActorRecorder();r.start({floorTracked:true,maxSeconds:5});
 assert(r.capture(1000,{head:mat(0,1.64,0),left:mat(-.28,1.2,-.35),right:mat(.31,1.3,-.34),
  leftSource:{gamepad:{axes:[0,0,.3,-.4],buttons:[{value:.2}]} } }));
 assert(!r.capture(1020,{head:mat(0,1.62,0)}),"sampling rate limit");
 assert(r.capture(1100,{head:mat(.1,1.46,.02),left:mat(-.24,1.18,-.34)}));
 r.stop();
 const json=JSON.parse(r.exportJSON());
 assert.equal(json.schema,MOTION_ACTOR_SCHEMA);
 assert.equal(json.floorY,0);
 assert.equal(json.referenceSpace,"local-floor");
 assert.equal(json.trackers.length,3);
 assert.equal(json.frames.length,2);
 assert.deepEqual(json.frames[0].head.p,[0,1.64,0]);
 assert.deepEqual(json.frames[0].left.p,[-.28,1.2,-.35]);
 assert.equal(json.frames[0].controls.left.axes[2],.3);
 assert.equal(json.frames[1].right,null,"do not invent a missing right controller");
 assert.match(getXRMotionTextSummary(json),/Y=0m/);
 assert(setXRMotionPlayback(json,5000));
 const halfway=currentXRMotionActorPose(5050);
 assert(Math.abs(halfway.head.p[0]-.05)<1e-4);
 assert(Math.abs(halfway.head.p[1]-1.55)<1e-4);
 setXRMotionPlayback(null);
 assert.equal(currentXRMotionActorPose(5100),null);
});
test("local reference space never asserts the floor is known",()=>{
 const r=new XRMotionActorRecorder();r.start({floorTracked:false});
 r.capture(0,{head:mat(0,1.5,0)});
 assert.equal(r.stop().floorY,null);
 assert.equal(r.track.referenceSpace,"local");
 assert.match(getXRMotionTextSummary(r.track),/不明/);
 assert.equal(motionPoseFromMatrix(null),null);
 assert.deepEqual(motionPoseFromMatrix(mat(0,1,0)).q,[0,0,0,1]);
});
test("no permission to auto-send data and bounded 30 s / 600 frames",()=>{
 const r=new XRMotionActorRecorder();r.start({floorTracked:true,maxSeconds:999});
 assert.equal(r.track.maxSeconds,30);
 for(let t=0;t<=32000;t+=60)r.capture(t,{head:mat(0,1.6,0)});
 assert(!r.recording);
 assert(r.track.frames.length<=MOTION_ACTOR_LIMIT);
 assert.equal(Object.keys(r.track).includes("upload"),false);
});
for(const model of ["ren","lyra"]){
 test("replayed Quest hands and head deform shipped "+model+" V10 rig",()=>{
  const raw=gunzipSync(readFileSync(new URL("../../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url)));
  const rig=parseFrontierRig(raw);
  const r=new XRMotionActorRecorder();r.start({floorTracked:true});
  r.capture(1000,{head:mat(0,1.62,0),left:mat(-.25,1.12,-.33),right:mat(.28,1.14,-.33)});
  r.capture(1100,{head:mat(.02,1.56,-.05),left:mat(-.14,1.46,-.40),right:mat(.12,1.43,-.45)});
  const track=r.stop();
  const frame=sampleXRMotionTrack(track,80);
  const base=poseFrontierRig(rig,"idle",.2,"faceIdle",.2);
  const applied=poseFrontierRig(rig,"idle",.2,"faceIdle",.2,{motionActor:frame});
  const right=rig.jointsByName.get("Hand_R");
  assert(Number.isInteger(right));
  const matrix=applied.world[right];
  assert(matrix.every(Number.isFinite));
  const baseMatrix=base.world[right];
  const delta=Math.hypot(matrix[12]-baseMatrix[12],matrix[13]-baseMatrix[13],matrix[14]-baseMatrix[14]);
  assert(delta>.015,"replayed controller must move avatar wrist; measured "+delta);
 });
}
