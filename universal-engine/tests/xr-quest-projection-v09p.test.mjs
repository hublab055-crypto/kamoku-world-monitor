import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {canUseXRProjection,createXRProjection,projectionReady,bindXRProjectionView,destroyXRProjection} from "../planet-explorer/xr-projection.mjs";
const source=(f)=>readFileSync(new URL("../planet-explorer/"+f,import.meta.url),"utf8");
function setup(){
 const calls=[],gl={
  DEPTH_COMPONENT24:0x81a6,TEXTURE_2D:0x0de1,FRAMEBUFFER:0x8d40,
  COLOR_ATTACHMENT0:0x8ce0,DEPTH_ATTACHMENT:0x8d00,FRAMEBUFFER_COMPLETE:0x8cd5,
  createFramebuffer:()=>({fb:1}),deleteFramebuffer:fb=>calls.push(["delete",fb]),
  bindFramebuffer:(...x)=>calls.push(["bind",...x]),
  framebufferTexture2D:(...x)=>calls.push(["attach",...x]),
  checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE
 };
 const layer={projection:true},eyeView={eye:"left"};
 class FakeBinding{
  constructor(session,context){assert.equal(context,gl);}
  createProjectionLayer(options){calls.push(["create",options]);return layer;}
  getViewSubImage(_layer,view){assert.equal(_layer,layer);assert.equal(view,eyeView);
   return {colorTexture:{color:true},depthStencilTexture:{depth:true},
    viewport:{x:0,y:0,width:1024,height:1100}};}
 }
 const session={renderState:{layers:[],baseLayer:{}},updateRenderState(o){
  calls.push(["update",o]);this.renderState.layers=o.layers;this.renderState.baseLayer=null;
 }};
 return {calls,gl,layer,eyeView,FakeBinding,session};
}
test("VR projection capability is optional and queried only when available",()=>{
 assert.equal(canUseXRProjection({}),false);
 assert.equal(canUseXRProjection({XRWebGLBinding(){}}),true);
});
test("Quest VR uses texture-only XRProjectionLayer instead of an opaque framebuffer",()=>{
 const a=setup(),p=createXRProjection(a.session,a.gl,a.FakeBinding);
 assert.equal(projectionReady(a.session,p),true);
 assert.equal(a.session.renderState.baseLayer,null);
 assert.deepEqual(a.calls.find(c=>c[0]==="create")[1],{
  textureType:"texture",depthFormat:a.gl.DEPTH_COMPONENT24,scaleFactor:.85});
 assert.deepEqual(a.calls.find(c=>c[0]==="update")[1].layers,[a.layer]);
});
test("Direct XR projection attaches per-eye compositor color and depth images",()=>{
 const a=setup(),p=createXRProjection(a.session,a.gl,a.FakeBinding);
 const view=bindXRProjectionView(a.gl,p,a.eyeView);
 assert.equal(view.width,1024);
 const attachments=a.calls.filter(c=>c[0]==="attach");
 assert.equal(attachments.length,2);
 assert.equal(attachments[0][2],a.gl.COLOR_ATTACHMENT0);
 assert.equal(attachments[1][2],a.gl.DEPTH_ATTACHMENT);
 destroyXRProjection(a.gl,p);
 assert.ok(a.calls.some(c=>c[0]==="delete"));
});
test("Per-view XR FBO reports real WebGL incompleteness",()=>{
 const a=setup(),p=createXRProjection(a.session,a.gl,a.FakeBinding);
 a.gl.checkFramebufferStatus=()=>0x8cd7;
 assert.throws(()=>bindXRProjectionView(a.gl,p,a.eyeView),/0x8cd7/);
});
test("XR layer errors free the temporary framebuffer",()=>{
 const a=setup();
 a.session.updateRenderState=()=>{throw Error("unsupported")};
 assert.throws(()=>createXRProjection(a.session,a.gl,a.FakeBinding),/unsupported/);
 assert.ok(a.calls.some(c=>c[0]==="delete"));
});
test("VR live progress survives incomplete FBO; XR fallback uses texture path on Quest",()=>{
 const s=source("xr-ui.mjs");
 assert.match(s,/vrMark\("セッション開始／XRコールバック待機"/);
 assert.match(s,/vrFrames\+\+;/);
 assert.match(s,/XR描画コールバック未受信/);
 assert.match(s,/XR映像描画未完了/);
 assert.match(s,/VR診断：/);
 assert.match(s,/createXRProjection\(session,gl\)/);
 assert.match(s,/bindXRProjectionView\(gl,projection,view\)/);
 assert.match(s,/projectionReady\(session,projection\)/);
});
test("Quest projection is only attempted in immersive VR; MR opaque renderer remains available",()=>{
 const s=source("xr-ui.mjs");
 assert.match(s,/if\(activeMode!=="vr"\)return;/);
 assert.match(s,/const usingProjection=mode==="vr"&&Boolean\(projection\)/);
 assert.match(s,/gl\.bindFramebuffer\(gl\.FRAMEBUFFER,layer\.framebuffer\);/);
 assert.match(s,/\["layers"\]/);
 assert.match(s,/onPlanetLand\(\)/);
 assert.match(s,/onRTSMove\(/);
});
test("XR browser and module cache keys invalidate old Quest script",()=>{
 const app=source("app.mjs"),html=source("index.html");
 assert.match(app,/xr-ui\.mjs\?v=0\.9p-vr-live-diagnostics/);
 assert.match(html,/live-v09p/);
});
