import test from "node:test";
import assert from "node:assert/strict";
import {VRPhysicalControls,xrBodyAnchors} from "../xr-physical-controls.mjs";
import {xrIdentity,xrRotateY,xrBowAim} from "../xr-spatial.mjs";
import {ArrowProjectiles} from "../arrow-projectiles.mjs";

function point(x,y,z){
 const m=xrIdentity();m[12]=x;m[13]=y;m[14]=z;return m;
}

test("left grip retrieves a bow and right grip retrieves an arrow only from the quiver",()=>{
 const body=new VRPhysicalControls(),head=point(0,1.65,0),anchors=xrBodyAnchors(head);
 body.setPose({head,left:point(...anchors.shoulderLeft),right:point(...anchors.shoulderRight),
  leftRay:xrIdentity(),rightRay:xrIdentity()},0);
 assert.equal(body.grab("right",()=>true).kind,"no-bow");
 assert.equal(body.grab("left",()=>true).kind,"bow");
 assert.equal(body.grab("right",()=>true).kind,"arrow");
 assert.equal(body.bowHeld,true);
 assert.equal(body.arrowHeld,true);
});

test("nock, right-trigger draw and release keep arrow when gameplay rejects the shot",()=>{
 const body=new VRPhysicalControls(),head=point(0,1.65,0),anchors=xrBodyAnchors(head);
 let left=point(...anchors.shoulderLeft),right=point(...anchors.shoulderRight);
 const pose=()=>({head,left,right,leftRay:xrIdentity(),rightRay:xrIdentity()});
 body.setPose(pose(),0);
 assert.equal(body.grab("left",()=>true).kind,"bow");
 assert.equal(body.grab("right",()=>true).kind,"arrow");
 right=point(left[12],left[13],left[14]+.12);
 assert.deepEqual(body.setPose(pose(),16),["nock"]);
 assert.equal(body.triggerStart("right"),"draw");
 right=point(left[12],left[13],left[14]+.52);
 body.setPose(pose(),130);
 const first=body.triggerEnd("right");
 assert.equal(first.kind,"shoot");
 assert.ok(first.power>.6);
 body.confirmShot(false);
 assert.equal(body.arrowHeld,true);
 assert.equal(body.nocked,true);
 assert.equal(body.triggerStart("right"),"draw");
 body.setPose(pose(),250);
 assert.equal(body.triggerEnd("right").kind,"shoot");
 body.confirmShot(true);
 assert.equal(body.arrowHeld,false);
 assert.equal(body.nocked,false);
 assert.equal(body.suppressSelect("right"),true);
 assert.equal(body.suppressSelect("right"),false);
});

test("tracked bow ray keeps its vertical aiming angle in game coordinates",()=>{
 const head=point(0,1.65,0),left=point(-.2,1.40,-.45);
 const ray=xrIdentity(),stage=xrRotateY(Math.PI);
 const horizontal=xrBowAim(ray,stage,head,left,{floor:true});
 assert.ok(Math.abs(horizontal.yaw)<.001);
 assert.ok(Math.abs(horizontal.pitch)<.001);
 assert.ok(horizontal.originOffset.y>1.3);
 const elevated=xrIdentity(),tilt=.30;
 elevated[9]=-Math.sin(tilt);elevated[10]=Math.cos(tilt);
 const aim=xrBowAim(elevated,stage,head,left,{floor:true});
 assert.ok(Math.abs(aim.pitch-tilt)<.001);
});

test("VR arrows spawn from the bow's hand and follow pitch instead of auto target",()=>{
 const arrows=new ArrowProjectiles();
 const shot=arrows.launch({shooterId:"player",actor:{x:3,z:5,yaw:1.3},groundY:2,
  target:{x:400,y:40,z:400},mode:"auto",
  aim:{yaw:0,pitch:.28,power:.9,originOffset:{x:-.2,y:1.35,z:.5}}});
 assert.equal(shot.mode,"vr");
 assert.ok(Math.abs(shot.x-2.8)<1e-9);
 assert.ok(Math.abs(shot.y-3.35)<1e-9);
 assert.ok(Math.abs(shot.z-5.5)<1e-9);
 assert.ok(Math.abs(shot.vx)<1e-7);
 assert.ok(shot.vy>0&&shot.vz>0);
 assert.equal(arrows.flying.length,1);
});
