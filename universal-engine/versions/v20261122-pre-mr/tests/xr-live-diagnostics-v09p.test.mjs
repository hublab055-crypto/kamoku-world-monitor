import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {installXRUI} from "../planet-explorer/xr-ui.mjs";

const files=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");

function harness(){
 const old={
  document:Object.getOwnPropertyDescriptor(globalThis,"document"),
  navigator:Object.getOwnPropertyDescriptor(globalThis,"navigator"),
  XRWebGLLayer:Object.getOwnPropertyDescriptor(globalThis,"XRWebGLLayer"),
  isSecureContext:Object.getOwnPropertyDescriptor(globalThis,"isSecureContext")
 };
 const restore=()=>{
  for(const [name,desc] of Object.entries(old)){
   if(desc)Object.defineProperty(globalThis,name,desc);
   else delete globalThis[name];
  }
 };
 const ids=["xr-vr","xr-mr-rts","xr-mr-planet","xr-exit","xr-status","xr-scale",
  "xr-occlusion","xr-place","xr-planet-land","xr-rts-all","xr-rotate-left",
  "xr-rotate-right","xr-vr-diagnostics"];
 const els=new Map(ids.map(id=>[id,{
  hidden:false,disabled:false,checked:false,value:"0.0014",textContent:"",
  listeners:{},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},
  click(){this.listeners.click?.();}
 }]));
 const document={
  getElementById(id){return els.get(id)||null;},
  documentElement:{classList:{toggle(){}}}
 };
 const gl={
  FRAMEBUFFER:0x8d40,SCISSOR_TEST:0x0c11,COLOR_BUFFER_BIT:0x4000,DEPTH_BUFFER_BIT:0x0100,
  makeXRCompatible:async()=>{},
  bindFramebuffer(){},disable(){},colorMask(){},clearColor(){},clear(){}
 };
 const session={
  visibilityState:"visible",renderState:{},listeners:{},callback:null,inputSources:[],
  addEventListener(name,fn){this.listeners[name]=fn;},
  async requestReferenceSpace(){return {};},
  updateRenderState(config){Object.assign(this.renderState,config);},
  requestAnimationFrame(fn){this.callback=fn;return 1;},
  async end(){this.listeners.end?.();}
 };
 class MockLayer{
  constructor(){this.framebuffer={};this.framebufferWidth=100;this.framebufferHeight=100;}
 }
 const navigator={xr:{
  async isSessionSupported(){return true;},
  async requestSession(){return session;}
 }};
 for(const [name,value] of Object.entries({document,navigator,XRWebGLLayer:MockLayer,isSecureContext:true}))
  Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
 const logs=[],ui=installXRUI({
  getRenderer:()=>({gl}),
  getController:()=>({}),notify:msg=>logs.push(msg)
 });
 const start=async()=>{
  els.get("xr-vr").click();
  for(let i=0;i<40;i++)await Promise.resolve();
  assert.equal(ui.active,true);
  assert.equal(typeof session.callback,"function");
 };
 return {restore,els,logs,ui,session,start};
}

test("VR session with zero XR callbacks preserves a meaningful final diagnosis",async()=>{
 const h=harness();
 try{
  await h.start();
  assert.match(h.els.get("xr-vr-diagnostics").textContent,/XRコールバック=0/);
  assert.match(h.els.get("xr-vr-diagnostics").textContent,/コールバック待機/);
  await h.session.end();
  const line=h.els.get("xr-vr-diagnostics").textContent;
  assert.match(line,/終了・XRフレーム未受信/);
  assert.match(line,/XRコールバック=0/);
  assert.ok(h.logs.some(x=>x.includes("XRフレーム未受信")));
 }finally{h.ui.dispose();h.restore();}
});

test("VR frame received without viewer pose is not misreported as no callback",async()=>{
 const h=harness();
 try{
  await h.start();
  h.session.callback(12,{getViewerPose(){return null;}});
  const diagnostic=h.els.get("xr-vr-diagnostics").textContent;
  assert.match(diagnostic,/XRコールバック=1/);
  assert.match(diagnostic,/追跡姿勢なし/);
  await h.session.end();
  assert.match(h.els.get("xr-vr-diagnostics").textContent,/終了・XRフレーム受信／映像未描画/);
 }finally{h.ui.dispose();h.restore();}
});

test("XR progress reporting is before early returns and watchdog is WebGL-free",()=>{
 const src=files("xr-ui.mjs");
 const count=src.indexOf("vrFrames++;",src.indexOf("function drawXR"));
 const check=src.indexOf("if(!renderer||!controller||!space)",count);
 const pose=src.indexOf("frame.getViewerPose(space)",count);
 assert.ok(count>0&&count<check&&count<pose);
 assert.match(src,/\[4500,11000\]/);
 assert.match(src,/XR描画コールバック未受信/);
 assert.match(src,/vrSessionVisibility=watched\.visibilityState/);
 assert.match(src,/clearVRWatchdogs\(\)/);
 assert.match(src,/renderedEyes!==pose\.views\.length/);
 assert.match(src,/vrMark\("左右眼描画完了"/);
});

test("MR model and RTS retain their existing input paths",()=>{
 const src=files("xr-ui.mjs");
 assert.match(src,/activeMode==="mr-planet"/);
 assert.match(src,/activeMode==="mr-rts"/);
 assert.match(src,/onPlanetLand\(\)/);
 assert.match(src,/onRTSMove\(point\.x,point\.z\)/);
 assert.match(files("app.mjs"),/xr-ui\.mjs\?v=0\.9p-vr-live-diagnostics/);
});
