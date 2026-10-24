import {xrAnchor,xrStage,xrTableHit,xrPlacementFromHit} from "./xr-spatial.mjs?v=0.9i-xr";

/**
 * Opt-in WebXR runtime for the existing WebGL2 renderer.
 * No save-schema changes. XR is presentation-only unless the user selects a
 * unit on the miniature RTS surface with a controller trigger.
 */
export function installXRUI({getRenderer,getController,onRTSSelect=()=>{},onRTSMove=()=>{},notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const buttons={vr:$("xr-vr"),rts:$("xr-mr-rts"),planet:$("xr-mr-planet"),exit:$("xr-exit")};
 const status=$("xr-status"),scaleInput=$("xr-scale");
 let session=null,activeMode=null,space=null,anchor=null,lastTime=0,viewerSpace=null,hitSource=null,hitPose=null;
 let usingFloor=false,disposed=false,readyPromise=Promise.resolve();
 let compatibilityRenderer=null;
 const present=()=>Boolean(session);
 const supported=()=>Boolean(navigator.xr&&globalThis.XRWebGLLayer&&globalThis.isSecureContext);
 const statusText=(message)=>{status.textContent=message;};
 function update(){
  for(const [name,button] of Object.entries(buttons)){
   if(!button)continue;
   if(name==="exit"){button.hidden=!session;continue;}
   const selected=activeMode===(name==="vr"?"vr":name==="rts"?"mr-rts":"mr-planet");
   button.setAttribute("aria-pressed",String(selected));
  }
  document.documentElement.classList.toggle("ue-xr-active",Boolean(session));
 }
 async function readyGL(){
  const current=getRenderer();
  if(!current)throw Error("描画エンジンがまだ初期化されていません");
  if(current===compatibilityRenderer)return readyPromise;
  compatibilityRenderer=current;
  readyPromise=typeof current.gl.makeXRCompatible==="function"?current.gl.makeXRCompatible():Promise.resolve();
  return readyPromise;
 }
 async function probe(){
  if(!supported()){
   statusText("このブラウザはWebXR非対応です。通常の3D・RTS表示を利用できます（iPhone SafariではXR不可）。");
   for(const id of ["vr","rts","planet"])buttons[id].disabled=true;
   return;
  }
  try{
   const [vr,ar]=await Promise.all([
    navigator.xr.isSessionSupported("immersive-vr"),
    navigator.xr.isSessionSupported("immersive-ar")
   ]);
   buttons.vr.disabled=!vr;buttons.rts.disabled=!ar;buttons.planet.disabled=!ar;
   statusText(vr||ar?
    "対応機器を検出。VRまたはMRを選択してください。MRではヘッドセットのトリガーで配置・RTS選択できます。":
    "接続中の端末にVR/MRセッションがありません。通常モードはそのまま使用できます。");
   if(vr||ar)readyGL().catch(()=>{});
  }catch(error){
   statusText("XR機能の確認に失敗しました: "+(error?.message||error));
  }
 }
 function endCleanup(){
  const renderer=getRenderer();
  if(renderer){renderer.xrView=null;renderer.gl.bindFramebuffer(renderer.gl.FRAMEBUFFER,null);
   renderer.gl.disable(renderer.gl.SCISSOR_TEST);}
  hitSource?.cancel?.();hitSource=null;hitPose=null;viewerSpace=null;
  session=null;activeMode=null;space=null;anchor=null;lastTime=0;usingFloor=false;
  update();
  if(!disposed)statusText("通常の3D画面に戻りました。");
 }
 async function start(mode){
  if(disposed)return;
  if(session){
   if(activeMode===mode)return;
   if(activeMode.startsWith("mr-")&&mode.startsWith("mr-")){
    activeMode=mode;anchor=null;hitPose=null;update();
    statusText(mode==="mr-rts"?"MR卓上RTSに切り替えました":"MR惑星モデルに切り替えました");
   }else statusText("VRとMRを切り替えるには、いったん「XR終了」を押してください。");
   return;
  }
  if(!supported()){statusText("WebXRを利用できません");return;}
  const requestedType=mode==="vr"?"immersive-vr":"immersive-ar";
  let newSession=null;
  try{
   // requestSession must be invoked in the click gesture, before awaiting
   // permissions, feature checks, or any asynchronous GL setup.
   const root=requestedType==="immersive-ar"?$("xr-controls"):null;
   const init={requiredFeatures:["local"],optionalFeatures:["local-floor",...(requestedType==="immersive-ar"?["hit-test",...(root?["dom-overlay"]:[])]:[])]};
   if(root)init.domOverlay={root};
   newSession=await navigator.xr.requestSession(requestedType,init);
   if(disposed){await newSession.end();return;}
   await readyGL();
   const renderer=getRenderer(),gl=renderer.gl;
   const layer=new XRWebGLLayer(newSession,gl,{alpha:requestedType==="immersive-ar",
    antialias:true,depth:true,stencil:false});
   newSession.updateRenderState({baseLayer:layer});
   try{space=await newSession.requestReferenceSpace("local-floor");usingFloor=true;}
   catch(_){space=await newSession.requestReferenceSpace("local");usingFloor=false;}
   try{
    viewerSpace=await newSession.requestReferenceSpace("viewer");
    if(requestedType==="immersive-ar"&&newSession.requestHitTestSource)
     hitSource=await newSession.requestHitTestSource({space:viewerSpace});
   }catch(_){hitSource=null;}
   session=newSession;activeMode=mode;anchor=null;lastTime=0;
   session.addEventListener("end",endCleanup,{once:true});
   session.addEventListener("select",onSelect);
   session.addEventListener("squeeze",onSqueeze);
   update();
   statusText(mode==="vr"?"VR表示中。ヘッドセットの終了操作で元に戻れます。":
    "MR表示中。トリガーで実空間の配置を更新し、卓上RTSでは味方を選択できます。");
   newSession.requestAnimationFrame(drawXR);
  }catch(error){
   if(newSession&&newSession!==session)try{await newSession.end();}catch(_){}
   endCleanup();
   const reason=error?.name==="NotAllowedError"?"XR利用が許可されませんでした":
    (error?.message||String(error));
   statusText("XR開始に失敗しました: "+reason);
   notify("🥽 "+reason);
  }
 }
 function onSelect(event){
  if(!session||!anchor||!space||!event.frame)return;
  const source=event.inputSource;
  if(!source?.targetRaySpace)return;
  const ray=event.frame.getPose(source.targetRaySpace,space);
  if(!ray)return;
  if(activeMode==="mr-rts"){
   const controller=getController();
   const point=xrTableHit(ray.transform.matrix,anchor,controller.yaw,controller,
    Number(scaleInput.value));
   if(point){
    const success=onRTSSelect(point.x,point.z);
    if(success){statusText("🎯 MR卓上の味方を選択しました");return;}
   }
  }
  // A controller select on a spatial surface repositions the hologram.
  if(activeMode?.startsWith("mr-")){
   if(hitPose)anchor=xrPlacementFromHit(hitPose,ray.transform.matrix,usingFloor);
   else anchor=null; // reset in front of the headset on next frame
   statusText(hitPose?"MRモデルを実空間の面に再配置しました":
    "MRモデルを正面に置き直しました（平面検出なし）");
  }
 }
 function onSqueeze(event){
  if(!session||activeMode!=="mr-rts"||!anchor||!space||!event.frame)return;
  const raySpace=event.inputSource?.targetRaySpace;
  const pose=raySpace&&event.frame.getPose(raySpace,space);
  if(!pose)return;
  const point=xrTableHit(pose.transform.matrix,anchor,getController().yaw,getController(),Number(scaleInput.value));
  if(point&&onRTSMove(point.x,point.z))statusText("📍 選択した味方にMR卓上の移動指示を出しました");
 }
 function inputVector(){
  if(!session||activeMode!=="vr")return null;
  const out={forward:0,strafe:0,turn:0};
  const deadzone=v=>Math.abs(v)<.18?0:Math.max(-1,Math.min(1,v));
  for(const src of session.inputSources||[]){
   const a=src.gamepad?.axes;
   if(!a?.length)continue;
   const x=deadzone(a.length>=4?a[2]:a[0]),y=deadzone(a.length>=4?a[3]:a[1]);
   if(src.handedness==="left"){out.forward=-y;out.strafe=x;}
   if(src.handedness==="right")out.turn=x;
  }
  return out;
 }
 function drawXR(time,frame){
  if(!session)return;
  session.requestAnimationFrame(drawXR);
  const renderer=getRenderer(),controller=getController();
  if(!renderer||!controller||!space)return;
  const pose=frame.getViewerPose(space);
  if(!pose)return;
  if(!anchor)anchor=xrAnchor(pose.transform.matrix,{floor:usingFloor});
  if(hitSource&&frame.getHitTestResults){
   const hits=frame.getHitTestResults(hitSource);
   const hit=hits?.[0]?.getPose(space);hitPose=hit?.transform.matrix||null;
  }
  const gl=renderer.gl,layer=session.renderState.baseLayer;
  if(!layer)return;
  const mode=activeMode;
  const planetMode=mode==="mr-planet"||(mode==="vr"&&controller.altitudeM>50000);
  const mrRts=mode==="mr-rts";
  const frameState=mrRts?Object.assign(Object.create(Object.getPrototypeOf(controller)),controller,{altitudeM:2.5}):
   mode==="mr-planet"?Object.assign(Object.create(Object.getPrototypeOf(controller)),controller,{altitudeM:15000000}):controller;
  let stageAnchor=anchor;
  if(mode==="vr"&&planetMode){
   // Preserve the original room-space planet anchor when the user turns
   // their head. A hologram must NOT chase the viewer every XR frame.
   stageAnchor={...anchor,position:[
    anchor.vrFloor[0]+(anchor.position[0]-anchor.vrFloor[0])*2.4,
    anchor.vrFloor[1]+1.65,
    anchor.vrFloor[2]+(anchor.position[2]-anchor.vrFloor[2])*2.4
   ]};
  }
  const stage=xrStage({
   mode:planetMode?"mr-planet":mode,anchor:stageAnchor,
   actorYaw:controller.yaw,planetRadius:renderer.R,
   rtsScale:Number(scaleInput.value),
   planetScale:mode==="vr"?1.15:.24
  });
  const dt=lastTime?Math.max(0,Math.min(.07,(time-lastTime)/1000)):1/60;lastTime=time;
  let cursor=null;
  if(mode==="mr-rts"){
   for(const source of session.inputSources||[]){
    const ray=source.targetRaySpace&&frame.getPose(source.targetRaySpace,space);
    if(!ray)continue;
    cursor=xrTableHit(ray.transform.matrix,anchor,controller.yaw,controller,Number(scaleInput.value));
    if(cursor)break;
   }
  }
  try{
   gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);
   gl.enable(gl.SCISSOR_TEST);
   for(let index=0;index<pose.views.length;index++){
    const view=pose.views[index],vp=layer.getViewport(view);
    if(!vp)continue;
    renderer.xrView={mode,projection:view.projectionMatrix,view:view.transform.inverse.matrix,
     stage,planetMode,viewport:vp,eye:index,cursor};
    renderer.frame(frameState,index===0?dt:0);
   }
  }catch(error){
   statusText("XR描画エラー: "+(error?.message||error));
   notify("XR描画エラー: "+(error?.message||error));
   session.end().catch(()=>{});
  }finally{
   renderer.xrView=null;
   gl.disable(gl.SCISSOR_TEST);
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
 }
 for(const [id,button] of [["vr",buttons.vr],["rts",buttons.rts],["planet",buttons.planet]]){
  button.addEventListener("click",()=>start(id==="vr"?"vr":id==="rts"?"mr-rts":"mr-planet"));
 }
 buttons.exit.addEventListener("click",()=>session?.end().catch(error=>statusText(String(error))));
 update();probe();
 return {get active(){return present();},get mode(){return activeMode;},inputVector,
  close:()=>session?.end(),dispose:()=>{
   disposed=true;
   if(session)session.end().catch(()=>{});
   else endCleanup();
  }};
}
