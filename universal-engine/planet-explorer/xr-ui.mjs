import {xrAnchor,xrStage,xrTableHit,xrPlacementFromHit,xrPlanetHit} from "./xr-spatial.mjs?v=0.9k-xr";
import {sampleXRDepth,depthFeatureOptions} from "./xr-depth.mjs?v=0.9j-xr";

/**
 * Opt-in WebXR runtime for the existing WebGL2 renderer.
 * No save-schema changes. XR is presentation-only unless the user selects a
 * unit on the miniature RTS surface with a controller trigger.
 */
export function installXRUI({getRenderer,getController,onRTSSelect=()=>{},onRTSMove=()=>{},
 onRTSAll=()=>{},onPlanetPick=()=>false,onPlanetLand=()=>false,notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const buttons={vr:$("xr-vr"),rts:$("xr-mr-rts"),planet:$("xr-mr-planet"),exit:$("xr-exit")};
 const status=$("xr-status"),scaleInput=$("xr-scale"),depthToggle=$("xr-occlusion");
 const placeButton=$("xr-place"),landButton=$("xr-planet-land");
 const allButton=$("xr-rts-all"),rotateLeft=$("xr-rotate-left"),rotateRight=$("xr-rotate-right");
 const vrDiag=$("xr-vr-diagnostics");
 let session=null,activeMode=null,space=null,anchor=null,lastTime=0,viewerSpace=null,hitSource=null,hitPose=null;
 let usingFloor=false,disposed=false,readyPromise=Promise.resolve();
 let compatibilityRenderer=null,depthTexture=null;
 let placementArmed=false,planetSelected=false,planetYaw=0,vrFrames=0,vrHasPose=false,vrDrawError="";
 let previousPlanetHit=null,previousPlanetHitTime=0;
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
  if(placeButton)placeButton.hidden=!activeMode?.startsWith("mr-");
  if(landButton)landButton.hidden=activeMode!=="mr-planet";
  if(allButton)allButton.hidden=activeMode!=="mr-rts";
  if(rotateLeft)rotateLeft.hidden=activeMode!=="mr-planet";
  if(rotateRight)rotateRight.hidden=activeMode!=="mr-planet";
  if(placeButton)placeButton.setAttribute("aria-pressed",String(placementArmed));
  if(landButton)landButton.disabled=!planetSelected;
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
  if(depthTexture){renderer?.gl.deleteTexture(depthTexture);depthTexture=null;}
  if(vrDiag&&vrFrames)vrDiag.textContent="VR診断："+vrFrames+"フレーム／追跡"+
   (vrHasPose?"取得済み":"未取得")+(vrDrawError?"／"+vrDrawError:"");
  session=null;activeMode=null;space=null;anchor=null;lastTime=0;usingFloor=false;
  placementArmed=false;planetSelected=false;vrFrames=0;vrHasPose=false;vrDrawError="";
  previousPlanetHit=null;previousPlanetHitTime=0;
  update();
  if(!disposed)statusText("通常の3D画面に戻りました。");
 }
 async function start(mode){
  if(disposed)return;
  if(session){
   if(activeMode===mode)return;
   if(activeMode.startsWith("mr-")&&mode.startsWith("mr-")){
    activeMode=mode;anchor=null;hitPose=null;placementArmed=false;planetSelected=false;
    previousPlanetHit=null;previousPlanetHitTime=0;update();
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
   const depthOptions=depthFeatureOptions(requestedType);
   if(depthOptions.optionalFeature){
    init.optionalFeatures.push(depthOptions.optionalFeature);
    init.depthSensing=depthOptions.depthSensing;
   }
   newSession=await navigator.xr.requestSession(requestedType,init);
   if(disposed){await newSession.end();return;}
   await readyGL();
   const renderer=getRenderer(),gl=renderer.gl;
   const layer=new XRWebGLLayer(newSession,gl,{alpha:requestedType==="immersive-ar",
    antialias:true,depth:true,stencil:false});
   newSession.updateRenderState({baseLayer:layer});
   if(requestedType==="immersive-ar"&&newSession.depthUsage==="cpu-optimized"){
    depthTexture=gl.createTexture();
    gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,depthTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
   }
   try{space=await newSession.requestReferenceSpace("local-floor");usingFloor=true;}
   catch(_){space=await newSession.requestReferenceSpace("local");usingFloor=false;}
   try{
    viewerSpace=await newSession.requestReferenceSpace("viewer");
    if(requestedType==="immersive-ar"&&newSession.requestHitTestSource)
     hitSource=await newSession.requestHitTestSource({space:viewerSpace});
   }catch(_){hitSource=null;}
   session=newSession;activeMode=mode;anchor=null;lastTime=0;
   placementArmed=false;planetSelected=false;vrFrames=0;vrHasPose=false;vrDrawError="";
   previousPlanetHit=null;previousPlanetHitTime=0;
   if(vrDiag&&mode==="vr")vrDiag.textContent="VR診断：セッション開始、映像フレーム待機中";
   session.addEventListener("end",endCleanup,{once:true});
   session.addEventListener("select",onSelect);
   session.addEventListener("squeeze",onSqueeze);
   update();
   statusText(mode==="vr"?"VR表示中。ヘッドセットの終了操作で元に戻れます。":
    "MR表示中。"+(depthTexture?"実物の深度遮蔽に対応。":"深度遮蔽はこの端末では利用できません。")+
    " トリガーで配置や味方選択、グリップで移動指示。");
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
 function placeModel(rayMatrix){
  if(hitPose&&rayMatrix)anchor=xrPlacementFromHit(hitPose,rayMatrix,usingFloor);
  else anchor=null;
  placementArmed=false;update();
  statusText(hitPose?"📍 MR模型の位置を更新しました":"📍 MR模型を正面に再配置しました");
 }
 function pickPlanet(rayMatrix){
  const hit=xrPlanetHit(rayMatrix,anchor,{yawOffset:planetYaw,radius:.24});
  if(!hit){statusText("🌐 惑星に照準を合わせてトリガーを押してください");return false;}
  planetSelected=Boolean(onPlanetPick(hit.lat,hit.lon));
  update();
  statusText(planetSelected?
   "🌐 "+hit.lat.toFixed(2)+"°, "+hit.lon.toFixed(2)+"° を選択。同じ場所をもう一度トリガー／グリップ／「↓降下」で実行":
   "🌐 この地点には降下できません");
  return planetSelected;
 }
 function confirmPlanetLanding(){
  if(!planetSelected){statusText("🌐 先に惑星表面をトリガーで選択してください");return;}
  if(onPlanetLand()){
   planetSelected=false;update();statusText("↓ 選択した地点への降下を開始しました");
   // On landing, leave the AR miniature and return to the native game camera.
   session?.end().catch(()=>{});
  }else statusText("↓ 降下できません。地形・手配状態・乗り物を確認してください");
 }
 function onSelect(event){
  if(!session||!anchor||!space||!event.frame)return;
  const source=event.inputSource;
  if(!source?.targetRaySpace)return;
  const ray=event.frame.getPose(source.targetRaySpace,space);
  if(!ray)return;
  if(placementArmed&&activeMode?.startsWith("mr-")){placeModel(ray.transform.matrix);return;}
  if(activeMode==="mr-planet"){
   const hit=xrPlanetHit(ray.transform.matrix,anchor,{yawOffset:planetYaw,radius:.24});
   if(!hit){statusText("🌐 惑星模型の表面に照準を合わせてください");return;}
   const now=performance.now();
   const repeated=planetSelected&&previousPlanetHit&&now-previousPlanetHitTime<1300&&
    Math.abs(hit.lat-previousPlanetHit.lat)<5&&
    Math.abs(((hit.lon-previousPlanetHit.lon+540)%360)-180)<5;
   if(repeated){previousPlanetHit=null;previousPlanetHitTime=0;confirmPlanetLanding();return;}
   const selected=pickPlanet(ray.transform.matrix);
   previousPlanetHit=selected?hit:null;previousPlanetHitTime=selected?now:0;
   return;
  }
  if(activeMode==="mr-rts"){
   const controller=getController();
   const point=xrTableHit(ray.transform.matrix,anchor,controller.yaw,controller,Number(scaleInput.value));
   if(!point){statusText("🎯 卓上の地面を狙ってトリガーを押してください");return;}
   if(onRTSSelect(point.x,point.z,Number(scaleInput.value))){
    statusText("🎯 MRで味方を選択。地面をトリガーで指定すると移動します");return;
   }
   if(onRTSMove(point.x,point.z)){statusText("📍 選択中の味方をMRの指定地点へ移動します");return;}
   statusText("📍 指示を出せません。先に味方を選択し、地面を指定してください");
  }
 }
 function onSqueeze(event){
  if(!session||!anchor||!space||!event.frame)return;
  const raySpace=event.inputSource?.targetRaySpace;
  const pose=raySpace&&event.frame.getPose(raySpace,space);
  if(!pose)return;
  if(activeMode==="mr-planet"){confirmPlanetLanding();return;}
  if(activeMode==="mr-rts"){
   const point=xrTableHit(pose.transform.matrix,anchor,getController().yaw,getController(),Number(scaleInput.value));
   if(point&&onRTSMove(point.x,point.z))statusText("📍 MRで選択した味方へ移動を指示しました");
  }
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
  if(activeMode==="vr")vrFrames++;
  if(!pose){
   // Present a visible neutral blue frame when VR tracking has not supplied
   // eyes yet; an all-black compositor image would hide this distinction.
   if(activeMode==="vr"&&session.renderState.baseLayer){
    const gl=renderer.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER,session.renderState.baseLayer.framebuffer);
    gl.disable(gl.SCISSOR_TEST);gl.colorMask(true,true,true,true);
    gl.clearColor(.08,.23,.40,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
   }
   if(activeMode==="vr"&&vrFrames===90){
    vrDrawError="追跡姿勢が取得できません";
    if(vrDiag)vrDiag.textContent="VR診断："+vrDrawError;
    notify("🥽 VR：トラッキング姿勢が90フレーム取得できません");
   }
   return;
  }
  if(activeMode==="vr")vrHasPose=true;
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
  const indoorYaw=mode==="vr"?(renderer.trainInterior?.pose?.yaw??
   renderer.townInterior?.pose?.yaw??
   (renderer.ferry?.boarded?renderer.ferry.pose?.yaw:undefined)??controller.yaw):controller.yaw;
  const stage=xrStage({
   mode:planetMode?"mr-planet":mode,anchor:stageAnchor,
   actorYaw:indoorYaw,planetRadius:renderer.R,
   rtsScale:Number(scaleInput.value),yawOffset:planetYaw,
   planetScale:mode==="vr"?1.15:.24
  });
  const dt=lastTime?Math.max(0,Math.min(.07,(time-lastTime)/1000)):1/60;lastTime=time;
  if(mode==="mr-planet"){
   for(const input of session.inputSources||[]){
    const axes=input.gamepad?.axes;
    if(!axes?.length)continue;
    const x=axes.length>=4?axes[2]:axes[0];
    if(Math.abs(x||0)>.22){planetYaw+=x*dt*1.2;break;}
   }
  }
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
   // A previous 2D pass can have disabled color/depth writes or changed
   // blend state. Restore XR framebuffer invariants every immersive frame.
   gl.colorMask(true,true,true,true);
   gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
   gl.disable(gl.BLEND);
   gl.enable(gl.SCISSOR_TEST);
   for(let index=0;index<pose.views.length;index++){
    const view=pose.views[index],vp=layer.getViewport(view);
    if(!vp)continue;
    let occlusionTexture=null;
    if(mode.startsWith("mr-")&&depthToggle?.checked&&depthTexture&&session.depthUsage==="cpu-optimized"){
     try{
      const depth=frame.getDepthInformation?.(view);
      const grid=sampleXRDepth(depth);
      if(grid?.available){
       gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,depthTexture);
       gl.texImage2D(gl.TEXTURE_2D,0,gl.R32F,grid.width,grid.height,0,gl.RED,gl.FLOAT,grid.pixels);
       gl.activeTexture(gl.TEXTURE0);
       occlusionTexture=depthTexture;
      }
     }catch(_){gl.activeTexture(gl.TEXTURE0);}
    }
    renderer.xrView={mode,projection:view.projectionMatrix,view:view.transform.inverse.matrix,
     stage,planetMode,viewport:vp,eye:index,cursor,depthTexture:occlusionTexture};
    renderer.frame(frameState,index===0?dt:0);
    if(mode==="vr"&&vrFrames<240)renderer.drawVRGuide(renderer.xrView,anchor);
   }
   if(mode==="vr"&&(vrFrames===90||vrFrames===300)){
    const err=gl.getError();
    const diag="VR診断：追跡あり／"+pose.views.length+"眼／"+
     (err===gl.NO_ERROR?"GL正常":"WebGLエラー 0x"+err.toString(16))+
     "／"+vrFrames+"フレーム";
    if(vrDiag)vrDiag.textContent=diag;
    if(err!==gl.NO_ERROR)notify("🥽 "+diag);
   }
  }catch(error){
   vrDrawError=error?.message||String(error);
   if(vrDiag)vrDiag.textContent="VR診断："+vrDrawError;
   statusText("XR描画エラー: "+vrDrawError);
   notify("XR描画エラー: "+vrDrawError);
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
 placeButton?.addEventListener("click",()=>{
  placementArmed=!placementArmed;update();
  statusText(placementArmed?"📍 次のトリガーで模型を配置します":"配置モードを終了しました");
 });
 rotateLeft?.addEventListener("click",()=>{planetYaw-=Math.PI/8;statusText("🌐 惑星を左に回転");});
 rotateRight?.addEventListener("click",()=>{planetYaw+=Math.PI/8;statusText("🌐 惑星を右に回転");});
 landButton?.addEventListener("click",confirmPlanetLanding);
 allButton?.addEventListener("click",()=>{onRTSAll();statusText("🎯 MR：味方全員を選択しました");});
 buttons.exit.addEventListener("click",()=>session?.end().catch(error=>statusText(String(error))));
 update();probe();
 return {get active(){return present();},get mode(){return activeMode;},inputVector,
  close:()=>session?.end(),dispose:()=>{
   disposed=true;
   if(session)session.end().catch(()=>{});
   else endCleanup();
  }};
}
