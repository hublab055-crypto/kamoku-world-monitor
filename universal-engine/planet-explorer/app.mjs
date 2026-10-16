import {Multiverse} from "../core.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {Weather} from "../planet/weather-engine.mjs";
import {ExplorerController} from "./controller.mjs";
import {findLand,terrainSurface} from "./geo.mjs";
import {ExplorerRenderer} from "./render.mjs";
import {Actions} from "./actions.mjs";
import {createAppearance,restoreAppearance,withOutfit,withAppearanceSlot,OUTFITS} from "./wardrobe.mjs";
import {ExpressionController,EXPRESSIONS} from "./expression.mjs";
import {CameraController,CAMERA_MODES} from "./camera-controller.mjs";

const $=id=>document.getElementById(id);
const SAVE_KEY="universal-engine:explorer:v0.7c";
const V07B_SAVE_KEY="universal-engine:explorer:v0.7b";
const PREVIOUS_SAVE_KEY="universal-engine:explorer:v0.7a";
const LEGACY_SAVE_KEY="universal-engine:explorer:v1";
let planet,terrain,weather,controller,renderer,universe,simWorld,actions;
let controlMode="stick",stick={x:0,y:0},stickPointer=null;
let running=true,lastTime=0,frameTime=0,frameCount=0,displayMode="",lastHud=0;
let avatarStyle="pioneer",appearance=createAppearance(),lastExpressionPreset="neutral";
const keys=new Set(),touches=new Set();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function log(msg){
 const li=document.createElement("li");li.textContent=msg;
 $("log").prepend(li);while($("log").children.length>8)$("log").lastElementChild.remove();
}
function init(saved=null){
 try{
  if(renderer)renderer.destroy();
  planet=saved?Planet.fromSnapshot(saved.planet):new Planet({seed:77,name:"Terra Nova",timeDays:0.24});
  terrain=new Terrain(planet);weather=new Weather(planet);
  controller=saved?ExplorerController.fromSnapshot(terrain,saved.explorer):new ExplorerController(terrain);
  actions=saved?.actions?Actions.fromSnapshot(saved.actions):new Actions();
  universe=saved?Multiverse.fromSnapshot(saved.universe):new Multiverse();
  simWorld=universe.getWorld("terra-nova")||universe.createWorld({
   id:"terra-nova",name:"Terra Nova",clock:{tickSeconds:.05,maxTicksPerAdvance:10}
  });
  simWorld.addSystem("solar-time",(_world,dt)=>planet.advance(dt*Number($("days-per-second").value)*.02));
  simWorld.clock.paused=!running;
  renderer=new ExplorerRenderer($("world"),planet,terrain);
  avatarStyle=["pioneer","scout","artisan"].includes(saved?.avatarStyle)?saved.avatarStyle:avatarStyle;
  appearance=saved?.v0_7b?.appearance?restoreAppearance(saved.v0_7b.appearance,avatarStyle):
    createAppearance(avatarStyle,avatarStyle);
  renderer.setAppearance(appearance);
  renderer.expression=saved?.v0_7b?.expression?
    ExpressionController.fromSnapshot(saved.v0_7b.expression):new ExpressionController();
  syncCustomizationControls();
  renderer.sceneActions=actions;
  renderer.cameraController=saved?.v0_7c?.camera?
    CameraController.fromSnapshot(saved.v0_7c.camera):new CameraController();
  if(!saved)renderer.cameraController.setMode("follow",controller,
    terrainSurface(terrain,controller.lat,controller.lon).elevationM);
  syncCameraControls();
  keys.clear();touches.clear();stick={x:0,y:0};
  $("fatal").hidden=true;$("world").hidden=false;
  $("landing").textContent=controller.origin.lat.toFixed(3)+"°, "+controller.origin.lon.toFixed(3)+"°";
  log(saved?"探索状態と人物設定を読み込みました。":"v0.7c：カメラ6モードを設定から選べます。v0.7b・v0.7a・v0.6へ戻れます。");
 }catch(e){$("fatal").hidden=false;$("fatal").textContent="3D初期化エラー: "+e.message;log(e.message);running=false;}
}
function inputVector(){
 const on=k=>keys.has(k)||touches.has(k);
 return {forward:(on("w")||on("arrowup")?1:0)-(on("s")||on("arrowdown")?1:0)+(controlMode==="stick"?-stick.y:0),
  strafe:(on("d")?1:0)-(on("a")?1:0)+(controlMode==="stick"?stick.x:0),
  turn:(on("e")||on("right")?1:0)-(on("q")||on("left")?1:0)};
}
function doFrame(t){
 const dt=lastTime?clamp((t-lastTime)/1000,0,.08):0;lastTime=t;
 if(controller&&renderer){
  const input=inputVector();
  if(renderer.cameraController.mode==="free"){
   renderer.cameraController.pan(dt,input.forward,input.strafe);
   controller.update(dt,{forward:0,strafe:0,turn:0});
  }else controller.update(dt,input);
  const completed=actions.advance(dt);
  if(completed)log(actions.message);
  if(running)universe.advance(dt);
  try{
   const next=renderer.frame(controller,dt);
   updateActorMarker(renderer.actorMarker);
   if(next!==displayMode){
    displayMode=next;
    $("mode").textContent=next==="orbit"?"宇宙・惑星モード":"地表メッシュモード";
    if(next==="ground")log("地表詳細メッシュへ移行。同じ緯度・経度を使用しています。");
   }
  }catch(e){
   running=false;simWorld.clock.pause();
   $("fatal").hidden=false;$("fatal").textContent="描画エラー: "+e.message;
  }
  frameTime+=dt;frameCount++;
  if(t-lastHud>240){
   updateHUD();
   const fps=frameTime?Math.round(frameCount/frameTime):0;
   $("fps").textContent=fps+" fps";frameTime=0;frameCount=0;lastHud=t;
  }
 }
 requestAnimationFrame(doFrame);
}
function updateHUD(){
 const g=terrainSurface(terrain,controller.lat,controller.lon);
 const climate=weather.sample(controller.lat,controller.lon,g.elevationM);
 const isSurface=controller.altitudeM<=12;
 $("coords").textContent=controller.lat.toFixed(5)+"°, "+controller.lon.toFixed(5)+"°";
 $("height").textContent=Math.round(controller.altitudeM).toLocaleString("ja-JP")+" m";
 $("ground-height").textContent=Math.round(g.elevationM).toLocaleString("ja-JP")+" m";
 $("biome").textContent=({ocean:"海洋",river:"河川",forest:"森林",mountain:"山岳",highland:"高地",plains:"平地",
  valley:"谷",coast:"海岸",tundra:"ツンドラ"}[g.category]||g.category);
 $("temp").textContent=climate.temperatureC.toFixed(1)+" °C";
 $("sunlight").textContent=Math.round(planet.illumination(controller.lat,controller.lon)*100)+"%";
 $("day").textContent=planet.timeDays.toFixed(2)+" 日";
 $("walked").textContent=controller.totalDistanceM.toFixed(1)+" m";
 $("jump-state").textContent=controller.jumpY>.01?"空中 "+controller.jumpY.toFixed(2)+" m":"接地";
 $("action-state").textContent=actions.message;
 $("customization-status").textContent=
   (OUTFITS.find(x=>x.id===appearance.presetId)?.name||appearance.presetId)+"・"+
   (EXPRESSIONS.find(x=>x[0]===renderer.expression.preset)?.[1]||renderer.expression.preset);
 $("materials").textContent="木 "+actions.resources.wood+" / 石 "+actions.resources.stone;
 $("building-count").textContent=String(actions.structures.filter(b=>b.progress>=1).length);
 $("control-state").textContent=renderer.cameraController.mode==="free"?"自由カメラ移動":
   controlMode==="stick"?"スティック移動":"地面タップで移動"+(controller.moveTarget?"（移動中）":"");
 $("camera-status").textContent=CAMERA_MODES.find(x=>x[0]===renderer.cameraController.mode)?.[1]||"従来";
 $("camera-mode").value=renderer.cameraController.mode;
 $("mode-stick").setAttribute("aria-pressed",String(controlMode==="stick"));
 $("mode-tap").setAttribute("aria-pressed",String(controlMode==="tap"));
 $("stick-area").hidden=controlMode!=="stick"||!isSurface;
 $("action-pad").hidden=!isSurface;
 $("walk-status").textContent=controller.blocked?"通行不可：水域または急斜面":isSurface?"歩行可能":"降下中／宇宙視点";
 $("play").textContent=running?"⏸ 時間を停止":"▶ 時間を再生";
 $("ground-button").disabled=isSurface&&controller.targetAltitudeM<=12;
 $("walk-note").textContent=renderer.cameraController.mode==="free"?
  "自由視点：スティック/WASDでカメラ移動。画面ドラッグで視線を回転。人物の位置は変わりません。":
  !isSurface?"地表へ降下すると歩行操作が有効になります。":
  controlMode==="tap"?"地面をタップすると自動で歩きます。ドラッグは視点回転です。":
  "左下の仮想スティックかWASDで移動。右下のボタンでジャンプや道具操作。";
}
function setAltitude(m){
 controller.targetAltitude(m);
 log(m<=12?"着陸地点へ降下します。":"高度 "+Math.round(m).toLocaleString("ja-JP")+"m を目標にします。");
}
$("ground-button").addEventListener("click",()=>setAltitude(2.5));
$("orbit-button").addEventListener("click",()=>setAltitude(15000000));
$("zoom-in").addEventListener("click",()=>controller.zoom(.35));
$("zoom-out").addEventListener("click",()=>controller.zoom(2.8));
$("next-day").addEventListener("click",()=>{planet.advance(1);log("惑星時間を1日進めました。");updateHUD();});
$("next-season").addEventListener("click",()=>{planet.advance(90);log("惑星時間を90日進めました。");updateHUD();});
$("play").addEventListener("click",()=>{
 running=!running;simWorld.clock.paused=!running;updateHUD();
});
$("save").addEventListener("click",()=>{
 try{
  const data={format:"ue/explorer-demo",version:1,
   planet:planet.snapshot(),explorer:controller.snapshot(),universe:universe.snapshot(),actions:actions.snapshot(),avatarStyle,
   v0_7b:{schemaVersion:1,appearance:{...appearance},expression:renderer.expression.snapshot()},
   v0_7c:{schemaVersion:1,camera:renderer.cameraController.snapshot()}};
  localStorage.setItem(SAVE_KEY,JSON.stringify(data));
  log("v0.7c専用にカメラ・衣装・表情・進行状況を保存しました。旧版は変更していません。");
 }catch(e){log("保存に失敗: "+e.message);}
});
$("restore").addEventListener("click",()=>{
 try{
  const data=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("対応する保存データがありません。");
  running=false;init(data);updateHUD();
 }catch(e){log("復元失敗: "+e.message);}
});
$("import-v06-save").addEventListener("click",()=>{
 try{
  const old=localStorage.getItem(LEGACY_SAVE_KEY);
  if(!old)throw Error("v0.6の保存データが見つかりません。");
  const data=JSON.parse(old);
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("非対応のv0.6セーブです。");
  running=false;init(data);updateHUD();
  log("v0.6のセーブを読み込みました（読み取りのみ）。v0.7c保存で新版に記録できます。");
 }catch(e){log("旧セーブの読み込み失敗: "+e.message)}
});
$("import-v07b-save").addEventListener("click",()=>{
 try{
  const old=localStorage.getItem(V07B_SAVE_KEY);
  if(!old)throw Error("v0.7bの保存データがありません。");
  const data=JSON.parse(old);
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("非対応のセーブデータです。");
  running=false;init(data);updateHUD();
  log("v0.7bの衣装・表情・進行状況を読み込みました。旧セーブは変更していません。");
 }catch(e){log("v0.7b読込失敗: "+e.message)}
});
$("import-v07a-save").addEventListener("click",()=>{
 try{
  const old=localStorage.getItem(PREVIOUS_SAVE_KEY);
  if(!old)throw Error("v0.7aの保存データが見つかりません。");
  const data=JSON.parse(old);
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("非対応のv0.7aセーブです。");
  running=false;init(data);updateHUD();
  log("v0.7aの進行データを読み取り専用で取り込みました。旧版セーブは変更していません。");
 }catch(e){log("v0.7aの読み込み失敗: "+e.message)}
});
$("reset").addEventListener("click",()=>{running=true;init();updateHUD();});
window.addEventListener("keydown",e=>{
 const k=e.key.toLowerCase();
 if(["w","a","s","d","q","e","arrowup","arrowdown","arrowleft","arrowright","+","-"].includes(k)){
  if(e.target===document.body)e.preventDefault();
  if(k==="arrowleft")keys.add("q");
  else if(k==="arrowright")keys.add("e");
  else keys.add(k);
 }
 if(k==="+"||k==="=")zoomScene(.65);
 if(k==="-")zoomScene(1.55);
});
window.addEventListener("keyup",e=>{
 const k=e.key.toLowerCase();keys.delete(k);
 if(k==="arrowleft")keys.delete("q");
 if(k==="arrowright")keys.delete("e");
});
document.addEventListener("visibilitychange",()=>{if(document.hidden){keys.clear();touches.clear();lastTime=0;}});
for(const button of document.querySelectorAll("[data-move]")){
 const key=button.dataset.move;
 const down=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);touches.add(key);};
 const up=e=>{e.preventDefault();touches.delete(key);};
 button.addEventListener("pointerdown",down);
 for(const action of ["pointerup","pointercancel","lostpointercapture"])button.addEventListener(action,up);
}
let pointer=null;
$("world").addEventListener("pointerdown",e=>{
 pointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false};
 $("world").setPointerCapture?.(e.pointerId);
});
$("world").addEventListener("pointermove",e=>{
 if(!pointer||e.pointerId!==pointer.id)return;
 if(Math.hypot(e.clientX-pointer.startX,e.clientY-pointer.startY)>10)pointer.moved=true;
 if(pointer.moved){
  if(renderer.cameraController.mode==="legacy")controller.turn((e.clientX-pointer.x)*.006);
  else renderer.cameraController.rotate(e.clientX-pointer.x,e.clientY-pointer.y);
 }
 pointer.x=e.clientX;pointer.y=e.clientY;
});
$("world").addEventListener("pointerup",e=>{
 if(!pointer||e.pointerId!==pointer.id)return;
 if(controlMode==="tap"&&!pointer.moved&&controller.nearGround){
   const ground=renderer.pickGround(e.clientX,e.clientY);
   if(ground&&controller.setMoveTarget(ground.x,ground.z)){
     log("タップ地点まで自動移動します。");
   }else log("移動できない地点です（地面を近くでタップしてください）。");
 }
 pointer=null;
});
$("world").addEventListener("pointercancel",()=>pointer=null);
$("world").addEventListener("wheel",e=>{
 e.preventDefault();
 zoomScene(e.deltaY>0?1.3:.77);
},{passive:false});
$("landing-select").addEventListener("change",()=>{
 const p=$("landing-select").value.split(",").map(Number);
 try{
  const site=findLand(terrain,p[0],p[1]);
  controller.setLanding(site.lat,site.lon);
  controller.targetAltitude(15000000);controller.altitudeM=15000000;
  renderer.patchKey=null;
  renderer.cameraController.resetFreeAnchor(controller,
    Math.max(0,terrainSurface(terrain,controller.lat,controller.lon).elevationM));
  $("landing").textContent=controller.lat.toFixed(3)+"°, "+controller.lon.toFixed(3)+"°";
  log("架空惑星の新しい着陸候補へ移動しました。");
 }catch(e){log("着陸地変更不可: "+e.message);}
});
$("landing-select").addEventListener("focus",()=>{keys.clear();touches.clear();});

