import test from "node:test";
import assert from "node:assert/strict";
import {XRWristWatch,watchButtonAt,watchWristFrame,watchGlance} from "./wrist-watch-spatial.mjs";
import {xrTranslate,xrRotateY} from "./xr-spatial.mjs";

function rayTo(model,x=0,y=0){
 const axis=c=>[model[c*4],model[c*4+1],model[c*4+2]];
 const unit=v=>v.map(a=>a/(Math.hypot(...v)||1));
 const ax=unit(axis(0)),ay=unit(axis(1)),z=unit(axis(2));
 const from=[model[12],model[13],model[14]].map((n,i)=>
  n+model[0+i]*x+model[4+i]*y+z[i]*.32);
 return [...ax,0,...ay,0,...z,0,...from,1];
}
test("watch attaches behind a tracked wrist, not as a head-facing panel",()=>{
 const watch=new XRWristWatch(),head=xrTranslate(0,1.65,0);
 const grip=xrTranslate(-.16,1.35,-.6);
 watch.update(head,grip,null,{hand:"left",mode:"universe"});
 assert.ok(watch.model);
 assert.ok(watch.wristFrame);
 assert.ok(Math.abs(watch.wristFrame[14]-(-.5))<1e-5);
 assert.ok(Math.abs(watch.model[5])<1e-8); // Face plane is perpendicular to grip +Y
 assert.ok(watch.model[9]>.1);             // Dorsal normal follows grip +Y
 const rotated=[...xrRotateY(Math.PI),0,0,0,1];
 // A rigid grip orientation rotates the face, independent of head position.
 const moved=[...xrRotateY(Math.PI)];moved[12]=-.16;moved[13]=1.35;moved[14]=-.6;
 watch.update(head,moved,null,{hand:"left"});
 assert.ok(watch.model[8]<.001);
 assert.equal(watchWristFrame(null),null);
});
test("normal controller ray opens visible headset menu and enters real 3D subpages",()=>{
 const watch=new XRWristWatch(),head=xrTranslate(0,1.65,0);
 const left=xrTranslate(-.16,1.35,-.6);
 watch.update(head,left,null,{hand:"left",mode:"universe"});
 assert.equal(watch.press(xrTranslate(9,9,9)),null);
 assert.deepEqual(watch.press(rayTo(watch.model)),{action:"toggle",open:true});
 assert.ok(watch.menuModel);
 assert.equal(watch.press(rayTo(watch.menuModel,-.15,.13)).action,"main-page");
 assert.equal(watch.page,"main");
 assert.equal(watch.press(rayTo(watch.menuModel,0,.13)).action,"settings-page");
 assert.equal(watch.page,"settings");
 assert.equal(watch.press(rayTo(watch.menuModel,0,.13)).action,"watch-style");
 assert.equal(watch.press(rayTo(watch.menuModel,-.15,.13)).action,"back-page");
 assert.equal(watch.page,"menu");
 assert.equal(watch.press(rayTo(watch.menuModel,.15,-.13)).action,"time-page");
 assert.equal(watch.press(rayTo(watch.menuModel,-.15,.13)).action,"time-pause");
 assert.equal(watch.press(rayTo(watch.menuModel,0,.13)).action,"blocked");
});
test("looking at a raised dorsal dial lights it and sustained gaze opens menu only once",()=>{
 const watch=new XRWristWatch(),head=xrTranslate(0,1.65,0);
 const left=xrTranslate(-.16,1.35,-.6);
 for(let i=0;i<20;i++){
  watch.update(head,left,null,{hand:"left"},i*70);
  if(i===6)assert.equal(watch.awake,true);
 }
 assert.equal(watchGlance(head,watch.model),true);
 assert.equal(watch.open,true);
 assert.ok(watch.menuModel);
 watch.closeMenu();
 // Continuing to stare must not reopen the menu until the gaze is withdrawn.
 for(let i=20;i<35;i++)watch.update(head,left,null,{hand:"left"},i*70);
 assert.equal(watch.open,false);
 const lowered=xrTranslate(-.35,.55,.7);
 for(let i=35;i<50;i++)watch.update(head,lowered,null,{hand:"left"},i*70);
 assert.equal(watch.open,false);
 for(let i=50;i<70;i++)watch.update(head,left,null,{hand:"left"},i*70);
 assert.equal(watch.open,true);
});
test("opposite-hand touch is a deliberate fallback, same-hand input is ignored",()=>{
 const watch=new XRWristWatch(),head=xrTranslate(0,1.65,0),left=xrTranslate(-.16,1.35,-.6);
 for(let i=0;i<6;i++)watch.update(head,left,null,{hand:"left"},i*70);
 assert.equal(watch.awake,true);
 const near=xrTranslate(watch.model[12],watch.model[13],watch.model[14]);
 assert.equal(watch.press(null,{sourceHand:"left",grip:near}),null);
 assert.equal(watch.press(null,{sourceHand:"right",grip:near}).action,"toggle");
});
test("multiverse keeps menus but rejects time manipulation",()=>{
 const watch=new XRWristWatch(),head=xrTranslate(0,1.6,0),right=xrTranslate(.2,1.2,-.35);
 watch.update(head,null,right,{hand:"right",mode:"multiverse"});
 assert.ok(watch.model);
 watch.press(rayTo(watch.model));
 assert.equal(watch.press(rayTo(watch.menuModel,.15,-.13)).action,"blocked");
 assert.equal(watch.press(rayTo(watch.menuModel,-.15,.13)).action,"main-page");
 watch.update(head,null,null,{hand:"right",mode:"multiverse"});
 assert.equal(watch.model,null);
});
test("stable large 3x2 watch menu ray hit grid",()=>{
 assert.equal(watchButtonAt(-.15,.13),0);
 assert.equal(watchButtonAt(.15,-.13),5);
 assert.equal(watchButtonAt(.3,.3),-1);
});
