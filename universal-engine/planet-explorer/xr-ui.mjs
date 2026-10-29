import {xrAnchor,xrStage,xrTableHit,xrPlacementFromHit,xrPlanetHit,xrPointerYaw} from "./xr-spatial.mjs?v=0.9r-vr-controls";
import {xrButtonEdges,xrVRMovement,xrControllerSources,xrVRActorYaw} from "./xr-quest-controls.mjs?v=0.9z-quest-strafe-heading-fix";
import {sampleXRDepth,depthFeatureOptions} from "./xr-depth.mjs?v=0.9j-xr";
import {XR_VR_LAYER_CONFIGS,probeXRFramebuffer,xrNextLayerIndex} from "./xr-framebuffer.mjs?v=0.9n-fb";
import {canUseXRProjection,createXRProjection,projectionReady,bindXRProjectionView,destroyXRProjection} from "./xr-projection.mjs?v=0.9p-quest-projection";
import {xrLayersEnabled,installLegacyXRLayer,activeLegacyXRLayer} from "./xr-layer-policy.mjs?v=0.9q-render-state";
import {VRPhysicalControls} from "./xr-physical-controls.mjs?v=0.9z-pockets";
import {vrNearestPickup,vrHandAtBag} from "./xr-backpack.mjs?v=0.9t-bag";
import {WearableInventory,starterWearables,pocketSocketForOutfit} from "./wearable-inventory.mjs?v=3";

/**
 * Opt-in WebXR runtime for the existing WebGL2 renderer.
 * No save-schema changes. XR is presentation-only unless the user selects a
 * unit on the miniature RTS surface with a controller trigger.
 */
