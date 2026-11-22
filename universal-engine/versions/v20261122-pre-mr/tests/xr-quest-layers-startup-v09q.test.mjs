import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {xrLayersEnabled,installLegacyXRLayer,activeLegacyXRLayer}
 from "../planet-explorer/xr-layer-policy.mjs";
const xr=readFileSync(new URL("../planet-explorer/xr-ui.mjs",import.meta.url),"utf8");

test("Quest: layers-enabled session chooses layers renderState and never baseLayer",()=>{
 const calls=[],legacy={framebuffer:{},getViewport(){}};
 const session={enabledFeatures:["local","layers"],renderState:{baseLayer:null,layers:[]},
  updateRenderState(options){
   calls.push(options);
   if("baseLayer" in options)throw Error("Can't use baseLayer with layers feature requested");
   this.renderState.layers=options.layers;
  }};
 assert.equal(xrLayersEnabled(session),true);
 assert.equal(installLegacyXRLayer(session,legacy,{preferLayers:xrLayersEnabled(session)}),"layers");
 assert.equal(calls.length,1);
 assert.deepEqual(calls[0],{layers:[legacy]});
 assert.equal(activeLegacyXRLayer(session),legacy);
});

test("Older browser: baseLayer remains supported when layers feature is absent",()=>{
 const calls=[],legacy={framebuffer:{},getViewport(){}};
 const session={enabledFeatures:new Set(["local"]),renderState:{},
  updateRenderState(options){
   calls.push(options);
   if("layers" in options)throw Error("WebXR layers not supported");
   this.renderState.baseLayer=options.baseLayer;
  }};
 assert.equal(xrLayersEnabled(session),false);
 assert.equal(installLegacyXRLayer(session,legacy,{preferLayers:false}),"baseLayer");
 assert.deepEqual(calls,[{baseLayer:legacy}]);
 assert.equal(activeLegacyXRLayer(session),legacy);
});
test("Feature grant unknown: fallback from baseLayer refusal to XR layers",()=>{
 const calls=[],legacy={framebuffer:{},getViewport(){}};
 const session={renderState:{layers:[]},updateRenderState(state){
  calls.push(state);
  if("baseLayer" in state)throw new Error("Can't use baseLayer with layers feature requested");
  this.renderState.layers=state.layers;
 }};
 assert.equal(xrLayersEnabled(session),null);
 assert.equal(installLegacyXRLayer(session,legacy),"layers");
 assert.equal(calls.length,2);
 assert.ok("baseLayer" in calls[0]);assert.ok("layers" in calls[1]);
 assert.equal(activeLegacyXRLayer(session),legacy);
});
test("Feature grant unknown: fallback from unsupported layers to baseLayer",()=>{
 const legacy={framebuffer:{},getViewport(){}};
 const session={renderState:{},updateRenderState(state){
  if("layers" in state)throw Error("layers unsupported");
  this.renderState.baseLayer=state.baseLayer;
 }};
 assert.equal(installLegacyXRLayer(session,legacy,{preferLayers:true}),"baseLayer");
 assert.equal(activeLegacyXRLayer(session),legacy);
});
test("Legacy layer lookup ignores XRProjectionLayer without framebuffer",()=>{
 const projection={colorTexture:{},textureWidth:1000};
 const session={renderState:{baseLayer:null,layers:[projection]}};
 assert.equal(activeLegacyXRLayer(session),null);
});
test("Quest VR startup creates XRProjectionLayer before any legacy XRWebGLLayer fallback",()=>{
 const start=xr.indexOf("async function start(mode)");
 const init=xr.indexOf("projection=createXRProjection(newSession,gl)",start);
 const legacy=xr.indexOf("const layer=new XRWebGLLayer(newSession,gl",start);
 const session=xr.indexOf("session=newSession;activeMode=mode",start);
 assert.ok(start>0 && init>start && legacy>init && session>legacy);
 assert.match(xr,/if\(!projection\)\{\s*const layer=new XRWebGLLayer/);
 assert.match(xr,/preferLayers:requestedType==="immersive-vr"&&\(granted\?\?wantsLayers\)/);
 assert.doesNotMatch(xr,/newSession\.updateRenderState\(\{baseLayer:layer\}\)/);
});
test("Quest projection render can draw when baseLayer is null",()=>{
 assert.match(xr,/const gl=renderer\.gl,layer=activeLegacyXRLayer\(session\)/);
 assert.match(xr,/if\(!layer&&!projection\)/);
 assert.match(xr,/projectionReady\(session,projection\)/);
});
test("MR initialization requests no layers and retains legacy framebuffer",()=>{
 assert.match(xr,/requestedType==="immersive-vr"&&canUseXRProjection\(\)/);
 assert.match(xr,/requestedType==="immersive-ar"\?\["hit-test"/);
 assert.match(xr,/gl\.bindFramebuffer\(gl\.FRAMEBUFFER,layer\.framebuffer\)/);
});
