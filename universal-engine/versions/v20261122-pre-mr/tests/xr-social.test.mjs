import test from "node:test";
import assert from "node:assert/strict";
import {decodeSocialPose,SocialStage,SocialLink,sampleSocialPose} from "../planet-explorer/xr-social.mjs";
import {xrMul,xrRotateY,xrTranslate} from "../planet-explorer/xr-spatial.mjs";

const head=xrTranslate(0,1.65,0);
const makePose=(head,left=null,right=null)=>({head,left,right,appearance:{outer:"#123456",bag:"toolbag"}});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);

test("two different XR reference spaces align to the same physical mark and heading",()=>{
 const sent=[];
 const a=new SocialStage({send:pose=>sent.push(pose)});
 const b=new SocialStage({send:pose=>sent.push(pose)});
 const offset=xrMul(xrTranslate(-7,0,3),xrRotateY(1.1));
 assert.ok(a.calibrate(head));
 assert.ok(b.calibrate(xrMul(offset,head)));
 const atAnotherPoint=xrTranslate(2,1.65,-1);
 const wrist=xrTranslate(2.2,1.4,-.8);
 a.update(makePose(atAnotherPoint,wrist),100,100);
 b.update(makePose(xrMul(offset,atAnotherPoint),xrMul(offset,wrist)),100,100);
 for(const key of ["head","left"])
  sent[0][key].forEach((value,i)=>near(value,sent[1][key][i]));
});

test("full-scale MR shows the peer while the fixed miniature shows both avatars",()=>{
 const link={send:()=>{},remote:{time:100,pose:makePose(xrTranslate(1,1.7,-2))}};
 const stage=new SocialStage(link);
 assert.equal(stage.update(makePose(head),100,100),null);
 assert.ok(stage.calibrate(head));
 assert.equal(stage.update(makePose(head),100,100).actors.length,1);
 assert.ok(stage.toggleView(head));
 const third=stage.update(makePose(head),110,110);
 assert.equal(third.actors.length,2);
 assert.equal(third.stage[0],.4);
 const moved=stage.update(makePose(xrTranslate(1,1.7,0)),150,150);
 assert.deepEqual(third.stage,moved.stage);
 assert.equal(stage.update(makePose(head),900,900).actors.length,1);
 assert.ok(stage.toggleView(head));
 assert.equal(stage.update(null,950,950).actors.length,0);
});

test("wire format ignores unsupported appearance fields and rejects invalid positions",()=>{
 const packet=pose=>JSON.stringify({v:1,...pose});
 assert.deepEqual(decodeSocialPose(packet(makePose(head))).appearance,{outer:"#123456"});
 assert.equal(decodeSocialPose(packet(makePose(xrTranslate(400,1,0)))),null);
 assert.equal(decodeSocialPose(packet(makePose(head,[1]))),null);
 assert.equal(decodeSocialPose("["),null);
});

test("hand tracking and grip poses are sampled with independent tracking loss",()=>{
 const wrist={};
 const input=[{handedness:"left",hand:new Map([["wrist",wrist]])},
  {handedness:"right",gripSpace:{}}];
 const hand=xrTranslate(.2,1.4,-.2);
 const pose=sampleSocialPose({getJointPose:()=>({transform:{matrix:new Float32Array(hand)}}),
  getPose:()=>null},{},head,input,null);
 near(pose.left[13],new Float32Array(hand)[13]);
 assert.equal(pose.right,null);
});

test("a private data channel sends poses, validates inbound messages and drops stale data on close",()=>{
 const peer={close(){}};
 const channel={label:"ue-mr-pose-v1",readyState:"open",bufferedAmount:0,
  send(packet){this.lastPacket=packet;},close(){}};
 const link=new SocialLink(()=>{},()=>peer);
 link.openPeer();link.attach(peer,channel);
 link.send(makePose(head));
 assert.equal(JSON.parse(channel.lastPacket).v,1);
 channel.onmessage({data:channel.lastPacket});
 assert.deepEqual(link.remote.pose.head,head);
 channel.onmessage({data:"invalid"});
 assert.deepEqual(link.remote.pose.head,head);
 channel.onclose();
 assert.equal(link.remote,null);
 assert.equal(link.connected,false);
});
