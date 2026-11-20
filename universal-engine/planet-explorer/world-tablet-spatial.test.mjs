import test from "node:test";
import assert from "node:assert/strict";
import {
 XRWorldTablet,VR_TABLET_KEYS,VR_TABLET_WALL_SCALE,
 vrTabletHandPose,vrTabletWallPose,vrTabletRayHit,vrTabletButtonAt
} from "./world-tablet-spatial.mjs";
import {xrIdentity,xrTranslate,xrMul} from "./xr-spatial.mjs";

const head=()=>xrTranslate(0,1.65,0);
const left=(x=-.22,z=-.58)=>xrTranslate(x,1.25,z);
function rayAt(model,x=0,y=0,dist=.65){
 const m=Array.from(model);
 m[12]+=model[0]*x+model[4]*y+model[8]*dist;
 m[13]+=model[1]*x+model[5]*y+model[9]*dist;
 m[14]+=model[2]*x+model[6]*y+model[10]*dist;
 return m;
}

test("Quest tablet is opt-in and follows genuine left controller tracking",()=>{
 const tablet=new XRWorldTablet();
 assert.equal(tablet.update(head(),left()),null);
 tablet.setEnabled(true);
 const matrix=tablet.update(head(),left());
 assert.ok(matrix);
 assert.ok(Math.abs(matrix[12]+.22)<.0001);
 assert.ok(Math.abs(matrix[13]-1.40)<.0001);
 const newModel=tablet.update(head(),left(-.42,-.67));
 assert.ok(Math.abs(newModel[12]+.42)<.0001);
 assert.ok(Math.abs(newModel[14]+.705)<.0001);
 assert.equal(tablet.position,"hand");
});

test("If controller is untracked, tablet uses a labelled head-space fallback",()=>{
 const a=vrTabletHandPose(head(),null);
 assert.ok(a);
 assert.ok(a[14]<-.5);
 assert.ok(a[12]<0);
 assert.equal(vrTabletHandPose(null,null),null);
 assert.equal(vrTabletWallPose(null),null);
});

test("Right ray hits 3D buttons only from the visible side within reach",()=>{
 const tablet=new XRWorldTablet();
 tablet.setEnabled(true);
 tablet.update(head(),left());
 const model=tablet.model;
 const center=vrTabletRayHit(rayAt(model),model);
 assert.ok(center);
 assert.ok(Math.abs(center.x)<1e-8);
 assert.ok(Math.abs(center.y)<1e-8);
 for(const btn of VR_TABLET_KEYS){
  const hit=vrTabletRayHit(rayAt(model,btn.x,btn.y),model);
  assert.equal(vrTabletButtonAt(hit.x,hit.y),btn.id);
 }
 assert.equal(vrTabletRayHit(rayAt(model,.5,0),model),null);
 assert.equal(vrTabletRayHit(rayAt(model,0,0,4),model),null);
 // Ray from behind points away from front-facing normal and is rejected.
 const back=rayAt(model,0,0,-.5);
 assert.equal(vrTabletRayHit(back,model),null);
 assert.equal(vrTabletRayHit(null,model),null);
 assert.equal(vrTabletButtonAt(.08,.08),null);
});

test("WALL places a real XR room-space panel; HAND restores controller-follow",()=>{
 const tablet=new XRWorldTablet();
 tablet.setEnabled(true);
 tablet.update(head(),left());
 const wall=VR_TABLET_KEYS.find(k=>k.id==="wall");
 assert.equal(tablet.press(rayAt(tablet.model,wall.x,wall.y)).action,"wall");
 const original=[tablet.model[12],tablet.model[13],tablet.model[14]];
 assert.equal(tablet.position,"wall");
 assert.ok(Math.abs(tablet.scale-VR_TABLET_WALL_SCALE)<1e-9);
 tablet.update(xrTranslate(1,1.65,1),left(-.7,-.4));
 assert.deepEqual([tablet.model[12],tablet.model[13],tablet.model[14]],original);
 const hand=VR_TABLET_KEYS.find(k=>k.id==="hand");
 assert.equal(tablet.press(rayAt(tablet.model,hand.x,hand.y)).action,"hand");
 assert.equal(tablet.position,"hand");
 assert.ok(Math.abs(tablet.model[12]+.7)<.0001);
});

test("OFF closes the world-space panel; session reset removes room anchors",()=>{
 const t=new XRWorldTablet();
 t.setEnabled(true);
 t.update(head(),left());
 const off=VR_TABLET_KEYS.find(k=>k.id==="hide");
 assert.equal(t.press(rayAt(t.model,off.x,off.y)).action,"hide");
 assert.equal(t.enabled,false);
 assert.equal(t.model,null);
 t.setEnabled(true);
 t.update(head(),left());
 t.resetSession();
 assert.equal(t.position,"hand");
 assert.equal(t.wall,null);
 assert.equal(t.model,null);
 assert.equal(t.press(xrIdentity()),null);
});

test("Tablet avatar and motion pages change keys but retain main actions",()=>{
 const tablet=new XRWorldTablet();tablet.setEnabled(true);tablet.update(head(),left());
 const key=(id,keys=VR_TABLET_KEYS)=>keys.find(x=>x.id===id);
 const press=(id,keys)=>{const k=key(id,keys);return tablet.press(rayAt(tablet.model,k.x,k.y));};
 assert.equal(press("avatar").action,"avatar");
 assert.equal(tablet.page,"avatar");
 assert.equal(tablet.press(rayAt(tablet.model,.18,.14)).action,"brow-more");
 assert.equal(press("back",[{id:"back",x:.18,y:-.14}]).action,"back");
 assert.equal(tablet.page,"main");
 assert.equal(press("motion").action,"motion");
 assert.equal(tablet.page,"motion");
 assert.equal(press("record",[{id:"record",x:.06,y:.14}]).action,"record");
 tablet.resetSession();assert.equal(tablet.page,"main");
});

test("Motion panel exposes isolated pose editor commands to the right-hand ray",()=>{
 const t=new XRWorldTablet();t.setEnabled(true);t.update(head(),left());
 const main=VR_TABLET_KEYS.find(k=>k.id==="motion");
 t.press(rayAt(t.model,main.x,main.y));
 assert.equal(t.page,"motion");
 for(const [id,x,y]of [["pose",-.18,.14],["target",-.06,.14],["key",-.06,0],["export",-.18,-.14]]){
  assert.equal(t.press(rayAt(t.model,x,y))?.action,id);
 }
});