function syncCustomizationControls(){
 $("avatar-style").value=appearance.baseModelId;
 $("outfit-select").value=appearance.presetId;
 for(const slot of ["hairStyle","headwear","cape","bag"]){
  const id=slot==="hairStyle"?"hair-style":slot;
  $(id).value=appearance[slot];
 }
 for(const [slot,id] of [["outer","outer-color"],["legs","legs-color"],["feet","feet-color"],["hairColor","hair-color"]])
  $(id).value=appearance[slot];
 $("expression-preset").value=renderer.expression.preset;
 $("gaze-x").value=String(renderer.expression.gazeX);
 $("auto-blink").checked=renderer.expression.autoBlink;
}
function applyAppearance(next,label){
 try{
  const restored=restoreAppearance(next);
  renderer.setAppearance(restored);
  appearance=restored;
  avatarStyle=restored.baseModelId;
  syncCustomizationControls();updateHUD();
  if(label)log(label);
 }catch(e){log("外見変更に失敗: "+e.message)}
}
$("avatar-style").addEventListener("change",()=>{
 const base=$("avatar-style").value;
 applyAppearance({...appearance,baseModelId:base},"人物の素体を変更しました。");
});
$("outfit-select").addEventListener("change",()=>{
 try{applyAppearance(withOutfit(appearance,$("outfit-select").value),"衣装を変更しました。");}
 catch(e){log(e.message)}
});
for(const [id,slot] of [["hair-style","hairStyle"],["headwear","headwear"],["cape","cape"],["bag","bag"],
 ["outer-color","outer"],["legs-color","legs"],["feet-color","feet"],["hair-color","hairColor"]]){
 $(id).addEventListener("change",()=>{
  try{applyAppearance(withAppearanceSlot(appearance,slot,$(id).value),"部位別の衣装・色を変更しました。");}
  catch(e){log(e.message)}
 });
}
$("expression-preset").addEventListener("change",()=>{
 try{renderer.expression.setPreset($("expression-preset").value);updateHUD();}
 catch(e){log("表情の変更失敗: "+e.message)}
});
$("gaze-x").addEventListener("input",()=>{
 renderer.expression.setGaze(Number($("gaze-x").value));
});
$("auto-blink").addEventListener("change",()=>renderer.expression.setAutoBlink($("auto-blink").checked));
$("reset-appearance").addEventListener("click",()=>{
 renderer.expression=new ExpressionController();
 applyAppearance(createAppearance("pioneer","pioneer"),"人物の外見と表情を初期化しました。");
});

