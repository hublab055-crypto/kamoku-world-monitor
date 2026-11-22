import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {sampleXRDepth,depthFeatureOptions,canRequestXRDepth} from "../planet-explorer/xr-depth.mjs";

const read=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");

test("MR depth grid flips top-left WebXR pixels into bottom-left WebGL texture rows",()=>{
 const sampled=sampleXRDepth({getDepthInMeters(_u,v){return v>.5?3:7;}},{width:2,height:2});
 assert.deepEqual([...sampled.pixels],[3,3,7,7]);
 assert.equal(sampled.valid,4);
});
test("Sensor gaps are transparent, not dark occlusion walls",()=>{
 const values=[NaN,Infinity,-1,0,.01,80.1,2];
 let i=0;
 const sampled=sampleXRDepth({getDepthInMeters(){return values[i++];}},{width:7,height:1});
 assert.deepEqual([...sampled.pixels],[0,0,0,0,0,0,2]);
 assert.equal(sampled.valid,1);
 assert.equal(sampleXRDepth({getDepthInMeters(){return 0;}},{width:1,height:1}).available,false);
});
test("Sampling fails safe on missing info and invalid dimensions",()=>{
 assert.equal(sampleXRDepth(null),null);
 assert.equal(sampleXRDepth({},{}),null);
 assert.throws(()=>sampleXRDepth({getDepthInMeters(){return 1;}},{width:0,height:2}),RangeError);
});
test("Depth sensing requested only for AR and kept optional",()=>{
 assert.equal(canRequestXRDepth("immersive-vr"),false);
 assert.equal(canRequestXRDepth("immersive-ar"),true);
 assert.deepEqual(depthFeatureOptions("immersive-vr"),{});
 assert.equal(depthFeatureOptions("immersive-ar").optionalFeature,"depth-sensing");
 assert.deepEqual(depthFeatureOptions("immersive-ar").depthSensing.usagePreference,["cpu-optimized"]);
});
test("Headset routing supports building and moving vehicle interiors",()=>{
 const render=read("render.mjs");
 for(const name of ["renderTrainInterior","renderTownInterior","renderFerryInterior","renderRailwayConcourse","renderRailwayJail"])
  assert.match(render,new RegExp("this\\."+name+"\\(asp"));
 assert.match(render,/xrInteriorVP\(person=/);
 assert.match(render,/const vp=this\.xrInteriorVP\(actorPose\)/);
 assert.match(render,/const vp=this\.xrInteriorVP\(this\.townInterior\.pose/);
 assert.match(render,/if\(this\.xrView\?\.mode!=="vr"\)/);
});
test("MR occlusion is per-eye and disabled when outside passthrough",()=>{
 const runtime=read("xr-ui.mjs"),render=read("render.mjs"),html=read("index.html");
 assert.match(runtime,/frame\.getDepthInformation\?\.\(view\)/);
 assert.match(runtime,/if\(mode\.startsWith\("mr-"\)&&depthToggle\?\.checked/);
 assert.match(runtime,/gl\.R32F/);
 assert.match(render,/uniform sampler2D uXROcclusionDepth/);
 assert.match(render,/if\(realMeters>0\.02&&vDepth>realMeters\+0\.08\)discard/);
 assert.match(render,/const mask=Boolean\(xr\?\.mode\.startsWith\("mr-"\)&&xr\?\.depthTexture\)/);
 assert.match(html,/id="xr-occlusion"/);
});
