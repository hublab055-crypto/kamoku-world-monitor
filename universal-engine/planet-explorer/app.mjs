import {Multiverse} from "../core.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {Weather} from "../planet/weather-engine.mjs";
import {ExplorerController} from "./controller.mjs";
import {findLand,terrainSurface} from "./geo.mjs";
import {ExplorerRenderer} from "./render.mjs";
import {Actions} from "./actions.mjs";
import {HutAccess,HUT} from "./buildings.mjs";
import {BOOK_MAP,BookCollection,pagesForBook} from "./books.mjs";
import {Lifestyle} from "./lifestyle.mjs";
import {installLifestyleUI} from "./lifestyle-ui.mjs";
import {createAppearance,restoreAppearance,withOutfit,withAppearanceSlot,OUTFITS} from "./wardrobe.mjs";
import {ExpressionController,EXPRESSIONS} from "./expression.mjs";
import {CameraController,CAMERA_MODES} from "./camera-controller.mjs";
import {SquadEngine,RULE_METRICS,RULE_OPERATORS,RULE_ACTIONS} from "./squad.mjs";
import {installFrontierInteractions} from "./frontier-interaction-ui.mjs";

const $=id=>document.getElementById(id);
const SAVE_KEY="universal-engine:explorer:v0.7g";
const V07D_SAVE_KEY="universal-engine:explorer:v0.7d";
const LIFE_JOURNAL_KEY="universal-engine:explorer:life:v1";
const V07C_SAVE_KEY="universal-engine:explorer:v0.7c";
const V07B_SAVE_KEY="universal-engine:explorer:v0.7b";
const PREVIOUS_SAVE_KEY="universal-engine:explorer:v0.7a";
const LEGACY_SAVE_KEY="universal-engine:explorer:v1";
let planet,terrain,weather,controller,renderer,universe,simWorld,actions,squad,access;
let books=new BookCollection(),activeBookId=null,life=new Lifestyle(),lifeUI=null;
function loadLifeJournal(){
 try{return JSON.parse(localStorage.getItem(LIFE_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveLifeJournal(){
 try{localStorage.setItem(LIFE_JOURNAL_KEY,JSON.stringify({life:life.snapshot(),resources:actions.resources}));}
 catch(_){log("生活データの自動保存に失敗しました。");}
}
const BOOK_JOURNAL_KEY="universal-engine:explorer:reading:v1";
function loadBookJournal(){
 try{return JSON.parse(localStorage.getItem(BOOK_JOURNAL_KEY)||"null");}
 catch(_){return null;}
}
function saveBookJournal(){
 try{localStorage.setItem(BOOK_JOURNAL_KEY,JSON.stringify(books.snapshot()));}
 catch(_){log("しおりの自動保存ができません。ゲーム全体の保存をお試しください。");}
}
let rtsMode=false,rtsPreviousCamera="follow",rtsMulti=false,rallyPicking=false,autoActorId="player";
let controlMode="stick",stick={x:0,y:0},stickPointer=null;
let running=true,lastTime=0,frameTime=0,frameCount=0,displayMode="",lastHud=0;
let avatarStyle="pioneer",appearance=createAppearance(),lastExpressionPreset="neutral";
let frontierUI=null;
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
   access=new HutAccess(actions,{insideId:saved?.v0_7e?.insideId??null});
   books=new BookCollection(saved?.v0_7f||loadBookJournal());
   const journal=!saved?loadLifeJournal():null;
   life=new Lifestyle(saved?.v0_7g||journal?.life||null);
   if(journal?.resources&&!saved){
    for(const k of ["wood","stone","fiber","clay","metal"])
     if(Number.isSafeInteger(journal.resources[k])&&journal.resources[k]>=0)actions.resources[k]=journal.resources[k];
   }
   for(const hut of actions.structures.filter(h=>h.progress>=1))life.ensureHut(hut);
   activeBookId=null;
   $("book-overlay").hidden=true;
   $("life-overlay").hidden=true;
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
  renderer.sceneActions=actions;renderer.sceneLife=life;
   renderer.interiorBuildingId=access.insideId;
  squad=new SquadEngine(terrain,controller,actions,saved?.v0_7d?.squad||null);
  renderer.squad=squad;
  squad.attachLifestyle(life);renderer.sceneFrontier=squad.frontier;
  frontierUI?.restore(saved?.v0_7i||null);
  void frontierUI?.loadModels(renderer);
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
  const input=$("book-overlay").hidden&&$("life-overlay").hidden?inputVector():{forward:0,strafe:0,turn:0};
   const previous={x:controller.x,z:controller.z,lat:controller.lat,lon:controller.lon};
  const manualLead=Math.abs(input.forward)+Math.abs(input.strafe)+Math.abs(input.turn)>.1;
  squad?.advance(running?dt:0,{manualLead});
  frontierUI?.updateCamera();
  if(renderer.cameraController.mode==="free"){
   renderer.cameraController.pan(dt,input.forward,input.strafe);
   controller.update(dt,{forward:0,strafe:0,turn:0});
  }else controller.update(dt,input);
  const transition=access.guard(previous,controller);
   if(transition==="enter")log("🏠 ドアを通って小屋に入りました。");
   if(transition==="exit")log("🌿 ドアから小屋の外に出ました。");
   if(life.guardCamp(controller)==="exit")log("⛺ テントの外に出ました。");
   if(access.pendingDoorId&&!access.inside&&controller.nearGround){
    const b=access.find(access.pendingDoorId);
    if(!b)access.pendingDoorId=null;
    else if(Math.hypot(controller.x-b.x,controller.z-b.z-HUT.halfDepth-.13)<=HUT.reach){
     access.pendingDoorId=null;if(!b.doorOpen)log(access.toggle(b,controller).message);
    }else if(!controller.moveTarget)access.pendingDoorId=null;
   }
   renderer.interiorBuildingId=access.insideId;
   const completed=actions.advance(dt);
   for(const hut of actions.structures.filter(h=>h.progress>=1))life.ensureHut(hut);
   life.advance(dt,controller.moving);
   renderer.sceneLife=life;
  if(completed){log(actions.message);saveLifeJournal();}
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
 $("action-state").textContent=access.inside?"🏠 屋内（小屋 #"+access.inside.id+"）":actions.message;
  syncDoorUi();
 $("customization-status").textContent=
   (OUTFITS.find(x=>x.id===appearance.presetId)?.name||appearance.presetId)+"・"+
   (EXPRESSIONS.find(x=>x[0]===renderer.expression.preset)?.[1]||renderer.expression.preset);
 $("materials").textContent="木 "+actions.resources.wood+" / 石 "+actions.resources.stone+
   " / 繊維 "+actions.resources.fiber+" / 粘土 "+actions.resources.clay+" / 金属 "+actions.resources.metal;
  lifeUI?.updateStats();
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
  if(rtsMode||!isSurface)setToolMenu(false);
 $("rts-controls").hidden=!rtsMode||!isSurface;
 $("rts-summary").textContent="選択: "+squad.selectedAgents().map(a=>a.name).join("・");
 $("viewport-rts").setAttribute("aria-pressed",String(rtsMode));
 frontierUI?.quick();
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
   v0_7d:{schemaVersion:1,squad:squad.snapshot()},v0_7e:access.snapshot(),
    v0_7f:books.snapshot(),v0_7g:life.snapshot(),v0_7i:frontierUI?.snapshot()};
  localStorage.setItem(SAVE_KEY,JSON.stringify(data));
  log("v0.7g：家具・食器・野営・読書・3人の部隊を保存しました。旧版の保存は上書きしません。");
 }catch(e){log("保存に失敗: "+e.message);}
});
$("restore").addEventListener("click",()=>{
 try{
  const data=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("対応する保存データがありません。");
  running=false;init(data);updateHUD();
 }catch(e){log("復元失敗: "+e.message);}
});
$("import-v07d-save").addEventListener("click",()=>{
  try{
   const data=JSON.parse(localStorage.getItem(V07D_SAVE_KEY)||"null");
   if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("旧v0.7dセーブがありません。");
   running=false;init(data);updateHUD();
   log("v0.7dセーブを取り込みました。元の保存データは変更していません。");
  }catch(e){log("v0.7d読込失敗: "+e.message);}
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
$("reset").addEventListener("click",()=>{
  try{localStorage.removeItem(LIFE_JOURNAL_KEY);}catch(_){}
  running=true;init();updateHUD();
 });
window.addEventListener("keydown",e=>{
 if(e.target?.closest?.("input,select,textarea,[contenteditable=true]"))return;
 const k=e.key.toLowerCase();
 if(["w","a","s","d","q","e","arrowup","arrowdown","arrowleft","arrowright","+","-"].includes(k)){
  if(e.target===document.body)e.preventDefault();
  if(k==="arrowleft")keys.add("q");
  else if(k==="arrowright")keys.add("e");
  else keys.add(k);
 }
 if(k==="f"){e.preventDefault();interactDoor();return;}
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
 if(!rtsMode&&!pointer.moved){
   const hit=renderer.pickLife(e.clientX,e.clientY);
   if(hit){
    if(hit.type==="furniture"&&hit.kind==="bookshelf")openBookLibrary();
    else lifeUI.open(hit.type==="camp"?"camp":"home",hit.id);
    pointer=null;return;
   }
  }
  if(!rtsMode&&!pointer.moved&&access.inside&&renderer.pickBookshelf(e.clientX,e.clientY)){
   openBookLibrary();pointer=null;return;
  }
  if(!rtsMode&&!pointer.moved&&controller.nearGround){
   const door=renderer.pickDoor(e.clientX,e.clientY);
   if(door){tapDoor(door.id);pointer=null;return;}
  }
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
/* Cabin interaction: tapping the door approaches/opens it; buttons handle entry/exit. */
 function performDoor(result){log(result.message);updateHUD();}
 function tapDoor(id){
  const hut=access.find(id);if(!hut)return;
  if(access.inside){
   if(access.inside.id===hut.id)performDoor(access.toggle(hut,controller));
   return;
  }
  if(access.nearby(controller)?.id===hut.id){performDoor(access.toggle(hut,controller));return;}
  if(controller.setMoveTarget(hut.x,hut.z+HUT.halfDepth+1.08)){
   access.pendingDoorId=hut.id;log("🚶 ドアに向かいます。近づいたら開きます。");
  }else log("ドアまで移動できませんでした。");
 }
 function interactDoor(){
  const hut=access.inside||access.nearby(controller);
  if(!hut){log("🚪 完成した小屋の入口へ近づいてください。");return;}
  performDoor(access.toggle(hut,controller));
 }
 function syncDoorUi(){
  const inside=access.inside,near=inside||access.nearby(controller);
  const node=$("door-controls");if(!node)return;
  const active=controller.nearGround&&!rtsMode&&Boolean(near);
  node.hidden=!active;
  if(!active){setDoorMenu(false);return;}
  $("door-toggle").textContent=near.doorOpen?"🚪 閉める":"🚪 開ける";
  $("door-enter").hidden=!!inside||!near.doorOpen;
  $("door-exit").hidden=!inside;
  $("door-shelf").hidden=!inside;
 }
 $("door-toggle").addEventListener("click",interactDoor);
 $("door-enter").addEventListener("click",()=>{
  const hut=access.nearby(controller);if(hut)performDoor(access.enter(hut,controller));
 });
 $("door-exit").addEventListener("click",()=>performDoor(access.exit(controller)));
 
/* v0.7f - reader is inside the game, not an external web page. */
let bookDialogReturnFocus=null;
function closeBookDialog(){
 $("book-overlay").hidden=true;
 activeBookId=null;
 bookDialogReturnFocus?.focus?.();
}
function openBookLibrary(){
 bookDialogReturnFocus=document.activeElement;
 controller.clearMoveTarget();
 keys.clear();touches.clear();stick={x:0,y:0};
 $("stick-nub").style.transform="translate(0px,0px)";
 $("book-overlay").hidden=false;
 activeBookId=null;
 renderBookLibrary();
 $("book-close").focus();
}
function renderBookLibrary(){
 $("book-reading").hidden=true;$("book-library").hidden=false;
 const hut=access.inside,library=books.available(hut),list=$("book-library-list");
 list.replaceChildren();
 $("book-heading").textContent=hut?"📚 小屋の本棚と持ち物":"📖 持ち歩いている本";
 $("book-library-status").textContent=hut?
  "表紙を選ぶと本を開けます。持ち出すと、野外でも「📖 読書」から開けます。":
  "持ち歩いている本はどこでも読めます。小屋の本棚で本を手に取ってください。";
 if(!library.length){
  const empty=document.createElement("p");empty.className="book-library-status";
  empty.textContent="まだ本がありません。小屋の中に入って、本棚を開きましょう。";
  list.append(empty);return;
 }
 for(const book of library){
  const card=document.createElement("article");card.className="book-volume";
  const title=document.createElement("h3");title.textContent="📕 "+book.title;
  const author=document.createElement("small");author.textContent=book.author+" ／ "+book.genre;
  const summary=document.createElement("p");summary.textContent=book.summary;
  const total=pagesForBook(book).length,page=books.page(book.id)+1;
  const progress=document.createElement("small");
  progress.textContent="しおり "+page+" / "+total+" ページ"+(books.carried.includes(book.id)?"　🎒 所持中":"　📚 本棚");
  const buttons=document.createElement("div");buttons.className="book-buttons";
  const open=document.createElement("button");open.type="button";open.dataset.bookOpen=book.id;
  open.textContent=page>1?"📖 続きから読む":"📖 読み始める";
  buttons.append(open);
  if(hut){
   const carry=document.createElement("button");carry.type="button";
   if(books.carried.includes(book.id)){
    carry.dataset.bookReturn=book.id;carry.textContent="📚 本棚に戻す";
   }else{
    carry.dataset.bookTake=book.id;carry.textContent="🎒 持ち出す";
   }
   buttons.append(carry);
  }
  card.append(title,author,summary,progress,buttons);list.append(card);
 }
}
function openBook(bookId){
 const book=BOOK_MAP.get(bookId);if(!book||!books.has(bookId,access.inside))return;
 activeBookId=bookId;
 if(life.readPage(bookId,books.page(bookId)))saveLifeJournal();
 $("book-library").hidden=true;$("book-reading").hidden=false;
 $("book-heading").textContent="📖 読書中";
 $("book-title").textContent=book.title;
 $("book-author").textContent=book.author;
 renderBookPage();
 $("book-paper").focus();
}
function renderBookPage(){
 const book=BOOK_MAP.get(activeBookId);if(!book)return;
 const pages=pagesForBook(book),index=Math.min(books.page(book.id),pages.length-1);
 const current=pages[index],root=$("book-text");
 $("book-chapter").textContent=current.chapter;
 root.replaceChildren();
 for(const text of current.text.split(/\n\n/)){
  const p=document.createElement("p");p.textContent=text;root.append(p);
 }
 root.style.setProperty("--book-font-size",books.fontSize+"px");
 $("book-page-no").textContent=(index+1)+" / "+pages.length;
 $("book-prev").disabled=index===0;
 $("book-next").disabled=index===pages.length-1;
 $("book-paper").scrollTop=0;
}
function moveBookPage(delta){
 const book=BOOK_MAP.get(activeBookId);if(!book)return;
 const target=Math.max(0,Math.min(pagesForBook(book).length-1,books.page(book.id)+delta));
 if(books.bookmark(book.id,target)){
   if(life.readPage(book.id,target))saveLifeJournal();
   saveBookJournal();renderBookPage();
  }
}
$("viewport-books").addEventListener("click",openBookLibrary);
$("toolbar-books").addEventListener("click",openBookLibrary);
$("door-shelf").addEventListener("click",openBookLibrary);
$("book-close").addEventListener("click",closeBookDialog);
$("book-back").addEventListener("click",()=>{
 activeBookId=null;renderBookLibrary();$("book-close").focus();
});
$("book-prev").addEventListener("click",()=>moveBookPage(-1));
$("book-next").addEventListener("click",()=>moveBookPage(1));
$("book-font-down").addEventListener("click",()=>{
 books.fontSize=Math.max(15,books.fontSize-2);saveBookJournal();renderBookPage();
});
$("book-font-up").addEventListener("click",()=>{
 books.fontSize=Math.min(26,books.fontSize+2);saveBookJournal();renderBookPage();
});
$("book-library-list").addEventListener("click",event=>{
 const button=event.target.closest("button");if(!button)return;
 const id=button.dataset.bookOpen||button.dataset.bookTake||button.dataset.bookReturn;
 if(!id||!BOOK_MAP.has(id))return;
 if(button.dataset.bookOpen){openBook(id);return;}
 const hut=access.inside;
 if(!hut)return;
 if(button.dataset.bookTake){
  if(books.take(id,hut)){saveBookJournal();log("📚 「"+BOOK_MAP.get(id).title+"」を持ち物に入れました。");}
 }else if(button.dataset.bookReturn){
  if(books.putBack(id,hut)){saveBookJournal();log("📚 「"+BOOK_MAP.get(id).title+"」を本棚に戻しました。");}
 }
 renderBookLibrary();
});
window.addEventListener("keydown",event=>{
 if($("book-overlay").hidden)return;
 if(event.key==="Escape"){event.preventDefault();closeBookDialog();}
 else if(activeBookId&&event.key==="ArrowRight"){event.preventDefault();moveBookPage(1);}
 else if(activeBookId&&event.key==="ArrowLeft"){event.preventDefault();moveBookPage(-1);}
 else if(["w","a","s","d","q","e","f","ArrowUp","ArrowDown"].includes(event.key))event.preventDefault();
 event.stopImmediatePropagation();
},true);

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
const RTS_METRICS={wood:"木材",stone:"石材",houses:"完成小屋",idle:"待機 0/1",distance:"隊長との距離(m)",walked:"累計歩行(m)",stamina:"⚡スタミナ%",load_kg:"🎒重量kg",resource_nearby:"🌿半径内の資源数"};
const RTS_ACTIONS={gather_wood:"木材を採集",gather_stone:"石材を採集",build:"小屋を建築",
 move_rally:"集合地点へ移動",follow:"隊長を追従",patrol:"集合地点付近を巡回",wait:"待機",rest_home:"💤家で100%まで休息",store_chest:"📦チェストに全収納",gather_nearby:"🧺範囲内の資源を全回収"};

function renderFrontierEditor(actor){
 let panel=document.getElementById("fw-life-gambit");
 if(!panel){
  panel=document.createElement("div");panel.id="fw-life-gambit";panel.className="fw-life-gambit";
  panel.style.cssText="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:8px 0;padding:8px;background:#15394a;border:1px solid #6ca5ad;border-radius:9px;font-size:11px";
  panel.innerHTML='<strong style="width:100%">🌿 Frontier World 生活AI</strong>'+
    '<span data-fw="stats" style="flex:1 1 100%"></span>'+
    '<button type="button" data-fw="preset">💤休息→📦収納→🧺全回収</button>'+
    '<label>半径 <output data-fw="radiusText"></output> <input type="range" data-fw="radius" min="5" max="100" style="width:95px;accent-color:#8fe5c3"></label>'+
    '<button type="button" data-fw="origin">📍現在地を中心に</button>';
  document.getElementById("auto-rule-list").before(panel);
  panel.addEventListener("click",event=>{
   const button=event.target.closest("button[data-fw]");if(!button)return;
   const id=autoActorId;
   if(button.dataset.fw==="preset"){
    squad.frontier.applyPreset(id);$("auto-status").textContent="優先1：30%以下→100%まで休息 / 2：18kg以上→全収納 / 3：範囲内全回収（4〜8は維持）";
   }
   if(button.dataset.fw==="origin")squad.frontier.setOrigin(id);
   renderAutoEditor();
  });
  panel.querySelector('[data-fw="radius"]').addEventListener("change",event=>{
   squad.frontier.setRadius(autoActorId,event.target.value);renderAutoEditor();
  });
 }
 const fw=squad.frontier.person(actor.id),home=squad.frontier.home(actor);
 const stored=squad.frontier.stored();
 panel.querySelector('[data-fw="stats"]').textContent="⚡ "+fw.stamina.toFixed(1)+"% / 🎒 "+squad.frontier.loadKg(actor.id)+"kg / 🌲 資源"+squad.frontier.metrics(actor).resource_nearby+" / "+(home.kind==="hut"?"🏠家":"⛺仮拠点")+" / 収納:木"+stored.wood+" 石"+stored.stone+" 食材"+stored.food;
 panel.querySelector('[data-fw="radius"]').value=fw.radius;
 panel.querySelector('[data-fw="radiusText"]').textContent=fw.radius+"m";
}

function renderAutoEditor(){
 if(!squad)return;
 const actor=squad.get(autoActorId)||squad.get("player");
 $("auto-actor").value=actor.id;
 $("auto-enabled").checked=actor.auto;
 renderFrontierEditor(actor);
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

 $("auto-rule-list").querySelectorAll(".auto-rule").forEach((row,i)=>{
  const wrap=document.createElement("div");wrap.style.cssText="display:flex;grid-column:1/-1;justify-content:flex-end;gap:5px";
  for(const delta of [-1,1]){
   const b=document.createElement("button");b.type="button";b.textContent=delta<0?"↑ 優先":"↓ 優先";
   b.dataset.order=String(delta);b.disabled=(i===0&&delta<0)||(i===actor.rules.length-1&&delta>0);
   b.style.cssText="padding:3px 9px;min-height:27px";wrap.append(b);
  }
  row.append(wrap);
 });
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
$("auto-rule-list").addEventListener("click",e=>{
 const button=e.target.closest("button[data-order]");if(!button)return;
 const row=button.closest("[data-slot]"),i=Number(row.dataset.slot),j=i+Number(button.dataset.order),actor=squad.get(autoActorId);
 if(j<0||j>=actor.rules.length)return;
 [actor.rules[i],actor.rules[j]]=[actor.rules[j],actor.rules[i]];
 squad.frontier.cancel(actor);renderAutoEditor();
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
 squad.halt([...squad.selected]);renderAutoEditor();updateHUD();log("選択した人物の移動と自動行動を停止しました。");
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


/* v0.7h Compact HUD: collapse large toolbars, retaining all existing actions. */
const quickToggle=$("viewport-quick-toggle"),quickPanel=$("viewport-quick-panel");
const toolToggle=$("action-tools-toggle"),toolPanel=$("action-tool-list");
const doorToggle=$("door-actions-toggle"),doorPanel=$("door-options");
function setQuickMenu(open){
 quickPanel.hidden=!open;quickToggle.setAttribute("aria-expanded",String(open));
 quickToggle.setAttribute("aria-label",open?"操作メニューを閉じる":"操作メニューを開く");
 quickToggle.textContent=open?"× 閉じる":"☰ 操作";
 if(open){setToolMenu(false);setDoorMenu(false);}
}
function setToolMenu(open){
 toolPanel.hidden=!open;toolToggle.setAttribute("aria-expanded",String(open));
 toolToggle.setAttribute("aria-label",open?"道具メニューを閉じる":"道具メニューを開く");
 if(open){setQuickMenu(false);setDoorMenu(false);}
}
function setDoorMenu(open){
 doorPanel.hidden=!open;doorToggle.setAttribute("aria-expanded",String(open));
 doorToggle.setAttribute("aria-label",open?"ドア操作を閉じる":"ドア操作を開く");
 if(open){setQuickMenu(false);setToolMenu(false);}
}
function closeCompactMenus(){setQuickMenu(false);setToolMenu(false);setDoorMenu(false);}
quickToggle.addEventListener("click",()=>setQuickMenu(quickPanel.hidden));
toolToggle.addEventListener("click",()=>setToolMenu(toolPanel.hidden));
doorToggle.addEventListener("click",()=>setDoorMenu(doorPanel.hidden));
quickPanel.addEventListener("click",e=>{
 if(e.target.closest("#viewport-rts,#viewport-auto,#viewport-books,#viewport-life,#viewport-menu"))setQuickMenu(false);
});
toolPanel.addEventListener("click",e=>{if(e.target.closest("button"))setToolMenu(false);});
doorPanel.addEventListener("click",e=>{if(e.target.closest("button"))setDoorMenu(false);});
$("viewport-expand").addEventListener("click",closeCompactMenus);
document.addEventListener("pointerdown",e=>{
 if(!e.target.closest(".viewport-actions"))setQuickMenu(false);
 if(!e.target.closest(".action-pad"))setToolMenu(false);
 if(!e.target.closest(".door-controls"))setDoorMenu(false);
});

lifeUI=installLifestyleUI({
  getContext:()=>({
   life,actions,access,controller,
   sample:(lat,lon)=>terrainSurface(terrain,lat,lon)
  }),
  onChange:()=>{saveLifeJournal();updateHUD();},
  onBook:openBookLibrary,
  onSleep:()=>{planet.advance(.25);updateHUD();},
  notify:log
 });
 frontierUI=installFrontierInteractions({
 get:()=>({controller,renderer,squad,actions,life,terrain,rtsMode,
  sample:(lat,lon)=>terrainSurface(terrain,lat,lon)}),
 log,updateHUD,openBookLibrary,saveLifeJournal
});
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
 if(e.key!=="Escape")return;
 if(!quickPanel.hidden||!toolPanel.hidden||!doorPanel.hidden){
  closeCompactMenus();e.preventDefault();return;
 }
 if(cssImmersive){
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