function zoomScene(factor){
 if(renderer.cameraController.mode==="legacy")controller.zoom(factor);
 else if(controller.altitudeM>23000)controller.zoom(factor);
 else renderer.cameraController.zoom(factor);
}
function updateActorMarker(info){
 const marker=$("actor-marker");
 if(!info||!info.onScreen){
  if(!info){marker.hidden=true;return;}
  marker.hidden=false;
  marker.style.left=(Math.max(.04,Math.min(.96,info.u))*100)+"%";
  marker.style.top=(Math.max(.08,Math.min(.92,info.v))*100)+"%";
  marker.textContent="↗ アバター";
  return;
 }
 marker.hidden=false;
 marker.style.left=(info.u*100)+"%";
 marker.style.top=(info.v*100)+"%";
 marker.textContent="◆ アバター";
}
function syncCameraControls(){
 const camera=renderer.cameraController.config;
 $("camera-mode").value=camera.mode;
 $("camera-distance").value=String(camera.distanceM);
 $("camera-fov").value=String(camera.fieldOfViewDeg);
 $("camera-height").value=String(camera.tacticalHeightM);
 $("camera-follow-strength").value=String(camera.followStrength);
 $("camera-indicator").checked=camera.indicator;
 $("camera-distance-label").textContent=camera.distanceM.toFixed(1)+"m";
 $("camera-fov-label").textContent=camera.fieldOfViewDeg+"°";
 $("camera-height-label").textContent=Math.round(camera.tacticalHeightM)+"m";
 $("camera-mode-label").textContent=CAMERA_MODES.find(x=>x[0]===camera.mode)?.[1]||camera.mode;
}
function setCameraMode(mode){
 try{
  const ground=Math.max(0,terrainSurface(terrain,controller.lat,controller.lon).elevationM);
  renderer.cameraController.setMode(mode,controller,ground);
  syncCameraControls();updateHUD();
  log("カメラを「"+$("camera-mode-label").textContent+"」へ切り替えました。");
 }catch(e){log("カメラ設定失敗: "+e.message)}
}
$("camera-mode").addEventListener("change",()=>setCameraMode($("camera-mode").value));
$("camera-distance").addEventListener("input",()=>{
 renderer.cameraController.setValue("distanceM",Number($("camera-distance").value));
 syncCameraControls();
});
$("camera-fov").addEventListener("input",()=>{
 renderer.cameraController.setValue("fieldOfViewDeg",Number($("camera-fov").value));
 syncCameraControls();
});
$("camera-height").addEventListener("input",()=>{
 renderer.cameraController.setValue("tacticalHeightM",Number($("camera-height").value));
 syncCameraControls();
});
$("camera-follow-strength").addEventListener("input",()=>{
 renderer.cameraController.setValue("followStrength",Number($("camera-follow-strength").value));
 syncCameraControls();
});
$("camera-indicator").addEventListener("change",()=>{
 renderer.cameraController.setValue("indicator",$("camera-indicator").checked);
});
$("camera-face").addEventListener("click",()=>{
 setCameraMode("orbitTarget");
 renderer.cameraController.config.yawOffset=Math.PI;
 renderer.cameraController.setValue("distanceM",4);
 renderer.cameraController.config.pitchRad=.1;
 syncCameraControls();
 log("正面から表情を確認するカメラに切り替えました。");
});
$("camera-home").addEventListener("click",()=>{
 renderer.cameraController.resetFreeAnchor(controller,Math.max(0,
  terrainSurface(terrain,controller.lat,controller.lon).elevationM));
 if(renderer.cameraController.mode!=="free")setCameraMode("follow");
 syncCameraControls();
});
function setControlMode(mode){
 controlMode=mode;
 controller?.clearMoveTarget();
 stick={x:0,y:0};
 $("stick-nub").style.transform="translate(0px,0px)";
 updateHUD();
}
$("mode-stick").addEventListener("click",()=>setControlMode("stick"));
$("mode-tap").addEventListener("click",()=>setControlMode("tap"));
$("jump").addEventListener("click",()=>{if(!controller.jump())log("ジャンプは地上でのみ可能です。");});
for(const [button,kind] of [["action-sword","sword"],["action-axe","axe"],["action-mine","mine"],["action-build","build"]]){
 $(button).addEventListener("click",()=>{
   actions.start(kind,controller,(lat,lon)=>terrainSurface(terrain,lat,lon));
   log(actions.message);
   updateHUD();
 });
}
const stickArea=$("stick-area"),nub=$("stick-nub");
function updateStick(e){
 const r=stickArea.getBoundingClientRect();
 const cx=r.left+r.width/2,cy=r.top+r.height/2;
 const radius=Math.max(1,Math.min(r.width,r.height)*.32);
 const dx=e.clientX-cx,dy=e.clientY-cy,mag=Math.hypot(dx,dy);
 const scale=mag>radius?radius/mag:1;
 const px=dx*scale,py=dy*scale;
 stick={x:px/radius,y:py/radius};
 nub.style.transform="translate("+px.toFixed(1)+"px,"+py.toFixed(1)+"px)";
}
function releaseStick(){stickPointer=null;stick={x:0,y:0};nub.style.transform="translate(0px,0px)";}
stickArea.addEventListener("pointerdown",e=>{
 if(controlMode!=="stick")return;
 e.preventDefault();stickPointer=e.pointerId;
 stickArea.setPointerCapture?.(e.pointerId);controller.clearMoveTarget();updateStick(e);
});
stickArea.addEventListener("pointermove",e=>{if(e.pointerId===stickPointer)updateStick(e);});
for(const t of ["pointerup","pointercancel","lostpointercapture"]){
 stickArea.addEventListener(t,e=>{if(stickPointer===e.pointerId)releaseStick();});
}

