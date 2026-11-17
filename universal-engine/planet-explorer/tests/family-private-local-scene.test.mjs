import test from "node:test";
import assert from "node:assert/strict";
import {LocalPrivateScene,LOCAL_PRIVATE_GESTURES} from "../family-private-local-scene.mjs";

const event=(override={})=>({
 fadeToBlack:false,cameraTransition:"retain",
 modEvent:{version:1,partner:"navigator",adults:true,consent:true,renderContent:"external-only"},
 ...override
});
test("local scene requires the existing adult, consent, and proximity gate",()=>{
 let eligible=false;
 const scene=new LocalPrivateScene({guard:()=>eligible,play:()=>({ok:true})});
 assert.equal(scene.open(event()).ok,false);
 eligible=true;
 assert.equal(scene.open(event()).ok,true);
 assert.equal(scene.active,true);
 assert.equal(scene.open(event({fadeToBlack:true})).ok,false);
 assert.equal(scene.active,false);
 assert.equal(scene.open(event({modEvent:{...event().modEvent,adults:false}})).ok,false);
 assert.equal(scene.open(event({modEvent:{...event().modEvent,consent:false}})).ok,false);
 assert.equal(scene.open(event({modEvent:{...event().modEvent,renderContent:"built-in"}})).ok,false);
});
test("local scene plays only existing non-graphic crew gestures",()=>{
 const plays=[];
 let eligible=true;
 const scene=new LocalPrivateScene({
  guard:id=>eligible&&id==="navigator",
  play:(action,id)=>{plays.push([action,id]);return {ok:true,message:"play "+action};}
 });
 assert.equal(scene.playMotion("hug").ok,false,"must enter through authorized event");
 assert.equal(scene.open(event()).ok,true);
 assert.deepEqual(LOCAL_PRIVATE_GESTURES.map(g=>g.id),["handhold","hug","kiss","9989","9966"]);
 assert.equal(scene.playMotion("hug").ok,true);
 assert.equal(scene.replay().ok,true);
 assert.deepEqual(plays,[["hug","navigator"],["hug","navigator"]]);
 assert.equal(scene.playMotion("unsupported").ok,false);
 eligible=false;
 assert.equal(scene.playMotion("kiss").ok,false,"consent/proximity can revoke control");
 assert.equal(scene.active,false);
 assert.equal(scene.replay().ok,false);
});
test("closing or reopening local control discards temporary state",()=>{
 const scene=new LocalPrivateScene({guard:()=>true,play:()=>({ok:true})});
 scene.open(event());scene.playMotion("handhold");scene.close();
 assert.equal(scene.partner,null);
 assert.equal(scene.lastMotion,null);
 scene.open(event());
 assert.equal(scene.replay().ok,false);
});

test("coded poses resolve to safe gesture names, with reversible local playback",()=>{
 const calls=[],scene=new LocalPrivateScene({
  guard:()=>true,
  play:(motion,partner)=>{calls.push([motion,partner]);return {ok:true,message:motion};},
  control:(operation,partner,value)=>{calls.push([operation,partner,value]);return {ok:true,message:operation};}
 });
 scene.open(event());
 assert.equal(scene.playMotion("9989").ok,true);
 assert.deepEqual(calls[0],["closeEmbrace","navigator"]);
 assert.equal(scene.playMotion("9966").ok,true);
 assert.deepEqual(calls[1],["foreheadRest","navigator"]);
 assert.equal(scene.seek(.5).ok,true);
 assert.equal(scene.setPaused(true).ok,true);
 assert.equal(scene.setPaused(false).ok,true);
 assert.equal(scene.setSpeed(1.5).ok,true);
 scene.close();
 assert.deepEqual(calls.at(-1),["stop","navigator",undefined]);
 assert.equal(scene.seek(.5).ok,false);
});
