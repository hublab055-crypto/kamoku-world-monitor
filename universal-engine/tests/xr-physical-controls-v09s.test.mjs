import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {VRPhysicalControls,xrBodyAnchors,xrDrawLength,XR_GRAB_RADIUS_M} from "../planet-explorer/xr-physical-controls.mjs";

const contentOf=f=>readFileSync(new URL("../planet-explorer/"+f,import.meta.url),"utf8");
const matrix=(x=0,y=0,z=0)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
const head=matrix(0,1.70,0);
const anchors=xrBodyAnchors(head,{floorY:0});
const at=a=>matrix(...a);
function rig(left,right,leftRay=matrix(),rightRay=matrix()){
 return {head,left:at(left),right:at(right),leftRay,rightRay};
}
test("tracked VR head creates real shoulders, hips, pelvis, knees and floor-aligned feet",()=>{
 assert.ok(anchors);
 assert.ok(anchors.shoulderLeft[0]<0&&anchors.shoulderRight[0]>0);
 assert.ok(anchors.leftHip[0]<0);
 assert.ok(anchors.chest[1]>anchors.pelvis[1]);
 assert.ok(Math.abs(anchors.leftFoot[1]-.09)<1e-9);
 assert.ok(XR_GRAB_RADIUS_M<.4);
});
test("left shoulder squeeze grabs bow only when carried",()=>{
 const v=new VRPhysicalControls();
 v.setPose(rig(anchors.shoulderLeft,anchors.rightElbow),1000,{floorY:0});
 assert.deepEqual(v.grab("left",()=>false),{kind:"unavailable",item:"bow"});
 assert.equal(v.bowHeld,false);
 assert.equal(v.grab("left",()=>true).kind,"bow");
 assert.equal(v.grab("left",()=>true).already,true);
});
test("right shoulder quiver then hands together nocks arrow, trigger pull sets tension",()=>{
 const v=new VRPhysicalControls();
 v.setPose(rig(anchors.shoulderLeft,anchors.shoulderRight),1000,{floorY:0});
 assert.equal(v.grab("left").kind,"bow");
 assert.equal(v.grab("right").kind,"arrow");
 assert.equal(v.nocked,false);
 const nockPlace=[anchors.shoulderLeft[0]+.18,anchors.shoulderLeft[1],anchors.shoulderLeft[2]];
 const events=v.setPose(rig(anchors.shoulderLeft,nockPlace),1100,{floorY:0});
 assert.ok(events.includes("nock"));assert.equal(v.nocked,true);
 assert.equal(v.triggerStart("right"),"draw");
 const pulled=[anchors.shoulderLeft[0]+.10,anchors.shoulderLeft[1],anchors.shoulderLeft[2]+.43];
 v.setPose(rig(anchors.shoulderLeft,pulled),1200,{floorY:0});
 assert.ok(v.pull>.4);
 assert.ok(xrDrawLength(anchors.shoulderLeft,pulled,matrix())>.4);
 const shot=v.triggerEnd("right");
 assert.equal(shot.kind,"shoot");
 assert.ok(shot.power>.4);
 assert.equal(v.arrowHeld,false);assert.equal(v.nocked,false);
 assert.equal(v.suppressSelect("right"),true);
 assert.equal(v.suppressSelect("right"),false);
});
test("undrawn bow never launches when right trigger releases",()=>{
 const v=new VRPhysicalControls();
 v.setPose(rig(anchors.shoulderLeft,anchors.shoulderRight),1000);
 v.grab("left");v.grab("right");
 v.setPose(rig(anchors.shoulderLeft,anchors.shoulderLeft),1100);
 v.triggerStart("right");
 v.setPose(rig(anchors.shoulderLeft,anchors.shoulderLeft),1200);
 assert.equal(v.triggerEnd("right").kind,"cancelDraw");
 assert.equal(v.arrowHeld,true);
});
test("right-hand sword unsheathes at left hip, swings with tracked velocity once per cooldown and sheathes",()=>{
 const v=new VRPhysicalControls();
 const p=anchors.leftHip;
 v.setPose(rig(anchors.shoulderLeft,p),1000);
 assert.equal(v.grab("right").kind,"sword");
 const q=[p[0]+.19,p[1]+.06,p[2]];
 const e=v.setPose(rig(anchors.shoulderLeft,q),1040);
 assert.ok(e.includes("swordSwing"));
 assert.deepEqual(v.setPose(rig(anchors.shoulderLeft,[q[0]+.22,q[1],q[2]]),1070),[]);
 v.setPose(rig(anchors.shoulderLeft,p),1800);
 assert.equal(v.grab("right").kind,"sheathe");
 assert.equal(v.swordHeld,false);
});
test("weapons are not materialized if missing from inventory",()=>{
 const v=new VRPhysicalControls();
 v.setPose(rig(anchors.shoulderLeft,anchors.leftHip),1000);
 assert.equal(v.grab("right",()=>false).kind,"unavailable");
 assert.equal(v.swordHeld,false);
});
test("Quest VR rendering includes room-space torso, arms, hands, knees and feet in each eye",()=>{
 const renderer=contentOf("render.mjs"),ui=contentOf("xr-ui.mjs");
 assert.match(renderer,/drawVRBody\(xr,rig\)/);
 assert.match(renderer,/segment\(a\.pelvis,a\.chest/);
 assert.match(renderer,/segment\(shoulder,mid/);
 assert.match(renderer,/segment\(knee,foot/);
 assert.match(renderer,/if\(rig\.drawing&&rig\.nocked\)/);
 assert.match(renderer,/this\.vrBodySegment\.destroy|this\.vrBodySegment,this\.custodyStarMesh/);
 assert.match(ui,/renderer\.drawVRBody\?\.\(renderer\.xrView,vrPhysical\.snapshot\(\)\)/);
});
test("XR events wire grip grab, trigger pull/release, swept sword and existing bow command",()=>{
 const ui=contentOf("xr-ui.mjs"),app=contentOf("app.mjs");
 assert.match(ui,/addEventListener\("squeezestart",onVRSqueezeStart\)/);
 assert.match(ui,/addEventListener\("selectstart",onVRSelectStart\)/);
 assert.match(ui,/addEventListener\("selectend",onVRSelectEnd\)/);
 assert.match(ui,/vrPhysical\.grab\(hand/);
 assert.match(ui,/vrPhysical\.triggerEnd\(/);
 assert.match(ui,/onVRCommand\("sweep"\)/);
 assert.match(ui,/onVRCommand\("shoot"\)/);
 assert.match(ui,/vrPhysical\.suppressSelect\(/);
 assert.match(app,/onVRGrab:\(item,hand\)=>/);
 assert.match(app,/frontierUI\.hasVRArrow\("player"\)/);
 assert.match(app,/frontierUI\.equipHandFromInventory\(item,hand\)/);
});
test("Quest body features do not change MR selection, full-screen or saved game schema",()=>{
 const ui=contentOf("xr-ui.mjs");
 assert.match(ui,/if\(activeMode==="mr-planet"\)/);
 assert.match(ui,/if\(activeMode==="mr-rts"\)/);
 assert.match(ui,/if\(activeMode!=="vr"\|\|vrRTS/);
 const app=contentOf("app.mjs");
 assert.match(app,/onRTSMove:\(x,z\)=>/);
 assert.match(app,/xr-ui\.mjs\?v=.*controls-v09s-body/);
});
