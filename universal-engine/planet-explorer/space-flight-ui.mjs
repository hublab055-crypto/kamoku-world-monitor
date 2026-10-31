import {bodyById} from "./solar-system.mjs";
import {installShipInterior3D} from "./ship-interior-3d.mjs";
import {SHIP_CREW,SHIP_STATIONS} from "./ship-interior.mjs";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function disk(ctx,x,y,r,color){
 const gradient=ctx.createRadialGradient(x-r*.27,y-r*.32,1,x,y,r);
 gradient.addColorStop(0,"#e7f3ff");gradient.addColorStop(.16,color);
 gradient.addColorStop(.72,color);gradient.addColorStop(1,"#0a1228");
 ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#b3c8e08a";ctx.lineWidth=1;ctx.stroke();
}
export function installSpaceFlightUI({get,onLaunch,onLand,onCancel,onSave,getCargo,notify}){
 const style=document.createElement("style");
 style.textContent=`
 #space-flight[hidden]{display:none!important}
 #space-flight{position:fixed;inset:0;z-index:3500;background:#071320f7;color:#d9ecfa;display:flex;flex-direction:column;padding:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom));font:13px/1.45 system-ui;box-sizing:border-box;overscroll-behavior:contain}
 #space-flight .flight-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:space-between;padding:5px 7px}
 #space-flight .flight-head strong{font-size:16px}
 #space-flight .flight-head button{min-height:34px}
 #space-flight .flight-display{position:relative;flex:1;min-height:190px;max-height:68vh;border:1px solid #5a8297;border-radius:12px;overflow:hidden;background:#020915}
 #space-flight canvas{width:100%;height:100%;display:block}
 #space-flight .flight-hud{position:absolute;top:12px;left:12px;color:#cde7f7;font:12px/1.5 ui-monospace,monospace;text-shadow:0 1px 4px #000}
 #space-flight .flight-readout{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}
 #space-flight .flight-stat{background:#122d3f;padding:5px;border-radius:6px;text-align:center}
 #space-flight .flight-actions{display:flex;gap:7px;flex-wrap:wrap;align-items:center;justify-content:center;padding:3px}
 #space-flight .flight-actions button{min-height:42px;min-width:68px;padding:5px 10px;border:1px solid #6595b1;border-radius:8px;background:#183b55;color:#effaff;font-size:13px}
 #space-flight .flight-actions button:disabled{opacity:.43}
 #space-flight .flight-actions .primary{background:#226b68;border-color:#79bcae}
 #space-flight input[type=range]{width:min(220px,45vw);accent-color:#77dbd4}
 #space-flight .flight-guide{font-size:11px;color:#abcbdc;text-align:center;margin:3px}
 #space-flight #ship-3d-canvas[hidden],#space-flight #flight-canvas[hidden]{display:none!important}
 #space-flight .flight-crew{display:flex;align-items:center;gap:5px;flex-wrap:wrap;justify-content:center;min-height:36px;margin:2px 0}
 #space-flight .flight-crew button,#space-flight .flight-walk button{min-width:38px;min-height:36px;border:1px solid #688ea5;border-radius:6px;background:#19384b;color:#eaf4ff}
 #space-flight .flight-walk{display:flex;justify-content:center;gap:5px;flex-wrap:wrap;padding:3px;touch-action:none}
 #space-flight .flight-walk[hidden],#space-flight .flight-crew[hidden]{display:none!important}
 #space-flight .flight-walk button{touch-action:none;user-select:none;-webkit-user-select:none}
 #space-flight .flight-crew button:focus-visible,#space-flight .flight-walk button:focus-visible{outline:2px solid #a2efee}
 #space-flight #flight-dialogue:not(:empty){background:#102f3fe9;padding:5px 10px;border-radius:7px;color:#ccefe8;max-height:82px;overflow:auto}
 #space-flight #flight-view{background:#2d5061;color:#e4f5ff}
 #space-flight #ship-3d-canvas{touch-action:none}
 #space-flight .flight-hud{white-space:pre-line}

 @media(max-width:560px){#space-flight .flight-readout{font-size:11px}#space-flight .flight-head strong{font-size:13px}#space-flight .flight-actions button{min-width:55px}}
 `;
 document.head.append(style);
 const root=document.createElement("section");root.id="space-flight";root.hidden=true;root.setAttribute("role","region");root.setAttribute("aria-label","惑星間宇宙船の操縦席");
 root.innerHTML='<div class="flight-head"><strong id="flight-route">🚀 宇宙船 / 航行準備</strong><div><button id="flight-view" type="button">🎮 船内 / 操縦席</button> <button id="flight-save" type="button">💾 航行保存</button> <button id="flight-cancel" type="button">↶ 出発取消</button></div></div>'+
  '<div class="flight-display"><canvas id="flight-canvas" width="960" height="540" aria-label="宇宙船の操縦席から見える星空と目的惑星"></canvas><canvas id="ship-3d-canvas" aria-label="3D宇宙船船内：操縦室、連絡通路、貨物室" hidden></canvas><div class="flight-hud" id="flight-hud"></div></div>'+
  '<div class="flight-readout"><div class="flight-stat" id="flight-phase"></div><div class="flight-stat" id="flight-fuel"></div><div class="flight-stat" id="flight-heading"></div></div>'+
  '<div id="flight-walk" class="flight-walk"><button type="button" data-flight-move="leftTurn">↶ 視点</button><button type="button" data-flight-move="forward">↑ 前進</button><button type="button" data-flight-move="back">↓ 後退</button><button type="button" data-flight-move="left">← 横移動</button><button type="button" data-flight-move="right">横移動 →</button><button type="button" data-flight-move="rightTurn">視点 ↷</button></div><div id="flight-nearby" class="flight-crew"></div><div id="flight-dialogue" role="status" aria-live="polite"></div><div class="flight-actions"><label>スロットル <input id="flight-throttle" type="range" min="0" max="100" step="5" value="70"></label><button type="button" id="flight-left">◀ 左旋回</button><button type="button" id="flight-right">右旋回 ▶</button><button type="button" id="flight-auto">自動航行</button><button type="button" id="flight-main" class="primary">🚀 離陸</button></div>'+
  '<div class="flight-guide">船内：WASD／方向ボタンで歩行、Q/E・ドラッグで見回し、近くの乗員と会話・貨物確認。航行操作は船内からも可能です。着陸は目的地に接近後。</div>';
 document.body.append(root);
 const $=id=>root.querySelector("#"+id);
 const screen=$("flight-canvas"),ctx=screen.getContext("2d"),shipCanvas=$("ship-3d-canvas");
 const ship3D=installShipInterior3D(shipCanvas,{get:()=>{
  const voyage=get();return {voyage,interior:voyage?.interior};
 }});
 const held=new Set();let nearKey="",lastView="";
 function cockpitAvailable(){const v=get();return Boolean(v?.interior&&ship3D.supported);}
 function showCargo(){
  const resources=getCargo?.()||{};
  const entries=Object.entries(resources).filter(([,v])=>Number(v)>0).sort((a,b)=>a[0].localeCompare(b[0],"ja"));
  $("flight-dialogue").textContent=entries.length?
   "📦 船倉： "+entries.slice(0,18).map(([k,v])=>k+" ×"+v).join(" ／ ")+(entries.length>18?" ほか"+(entries.length-18)+"種":""):
   "📦 船倉は空です。惑星で採掘した資源がここに表示されます。";
 }
 function updateNearby(){
  const v=get(),interior=v?.interior;
  if(!interior||interior.mode!=="interior")return;
  const people=interior.nearCrew(),stations=interior.nearStations();
  const key=[...people.map(p=>p.id),...stations.map(s=>s.id)].join(":");
  if(key===nearKey)return;nearKey=key;
  const panel=$("flight-nearby");panel.replaceChildren();
  const label=document.createElement("span");label.textContent="近く：";panel.append(label);
  for(const person of people){
   const button=document.createElement("button");button.type="button";button.textContent="💬 "+person.name;
   button.addEventListener("click",()=>{
    const current=get();const reply=current?.interior?.talk(person.id,current);
    if(reply?.message)$("flight-dialogue").textContent="💬 "+person.name+"「"+reply.message+"」";
   });
   panel.append(button);
  }
  for(const station of stations){
   const button=document.createElement("button");button.type="button";button.textContent=station.id==="cargo"?"📦 貨物確認":station.id==="helm"?"🪑 操縦席":station.id==="engine"?"⚙️ 機関監視":"🧭 航法盤";
   button.addEventListener("click",()=>{
    if(station.id==="cargo"){showCargo();return;}
    if(station.id==="helm"){const current=get();if(current)current.interior.mode="cockpit";render();return;}
    const current=get();
    $("flight-dialogue").textContent=station.id==="engine"?
     "⚙️ 推進系：燃料"+Math.round(current?.fuel||0)+"%／スロットル"+Math.round((current?.throttle||0)*100)+"%":
     "🧭 航路：目的地 "+bodyById(current?.destinationId)?.name+"／進捗 "+Math.round((current?.progress||0)*100)+"%";
   });panel.append(button);
  }
  if(!people.length&&!stations.length)label.textContent="通路を歩いて乗員や装置に近づいてください";
 }
 // Pointer-held buttons and keyboard are two input paths for the same collision-aware navigation.
 for(const button of root.querySelectorAll("[data-flight-move]")){
  const name=button.dataset.flightMove;
  button.addEventListener("pointerdown",e=>{
   if(root.hidden||!cockpitAvailable())return;
   e.preventDefault();button.setPointerCapture?.(e.pointerId);held.add(name);
   applyMove(.12);
  });
  for(const event of ["pointerup","pointercancel","lostpointercapture"])
   button.addEventListener(event,()=>held.delete(name));
 }
 const keys=new Map([["w","forward"],["arrowup","forward"],["s","back"],["arrowdown","back"],
  ["a","left"],["arrowleft","left"],["d","right"],["arrowright","right"],
  ["q","leftTurn"],["e","rightTurn"]]);
 document.addEventListener("keydown",event=>{
  if(root.hidden||get()?.interior?.mode!=="interior"||!keys.has(event.key.toLowerCase())||
     ["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
  event.preventDefault();held.add(keys.get(event.key.toLowerCase()));
 });
 document.addEventListener("keyup",event=>{const key=keys.get(event.key.toLowerCase());if(key)held.delete(key);});
 window.addEventListener("blur",()=>held.clear());
 let drag=null;
 shipCanvas.addEventListener("pointerdown",event=>{drag={id:event.pointerId,x:event.clientX,y:event.clientY};shipCanvas.setPointerCapture?.(event.pointerId);});
 shipCanvas.addEventListener("pointermove",event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const state=get()?.interior;if(state)state.turn((event.clientX-drag.x)*.006,(drag.y-event.clientY)*.004);
  drag.x=event.clientX;drag.y=event.clientY;
 });
 for(const type of ["pointerup","pointercancel","lostpointercapture"])
  shipCanvas.addEventListener(type,()=>{drag=null;});
 function applyMove(dt){
  const state=get()?.interior;
  if(!state||state.mode!=="interior")return;
  const n=key=>Number(held.has(key));
  state.turn((n("rightTurn")-n("leftTurn"))*dt*1.7);
  state.walk(n("forward")-n("back"),n("right")-n("left"),dt);
 }
 $("flight-view").addEventListener("click",()=>{
  const current=get();if(!current)return;
  current.interior.mode=current.interior.mode==="interior"?"cockpit":"interior";
  nearKey="";held.clear();render();
 });

 const throttle=$("flight-throttle"),main=$("flight-main");
 const run=(fn)=>{const result=fn();if(result?.message)notify?.(result.message);return result;};
 throttle.addEventListener("input",()=>get()?.setThrottle(Number(throttle.value)/100));
 $("flight-left").addEventListener("click",()=>get()?.steer(-8));
 $("flight-right").addEventListener("click",()=>get()?.steer(8));
 $("flight-auto").addEventListener("click",()=>{const v=get();if(v)v.setAutopilot(!v.autopilot);});
 $("flight-save").addEventListener("click",()=>run(onSave));
 $("flight-cancel").addEventListener("click",()=>run(onCancel));
 main.addEventListener("click",()=>{const v=get();if(!v)return;run(v.status==="preflight"?onLaunch:onLand);});
 function render(dt=0){
  const v=get();root.hidden=!v?.active;if(root.hidden){held.clear();return;}
  if(!ship3D.supported&&v.interior.mode==="interior")v.interior.mode="cockpit";
  applyMove(dt);
  const interiorView=v.interior.mode==="interior";
  shipCanvas.hidden=!interiorView;screen.hidden=interiorView;
  $("flight-walk").hidden=!interiorView;$("flight-nearby").hidden=!interiorView;
  $("flight-view").textContent=interiorView?"🛰️ 操縦席の星図":"🚶 3D船内";
  if(interiorView){updateNearby();ship3D.render();}
  if(lastView!==v.interior.mode){lastView=v.interior.mode;nearKey="";$("flight-dialogue").textContent="";}

  const target=bodyById(v.destinationId),origin=bodyById(v.originId);
  $("flight-route").textContent="🚀 "+origin.name+" → "+target.name;
  $("flight-phase").textContent="段階："+v.phase;
  $("flight-fuel").textContent="燃料："+Math.round(v.fuel)+"%";
  $("flight-heading").textContent="進路偏差："+Math.round(v.heading)+"°";
  $("flight-auto").textContent=v.autopilot?"🧭 自動ON":"🧭 自動OFF";
  $("flight-auto").setAttribute("aria-pressed",String(v.autopilot));
  if(document.activeElement!==throttle)throttle.value=String(Math.round(v.throttle*100));
  $("flight-cancel").hidden=v.status!=="preflight";
  main.textContent=v.status==="preflight"?"🚀 離陸":v.status==="orbit"?"↓ 着陸":"🛰️ 巡航中";
  main.disabled=v.status!=="preflight"&&!v.readyToLand;
  if(interiorView){
   $("flight-hud").textContent="SHIP INTERIOR · "+v.phase+"\n"+bodyById(v.destinationId).name+" "+Math.round(v.progress*100)+"%";
   return;
  }
  const w=screen.width,h=screen.height,p=v.progress,elapsed=v.elapsedSeconds;
  const bg=ctx.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,"#030a18");bg.addColorStop(.63,"#0c2038");bg.addColorStop(1,"#0a1526");
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  for(let i=0;i<175;i++){
   const a=(i*1664525+1013904223)>>>0,b=(i*22695477+1)>>>0;
   const x=((a%10000)/10000*w+(elapsed*(v.throttle+.15)*(i%3+1))%w)%w,y=(b%10000)/10000*h*.78;
   ctx.fillStyle=i%6===0?"#dcecff":"#7097b4";ctx.globalAlpha=.28+(i%8)/12;
   ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);
  }
  ctx.globalAlpha=1;
  const shift=v.heading*3.2;
  const destinationSize=clamp(13+Math.pow(p,2.6)*245,13,280);
  const sourceSize=clamp(155*(1-p)* (1-p)+4,4,155);
  const tx=w*.62-shift,ty=h*.35,ox=w*.2-shift*.3,oy=h*.37;
  disk(ctx,ox,oy,sourceSize,origin.color);
  disk(ctx,tx,ty,destinationSize,target.color);
  if(p<.12){
   ctx.strokeStyle="#addef588";ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(ox,oy,sourceSize*1.12,0,Math.PI*2);ctx.stroke();
  }
  // Stylized cockpit and flight attitude indicators; never blocks the current game world state.
  ctx.fillStyle="#071421de";ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,h*.82);
  ctx.lineTo(w*.21,h*.88);ctx.lineTo(w*.32,h*.79);ctx.lineTo(w*.68,h*.79);
  ctx.lineTo(w*.79,h*.88);ctx.lineTo(w,h*.82);ctx.lineTo(w,h);ctx.fill();
  ctx.strokeStyle="#629fb3";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,h*.82);ctx.lineTo(w*.21,h*.88);
  ctx.lineTo(w*.32,h*.79);ctx.lineTo(w*.68,h*.79);ctx.lineTo(w*.79,h*.88);ctx.lineTo(w,h*.82);ctx.stroke();
  ctx.strokeStyle="#9ce5d2";ctx.lineWidth=2;ctx.beginPath();
  ctx.moveTo(w/2-29,h*.47);ctx.lineTo(w/2-8,h*.47);ctx.moveTo(w/2+8,h*.47);ctx.lineTo(w/2+29,h*.47);
  ctx.moveTo(w/2,h*.47-25);ctx.lineTo(w/2,h*.47-7);ctx.moveTo(w/2,h*.47+7);ctx.lineTo(w/2,h*.47+25);ctx.stroke();
  ctx.fillStyle="#0d3348";ctx.fillRect(w*.15,h*.92,w*.7,12);
  ctx.fillStyle=v.status==="orbit"?"#76e0af":"#79c3e5";
  ctx.fillRect(w*.15,h*.92,w*.7*p,12);
  ctx.fillStyle="#d9eefb";ctx.font="18px ui-monospace, monospace";
  ctx.fillText(Math.round(p*100)+"% / "+v.flightDays.toFixed(1)+" ゲーム日",w*.32,h*.90);
  $("flight-hud").textContent="HELIO NAV · "+v.status.toUpperCase()+"\n"+target.name+"  接近"+Math.round(p*100)+"%";
 }
 return {render,close:()=>{held.clear();root.hidden=true;},show:()=>{root.hidden=false;nearKey="";render();},destroy:ship3D.destroy};
}
