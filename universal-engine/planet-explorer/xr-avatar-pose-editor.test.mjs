import test from "node:test";
import assert from "node:assert/strict";
import {xrTranslate,xrMul} from "./xr-spatial.mjs";
import {XRAvatarPoseEditor,POSE_EDITOR_JOINTS,POSE_EDITOR_TARGETS,
 validPoseEditorTrack,samplePoseEditorTrack,xrPoseEditorAnchor} from "./xr-avatar-pose-editor.mjs";

const head=()=>xrTranslate(0,1.64,0);
const pos=(editor,joint,delta=[0,0,0])=>{
 const p=editor.joints[joint];
 return xrMul(editor.anchor,xrTranslate(p[0]+delta[0],p[1]+delta[1],p[2]+delta[2]));
};
test("Pose editor refuses untracked head and non-VR grip operation",()=>{
 const editor=new XRAvatarPoseEditor();
 assert.equal(editor.enter(null),false);
 assert.equal(editor.grab("left",xrTranslate(0,1,0)),null);
 assert.equal(xrPoseEditorAnchor(null),null);
 assert.equal(editor.enter(head()),true);
 assert.equal(editor.target,"navigator");
 assert.ok(editor.anchor[14]<-.9);
 editor.exit();
 assert.equal(editor.active,false);
});
test("Left and right grips select independent reachable joints and drag without snap",()=>{
 const editor=new XRAvatarPoseEditor();
 editor.enter(head());
 const before=[...editor.joints.leftHand];
 const left=pos(editor,"leftHand");
 const right=pos(editor,"rightElbow");
 assert.equal(editor.grab("left",left),"leftHand");
 assert.equal(editor.grab("right",right),"rightElbow");
 assert.notEqual(editor.grab("right",left),"leftHand");
 editor.update(1000,{left:pos(editor,"leftHand",[.10,.08,0]),right:pos(editor,"rightElbow",[-.07,0,.05])});
 assert.ok(editor.joints.leftHand[0]>before[0]+.09);
 assert.ok(editor.joints.rightElbow[0]<POSE_EDITOR_JOINTS.rightElbow[0]-.06);
 assert.equal(editor.held.left.joint,"leftHand");
 assert.equal(editor.held.right.joint,"rightElbow");
 const adjusted=[...editor.joints.leftHand];
 editor.update(1020,{left:null,right:null});
 assert.deepEqual(editor.joints.leftHand,adjusted,"tracking loss freezes posed joint");
 assert.equal(editor.release("left"),true);
 assert.equal(editor.release("right"),true);
 assert.deepEqual(editor.joints.leftHand,adjusted,"released joint holds position");
 assert.equal(editor.touched.leftHand,true);
});
test("Joint hit test rejects distant hands and prevents joint stealing",()=>{
 const e=new XRAvatarPoseEditor();e.enter(head());
 assert.equal(e.grab("right",xrTranslate(99,99,99)),null);
 assert.equal(e.grab("left",pos(e,"head")),"head");
 assert.equal(e.grab("right",pos(e,"head")),null);
 assert.equal(e.release("right"),false);
 assert.equal(e.release("left"),true);
 assert.equal(e.grab("right",pos(e,"head")),"head");
});
test("Gesture clip is time sampled, bounded, local-only and exported as schema JSON",()=>{
 const e=new XRAvatarPoseEditor();e.enter(head());e.grab("left",pos(e,"leftHand"));
 assert.equal(e.start(1000),true);
 e.update(1050,{left:pos(e,"leftHand",[.05,0,0])});
 e.update(1100,{left:pos(e,"leftHand",[.10,0,0])});
 assert.equal(e.stop(),true);
 assert.equal(e.track.frames.length,3);
 assert.equal(validPoseEditorTrack(e.track),true);
 assert.equal(e.track.target,"navigator");
 assert.ok(e.exportJSON().includes("two-grip-joint-ik"));
 assert.equal(e.togglePlayback(2000),true);
 e.update(2025,{});
 assert.ok(e.joints.leftHand[0]>POSE_EDITOR_JOINTS.leftHand[0]);
 const at=samplePoseEditorTrack(e.track,75);
 assert.ok(at.joints.leftHand[0]>POSE_EDITOR_JOINTS.leftHand[0]+.05);
 e.clear();assert.equal(e.exportJSON(),null);
});
test("Target selection cycles only among crew, resets pose and clears previous clip",()=>{
 const e=new XRAvatarPoseEditor();e.enter(head());
 const order=[...POSE_EDITOR_TARGETS];
 for(let i=1;i<order.length;i++)assert.equal(e.cycleTarget(),order[i]);
 assert.equal(e.cycleTarget(),order[0]);
 assert.equal(e.recording,false);
 e.grab("left",pos(e,"leftKnee"));
 assert.equal(e.resetPose(),undefined);
 assert.deepEqual(e.touched,{});
 e.start(0);e.update(26000,{});
 assert.equal(e.recording,false);
 assert.equal(validPoseEditorTrack(e.track),true);
});
test("Invalid tracks and injected joint payloads do not playback",()=>{
 const e=new XRAvatarPoseEditor();e.enter(head());
 assert.equal(e.togglePlayback(0),false);
 assert.equal(validPoseEditorTrack({schema:"invalid",frames:[]}),false);
 assert.equal(validPoseEditorTrack({schema:"universal-engine.xr-joint-pose.v1",target:"player",frames:[]}),false);
 assert.equal(samplePoseEditorTrack({schema:"invalid"},0),null);
});
