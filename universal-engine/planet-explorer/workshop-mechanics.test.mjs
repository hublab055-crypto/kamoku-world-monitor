import test from "node:test";import assert from "node:assert/strict";
import {Workshop} from "./workshop.mjs";
import {placePart} from "./workshop-spatial.mjs";
import {initThread,turnThread,testJointLoad,addMechanism,driveMechanism,removeMechanism,weldModel} from "./workshop-mechanics.mjs";
const site={lat:0,lon:0};
test("thread preload and release",()=>{const j={type:"bolt",diameter:8,torque:5};const t=initThread(j),f=t.preload;turnThread(j,1);assert.ok(Math.abs(t.preload-f-2500)<1e-8);turnThread(j,-10);assert.equal(t.preload,0);assert.ok(t.gap>0);assert.equal(testJointLoad(j,10,0).slip,true);});
test("revolute, slide and gear",()=>{const w=new Workshop(),a=w.stock("plate",10,50,50),b=w.stock("plate",5,50,50);placePart(w,a.id,site,0,0,100);placePart(w,b.id,site,0,0,110);let m=addMechanism(w,a.id,b.id,"revolute");driveMechanism(w,m.id,Math.PI/2);assert.equal(b.pose.yaw,Math.PI/2);assert.throws(()=>placePart(w,b.id,site));assert.equal(new Workshop(w.snapshot()).mechanisms.length,1);removeMechanism(w,m.id);m=addMechanism(w,a.id,b.id,"slider",{travel:20});driveMechanism(w,m.id,99);assert.equal(b.pose.x,20);removeMechanism(w,m.id);m=addMechanism(w,a.id,b.id,"gear",{ratio:2});driveMechanism(w,m.id,Math.PI);assert.equal(a.pose.yaw,Math.PI);assert.equal(b.pose.yaw,-1.5*Math.PI);});
test("overload",()=>{const j={type:"bolt",diameter:8,torque:5};initThread(j);turnThread(j,100);assert.equal(j.thread.failed,true);const k={type:"weld"},a={shape:"plate",d:10,w:50,l:50};weldModel(k,a,a,3);assert.equal(testJointLoad(k,1e9,0).failed,true);});