init();requestAnimationFrame(doFrame);

/* Enlarged view: native fullscreen where available, CSS immersive fallback on
   iPhone Safari and browsers that restrict Element.requestFullscreen(). */
const stage=document.querySelector(".view-panel");
const fullBtn=$("fullscreen-toggle");
let cssImmersive=false;
function enlarged(){
 return cssImmersive || document.fullscreenElement===stage;
}
function syncFullscreenButton(){
 const on=enlarged();
 fullBtn.textContent=on?"⤡ 元の画面へ戻す":"⛶ 画面を広げる";
 fullBtn.setAttribute("aria-pressed",String(on));
 fullBtn.setAttribute("aria-label",on?"通常表示に戻す":"画面を最大化");
}
async function switchFullscreen(){
 if(enlarged()){
   cssImmersive=false;
   stage.classList.remove("immersive");
   document.body.classList.remove("immersive");
   if(document.fullscreenElement===stage&&document.exitFullscreen){
     try{await document.exitFullscreen()}catch(e){log("全画面の解除に失敗しました: "+e.message)}
   }
 }else{
   let nativeOpened=false;
   if(typeof stage.requestFullscreen==="function"){
     try{
       await stage.requestFullscreen({navigationUI:"hide"});
       nativeOpened=document.fullscreenElement===stage;
     }catch(e){/* iOS Safari often limits fullscreen to video elements. */}
   }
   if(!nativeOpened){
     cssImmersive=true;
     stage.classList.add("immersive");
     document.body.classList.add("immersive");
   }
 }
 syncFullscreenButton();
 lastTime=0;
}
fullBtn.addEventListener("click",()=>{void switchFullscreen()});
document.addEventListener("fullscreenchange",()=>{
 if(document.fullscreenElement!==stage&&!cssImmersive){
   stage.classList.remove("immersive");
   document.body.classList.remove("immersive");
 }
 syncFullscreenButton();lastTime=0;
});
window.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&cssImmersive){
   cssImmersive=false;stage.classList.remove("immersive");
   document.body.classList.remove("immersive");syncFullscreenButton();
 }
});
syncFullscreenButton();