export function installXRUI({getRenderer,getController,onRTSSelect=()=>{},onRTSMove=()=>{},
 onRTSAll=()=>{},onPlanetPick=()=>false,onPlanetLand=()=>false,onVRGroundStart=()=>false,
 onVRHand=()=>{},onVRCommand=()=>{},onVRToggleRTS=()=>false,
 onVRJump=()=>{},onVRDeck=()=>{},onVRSync=()=>{},onVRAim=()=>{},
 onVRGrab=()=>false,getVRPickups=()=>[],onVRStow=()=>({ok:false}),
 onVRHasBag=()=>true,getVRAppearance=()=>null,getVRArrowCount=()=>0,onVRFrame=()=>{},onVRCustody=()=>({handled:false}),getVRCustodyPose=()=>null,notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const buttons={vr:$("xr-vr"),adventure:$("xr-adventure"),rts:$("xr-mr-rts"),planet:$("xr-mr-planet"),exit:$("xr-exit")};
 const status=$("xr-status"),scaleInput=$("xr-scale"),depthToggle=$("xr-occlusion");
 const placeButton=$("xr-place"),landButton=$("xr-planet-land");
 const allButton=$("xr-rts-all"),rotateLeft=$("xr-rotate-left"),rotateRight=$("xr-rotate-right");
 const vrDiag=$("xr-vr-diagnostics");
 let session=null,activeMode=null,space=null,anchor=null,lastTime=0,viewerSpace=null,hitSource=null,hitPose=null;
 let usingFloor=false,disposed=false,readyPromise=Promise.resolve();
 let compatibilityRenderer=null,depthTexture=null;
 let placementArmed=false,planetSelected=false,planetYaw=0,vrFrames=0,vrHasPose=false,vrDrawError="";
 let previousPlanetHit=null,previousPlanetHitTime=0;
 let vrLayerIndex=0,vrPendingLayer=null,vrPendingFrames=0,vrFramebufferInfo="未検査";
 let vrRecoveryExhausted=false,vrLastErrorStep="";
 let projection=null,projectionAttempted=false;
 let vrRTS=false,vrThird=false,vrPlanetOverview=false,vrPlanetAnchor=null,vrTableYaw=0,vrButtons=new Set(),vrCurrentStage=null;
 let vrMovement={forward:0,strafe:0,turn:0,tableTurn:0},vrInputSampleAt=0;
 let vrInputInfo="未取得",vrLastConnectedLeft="未取得";
 let vrMoveInfo="未計測",vrLastWalk="未試行",vrNoMotionFrames=0,vrWarned=false,vrCustodyTipShown=false;
 let vrPhysical=new VRPhysicalControls(),vrGripConsumed=new Set(),vrCustodyTriggerConsumed=new Set();
 const VR_WEARABLE_SAVE="universal-engine:explorer:vr-wearables:v1";
 let vrWearables=(()=>{
  try{
   const saved=localStorage.getItem(VR_WEARABLE_SAVE);
   return saved?WearableInventory.fromSnapshot(JSON.parse(saved)):starterWearables({combatDemo:false});
  }catch(_){return starterWearables({combatDemo:false});}
 })();
 const saveWearables=()=>{
  try{localStorage.setItem(VR_WEARABLE_SAVE,JSON.stringify(vrWearables.snapshot()));}
  catch(_){/* VR continues in memory when storage is unavailable. */}
 };
 let bagWarningShown=false;
 const syncVRClothing=()=>{
  const outfit=getVRAppearance();
  const bag=outfit?.bag||(onVRHasBag()?"satchel":"none");
  vrWearables.setSocket("trouser-pocket",pocketSocketForOutfit(outfit?.presetId));
  const container=vrWearables.containers.get("travel-backpack");
  if(!container)return;
  const next=bag==="toolbag"?"toolbag":bag==="satchel"?"satchel":"backpack";
  if(container.preset!==next&&!vrWearables.setPreset(container.id,next)&&!bagWarningShown){
   bagWarningShown=true;statusText("🎒 鞄の容量を超えるため、収納物を減らしてください");
  }
  vrWearables.setAccess(container.id,{active:bag!=="none"});
  return bag;
 };
 let vrStage="未開始",vrSceneFrames=0,vrTimerIds=[],vrSessionVisibility="不明";
 let vrLastCallbackAt=0;
 let vrLastSnapshot="";
 // A watchdog can run even when WebXR never delivers a rendering callback.
 // No XR framebuffer/WebGL operations are performed by these timers.
 function vrSnapshot(stage=vrStage){
  const tail=vrLastErrorStep?"／"+vrLastErrorStep:"";
  return "🥽 VR診断："+stage+"／XRコールバック="+vrFrames+
   "／描画完了="+vrSceneFrames+"／追跡="+(vrHasPose?"あり":"未確認")+
   "／可視状態="+vrSessionVisibility+"／入力="+vrInputInfo+
   "／歩行="+vrMoveInfo+"／最終試行="+vrLastWalk+"／"+vrFramebufferInfo+tail+
   (vrDrawError?"／"+vrDrawError:"");
 }
 function vrMark(stage,{force=false,log=false}={}){
  if(activeMode!=="vr")return;
  const changed=stage!==vrStage;
  vrStage=stage;
  const shouldRender=force||vrFrames<2||vrFrames===30||vrFrames===90||
   vrFrames===300||((vrFrames%180)===0)||changed&&/未受信|未完了|例外|エラー|切替待ち|不完全/.test(stage);
  if(!shouldRender)return;
  const msg=vrSnapshot(stage);
  if(vrDiag)vrDiag.textContent=msg;
  vrLastSnapshot=msg;
  if(log)notify(msg);
 }
 function clearVRWatchdogs(){
  for(const t of vrTimerIds)clearTimeout(t);
  vrTimerIds=[];
 }
 const present=()=>Boolean(session);
 const supported=()=>Boolean(navigator.xr&&globalThis.XRWebGLLayer&&globalThis.isSecureContext);
 const statusText=(message)=>{status.textContent=message;};
 function update(){
  for(const [name,button] of Object.entries(buttons)){
   if(!button)continue;
   if(name==="exit"){button.hidden=!session;continue;}
   const selected=activeMode===(name==="vr"||name==="adventure"?"vr":name==="rts"?"mr-rts":"mr-planet");
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
   for(const id of ["vr","adventure","rts","planet"])buttons[id].disabled=true;
   return;
  }
  try{
   const [vr,ar]=await Promise.all([
    navigator.xr.isSessionSupported("immersive-vr"),
    navigator.xr.isSessionSupported("immersive-ar")
   ]);
   buttons.vr.disabled=!vr;buttons.adventure.disabled=!vr;buttons.rts.disabled=!ar;buttons.planet.disabled=!ar;
   statusText(vr||ar?
    "対応機器を検出。VRまたはMRを選択してください。MRではヘッドセットのトリガーで配置・RTS選択できます。":
    "接続中の端末にVR/MRセッションがありません。通常モードはそのまま使用できます。");
   if(vr||ar)readyGL().catch(()=>{});
  }catch(error){
   statusText("XR機能の確認に失敗しました: "+(error?.message||error));
  }
 }
 function endCleanup(){
  onVRCustody("climb-reset");
  vrCustodyTriggerConsumed.clear();
  const renderer=getRenderer();
  if(renderer){renderer.xrView=null;renderer.gl.bindFramebuffer(renderer.gl.FRAMEBUFFER,null);
   renderer.gl.disable(renderer.gl.SCISSOR_TEST);}
  hitSource?.cancel?.();hitSource=null;hitPose=null;viewerSpace=null;
  if(projection){if(renderer)destroyXRProjection(renderer.gl,projection);projection=null;}
  projectionAttempted=false;
  if(activeMode==="vr"&&vrRTS)onVRToggleRTS(false);
  vrRTS=false;vrThird=false;vrTableYaw=0;
  vrPlanetOverview=false;vrPlanetAnchor=null;vrButtons.clear();vrCurrentStage=null;
  vrMovement={forward:0,strafe:0,turn:0,tableTurn:0};vrInputSampleAt=0;
   vrPhysical=new VRPhysicalControls();vrGripConsumed.clear();vrCustodyTriggerConsumed.clear();
  if(depthTexture){renderer?.gl.deleteTexture(depthTexture);depthTexture=null;}
  clearVRWatchdogs();
  if(activeMode==="vr"){
   const ending=vrSceneFrames?"終了・VR映像描画済み":
    vrFrames?"終了・XRフレーム受信／映像未描画":"終了・XRフレーム未受信";
   vrMark(ending,{force:true,log:!disposed});
  }
  // Preserve the final stick/blocked diagnostic for inspection after exiting VR.
  vrInputInfo="未取得";vrLastConnectedLeft="未取得";vrMoveInfo="未計測";vrLastWalk="未試行";vrNoMotionFrames=0;vrWarned=false;vrCustodyTipShown=false;
  session=null;activeMode=null;space=null;anchor=null;lastTime=0;usingFloor=false;
  placementArmed=false;planetSelected=false;planetYaw=0;vrFrames=0;vrHasPose=false;vrDrawError="";
  previousPlanetHit=null;previousPlanetHitTime=0;
  vrLayerIndex=0;vrPendingLayer=null;vrPendingFrames=0;
  vrRecoveryExhausted=false;vrLastErrorStep="";
  vrStage="未開始";vrSceneFrames=0;vrLastCallbackAt=0;
  update();
  if(!disposed)statusText("通常の3D画面に戻りました。");
 }
 async function start(mode){return startWithOptions(mode,{ground:false});}
 async function startWithOptions(mode,{ground=false}={}){
  if(disposed)return;
  if(session){
   if(activeMode===mode)return;
   if(activeMode.startsWith("mr-")&&mode.startsWith("mr-")){
    activeMode=mode;anchor=null;hitPose=null;placementArmed=false;planetSelected=false;planetYaw=0;
    previousPlanetHit=null;previousPlanetHitTime=0;update();
    statusText(mode==="mr-rts"?"MR卓上RTSに切り替えました":"MR惑星モデルに切り替えました");
   }else statusText("VRとMRを切り替えるには、いったん「XR終了」を押してください。");
   return;
  }
  if(!supported()){statusText("WebXRを利用できません");return;}
  if(ground){
   const result=onVRGroundStart();
   if(result===false || result?.ok===false){statusText(result?.message||"地表へ移動できません");return;}
   if(result?.message)statusText(result.message);
  }
  const requestedType=mode==="vr"?"immersive-vr":"immersive-ar";
  let newSession=null;
  try{
   // requestSession must be invoked in the click gesture, before awaiting
   // permissions, feature checks, or any asynchronous GL setup.
   const root=requestedType==="immersive-ar"?$("xr-controls"):null;
   const wantsLayers=requestedType==="immersive-vr"&&canUseXRProjection();
   const init={requiredFeatures:["local"],optionalFeatures:["local-floor",...(requestedType==="immersive-ar"?["hit-test",...(root?["dom-overlay"]:[])]:wantsLayers?["layers"]:[])]};
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
   // Quest Browser rejects baseLayer when the optional "layers" feature is
   // granted. Select the compositor path before the first XR frame.
   projection=null;projectionAttempted=false;
   vrRTS=false;vrThird=false;vrTableYaw=0;
  vrPlanetOverview=false;vrPlanetAnchor=null;vrButtons.clear();vrCurrentStage=null;
  vrMovement={forward:0,strafe:0,turn:0,tableTurn:0};vrInputSampleAt=0;
  vrInputInfo="未取得";vrLastConnectedLeft="未取得";vrMoveInfo="未計測";vrLastWalk="未試行";vrNoMotionFrames=0;vrWarned=false;vrCustodyTipShown=false;
   vrPhysical=new VRPhysicalControls();vrGripConsumed.clear();vrCustodyTriggerConsumed.clear();
   let projectionStartError="";
   if(requestedType==="immersive-vr"&&canUseXRProjection()){
    projectionAttempted=true;
    try{projection=createXRProjection(newSession,gl);}
    catch(error){projectionStartError=error?.message||String(error);}
   }
   let legacyPath="";
   if(!projection){
    const layer=new XRWebGLLayer(newSession,gl,requestedType==="immersive-vr"?
     XR_VR_LAYER_CONFIGS[0]:{alpha:true,antialias:true,depth:true,stencil:false});
    const granted=xrLayersEnabled(newSession);
    legacyPath=installLegacyXRLayer(newSession,layer,{
     preferLayers:requestedType==="immersive-vr"&&(granted??wantsLayers)
    });
   }
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
   placementArmed=false;planetSelected=false;planetYaw=0;vrFrames=0;vrHasPose=false;vrDrawError="";
   previousPlanetHit=null;previousPlanetHitTime=0;
   vrLayerIndex=0;vrPendingLayer=null;vrPendingFrames=0;
   vrFramebufferInfo=projection?"XRProjectionLayer起動時設定":
    "XRWebGLLayer "+legacyPath;
   vrRecoveryExhausted=false;vrLastErrorStep=projectionStartError?
    "XRProjectionLayer起動失敗: "+projectionStartError:"";
   vrSceneFrames=0;vrLastCallbackAt=0;vrStage="開始";vrSessionVisibility=newSession.visibilityState||"不明";
   clearVRWatchdogs();
   if(mode==="vr"){
    vrMark("セッション開始／XRコールバック待機",{force:true,log:true});
    notify("🥽 Quest VR身体操作：左肩で左グリップ→弓、右肩で右グリップ→矢、弦につがえて右トリガーを押し引き絞り→離して発射。左腰で右グリップ→抜刀、腕を振って攻撃。A=RTS、B=視点、スティック=歩行・旋回");
    if(getController()?.altitudeM>12.01)notify("🥽 VR歩行には地表への降下が必要です。惑星モードから地表に降下してください。");
   }
   session.addEventListener("end",endCleanup,{once:true});
   session.addEventListener("select",onSelect);
   session.addEventListener("selectstart",onVRSelectStart);
   session.addEventListener("selectend",onVRSelectEnd);
   session.addEventListener("squeezestart",onVRSqueezeStart);
   session.addEventListener("squeezeend",onVRSqueezeEnd);
   session.addEventListener("squeeze",onSqueeze);
   session.addEventListener("visibilitychange",()=>{
    if(session!==newSession||activeMode!=="vr")return;
    vrSessionVisibility=newSession.visibilityState||"不明";
    vrMark("可視状態変更",{force:true,log:true});
   });
   update();
   statusText(mode==="vr"?"VR表示中。ヘッドセットの終了操作で元に戻れます。":
    "MR表示中。"+(depthTexture?"実物の深度遮蔽に対応。":"深度遮蔽はこの端末では利用できません。")+
    " 惑星ではトリガーで地点選択・再押下で降下、RTSではトリガーで選択と移動。模型再配置は専用ボタン。");
   newSession.requestAnimationFrame(drawXR);
   if(mode==="vr")for(const delay of [4500,11000]){
    const watched=newSession;
    vrTimerIds.push(setTimeout(()=>{
     if(session!==watched||activeMode!=="vr")return;
     vrSessionVisibility=watched.visibilityState||"不明";
     if(!vrFrames)vrMark("XR描画コールバック未受信 "+delay+"ms",{force:true,log:true});
     else if(!vrSceneFrames)vrMark("XR映像描画未完了 "+delay+"ms",{force:true,log:true});
     else if(delay>=11000&&vrLastCallbackAt&&performance.now()-vrLastCallbackAt>4000)
      vrMark("XR描画コールバックが停止 "+delay+"ms",{force:true,log:true});
    },delay));
   }
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

 function sampleVRRig(frame,headOverride=null,time=performance.now()){
  if(activeMode!=="vr"||!frame||!space)return;
  const matrix=(source,kind)=>{
   const target=kind==="grip"?(source?.gripSpace||source?.targetRaySpace):source?.targetRaySpace;
   try{return target?frame.getPose(target,space)?.transform.matrix||null:null;}
   catch(_){return null;}
  };
  const controllerSources=xrControllerSources(session);
  const left=controllerSources.find(s=>s.handedness==="left");
  const right=controllerSources.find(s=>s.handedness==="right");
  let head=headOverride;
  if(!head)try{head=frame.getViewerPose(space)?.transform.matrix||null;}catch(_){}
  const last=vrPhysical.pose||{};
  const trackedLeft=matrix(left,"grip"),trackedRight=matrix(right,"grip");
  const gear={head:head||last.head,left:trackedLeft||last.left,
   right:trackedRight||last.right,
   leftRay:matrix(left,"ray")||last.leftRay,rightRay:matrix(right,"ray")||last.rightRay};
  const prevRigTime=vrPhysical.lastTime;
  const events=vrPhysical.setPose(gear,time,{floorY:usingFloor?0:null});
  syncVRClothing();
  if(activeMode==="vr"&&onVRCustody("state")?.handled){
   // Only fresh grip poses count. Last-known body poses are NOT climbing input.
   onVRCustody("climb-pull",{poses:{left:trackedLeft,right:trackedRight},
    stage:vrCurrentStage,dt:Number.isFinite(prevRigTime)?
     Math.max(0,Math.min(.15,(time-prevRigTime)/1000)):1/90});
   return;
  }
  if(vrRTS)return;
  const carried=vrPhysical.heldDrop;
  if(carried){
   const handMatrix=gear[carried.hand];
   const atBag=onVRHasBag()&&vrHandAtBag(handMatrix,vrPhysical.anchors);
   if(atBag&&!carried.stowAttempted){
    carried.stowAttempted=true;
    const result=onVRStow(carried.item);
    if(result?.ok){
     vrPhysical.heldDrop=null;
     statusText("🎒 "+(result.message||"拾ったアイテムを鞄に収納しました"));
    }else statusText("🎒 "+(result?.message||"鞄へ収納できません"));
   }
   if(!atBag)carried.stowAttempted=false;
  }
  for(const action of events){
   if(action==="swordSwing"){
    const yaw=gear.rightRay&&vrCurrentStage?xrPointerYaw(gear.rightRay,vrCurrentStage):null;
    if(yaw!==null)onVRAim(yaw,"right");
    if(onVRCommand("sweep")?.ok)statusText("⚔️ VR：剣の振り動作で攻撃");
   }else if(action==="nock")
    statusText("🏹 矢をつがえました。右トリガーで引いて、離すと射撃");
  }
 }
 function onVRSqueezeStart(event){
  if(activeMode!=="vr"||vrRTS||!event.frame)return;
  sampleVRRig(event.frame);
  const hand=event.inputSource?.handedness;
  if(!["left","right"].includes(hand))return;
  if(onVRCustody("state")?.handled){
   let liveGrip=null;
   try{const source=event.inputSource;
    const ref=source?.gripSpace||source?.targetRaySpace;
    liveGrip=ref&&space?event.frame.getPose(ref,space)?.transform.matrix||null:null;
   }catch(_){/* Never use a cached grip to initiate climbing. */}
   const result=onVRCustody("climb-grab",{hand,
    pose:liveGrip,stage:vrCurrentStage});
   vrGripConsumed.add(hand);
   statusText(result?.ok?"✊ 鉄格子をつかみました。手を下へ引いて登れます。":
    "🔒 鉄格子に手を近づけてグリップを握ってください。");
   return;
  }
  if(vrPhysical.heldDrop?.hand===hand){vrGripConsumed.add(hand);return;}
  const result=vrWearables.hands[hand]?{kind:"none"}:
   vrPhysical.grab(hand,(item,grip)=>onVRGrab(item,grip)===true);
  if(result.kind==="none"){
   if(vrPhysical.heldDrop)return;
   const hp=vrPhysical.pose?.[hand],anchors=vrPhysical.anchors;
   const point=hp&&hp.length>=16?{x:hp[12],y:hp[13],z:hp[14]}:null;
   const reachable=(containerId,anchor)=>{
    const socket=anchors?.[anchor];
    return point&&socket&&vrWearables.isInReach(containerId,point,
     {x:socket[0],y:socket[1],z:socket[2]});
   };
   // Pockets exist on the garment; the bag uses the chest/shoulder strap.
   const handBusy=hand==="right"?(vrPhysical.swordHeld||vrPhysical.arrowHeld||vrPhysical.toolHeld.right):
    (vrPhysical.bowHeld||vrPhysical.toolHeld.left);
   const pocketSocket=vrWearables.containers.get("trouser-pocket")?.socket||"rightPocket";
   if(!handBusy&&reachable("trouser-pocket",pocketSocket)){
    const held=vrWearables.hands[hand];
    if(held&&vrWearables.returnToContainer(hand,"trouser-pocket")){
     saveWearables();vrGripConsumed.add(hand);
     statusText("👖 ポケットに手帳を戻しました");return;
    }
    if(!held){
     const item=vrWearables.grab(hand,"trouser-pocket");
     if(item){saveWearables();vrGripConsumed.add(hand);
      statusText("📓 ポケットから手帳を取り出しました");return;}
    }
   }
   if(!handBusy&&onVRHasBag()&&reachable("travel-backpack","chest")){
    const bag=vrWearables.containers.get("travel-backpack");
    if(bag?.active!==false){
     const held=vrWearables.hands[hand];
     if(!bag.open){
      vrWearables.setAccess(bag.id,{open:true,accessible:true});
      saveWearables();vrGripConsumed.add(hand);
      statusText("🎒 カバンを開きました。もう一度グリップで収納・取り出し");return;
     }
     if(held&&vrWearables.returnToContainer(hand,bag.id)){
      saveWearables();vrGripConsumed.add(hand);
      statusText("🎒 カバンに手帳を収納しました");return;
     }
     if(!held){
      const item=vrWearables.grab(hand,bag.id);
      if(item){saveWearables();vrGripConsumed.add(hand);
       statusText("🎒 カバンから"+(item.id==="field-note"?"手帳":"アイテム")+"を取り出しました");return;}
      vrWearables.setAccess(bag.id,{open:false,accessible:false});
      saveWearables();vrGripConsumed.add(hand);
      statusText("🎒 カバンを閉じました");return;
     }
     statusText("🎒 カバンに空き容量がありません");vrGripConsumed.add(hand);return;
    }
   }
   if(handBusy||vrWearables.hands[hand]){vrGripConsumed.add(hand);return;}
   const candidate=vrNearestPickup(vrPhysical.pose?.[hand],vrCurrentStage,
    getController(),getVRPickups());
   if(!candidate)return;
   vrPhysical.heldDrop={hand,item:{...candidate.item},stowAttempted:false};
   vrGripConsumed.add(hand);
   statusText("✋ "+(candidate.item.label||candidate.item.kind)+"を手で拾いました。胸元の鞄ベルトへ運んで収納");
   return;
  }
  vrGripConsumed.add(hand);
  if(result.kind==="unavailable")statusText("🥽 "+result.item+"が装備・所持品にありません");
  else if(result.kind==="no-bow")statusText("🏹 先に左肩から弓を取ってください");
  else if(result.kind==="sheathe"){
   onVRGrab("sheathe",hand);statusText("⚔️ 剣を納刀しました");
  }else if(result.kind==="stowTool"){
   onVRGrab("none",hand);statusText("🔧 "+result.item+"をホルスターに戻しました");
  }else if(result.kind==="tool"){
   statusText("🔧 "+result.item+"を取り出しました。トリガーで使用できます");
  }else statusText("🥽 "+({bow:"左肩から弓",arrow:"右肩の矢筒から矢",sword:"左腰から剣"}[result.kind]||result.kind)+"を取り出しました");
 }
 function onVRSqueezeEnd(event){
  if(activeMode!=="vr")return;
  const hand=event.inputSource?.handedness;
  if(!["left","right"].includes(hand))return;
  const result=onVRCustody("climb-release",{hand});
  vrGripConsumed.delete(hand);
  if(result?.handled&&result.ok)statusText("✋ 鉄格子から手を放しました。両手を離すと床に降ります。");
 }
 function onVRSelectStart(event){
  if(activeMode!=="vr"||vrRTS||!event.frame)return;
  if(onVRCustody("state")?.handled){
   const hand=event.inputSource?.handedness;
   if(!["left","right"].includes(hand))return;
   sampleVRRig(event.frame);
   let grip=null;
   try{const ref=event.inputSource?.gripSpace||event.inputSource?.targetRaySpace;
    grip=ref&&space?event.frame.getPose(ref,space)?.transform.matrix||null:null;
   }catch(_){/* No virtual ledge grab without controller tracking. */}
   const result=hand==="left"?onVRCustody("climb-foot",{hand}):
    onVRCustody("climb-mantle",{hand,pose:grip,stage:vrCurrentStage});
   if(result?.ok)vrCustodyTriggerConsumed.add(hand);
   if(result?.message)statusText("🥽 "+result.message);
   return;
  }
  sampleVRRig(event.frame);
  if(vrPhysical.triggerStart(event.inputSource?.handedness)==="draw")
   statusText("🏹 ＋を目標に合わせて弦を引き、右トリガーを離すと射撃します");
 }
 function onVRSelectEnd(event){
  if(onVRCustody("state")?.handled)return;
  if(activeMode!=="vr"||vrRTS||!event.frame)return;
  sampleVRRig(event.frame);
  const outcome=vrPhysical.triggerEnd(event.inputSource?.handedness);
  if(!outcome)return;
  if(outcome.kind==="shoot"){
   const ray=vrPhysical.pose?.leftRay;
   const yaw=ray&&vrCurrentStage?xrPointerYaw(ray,vrCurrentStage):null;
   if(yaw!==null)onVRAim(yaw,"left");
   const fired=onVRCommand("shoot");
   statusText(fired?.ok?"🏹 VR：トリガーを離して射撃":"🏹 射撃できません。矢・体力・行動中を確認してください");
  }else statusText("🏹 引きが不足しているため射撃をキャンセルしました");
 }
 function onSelect(event){
  if(!session||!anchor||!space||!event.frame)return;
  const source=event.inputSource;
  if(!source?.targetRaySpace)return;
  const ray=event.frame.getPose(source.targetRaySpace,space);
  if(!ray)return;
  if(activeMode==="vr"){
   if(onVRCustody("state")?.handled){
    if(vrCustodyTriggerConsumed.delete(source.handedness))return;
    const result=onVRCustody("talk");
    if(result?.message)statusText("🛡️ "+result.message);
    return;
   }
   if(vrPhysical.suppressSelect(source.handedness))return;
   if((vrPlanetOverview||getController()?.altitudeM>50000)&&!vrRTS){
    if(source.handedness!=="right"||!vrPlanetAnchor)return;
    const hit=xrPlanetHit(ray.transform.matrix,vrPlanetAnchor,{yawOffset:planetYaw,radius:1.15});
    if(!hit){statusText("🌐 惑星模型を狙ってください");return;}
    const now=performance.now();
    const again=planetSelected&&previousPlanetHit&&now-previousPlanetHitTime<1300&&
     Math.abs(hit.lat-previousPlanetHit.lat)<5&&
     Math.abs(((hit.lon-previousPlanetHit.lon+540)%360)-180)<5;
    if(again){
     if(onPlanetLand()){
      vrPlanetOverview=false;planetSelected=false;previousPlanetHit=null;vrPlanetAnchor=null;
      statusText("🌐 惑星から地表への降下を開始しました（VRを維持）");
     }else statusText("降下できません。地形や拘束状態を確認してください");
    }else{
     planetSelected=Boolean(onPlanetPick(hit.lat,hit.lon));
     previousPlanetHit=planetSelected?hit:null;previousPlanetHitTime=now;
     statusText(planetSelected?"🌐 選択しました。同じ地点を再度トリガーで降下":"🌐 この地点へは降下できません");
    }
    return;
   }
   if(vrRTS&&source.handedness==="right"){
    const actor=getController();
    const point=xrTableHit(ray.transform.matrix,anchor,actor.yaw,actor,Number(scaleInput.value),vrTableYaw);
    if(!point){statusText("🥽 VR RTS：卓上の地面を狙ってください");return;}
    if(onRTSSelect(point.x,point.z,Number(scaleInput.value)))statusText("🥽 VR RTS：味方を選択");
    else if(onRTSMove(point.x,point.z))statusText("🥽 VR RTS：選択部隊を移動");
    else statusText("🥽 VR RTS：味方を選択してから移動先を指定してください");
    return;
   }
   const hand=source.handedness==="left"?"left":"right";
   if(vrCurrentStage){
    const yaw=xrPointerYaw(ray.transform.matrix,vrCurrentStage);
    if(yaw!==null)onVRAim(yaw,hand);
   }
   const result=onVRHand(hand);
   if(result?.ok)statusText("🥽 "+(hand==="right"?"右手":"左手")+"の装備を使用");
   return;
  }
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
  if(activeMode==="vr"){
   if(onVRCustody("state")?.handled)return; // Combat grips are inactive during detention.
   const hand=event.inputSource?.handedness;
   if(vrGripConsumed.delete(hand))return;
   const result=onVRCommand(event.inputSource?.handedness==="right"?"guard":"shoot");
   if(result?.ok)statusText("🥽 "+(event.inputSource?.handedness==="right"?"防御":"弓射撃")+"を実行");
   return;
  }
  if(activeMode==="mr-planet"){confirmPlanetLanding();return;}
  if(activeMode==="mr-rts"){
   const point=xrTableHit(pose.transform.matrix,anchor,getController().yaw,getController(),Number(scaleInput.value));
   if(point&&onRTSMove(point.x,point.z))statusText("📍 MRで選択した味方へ移動を指示しました");
  }
 }
 function inputVector(){
  if(!session||activeMode!=="vr")return null;
  // XR gamepad data is sampled in immersive session frames, not window RAF.
  // Stop motion if the headset is no longer delivering controller frames.
  if(!vrInputSampleAt||performance.now()-vrInputSampleAt>250)
   return {forward:0,strafe:0,turn:0,tableTurn:0};
  return {...vrMovement};
 }
 function vrButtonsFrame(sources){
  if(activeMode!=="vr")return;
  const {next,pressed}=xrButtonEdges(sources,vrButtons);
  vrButtons=next;
  for(const button of pressed){
   if(onVRCustody("state")?.handled){
    const action=button==="left:4"?"talk":button==="right:4"?"bail":button==="right:5"?"serve":null;
    if(action){
     const result=onVRCustody(action);
     if(result?.message)statusText("🛡️ "+result.message);
    }
    continue; // Detention overrides normal RTS/camera/jump bindings.
   }
   if(button==="right:4"){
    const nextMode=!vrRTS;
    if(onVRToggleRTS(nextMode)!==false){
     vrRTS=nextMode;vrPlanetOverview=false;vrPlanetAnchor=null;planetSelected=false;vrTableYaw=0;
     statusText(vrRTS?"🥽 VR卓上RTS：右トリガーで味方選択・移動、左グリップで射撃":"🥽 VR歩行へ戻りました");
    }
   }else if(button==="right:5"){
    if(!vrRTS){vrThird=!vrThird;statusText(vrThird?"🥽 三人称":"🥽 一人称");}
   }else if(button==="left:4"){
    if(!vrRTS)onVRJump();
   }else if(button==="left:5")onVRDeck();
   else if(button==="right:3"&&vrRTS)onRTSAll();
   else if(button==="left:3"&&vrRTS)onVRSync();
   else if(button==="left:3"){
    vrPlanetOverview=!vrPlanetOverview;vrPlanetAnchor=null;planetSelected=false;previousPlanetHit=null;
    statusText(vrPlanetOverview?"🌐 VR惑星ビュー：右トリガーで地点選択、もう一度押すと降下。左スティック押込で地表へ戻る":"🥽 VR一人称の冒険へ戻りました");
   }
  }
 }
 /**
  * Called only during a live immersive XR animation frame. Do not inspect
  * XR opaque framebuffer attachments and do not check them in window RAF.
  */
 function recoverVRFramebuffer(gl,reason){
  if(activeMode!=="vr")return;
  vrLastErrorStep=reason;
  if(projection){
   if(vrRecoveryExhausted)return;
   try{
    // If Quest's compositor cannot supply projection textures, use the
    // legacy XRWebGLLayer as one entry of renderState.layers, not baseLayer.
    const layer=new XRWebGLLayer(session,gl,XR_VR_LAYER_CONFIGS[0]);
    const granted=xrLayersEnabled(session);
    installLegacyXRLayer(session,layer,{preferLayers:granted??true});
    const old=projection;projection=null;destroyXRProjection(gl,old);
    vrLayerIndex=0;vrPendingLayer=layer;vrPendingFrames=0;
    vrFramebufferInfo="XRProjectionLayer→旧描画方式へ切替中";
    vrMark("Quest VR描画方式を再切替",{force:true,log:true});
   }catch(error){
    vrRecoveryExhausted=true;
    vrDrawError="VR代替描画先の設定失敗: "+(error?.message||error);
    vrMark("XRProjectionLayer描画エラー",{force:true,log:true});
   }
   return;
  }
  if(!projectionAttempted&&canUseXRProjection()){
   projectionAttempted=true;
   try{
    projection=createXRProjection(session,gl);
    vrFramebufferInfo="XRProjectionLayer反映待ち";
    vrMark("Quest向けVR描画方式へ切替",{force:true,log:true});
    return;
   }catch(error){
    vrLastErrorStep+="／XRProjectionLayer不可: "+(error?.message||error);
    notify("🥽 代替XRProjectionLayerの作成に失敗: "+(error?.message||error));
   }
  }
  if(vrPendingLayer)return;
  const next=xrNextLayerIndex(vrLayerIndex);
  if(next===null){
   if(!vrRecoveryExhausted){
    vrRecoveryExhausted=true;
    notify("🥽 VR描画先が利用できません／"+reason+
     "。機器のWebXR描画互換性を確認してください");
   }
   return;
  }
  try{
   const replacement=new XRWebGLLayer(session,gl,XR_VR_LAYER_CONFIGS[next]);
   const granted=xrLayersEnabled(session);
   installLegacyXRLayer(session,replacement,{preferLayers:granted??canUseXRProjection()});
   vrLayerIndex=next;vrPendingLayer=replacement;vrPendingFrames=0;
   vrFramebufferInfo="代替FB "+next+" 反映待ち";
   const msg="🥽 VR描画先を切替 "+next+"/"+(XR_VR_LAYER_CONFIGS.length-1)+
    "（"+reason+"）";
   statusText(msg);notify(msg);
  }catch(error){
   vrFramebufferInfo="代替FB生成失敗: "+(error?.message||error);
   notify("🥽 "+vrFramebufferInfo);
  }
 }
 function readGLError(gl){
  const err=gl.getError();
  return err===gl.NO_ERROR?null:"0x"+err.toString(16);
 }
 function drawXR(time,frame){
  if(!session)return;
  // Count callbacks *before* any early return. Otherwise the UI may keep
  // claiming "waiting" even though XR callbacks are being delivered.
  if(activeMode==="vr"){
   vrFrames++;
   vrLastCallbackAt=performance.now();
   vrSessionVisibility=session.visibilityState||"不明";
   if(vrFrames===1)vrMark("XR初回コールバック受信",{force:true,log:true});
  }
  session.requestAnimationFrame(drawXR);
  const controllerSources=xrControllerSources(session);
  try{vrButtonsFrame(controllerSources);}
  catch(error){
   vrButtons.clear();
   notify("🥽 コントローラー操作エラー: "+(error?.message||error));
  }
  if(activeMode==="vr"){
   // Quest controllers normally live in inputSources. Newer runtimes may
   // temporarily migrate them to trackedSources: retain one per hand.
   const sources=controllerSources;
   vrMovement=xrVRMovement(sources,{rts:vrRTS});
   if(vrPlanetOverview||getController()?.altitudeM>50000)vrMovement={forward:0,strafe:0,turn:0,tableTurn:0};
   vrInputSampleAt=performance.now();
   const left=sources.find(s=>s.handedness==="left");
   const axes=left?.gamepad?.axes;
   if(left?.gamepad){
    vrLastConnectedLeft="L("+[...(axes||[])].map(v=>Number(v).toFixed(2)).join(",")+
     ") "+(left.gamepad?.mapping||"mappingなし");
    vrInputInfo=vrLastConnectedLeft;
   }else{
    // XR inputSources may disappear when Quest shows an overlay or exits VR.
    // Preserve the most recent real input sample for post-exit diagnostics.
    const blurred=vrSessionVisibility!=="visible";
    vrInputInfo=vrLastConnectedLeft==="未取得"?"左コントローラー未検出":
     "現在左コントローラー未検出（直近 "+vrLastConnectedLeft+"）"+
     (blurred?"／フォーカス外の可能性":"");
   }
   // Quest can suspend window.requestAnimationFrame: drive the simulation
   // from the immersive XR frame and pass the same sampled axes directly.
   try{
    const movement=onVRFrame(time,{...vrMovement});
    if(movement){
     vrMoveInfo="移動 "+movement.traveledM.toFixed(3)+"m／高度 "+movement.altitudeM.toFixed(1)+
      "m"+(movement.blocked?"／衝突":"")+(movement.rts?"／RTS":"")+
      (movement.jailWalkable?"／牢内歩行":"")+
      (movement.barClimbing?"／鉄格子登攀 "+movement.barHeightM.toFixed(2)+"m":"")+
      (movement.barFootBraced?"／足掛け":"")+(movement.barOnLedge?"／内側足場":"")+
      (movement.restraintReason?"／"+movement.restraintReason:"");
     const requested=Math.hypot(vrMovement.forward,vrMovement.strafe)>.45&&!vrRTS;
     if(requested&&movement.detained&&!movement.jailWalkable&&!movement.jailStunned&&movement.restraintReason?.includes("勾留")&&!vrCustodyTipShown){
      vrCustodyTipShown=true;
      notify("🥽 歩行停止：ゲーム内で勾留中です。VRを終了して🚨「治安・手配」から「罰金を払って釈放」または「📆 服役して釈放」を選択してください。左スティック入力とは別の移動制限です。");
     }
     if(!movement.detained)vrCustodyTipShown=false;
     if(requested)vrLastWalk="前後 "+vrMovement.forward.toFixed(2)+
      "／左右 "+vrMovement.strafe.toFixed(2)+"／変位 "+movement.traveledM.toFixed(3)+
      "m／高度 "+movement.altitudeM.toFixed(1)+"m"+
      (movement.blocked?"／衝突":"")+(movement.restraintReason?"／"+movement.restraintReason:
       movement.detained?"／行動制限":"")+
      "／"+vrInputInfo;
     if(requested&&movement.traveledM<.001){
      vrNoMotionFrames++;
      if(vrNoMotionFrames>80&&!vrWarned){
       const reason=movement.jailStunned?"捕縛・気絶の演出中です。終了すると牢内を歩けます":
        movement.jailWalkable&&movement.blocked?"牢の壁・鉄格子・家具に阻まれています":
        movement.altitudeM>12.01?"地表への降下が未完了":
        movement.detained&&!movement.jailWalkable?movement.restraintReason||"行動制限中":
        movement.indoor?"施設や乗り物の専用移動中":
        movement.blocked?"地形・壁との衝突":"移動が反映されていません";
       notify("🥽 左スティック入力は検出しましたが、アバターが進めません："+reason+
        "／"+vrInputInfo);
       vrWarned=true;
      }
     }else{vrNoMotionFrames=0;vrWarned=false;}
    }
   }catch(error){
    if(vrFrames<3||vrFrames%180===0)notify("🥽 VR移動処理エラー: "+(error?.message||error));
    vrMoveInfo="移動処理エラー："+(error?.message||error);
   }
  }
  const renderer=getRenderer(),controller=getController();
  if(!renderer||!controller||!space){
   vrMark("描画準備未完了（renderer／controller／space）",{force:true,log:vrFrames===1});
   return;
  }
  let pose;
  try{pose=frame.getViewerPose(space);}
  catch(error){
   vrDrawError="getViewerPose例外: "+(error?.message||error);
   vrMark("追跡姿勢取得例外",{force:true,log:vrFrames===1});
   return;
  }
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
   if(activeMode==="vr"){
    if(vrFrames===90)vrDrawError="追跡姿勢が取得できません";
    vrMark("XRフレーム受信／追跡姿勢なし",{force:vrFrames===1||vrFrames===30||vrFrames===90,
     log:vrFrames===90});
   }
   return;
  }
  if(activeMode==="vr"){
   vrHasPose=true;
   if(vrDrawError==="追跡姿勢が取得できません")vrDrawError="";
   if(vrFrames===1)vrMark("追跡姿勢取得／"+pose.views.length+"眼",{force:true});
  }
  if(!anchor)anchor=xrAnchor(pose.transform.matrix,{floor:usingFloor});
  if(activeMode==="vr")sampleVRRig(frame,pose.transform.matrix,time);
  if(hitSource&&frame.getHitTestResults){
   const hits=frame.getHitTestResults(hitSource);
   const hit=hits?.[0]?.getPose(space);hitPose=hit?.transform.matrix||null;
  }
  const gl=renderer.gl,layer=activeLegacyXRLayer(session);
  if(!layer&&!projection){
   vrMark("XR描画レイヤー未適用",{force:vrFrames<2||vrFrames===30||vrFrames===90});
   return;
  }
  if(activeMode==="vr"&&projection&&!projectionReady(session,projection)){
   vrMark("XRProjectionLayer適用待ち",{force:vrFrames<2||vrFrames===30||vrFrames===90});
   return;
  }
  const mode=activeMode;
  const planetMode=mode==="mr-planet"||(mode==="vr"&&!vrRTS&&(vrPlanetOverview||controller.altitudeM>50000));
  const mrRts=mode==="mr-rts"||(mode==="vr"&&vrRTS);
  const frameState=mrRts?Object.assign(Object.create(Object.getPrototypeOf(controller)),controller,{altitudeM:2.5}):
   planetMode?Object.assign(Object.create(Object.getPrototypeOf(controller)),controller,{altitudeM:15000000}):controller;
  let stageAnchor=anchor;
  if(mode==="vr"&&vrThird&&!vrRTS&&!planetMode){
   // Allow a real head-tracked third-person view with the player in front.
   stageAnchor={...anchor,vrFloor:[
    anchor.vrFloor[0]+(anchor.position[0]-anchor.vrFloor[0])*3.2,
    anchor.vrFloor[1],
    anchor.vrFloor[2]+(anchor.position[2]-anchor.vrFloor[2])*3.2
   ]};
  }
  if(mode==="vr"&&planetMode){
   // Preserve the original room-space planet anchor when the user turns
   // their head. A hologram must NOT chase the viewer every XR frame.
   stageAnchor={...anchor,position:[
    anchor.vrFloor[0]+(anchor.position[0]-anchor.vrFloor[0])*2.4,
    anchor.vrFloor[1]+1.65,
    anchor.vrFloor[2]+(anchor.position[2]-anchor.vrFloor[2])*2.4
   ]};
  }
  if(mode==="vr")vrPlanetAnchor=planetMode?stageAnchor:null;
  // VR image facing must track the avatar that the sticks actually move.
  // In the detention facility its yaw is local and the outdoor controller
  // remains stationary while the planet clock is paused.
  const indoorYaw=mode==="vr"?xrVRActorYaw(renderer,controller):controller.yaw;
  const stage=xrStage({
   mode:mrRts?"mr-rts":planetMode?"mr-planet":mode,anchor:stageAnchor,
   actorYaw:indoorYaw,planetRadius:renderer.R,
   rtsScale:Number(scaleInput.value),yawOffset:mrRts&&mode==="vr"?vrTableYaw:planetYaw,
   planetScale:mode==="vr"?1.15:.24
  });
  if(mode==="vr")vrCurrentStage=stage;
  const dt=lastTime?Math.max(0,Math.min(.07,(time-lastTime)/1000)):1/60;lastTime=time;
  if(mode==="vr"&&vrRTS){
   vrTableYaw+=xrVRMovement(session.inputSources,{rts:true}).tableTurn*dt*1.4;
  }
  if(mode==="mr-planet"){
   for(const input of session.inputSources||[]){
    const axes=input.gamepad?.axes;
    if(!axes?.length)continue;
    const x=axes.length>=4?axes[2]:axes[0];
    if(Math.abs(x||0)>.22){planetYaw+=x*dt*1.2;break;}
   }
  }
  let cursor=null;
  if(mrRts){
   for(const source of session.inputSources||[]){
    const ray=source.targetRaySpace&&frame.getPose(source.targetRaySpace,space);
    if(!ray)continue;
    cursor=xrTableHit(ray.transform.matrix,anchor,controller.yaw,controller,Number(scaleInput.value),
     mode==="vr"?vrTableYaw:0);
    if(cursor)break;
   }
  }
  try{
   // WebXR opaque framebuffers are only renderable *inside* the XR frame
   // callback. A status probe here distinguishes an incompatible VR target
   // from a normal 3D scene error; never inspect its private attachments.
   const usingProjection=mode==="vr"&&Boolean(projection);
   if(mode==="vr"&&!usingProjection&&vrPendingLayer){
    if(layer!==vrPendingLayer){
     if(++vrPendingFrames<45){
      vrMark("描画レイヤー切替待ち",{force:vrPendingFrames===1||vrPendingFrames===30});
      return;
     }
     vrPendingLayer=null;vrFramebufferInfo="XRレイヤー切替が反映されません";
    }else{vrPendingLayer=null;vrPendingFrames=0;}
   }
   const stale=mode==="vr"?readGLError(gl):null;
   if(usingProjection){
    vrFramebufferInfo="XRProjectionLayer／左右眼テクスチャ";
   }else if(mode==="vr"){
    const target=probeXRFramebuffer(gl,layer);
    vrFramebufferInfo="FB="+target.label+
     " "+target.width+"x"+target.height+"／layer="+vrLayerIndex;
    if(!target.ok){
     recoverVRFramebuffer(gl,"FB状態 "+target.label);
     vrMark("VR描画先不完全",{force:true,log:vrFrames===1});return;
    }
    if(vrFrames===1)vrMark("描画先確認済み",{force:true});
   }else{
    // Legacy MR rendering already works on Quest. Avoid rejecting its
    // opaque compositing framebuffer based on attachment introspection.
    gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);
   }
   if(stale&&vrFrames<3)vrLastErrorStep="前フレームGL "+stale;
   // Restore output masks and depth testing after regular canvas rendering.
   gl.colorMask(true,true,true,true);
   gl.depthMask(true);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
   gl.disable(gl.BLEND);
   gl.enable(gl.SCISSOR_TEST);
   let renderedEyes=0;
   for(let index=0;index<pose.views.length;index++){
    const view=pose.views[index];
    const vp=usingProjection?bindXRProjectionView(gl,projection,view):layer.getViewport(view);
    if(!vp||vp.width<=0||vp.height<=0)continue;
    if(mode==="vr"){
     // Color-only calibration before drawing the real scene. When clear works
     // but the scene fails, the diagnosis reports "scene" instead of "FB".
     gl.viewport(vp.x,vp.y,vp.width,vp.height);
     gl.scissor(vp.x,vp.y,vp.width,vp.height);
     gl.clearColor(.12,.23,.40,1);
     gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
     const clearErr=readGLError(gl);
     if(clearErr){
      recoverVRFramebuffer(gl,"eye"+(index+1)+" clear "+clearErr+
       "／"+vrFramebufferInfo);
      vrMark("VR画面初期化エラー",{force:true,log:vrFrames===1});
      return;
     }
    }
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
    renderer.xrView={mode,vrImmersive:mode==="vr",rtsTabletop:mrRts,
     showAvatar:mode==="vr"&&(vrThird||vrRTS),
     projection:view.projectionMatrix,view:view.transform.inverse.matrix,
     stage,planetMode,viewport:vp,eye:index,cursor,depthTexture:occlusionTexture};
    renderer.frame(frameState,index===0?dt:0);
    if(mode==="vr")renderer.drawVRBody?.(renderer.xrView,{
      ...vrPhysical.snapshot(),backpack:onVRHasBag(),
      custodyFootBraced:Boolean(getVRCustodyPose()?.footBraced),
      custodyOnLedge:Boolean(getVRCustodyPose()?.onLedge),
      appearance:getVRAppearance(),arrowCount:Math.max(0,getVRArrowCount()||0),
      bagOpen:vrWearables.containers.get("travel-backpack")?.open&&onVRHasBag(),
      pocketContainsNote:vrWearables.containers.get("trouser-pocket")?.items.includes("field-note"),
      pocketSocket:vrWearables.containers.get("trouser-pocket")?.socket||"rightPocket",
      heldWearables:Object.fromEntries(["left","right"].map(hand=>
       [hand,vrWearables.items.get(vrWearables.hands[hand])||null]))
     });
    if(mode==="vr"&&vrFrames<240)renderer.drawVRGuide(renderer.xrView,anchor);
    if(mode==="vr"){
     const sceneErr=readGLError(gl);
     if(sceneErr){
      recoverVRFramebuffer(gl,"eye"+(index+1)+" scene "+sceneErr+
       "／"+vrFramebufferInfo);
      vrMark("VR 3D描画エラー",{force:true,log:vrFrames===1});
      return;
     }
     renderedEyes++;
    }
   }
   if(mode==="vr"){
    if(renderedEyes!==pose.views.length||renderedEyes===0){
     vrMark("XRビュー領域取得失敗 "+renderedEyes+"/"+pose.views.length,
      {force:vrFrames===1||vrFrames===90,log:vrFrames===90});
     return;
    }
    vrSceneFrames++;
    if(vrFrames===1||vrFrames===30||vrFrames===90||vrFrames===300)
     vrMark("左右眼描画完了",{force:true,log:vrFrames===1||vrFrames===90||vrFrames===300});
   }
  }catch(error){
   vrDrawError=error?.message||String(error);
   vrMark("XR描画例外",{force:true});
   if(vrDiag)vrDiag.textContent=vrSnapshot("XR描画例外");
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
 buttons.adventure?.addEventListener("click",()=>startWithOptions("vr",{ground:true}));
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
  exportWearables:()=>vrWearables.snapshot(),
  restoreWearables:data=>{
   const restored=WearableInventory.fromSnapshot(data);
   vrWearables=restored;saveWearables();syncVRClothing();return true;
  },
  close:()=>session?.end(),dispose:()=>{
   disposed=true;
   if(session)session.end().catch(()=>{});
   else endCleanup();
  }};
}
