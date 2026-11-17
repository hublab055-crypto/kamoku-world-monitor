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
 assert.deepEqual(LOCAL_PRIVATE_GESTURES.map(g=>g.id),["handhold","hug","kiss"]);
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
