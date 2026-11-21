import test from "node:test";
import assert from "node:assert/strict";
import {XRWristWatch,XR_WATCH_KEYS,xrWristPose,xrWristHit} from "./xr-wrist-watch.mjs";
import {xrTranslate} from "./xr-spatial.mjs";
const head=()=>xrTranslate(0,1.7,0);
const left=()=>xrTranslate(-.24,1.26,-.45);
function rayAt(model,x=0,y=0,d=.45){
 const m=Array.from(model);
 m[12]+=model[0]*x+model[4]*y+model[8]*d;
 m[13]+=model[1]*x+model[5]*y+model[9]*d;
 m[14]+=model[2]*x+model[6]*y+model[10]*d;
 return m;
}
test("watch appears only with genuine left tracking, in front of the wearer",()=>{
 assert.equal(xrWristPose(head(),null),null);
 const pose=xrWristPose(head(),left());
 assert.ok(pose);
 assert.ok(pose[13]>1.26);
 const w=new XRWristWatch();
 assert.equal(w.update(head(),null),null);
 assert.ok(w.update(head(),left()));
});
test("front-face touch opens menu, right-hand ray chooses buttons",()=>{
 const w=new XRWristWatch();w.update(head(),left());
 assert.equal(w.press(rayAt(w.model)),"face");assert.equal(w.open,true);
 for(const key of XR_WATCH_KEYS)assert.equal(w.press(rayAt(w.model,key.x,key.y)),key.id);
 assert.equal(w.press(rayAt(w.model,.3,0)),null);
 assert.equal(xrWristHit(rayAt(w.model,0,0,2),w.model,{open:true}),null);
 w.press(rayAt(w.model));assert.equal(w.open,false);
 assert.equal(w.press(rayAt(w.model,0,-.189)),null);
 w.reset();assert.equal(w.model,null);
});
