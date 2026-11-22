import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {XR_VR_LAYER_CONFIGS,probeXRFramebuffer,xrNextLayerIndex,xrFramebufferStatusLabel} from "../planet-explorer/xr-framebuffer.mjs";

const f=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
function mockGL(state=0x8cd5){
 const gl={FRAMEBUFFER:0x8d40,FRAMEBUFFER_COMPLETE:0x8cd5,
 FRAMEBUFFER_INCOMPLETE_ATTACHMENT:0x8cd6,FRAMEBUFFER_UNSUPPORTED:0x8cdd,
 last:null,bindFramebuffer(target,value){assert.equal(target,this.FRAMEBUFFER);this.last=value;},
 checkFramebufferStatus(){return state;}};
 return gl;
}
test("XR framebuffer only reports complete when the opaque layer is ready",()=>{
 const gl=mockGL(),fb={id:1},layer={framebuffer:fb,framebufferWidth:1400,framebufferHeight:1700};
 const result=probeXRFramebuffer(gl,layer);
 assert.equal(result.ok,true);
 assert.equal(result.label,"complete");assert.equal(result.width,1400);
 assert.equal(gl.last,fb);
});
test("Invalid FB 0x0506 is preceded by actionable incomplete FB status",()=>{
 const gl=mockGL(0x8cdd);
 const result=probeXRFramebuffer(gl,{framebuffer:{},framebufferWidth:1500,framebufferHeight:1500});
 assert.equal(result.ok,false);assert.equal(result.label,"unsupported");
 assert.equal(xrFramebufferStatusLabel(gl,0x8cd6),"incomplete-attachment");
 assert.equal(probeXRFramebuffer(gl,{framebuffer:null}).label,"missing-layer");
});
test("Incomplete framebuffer width is rejected without touching XR attachments",()=>{
 const gl=mockGL();
 assert.equal(probeXRFramebuffer(gl,{framebuffer:{},framebufferWidth:0,framebufferHeight:1000}).ok,false);
});
test("VR fallback first removes multisample, then depth on last resort",()=>{
 assert.equal(XR_VR_LAYER_CONFIGS.length,3);
 assert.equal(XR_VR_LAYER_CONFIGS[0].antialias,true);
 assert.equal(XR_VR_LAYER_CONFIGS[1].antialias,false);
 assert.equal(XR_VR_LAYER_CONFIGS[1].depth,true);
 assert.equal(XR_VR_LAYER_CONFIGS[2].depth,false);
 assert.equal(xrNextLayerIndex(0),1);
 assert.equal(xrNextLayerIndex(1),2);
 assert.equal(xrNextLayerIndex(2),null);
});
test("XR frame coordinator probes framebuffer before clearing or rendering",()=>{
 const runtime=f("xr-ui.mjs");
 const a=runtime.indexOf("const target=probeXRFramebuffer(gl,layer)");
 const b=runtime.indexOf("gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)",a);
 const c=runtime.indexOf("renderer.frame(frameState",a);
 assert.ok(a>0&&b>a&&c>b);
 assert.match(runtime,/const replacement=new XRWebGLLayer\(session,gl,XR_VR_LAYER_CONFIGS\[next\]\)/);
 assert.match(runtime,/if\(!target\.ok\)\{\s*recoverVRFramebuffer/);
 assert.match(runtime,/if\(clearErr\)/);
 assert.match(runtime,/if\(sceneErr\)/);
});
test("Existing WebXR modes and save-compatible renderer path are preserved",()=>{
 const runtime=f("xr-ui.mjs");
 assert.match(runtime,/requestedType==="immersive-vr"/);
 assert.match(runtime,/requestedType==="immersive-ar"/);
 assert.match(runtime,/xrPlanetHit\(/);
 assert.match(runtime,/onRTSMove\(/);
 assert.match(runtime,/if\(mode\.startsWith\("mr-"\)/);
 const app=f("app.mjs");
 assert.match(app,/const next=xrUI\?\.active\?displayMode:renderer\.frame\(controller,dt\)/);
});
