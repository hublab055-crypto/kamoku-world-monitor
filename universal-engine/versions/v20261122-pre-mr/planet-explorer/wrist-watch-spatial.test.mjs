import test from "node:test";
import assert from "node:assert/strict";
import {XRWristWatch,watchButtonAt} from "./wrist-watch-spatial.mjs";
import {xrTranslate} from "./xr-spatial.mjs";

function rayTo(matrix,x=0,y=0){
 const r=xrTranslate(matrix[12]+matrix[0]*x+matrix[4]*y,
  matrix[13]+matrix[1]*x+matrix[5]*y,matrix[14]+matrix[2]*x+matrix[6]*y+.3);
 return r;
}
test("watch binds to tracked wrist and requires controller hit",()=>{
 const watch=new XRWristWatch();
 const head=xrTranslate(0,1.65,0),left=xrTranslate(-.2,1.2,-.35),right=xrTranslate(.2,1.2,-.35);
 watch.update(head,left,right,{hand:"left",mode:"universe"});
 assert.ok(watch.model);
 assert.equal(watch.press(xrTranslate(9,9,9)),null);
 const hit=watch.press(rayTo(watch.model));
 assert.equal(hit.action,"toggle");
 assert.equal(hit.open,true);
 watch.update(head,left,right,{hand:"left",mode:"universe"});
 assert.ok(watch.menuModel);
 assert.equal(watch.press(rayTo(watch.menuModel,-.15,.13)).action,"main-menu");
 assert.equal(watch.press(rayTo(watch.menuModel,.15,-.13)).action,"time-page");
 watch.update(head,left,right,{hand:"left",mode:"universe"});
 assert.equal(watch.press(rayTo(watch.menuModel,-.15,.13)).action,"time-pause");
 assert.equal(watch.press(rayTo(watch.menuModel,0,.13)).action,"blocked");
});
test("multiverse has menus but no time controls; untracked wrist disappears",()=>{
 const watch=new XRWristWatch();
 const head=xrTranslate(0,1.6,0),right=xrTranslate(.2,1.2,-.35);
 watch.update(head,null,right,{hand:"right",mode:"multiverse"});
 assert.ok(watch.model);
 watch.press(rayTo(watch.model));
 watch.update(head,null,right,{hand:"right",mode:"multiverse"});
 assert.equal(watch.press(rayTo(watch.menuModel,.15,-.13)).action,"blocked");
 watch.update(head,null,null,{hand:"right",mode:"multiverse"});
 assert.equal(watch.model,null);
});
test("watch hit grid maps six stable menu locations",()=>{
 assert.equal(watchButtonAt(-.15,.13),0);
 assert.equal(watchButtonAt(.15,-.13),5);
 assert.equal(watchButtonAt(.3,.3),-1);
});
