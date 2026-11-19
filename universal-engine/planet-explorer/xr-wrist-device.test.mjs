import test from "node:test";
import assert from "node:assert/strict";
import {xrTranslate} from "./xr-spatial.mjs";
import {XRWristWatch,VR_WRIST_KEYS,xrWristPose,xrWristRayHit} from "./xr-wrist-device.mjs";
const rayAt=(model,x=0,y=0,d=.5)=>{
 const r=Array.from(model);
 for(let i=0;i<3;i++)r[12+i]+=model[i]*x+model[4+i]*y+model[8+i]*d;
 return r;
};
test("Watch requires a real tracked left controller",()=>{
 const watch=new XRWristWatch();
 assert.equal(watch.update(xrTranslate(0,1.65,0),null),null);
 assert.equal(watch.press(xrTranslate(0,1,0)),null);
 const model=watch.update(xrTranslate(0,1.65,0),xrTranslate(-.2,1.2,-.45));
 assert.ok(model);assert.ok(Math.abs(model[13]-1.275)<1e-7);
 watch.resetSession();assert.equal(watch.model,null);
 assert.equal(xrWristPose(null,xrTranslate(0,0,0)),null);
});
test("Right-hand trigger rays hit four commands from the visible side only",()=>{
 const watch=new XRWristWatch();
 const model=watch.update(xrTranslate(0,1.65,0),xrTranslate(-.2,1.2,-.45));
 for(const key of VR_WRIST_KEYS)assert.equal(watch.press(rayAt(model,key.x,key.y))?.action,key.id);
 assert.equal(xrWristRayHit(rayAt(model,.25,0),model),null);
 assert.equal(xrWristRayHit(rayAt(model,0,0,2),model),null);
 assert.equal(xrWristRayHit(rayAt(model,0,0,-.2),model),null);
});