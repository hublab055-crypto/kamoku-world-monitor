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
import {SquadEngine,RULE_METRICS,RULE_OPERATORS,RULE_ACTIONS} from "./squad.mjs";

const $=id=>document.getElementById(id);
const SAVE_KEY="universal-engine:explorer:v0.7d";
const V07C_SAVE_KEY="universal-engine:explorer:v0.7c";
const V07B_SAVE_KEY="universal-engine:explorer:v0.7b";
const PREVIOUS_SAVE_KEY="universal-engine:explorer:v0.7a";
const LEGACY_SAVE_KEY="universal-engine:explorer:v1";
let planet,terrain,weather,controller,renderer,universe,simWorld,actions,squad;
let rtsMode=false,rtsPreviousCamera="follow",rtsMulti=false,rallyPicking=false,autoActorId="player";
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
  squad=new SquadEngine(terrain,controller,actions,saved?.v0_7d?.squad||null);
  renderer.squad=squad;
  renderer.cameraController=saved?.v0_7c?.camera?
    CameraController.fromSnapshot(saved.v0_7c.camera):new CameraController();
  if(!saved)renderer.cameraController.setMode("follow",controller,
    terrainSurface(terrain,controller.lat,controller.lon).elevationM);
  syncCameraControls();
  rtsMode=false;rtsMulti=false;rallyPicking=false;
  autoActorId=squad.selectedAgents()[0]?.id||"player";
  syncSquadUi();
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
  const manualLead=Math.abs(input.forward)+Math.abs(input.strafe)+Math.abs(input.turn)>.1;
  squad?.advance(running?dt:0,{manualLead});
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
   updateRtsMarkers(renderer.screenActors);
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
 const sunLevel=planet.illumination(controller.lat,controller.lon);
 $("sunlight").textContent=Math.round(sunLevel*100)+"%";
 $("world").dataset.sky=sunLevel<.08?"night":sunLevel<.35?"dusk":"day";
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
 $("viewport-controls").textContent=controlMode==="stick"?"● スティック":"◎ タップ移動";
 $("viewport-controls").setAttribute("aria-label","移動方法の切替。現在："+(controlMode==="stick"?"スティック":"タップ"));
 $("stick-area").hidden=rtsMode||controlMode!=="stick"||!isSurface;
 $("action-pad").hidden=rtsMode||!isSurface;
 $("rts-controls").hidden=!rtsMode||!isSurface;
 $("rts-summary").textContent="選択: "+squad.selectedAgents().map(a=>a.name).join("・");
 $("viewport-rts").setAttribute("aria-pressed",String(rtsMode));
 $("viewport-rts").textContent=rtsMode?"⚓ RTS終了":"⚓ RTS視点";
 $("rts-multi").setAttribute("aria-pressed",String(rtsMulti));
 $("rts-rally").setAttribute("aria-pressed",String(rallyPicking));
 $("rts-rally").textContent=rallyPicking?"地面をタップ":"集合地点";
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
   v0_7c:{schemaVersion:1,camera:renderer.cameraController.snapshot()},
   v0_7d:{schemaVersion:1,squad:squad.snapshot()}};
  localStorage.setItem(SAVE_KEY,JSON.stringify(data));
  log("v0.7d：条件分岐と3人の部隊、カメラ・進行状況を保存しました。旧版は変更していません。");
 }catch(e){log("保存に失敗: "+e.message);}
});
$("restore").addEventListener("click",()=>{
 try{
  const data=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("対応する保存データがありません。");
  running=false;init(data);updateHUD();
 }catch(e){log("復元失敗: "+e.message);}
});
$("import-v07c-save").addEventListener("click",()=>{
 try{
  const data=JSON.parse(localStorage.getItem(V07C_SAVE_KEY)||"null");
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("旧v0.7cデータがありません。");
  running=false;init(data);updateHUD();
  log("v0.7c保存を読み込みました（旧保存は書き換えません）。");
 }catch(e){log("v0.7c読込失敗: "+e.message);}
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
 if(rtsMode&&!pointer.moved&&controller.nearGround){
  commandRtsTap(e.clientX,e.clientY,e.shiftKey);
 }else if(controlMode==="tap"&&!pointer.moved&&controller.nearGround){
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
  squad?.repositionAfterLanding();
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
 const quickLabels={legacy:"従来",follow:"追従",shoulder:"肩越し",free:"自由",orbitTarget:"人物注視",tactical:"俯瞰"};
 $("viewport-camera").textContent="◉ "+(quickLabels[camera.mode]||"カメラ");
 $("viewport-camera").setAttribute("aria-label","カメラ切替。現在："+$("camera-mode-label").textContent);
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

/* ⚓ Tactical RTS controls and eight-slot IF -> THEN automation editor. */
const RTS_METRICS={wood:"木材",stone:"石材",houses:"完成小屋",idle:"待機 0/1",distance:"隊長との距離(m)",walked:"累計歩行(m)"};
const RTS_ACTIONS={gather_wood:"木材を採集",gather_stone:"石材を採集",build:"小屋を建築",
 move_rally:"集合地点へ移動",follow:"隊長を追従",patrol:"集合地点付近を巡回",wait:"待機"};
function renderAutoEditor(){
 if(!squad)return;
 const actor=squad.get(autoActorId)||squad.get("player");
 $("auto-actor").value=actor.id;
 $("auto-enabled").checked=actor.auto;
 $("auto-actor-list").replaceChildren();
 for(const a of squad.agents){
  const btn=document.createElement("button");btn.type="button";
  btn.textContent=a.name+" "+(a.auto?"● 自動":"○ 手動")+" / "+a.status;
  btn.className=a.id===actor.id?"current":"";
  btn.addEventListener("click",()=>{
   autoActorId=a.id;squad.choose(a.id);renderAutoEditor();updateHUD();
  });
  $("auto-actor-list").append(btn);
 }
 const options=(items,selected,labeler)=>items.map(v=>
  '<option value="'+v+'"'+(v===selected?' selected':'')+'>'+labeler(v)+'</option>').join("");
 $("auto-rule-list").innerHTML=actor.rules.map((rule,index)=>
  '<div class="auto-rule" data-slot="'+index+'">'+
  '<label class="rule-enable"><input type="checkbox" data-field="enabled"'+(rule.enabled?' checked':'')+'> '+(index+1)+'</label>'+
  '<label>IF <select data-field="metric">'+options(RULE_METRICS,rule.metric,v=>RTS_METRICS[v])+'</select></label>'+
  '<label>比較 <select data-field="op">'+options(RULE_OPERATORS,rule.op,v=>v)+'</select></label>'+
  '<label>値 <input type="number" data-field="value" step="any" min="-1000000" max="1000000" value="'+rule.value+'"></label>'+
  '<label>THEN <select data-field="action">'+options(RULE_ACTIONS,rule.action,v=>RTS_ACTIONS[v])+'</select></label>'+
  '</div>').join("");
}
function syncSquadUi(){renderAutoEditor();updateHUD();}
function openAutoEditor(open){
 $("auto-panel").hidden=!open;
 $("viewport-auto").setAttribute("aria-expanded",String(open));
 if(open){renderAutoEditor();$("auto-status").textContent="選択中の人物の条件を編集できます。";}
}
$("viewport-auto").addEventListener("click",()=>openAutoEditor($("auto-panel").hidden));
$("toolbar-auto").addEventListener("click",()=>openAutoEditor(true));
$("auto-close").addEventListener("click",()=>openAutoEditor(false));
$("auto-actor").addEventListener("change",()=>{
 autoActorId=$("auto-actor").value;squad.choose(autoActorId);renderAutoEditor();updateHUD();
});
$("auto-enabled").addEventListener("change",()=>{
 squad.setAuto([autoActorId],$("auto-enabled").checked);
 renderAutoEditor();updateHUD();
});
$("auto-rule-list").addEventListener("change",e=>{
 const row=e.target.closest("[data-slot]");if(!row)return;
 const index=Number(row.dataset.slot);
 try{
  const rule={
   enabled:row.querySelector('[data-field="enabled"]').checked,
   metric:row.querySelector('[data-field="metric"]').value,
   op:row.querySelector('[data-field="op"]').value,
   value:Number(row.querySelector('[data-field="value"]').value),
   action:row.querySelector('[data-field="action"]').value
  };
  squad.setRule(autoActorId,index,rule);
  $("auto-status").textContent=(index+1)+"番の条件を更新しました。保存ボタンで記録できます。";
 }catch(err){$("auto-status").textContent="設定エラー: "+err.message;renderAutoEditor();}
});
$("auto-all-on").addEventListener("click",()=>{
 squad.setAuto(squad.agents.map(a=>a.id),true);renderAutoEditor();updateHUD();
});
$("auto-all-off").addEventListener("click",()=>{
 squad.setAuto(squad.agents.map(a=>a.id),false);renderAutoEditor();updateHUD();
});
$("auto-rally").addEventListener("click",()=>{
 squad.setRally(squad.selected.size?[...squad.selected]:[autoActorId],controller.x,controller.z);
 $("auto-status").textContent="隊長の現在地点を集合位置に設定しました。";
});
function toggleRts(){
 if(!rtsMode){
  if(!controller.nearGround){log("RTS操作は地表へ降下してから使えます。");setAltitude(2.5);return;}
  rtsPreviousCamera=renderer.cameraController.mode;
  rtsMode=true;
  setCameraMode("tactical");
  renderer.cameraController.setValue("tacticalHeightM",45);
  setControlMode("tap");
  log("⚓ RTS：人物をタップして選択、地面をタップして移動。全員選択も可能です。");
 }else{
  rtsMode=false;rtsMulti=false;rallyPicking=false;
  setCameraMode(rtsPreviousCamera==="tactical"?"follow":rtsPreviousCamera);
  setControlMode("stick");
 }
 updateHUD();
}
$("viewport-rts").addEventListener("click",toggleRts);
$("toolbar-rts").addEventListener("click",toggleRts);
$("rts-all").addEventListener("click",()=>{squad.selectAll();autoActorId="player";renderAutoEditor();updateHUD();});
$("rts-multi").addEventListener("click",()=>{rtsMulti=!rtsMulti;updateHUD();});
$("rts-rally").addEventListener("click",()=>{
 rallyPicking=!rallyPicking;updateHUD();
});
$("rts-stop").addEventListener("click",()=>{
 squad.halt([...squad.selected]);updateHUD();log("選択した人物の移動を停止しました。");
});
function commandRtsTap(clientX,clientY,shift=false){
 const rect=$("world").getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 const u=(clientX-rect.left)/rect.width,v=(clientY-rect.top)/rect.height;
 const nearest=(renderer.screenActors||[])
  .filter(p=>p.onScreen&&Math.hypot((p.u-u)*rect.width,(p.v-v)*rect.height)<42)
  .sort((a,b)=>Math.hypot((a.u-u)*rect.width,(a.v-v)*rect.height)-
   Math.hypot((b.u-u)*rect.width,(b.v-v)*rect.height))[0];
 if(nearest&&!rallyPicking){
  squad.choose(nearest.id,{add:rtsMulti||shift});
  autoActorId=nearest.id;renderAutoEditor();log(nearest.name+" を選択しました。");updateHUD();
  return;
 }
 const hit=renderer.pickGround(clientX,clientY);
 if(!hit){log("地面をタップして指示してください。");return;}
 if(rallyPicking){
  squad.setRally([...squad.selected],hit.x,hit.z);rallyPicking=false;
  log("選択した人物の集合地点を設定しました。");
 }else{
  const moved=squad.orderMove([...squad.selected],hit.x,hit.z);
  log(moved?moved+"人に移動を指示しました。":"移動不可：水域・急斜面・遠すぎる地点です。");
 }
 updateHUD();
}
const rtsNodes=new Map();
function updateRtsMarkers(projected){
 const root=$("rts-markers");
 if(!rtsMode||!controller.nearGround){root.hidden=true;return;}
 root.hidden=false;
 for(const agent of squad.agents){
  let node=rtsNodes.get(agent.id);
  if(!node){
   node=document.createElement("span");node.className="rts-label";
   root.append(node);rtsNodes.set(agent.id,node);
  }
  const point=projected?.find(p=>p.id===agent.id&&p.onScreen);
  node.hidden=!point;
  if(!point)continue;
  node.style.left=(point.u*100)+"%";node.style.top=(point.v*100)+"%";
  node.classList.toggle("selected",squad.selected.has(agent.id));
  node.textContent=agent.name+(agent.auto?" ⚙":"");
 }
}

init();requestAnimationFrame(doFrame);

/* v0.7c mobile patch: game-first viewport and explicit exit on iPhone Safari. */
const stage=document.querySelector(".view-panel");
const fullBtn=$("fullscreen-toggle");
const mobileViewportPref="universal-engine:mobile-expanded:v1";
let cssImmersive=false;
function enlarged(){return cssImmersive||document.fullscreenElement===stage;}
function setCssImmersive(on){
 cssImmersive=Boolean(on);
 stage.classList.toggle("immersive",cssImmersive);
 document.body.classList.toggle("immersive",cssImmersive);
}
function rememberViewport(on){
 try{sessionStorage.setItem(mobileViewportPref,on?"1":"0");}catch(e){/* Storage unavailable. */}
}
function syncFullscreenButton(){
 const on=enlarged();
 fullBtn.textContent=on?"⤡ 元の画面へ戻す":"⛶ 画面を広げる";
 fullBtn.setAttribute("aria-pressed",String(on));
 fullBtn.setAttribute("aria-label",on?"通常表示に戻す":"画面を最大化");
 $("viewport-expand").textContent=on?"⤡ 戻る":"⛶ 全画面";
 $("viewport-expand").setAttribute("aria-pressed",String(on));
 $("viewport-expand").setAttribute("aria-label",on?"通常表示に戻す":"画面を最大化");
 if(!on)stage.classList.remove("hud-tools-open");
 $("viewport-menu").setAttribute("aria-expanded",String(stage.classList.contains("hud-tools-open")));
}
async function switchFullscreen(){
 if(enlarged()){
  setCssImmersive(false);stage.classList.remove("hud-tools-open");
  if(document.fullscreenElement===stage&&document.exitFullscreen){
   try{await document.exitFullscreen();}catch(e){log("全画面の解除に失敗しました: "+e.message);}
  }
 }else{
  let nativeOpened=false;
  if(typeof stage.requestFullscreen==="function"){
   try{
    await stage.requestFullscreen({navigationUI:"hide"});
    nativeOpened=document.fullscreenElement===stage;
   }catch(e){/* iPhone Safari normally denies element fullscreen. */}
  }
  if(!nativeOpened)setCssImmersive(true);
 }
 rememberViewport(enlarged());syncFullscreenButton();lastTime=0;
}
fullBtn.addEventListener("click",()=>{void switchFullscreen();});
$("viewport-expand").addEventListener("click",()=>{void switchFullscreen();});
$("viewport-camera").addEventListener("click",()=>{
 const sequence=["follow","shoulder","orbitTarget","tactical","free","legacy"];
 const current=renderer.cameraController.mode;
 setCameraMode(sequence[(sequence.indexOf(current)+1)%sequence.length]);
});
$("viewport-controls").addEventListener("click",()=>setControlMode(controlMode==="stick"?"tap":"stick"));
$("viewport-menu").addEventListener("click",()=>{
 if(enlarged()){stage.classList.toggle("hud-tools-open");syncFullscreenButton();}
 else $("viewport-toolbar").scrollIntoView({behavior:"smooth",block:"nearest"});
});
document.addEventListener("fullscreenchange",()=>{
 if(document.fullscreenElement!==stage&&!cssImmersive){
  stage.classList.remove("immersive");document.body.classList.remove("immersive");
 }
 syncFullscreenButton();lastTime=0;
});
window.addEventListener("keydown",e=>{
 if(e.key==="Escape"&&cssImmersive){
  setCssImmersive(false);stage.classList.remove("hud-tools-open");
  rememberViewport(false);syncFullscreenButton();
 }
});
/* Mobile opens directly into the 3D play view once per tab, unless the player
   manually exited. This preference is separate from versioned game saves. */
if(typeof window.matchMedia==="function"&&window.matchMedia("(max-width:760px) and (pointer:coarse)").matches){
 let pref=null;
 try{pref=sessionStorage.getItem(mobileViewportPref);}catch(e){/* no storage */}
 if(pref!=="0")setCssImmersive(true);
}
syncFullscreenButton();
