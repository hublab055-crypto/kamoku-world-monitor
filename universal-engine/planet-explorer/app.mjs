import {Multiverse} from "../core.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {Weather} from "../planet/weather-engine.mjs";
import {ExplorerController} from "./controller.mjs";
import {findLand,terrainSurface} from "./geo.mjs";
import {ExplorerRenderer} from "./render.mjs";

const $=id=>document.getElementById(id);
const SAVE_KEY="universal-engine:explorer:v1";
let planet,terrain,weather,controller,renderer,universe,simWorld;
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
  universe=saved?Multiverse.fromSnapshot(saved.universe):new Multiverse();
  simWorld=universe.getWorld("terra-nova")||universe.createWorld({
   id:"terra-nova",name:"Terra Nova",clock:{tickSeconds:.05,maxTicksPerAdvance:10}
  });
  simWorld.addSystem("solar-time",(_world,dt)=>planet.advance(dt*Number($("days-per-second").value)*.02));
  simWorld.clock.paused=!running;
  renderer=new ExplorerRenderer($("world"),planet,terrain);
  keys.clear();touches.clear();
  $("fatal").hidden=true;$("world").hidden=false;
  $("landing").textContent=controller.origin.lat.toFixed(3)+"°, "+controller.origin.lon.toFixed(3)+"°";
  log(saved?"保存した3D探索状態を復元しました。":"惑星を生成しました。降下して地上を歩いてみましょう。");
 }catch(e){$("fatal").hidden=false;$("fatal").textContent="3D初期化エラー: "+e.message;log(e.message);running=false;}
}
function inputVector(){
 const on=k=>keys.has(k)||touches.has(k);
 return {forward:(on("w")||on("arrowup")?1:0)-(on("s")||on("arrowdown")?1:0),
  strafe:(on("d")?1:0)-(on("a")?1:0),
  turn:(on("e")||on("right")?1:0)-(on("q")||on("left")?1:0)};
}
function doFrame(t){
 const dt=lastTime?clamp((t-lastTime)/1000,0,.08):0;lastTime=t;
 if(controller&&renderer){
  const input=inputVector();
  controller.update(dt,input);
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
 $("walk-status").textContent=controller.blocked?"通行不可：水域または急斜面":isSurface?"歩行可能":"降下中／宇宙視点";
 $("play").textContent=running?"⏸ 時間を停止":"▶ 時間を再生";
 $("ground-button").disabled=isSurface&&controller.targetAltitudeM<=12;
 $("walk-note").textContent=isSurface?"WASDまたは画面ボタンで移動。Q/Eまたは左右ボタンで向きを変更。":
  "地表へ降下すると歩行操作が有効になります。";
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
   planet:planet.snapshot(),explorer:controller.snapshot(),universe:universe.snapshot()};
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
 pointer={id:e.pointerId,x:e.clientX};
 $("world").setPointerCapture?.(e.pointerId);
});
$("world").addEventListener("pointermove",e=>{
 if(!pointer||e.pointerId!==pointer.id)return;
 controller.turn((e.clientX-pointer.x)*.006);
 pointer.x=e.clientX;
});
for(const type of ["pointerup","pointercancel"])$("world").addEventListener(type,()=>pointer=null);
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
init();requestAnimationFrame(doFrame);