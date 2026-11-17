import test from "node:test";
import assert from "node:assert/strict";
import {NUMERIC_PAIR_POSES,sampleNumericPairPose,numericPairPose} from "../pair-motion-numeric-poses.mjs";
import {poseAvatarV10Gesture} from "../avatar-v10-motion.mjs";
import {ShipCrewGreetings,CREW_GESTURES} from "../ship-crew-greetings.mjs";

test("9989 and 9966 numeric joint definitions have bounded, continuous keyframes",()=>{
 for(const id of ["9989","9966"]){
  const spec=numericPairPose(id);
  assert.equal(spec.id,id);
  assert.ok(spec.seconds>0);
  assert.equal(spec.frames[0].t,0);
  assert.equal(spec.frames.at(-1).t,spec.seconds);
  assert.ok(spec.frames.every((f,i,a)=>i===0||f.t>a[i-1].t));
  for(const t of [0,.25,spec.seconds/2,spec.seconds]){
   const p=sampleNumericPairPose(spec.motion,t);
   assert.equal(p.id,id);
   assert.ok(p.blend>=0&&p.blend<=1);
   assert.ok(Object.values(p.bones).every(v=>v.length===3&&v.every(Number.isFinite)));
   assert.ok(Object.values(p.hands).every(v=>v.length===3&&v.every(Number.isFinite)));
  }
  assert.equal(sampleNumericPairPose(spec.motion,0).blend,0);
  assert.equal(sampleNumericPairPose(spec.motion,spec.seconds).blend,0);
  assert.ok(sampleNumericPairPose(spec.motion,spec.seconds/2).blend>.9);
 }
 assert.equal(sampleNumericPairPose("unknown",1),null);
 assert.equal(sampleNumericPairPose("closeEmbrace",Infinity),null);
 assert.equal(Object.keys(NUMERIC_PAIR_POSES).length,2);
});
test("Avatar V10 turns numeric chest and head frames into quaternions",()=>{
 const pose=Array.from({length:3},()=>({translation:[0,0,0],rotation:[0,0,0,1]}));
 const rig={jointsByName:new Map([["Hips",0],["Chest",1],["Head",2]]),scale:1,center:[0,0,0]};
 poseAvatarV10Gesture(rig,pose,{motion:"closeEmbrace",time:1});
 assert.notDeepEqual(pose[1].rotation,[0,0,0,1]);
 assert.notDeepEqual(pose[2].rotation,[0,0,0,1]);
 assert.ok(pose.every(p=>p.rotation.every(Number.isFinite)));
});
test("crew can pause, seek, speed up and stop a numeric paired gesture",()=>{
 const member={id:"navigator",name:"副官",x:0,z:0};
 const greetings=new ShipCrewGreetings([member]);
 const interior={x:0,z:1,mode:"interior",seated:false,
  distance:()=>1,canReachCrew:()=>true,canOccupy:()=>true};
 const result=greetings.start(interior,"navigator","closeEmbrace");
 assert.equal(result.ok,true);
 assert.equal(greetings.pair.action,"closeEmbrace");
 assert.equal(CREW_GESTURES.closeEmbrace.seconds,NUMERIC_PAIR_POSES["9989"].seconds);
 assert.equal(greetings.control("navigator","seek",.5).ok,true);
 assert.ok(Math.abs(greetings.pair.time-NUMERIC_PAIR_POSES["9989"].seconds/2)<.001);
 assert.equal(greetings.control("engineer","pause",true).ok,false);
 assert.equal(greetings.control("navigator","pause",true).ok,true);
 const before=greetings.pair.time;
 greetings.advance(interior,1);
 assert.equal(greetings.pair.time,before);
 assert.equal(greetings.control("navigator","speed",2).ok,true);
 assert.equal(greetings.control("navigator","pause",false).ok,true);
 greetings.advance(interior,.5);
 assert.ok(greetings.pair.time>before+.99);
 assert.equal(greetings.control("navigator","seek",NaN).ok,false);
 assert.equal(greetings.control("navigator","speed",100).ok,false);
 assert.equal(greetings.control("navigator","stop").ok,true);
 assert.equal(greetings.pair,null);
});
