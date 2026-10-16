import {Multiverse} from "../core.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {Weather} from "../planet/weather-engine.mjs";
import {ExplorerController} from "./controller.mjs";
import {findLand,terrainSurface} from "./geo.mjs";
import {ExplorerRenderer} from "./render.mjs";
import {Actions} from "./actions.mjs";

const $=id=>document.getElementById(id);
const SAVE_KEY="universal-engine:explorer:v1";
let planet,terrain,weather,controller,renderer,universe,simWorld,actions;
let controlMode="stick",stick={x:0,y:0},stickPointer=null;
let running=true,lastTime=0,frameTime=0,frameCount=0,displayMode="",lastHud=0;
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
  renderer.sceneActions=actions;
  keys.clear();touches.clear();stick={x:0,y:0};
  $("fatal").hidden=true;$("world").hidden=false;
  $("landing").textContent=controller.origin.lat.toFixed(3)+"°, "+controller.origin.lon.toFixed(3)+"°";
  log(saved?"保存した3D探索状態を復元しました。":"惑星を生成しました。降下して地上を歩いてみましょう。");
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
  controller.update(dt,input);
  const completed=actions.advance(dt);
  if(completed)log(actions.message);
  if(running)universe.advance(dt);
  try{
   const next=renderer.frame(controller);
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
 $("materials").textContent="木 "+actions.resources.wood+" / 石 "+actions.resources.stone;
 $("building-count").textContent=String(actions.structures.filter(b=>b.progress>=1).length);
 $("control-state").textContent=controlMode==="stick"?"スティック移動":"地面タップで移動"+(controller.moveTarget?"（移動中）":"");
 $("mode-stick").setAttribute("aria-pressed",String(controlMode==="stick"));
 $("mode-tap").setAttribute("aria-pressed",String(controlMode==="tap"));
 $("stick-area").hidden=controlMode!=="stick"||!isSurface;
 $("action-pad").hidden=!isSurface;
 $("walk-status").textContent=controller.blocked?"通行不可：水域または急斜面":isSurface?"歩行可能":"降下中／宇宙視点";
 $("play").textContent=running?"⏸ 時間を停止":"▶ 時間を再生";
 $("ground-button").disabled=isSurface&&controller.targetAltitudeM<=12;
 $("walk-note").textContent=!isSurface?"地表へ降下すると歩行操作が有効になります。":
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
   planet:planet.snapshot(),explorer:controller.snapshot(),universe:universe.snapshot(),actions:actions.snapshot()};
  localStorage.setItem(SAVE_KEY,JSON.stringify(data));
  log("独立した3D探索データを保存しました。");
 }catch(e){log("保存に失敗: "+e.message);}
});
$("restore").addEventListener("click",()=>{
 try{
  const data=JSON.parse(localStorage.getItem(SAVE_KEY)||"null");
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("対応する保存データがありません。");
  running=false;init(data);updateHUD();
 }catch(e){log("復元失敗: "+e.message);}
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
 if(k==="+"||k==="=")controller.zoom(.65);
 if(k==="-")controller.zoom(1.55);
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
 if(pointer.moved)controller.turn((e.clientX-pointer.x)*.006);
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
 controller.zoom(e.deltaY>0?1.3:.77);
},{passive:false});
$("landing-select").addEventListener("change",()=>{
 const p=$("landing-select").value.split(",").map(Number);
 try{
  const site=findLand(terrain,p[0],p[1]);
  controller.setLanding(site.lat,site.lon);
  controller.targetAltitude(15000000);controller.altitudeM=15000000;
  renderer.patchKey=null;
  $("landing").textContent=controller.lat.toFixed(3)+"°, "+controller.lon.toFixed(3)+"°";
  log("架空惑星の新しい着陸候補へ移動しました。");
 }catch(e){log("着陸地変更不可: "+e.message);}
});
$("landing-select").addEventListener("focus",()=>{keys.clear();touches.clear();});

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
