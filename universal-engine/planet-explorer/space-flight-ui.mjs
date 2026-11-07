import {bodyById} from "./solar-system.mjs";
import {installShipInterior3D} from "./ship-interior-3d.mjs?v=20261107-buttons";
import {groundScenePhase} from "./ship-shared-scene.mjs?v=4";
import {SHIP_CREW,SHIP_STATIONS} from "./ship-interior.mjs?v=6";
import {shipTouchAxes,shipTouchPilot} from "./ship-view-controls.mjs?v=3-chase-orbit";
import {installShipSensorHUD} from "./ship-sensor-hud.mjs?v=1";
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function disk(ctx,x,y,r,color){
 const gradient=ctx.createRadialGradient(x-r*.27,y-r*.32,1,x,y,r);
 gradient.addColorStop(0,"#e7f3ff");gradient.addColorStop(.16,color);
 gradient.addColorStop(.72,color);gradient.addColorStop(1,"#0a1228");
 ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle="#b3c8e08a";ctx.lineWidth=1;ctx.stroke();
}
export function installSpaceFlightUI({get,onLaunch,onLand,onCancel,onSave,getCargo,getCompanions,getWorldCanvas,getWorldRenderer,notify}){
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
 #space-flight{overflow-y:auto}
 #space-flight .flight-display{flex-shrink:1}
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
 #space-flight.integrated{position:absolute;inset:0;z-index:3500;padding:3px;background:transparent;pointer-events:none;overflow-y:auto}
 #space-flight.integrated .flight-head,#space-flight.integrated .flight-readout,
 #space-flight.integrated .flight-actions,#space-flight.integrated .flight-walk,
 #space-flight.integrated .flight-crew,#space-flight.integrated #seamless-ship,
 #space-flight.integrated #flight-dialogue,#space-flight.integrated .flight-guide{pointer-events:auto}
 #space-flight.integrated .flight-head{background:#071e30d9;border-radius:8px}
 #space-flight.integrated .flight-display{flex:1;min-height:70px;max-height:none;background:transparent;border:0;pointer-events:none}
 #space-flight.integrated #ship-3d-canvas{display:none!important}
 #space-flight.integrated #flight-canvas:not([hidden]){display:block!important;position:absolute;top:4px;right:4px;width:min(300px,50vw);height:auto;max-height:150px;border:1px solid #70a5b6aa;border-radius:8px;background:#08172bd9;pointer-events:none;opacity:.86}
 #space-flight.integrated .flight-hud{top:3px;left:3px;background:#07192c88;border-radius:5px;padding:3px 6px}
 #space-flight.integrated .flight-readout{margin:3px 0}
 #space-flight.integrated .flight-guide{background:#102b3fc9;border-radius:6px}
 #space-flight.integrated .flight-actions{background:#10263ac9;border-radius:7px}
 @media(max-width:590px){#space-flight.integrated .flight-display{min-height:24px}
 #space-flight.integrated .flight-guide{font-size:10px}#space-flight.integrated .flight-actions button{min-height:33px}}

 #space-flight .flight-hud{white-space:pre-line}

 @media(max-width:560px){#space-flight .flight-readout{font-size:11px}#space-flight .flight-head strong{font-size:13px}#space-flight .flight-actions button{min-width:55px}}

 /* In-viewport touch controls with explicit pointer ownership. */
 #space-flight .flight-touch-pad{position:absolute;z-index:40;bottom:calc(9px + env(safe-area-inset-bottom,0px));left:calc(12px + env(safe-area-inset-left,0px));width:106px;height:112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;touch-action:none;user-select:none;-webkit-user-select:none;pointer-events:auto;color:#e6f9ff}
 #space-flight .flight-touch-ring{width:88px;height:88px;border-radius:50%;border:2px solid #94cadb;display:grid;place-items:center;background:#0b3348ba;box-shadow:0 0 0 4px #04182273}
 #space-flight .flight-touch-nub{width:39px;height:39px;border-radius:50%;background:#8dbdc9;border:2px solid #f1ffff;pointer-events:none}
 #space-flight .flight-touch-caption{font-size:10px;font-weight:600;text-shadow:0 1px 3px #001}
 #space-flight .flight-view-distance{position:absolute;right:10px;bottom:10px;display:flex;gap:5px;z-index:41;pointer-events:auto}
 #space-flight .flight-view-distance[hidden]{display:none!important}
 #space-flight .flight-view-distance button{min-height:38px;min-width:44px;background:#0b354edf;color:#fff;border:1px solid #8bbbc9;border-radius:7px}
 #space-flight.flight-wide .flight-guide,#space-flight.flight-wide .flight-readout,#space-flight.flight-wide #flight-walk{display:none!important}
 #space-flight.flight-wide .flight-head #flight-save,#space-flight.flight-wide .flight-head #flight-cancel{display:none!important}
 #space-flight.flight-wide .flight-head{flex:0 0 auto}
 #space-flight.flight-wide .flight-display{min-height:220px;max-height:none}
 #space-flight.flight-wide .flight-actions{padding:2px}
 @media(pointer:coarse){#space-flight.flight-wide #flight-left,#space-flight.flight-wide #flight-right{display:none!important}}
 #space-flight.integrated.flight-wide #flight-canvas:not([hidden]){display:none!important}
 #space-flight.integrated .flight-touch-pad,#space-flight.integrated .flight-view-distance,#space-flight.integrated .flight-engine-lever{pointer-events:auto}
 /* Dedicated lever for engine output, independent of pitch/yaw stick. */
 #space-flight .flight-engine-lever{position:absolute;z-index:42;bottom:calc(8px + env(safe-area-inset-bottom,0px));left:calc(9px + env(safe-area-inset-left,0px));display:flex;flex-direction:column;align-items:center;gap:3px;min-width:65px;padding:7px 4px;border:1px solid #80bbca;border-radius:10px;background:#103246dd;pointer-events:auto;touch-action:none;user-select:none;color:#e0fbff;font-size:10px}
 #space-flight .flight-engine-lever[hidden]{display:none!important}
 #space-flight .flight-engine-lever input{height:112px;width:30px;min-height:65px;writing-mode:vertical-lr;direction:rtl;accent-color:#78dcc8;touch-action:none;cursor:pointer}
 #space-flight .flight-engine-lever output{font:700 11px ui-monospace,monospace}
 #space-flight .flight-engine-lever small{font-size:9px;color:#afd7e0}
 #space-flight.ship-piloting .flight-touch-caption{white-space:nowrap}
 @media(max-height:430px){#space-flight .flight-engine-lever input{height:72px}#space-flight .flight-engine-lever{padding:3px}}
 #space-flight .flight-sensor-layer{position:absolute;inset:0;z-index:35;pointer-events:none;overflow:hidden}
 #space-flight .flight-sensor-layer[hidden]{display:none!important}
 #space-flight .flight-sensor{position:absolute;display:flex;align-items:center;gap:4px;
  transform:translate(-50%,-50%);padding:3px 7px;border:1px solid #82d4e0b0;
  border-radius:6px;background:#071c31d9;color:#dffaff;font:600 11px/1.25 system-ui,sans-serif;
  text-shadow:0 1px 2px #001;white-space:nowrap;max-width:min(39vw,230px)}
 #space-flight .flight-sensor[data-type="pirate"]{border-color:#ff9d57;color:#ffda9e;background:#3c1a19e6}
 #space-flight .flight-sensor[data-offscreen="true"]{border-width:1.5px}
 #space-flight .flight-sensor-arrow{display:inline-block;min-width:15px;color:inherit;text-align:center}
 #space-flight .flight-sensor-details{display:flex;flex-direction:column;gap:1px}
 #space-flight .flight-sensor-distance{font:400 10px/1.2 ui-monospace,monospace;color:#a9d2dd}
 #space-flight .flight-sensor[data-type="pirate"] .flight-sensor-distance{color:#e7ac85}
 @media(max-width:590px){#space-flight .flight-sensor{font-size:10px;padding:2px 4px}
 #space-flight .flight-sensor-distance{font-size:9px}}
 @media(pointer:fine){#space-flight .flight-touch-pad{display:none!important}}
 @media(max-width:590px){#space-flight .flight-head strong{font-size:12px;max-width:45%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#space-flight .flight-head button{font-size:11px;padding:4px 5px}#space-flight .flight-touch-pad{width:95px;height:100px}#space-flight .flight-touch-ring{width:78px;height:78px}#space-flight.flight-wide .flight-actions input[type=range]{width:90px}}
 `;
 document.head.append(style);
 const root=document.createElement("section");root.id="space-flight";root.hidden=true;root.setAttribute("role","region");root.setAttribute("aria-label","惑星間宇宙船の操縦席");
 root.innerHTML='<div class="flight-head"><strong id="flight-route">🚀 宇宙船 / 航行準備</strong><div><button id="flight-view" type="button">🎮 船内 / 操縦席</button> <button id="flight-camera" type="button" aria-pressed="false">🚀 船外追従</button> <button id="flight-wide" type="button" aria-pressed="false">⛶ 広画面</button> <button id="flight-save" type="button">💾 航行保存</button> <button id="flight-cancel" type="button">↶ 出発取消</button></div></div>'+
  '<div class="flight-display"><canvas id="flight-canvas" width="960" height="540" aria-label="宇宙船の操縦席から見える星空と目的惑星"></canvas><canvas id="ship-3d-canvas" aria-label="3D宇宙船船内：操縦室、連絡通路、貨物室" hidden></canvas><div class="flight-sensor-layer" id="flight-sensors" hidden aria-label="宇宙船目標表示"></div><div class="flight-hud" id="flight-hud"></div><label class="flight-engine-lever" hidden>推力<input id="flight-throttle" type="range" min="-100" max="100" step="1" value="72" aria-label="宇宙船推力レバー、マイナスは逆噴射、0は慣性航行、プラスは加速"><output for="flight-throttle">72%</output><small>0 慣性</small></label><div class="flight-touch-pad" role="group" aria-label="宇宙船・船内の仮想スティック"><div class="flight-touch-ring"><div class="flight-touch-nub"></div></div><small class="flight-touch-caption">船内歩行</small></div><div class="flight-view-distance" hidden><button type="button" id="flight-zoom-near" aria-label="宇宙船にカメラを近づける">＋</button><button type="button" id="flight-zoom-far" aria-label="宇宙船からカメラを離す">－</button></div></div>'+
  '<div class="flight-readout"><div class="flight-stat" id="flight-phase"></div><div class="flight-stat" id="flight-fuel"></div><div class="flight-stat" id="flight-heading"></div></div>'+
  '<div id="flight-walk" class="flight-walk"><button type="button" data-flight-move="leftTurn">↶ 視点</button><button type="button" data-flight-move="forward">↑ 前進</button><button type="button" data-flight-move="back">↓ 後退</button><button type="button" data-flight-move="left">← 横移動</button><button type="button" data-flight-move="right">横移動 →</button><button type="button" data-flight-move="rightTurn">視点 ↷</button></div><div id="flight-nearby" class="flight-crew"></div><div id="flight-dialogue" role="status" aria-live="polite"></div><div class="flight-actions"><button type="button" id="flight-left">◀ 左旋回</button><button type="button" id="flight-right">右旋回 ▶</button><button type="button" id="flight-auto">自動航行</button><button type="button" id="flight-main" class="primary">🚀 離陸</button></div>'+
  '<div class="flight-guide">船内：WASD／方向ボタンで歩行、Q/E・ドラッグで見回し、近くの乗員と会話・貨物確認。宇宙戦はVR視線保持、スマホはタップ、PCはクリックでロック。トリガー・Space・発射ボタンで攻撃。</div>';
 (document.querySelector(".canvas-wrap")||document.body).append(root);
 const $=id=>root.querySelector("#"+id);
 const screen=$("flight-canvas"),ctx=screen.getContext("2d"),shipCanvas=$("ship-3d-canvas");
 const worldCanvas=getWorldCanvas?.();
 const unified=Boolean(worldCanvas);
 const ship3D=unified?{supported:true,render:()=>true,destroy:()=>{}}:
  installShipInterior3D(shipCanvas,{get:()=>{
   const voyage=get();return {voyage,interior:voyage?.interior};
  }});
 root.classList.toggle("integrated",unified);
 const held=new Set();let nearKey="",lastView="";
 let chase=false,wide=typeof matchMedia==="function"&&matchMedia("(max-width: 1024px) and (pointer: coarse)").matches;
 let chaseDistance=52,orbitYaw=0,orbitPitch=.31,shipPointer=null,shipStick={x:0,y:0};
 const shipSensors=installShipSensorHUD(root);
 const touchPad=root.querySelector(".flight-touch-pad"),touchNub=root.querySelector(".flight-touch-nub");
 function resetShipStick(){shipPointer=null;shipStick={x:0,y:0};touchNub.style.transform="translate(0px,0px)";}
 function updateShipStick(e){
  const bounds=touchPad.querySelector(".flight-touch-ring").getBoundingClientRect();
  const radius=Math.max(1,Math.min(bounds.width,bounds.height)*.31);
  const dx=e.clientX-(bounds.left+bounds.width/2),dy=e.clientY-(bounds.top+bounds.height/2);
  const scale=Math.min(1,radius/Math.max(1,Math.hypot(dx,dy)));
  shipStick={x:dx*scale/radius,y:dy*scale/radius};
  touchNub.style.transform="translate("+Math.round(dx*scale)+"px,"+Math.round(dy*scale)+"px)";
 }
 touchPad.addEventListener("pointerdown",e=>{
  if(shipPointer!==null||root.hidden||(e.pointerType==="mouse"&&e.button!==0))return;
  e.preventDefault();shipPointer=e.pointerId;touchPad.setPointerCapture?.(e.pointerId);updateShipStick(e);
 });
 touchPad.addEventListener("pointermove",e=>{
  if(e.pointerId===shipPointer){e.preventDefault();updateShipStick(e);}
 });
 for(const type of ["pointerup","pointercancel","lostpointercapture"])
  touchPad.addEventListener(type,e=>{if(e.pointerId===shipPointer)resetShipStick();});
 document.addEventListener("visibilitychange",()=>{if(document.hidden)resetShipStick();});
 function seatedPilot(v){return Boolean(v&&(v.seated===true||v.kind!=="surface-to-surface"&&v.interior?.mode==="cockpit"));}
 function syncShipCamera(){
  const v=get(),seated=seatedPilot(v);
  if(!seated)chase=false;
  const viewer=getWorldRenderer?.();
  if(viewer){
   viewer.shipCameraMode=chase?"chase":"cockpit";
   viewer.shipWideView=wide;
   viewer.shipChaseDistance=chaseDistance;
   viewer.shipOrbitYaw=orbitYaw;viewer.shipOrbitPitch=orbitPitch;
  }
  root.classList.toggle("flight-wide",wide);
  root.classList.toggle("ship-piloting",seated);
  root.querySelector(".flight-engine-lever").hidden=!seated;
  $("flight-camera").hidden=!seated;
  $("flight-camera").textContent=chase?"🪑 操縦席視点":"🚀 船外追従";
  $("flight-camera").setAttribute("aria-pressed",String(chase));
  $("flight-wide").textContent=wide?"▣ 詳細UI":"⛶ 広画面";
  $("flight-wide").setAttribute("aria-pressed",String(wide));
  root.querySelector(".flight-view-distance").hidden=!chase;
  touchPad.querySelector(".flight-touch-caption").textContent=seated?"↔ 旋回 / ↑機首上げ ↓機首下げ":"船内歩行";
  touchPad.style.left=seated?"50%":"";
  touchPad.style.transform=seated?"translateX(-50%)":"";
 }
 $("flight-camera").addEventListener("click",()=>{if(!seatedPilot(get()))return;chase=!chase;syncShipCamera();});
 $("flight-wide").addEventListener("click",()=>{wide=!wide;syncShipCamera();});
 $("flight-zoom-near").addEventListener("click",()=>{chaseDistance=Math.max(28,chaseDistance-12);syncShipCamera();});
 $("flight-zoom-far").addEventListener("click",()=>{chaseDistance=Math.min(150,chaseDistance+12);syncShipCamera();});

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
  const companionName=getCompanions?.()?.[0];
  const key=[...people.map(p=>p.id+(p.id==="companion"?companionName||"":"")),...stations.map(s=>s.id)].join(":");
  if(key===nearKey)return;nearKey=key;
  const panel=$("flight-nearby");panel.replaceChildren();
  const label=document.createElement("span");label.textContent="近く：";panel.append(label);
  for(const person of people){
   const button=document.createElement("button");button.type="button";const displayName=person.id==="companion"&&companionName?companionName:person.name;
   button.textContent="💬 "+displayName;
   button.addEventListener("click",()=>{
    const current=get();const reply=current?.interior?.talk(person.id,current);
    if(reply?.message)$("flight-dialogue").textContent="💬 "+displayName+"「"+reply.message+"」";
   });
   panel.append(button);
  }
  for(const station of stations){
   const button=document.createElement("button");button.type="button";button.textContent=station.id==="cargo"?"📦 貨物確認":station.id==="helm"?"🪑 操縦席":station.id==="engine"?"⚙️ 機関監視":"🧭 航法盤";
   button.addEventListener("click",()=>{
    if(station.id==="cargo"){showCargo();return;}
    if(station.id==="helm"){
     const current=get();if(current?.kind==="surface-to-surface"){
      const result=current.sit();if(result?.message)$("flight-dialogue").textContent=result.message;
     }else if(current)current.interior.mode="cockpit";
     render();return;
    }
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
  if(root.hidden||!get()?.interior||!keys.has(event.key.toLowerCase())||
     ["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName))return;
  event.preventDefault();held.add(keys.get(event.key.toLowerCase()));
 });
 document.addEventListener("keyup",event=>{const key=keys.get(event.key.toLowerCase());if(key)held.delete(key);});
 window.addEventListener("blur",()=>{held.clear();resetShipStick();});
 let drag=null;
 const dragTarget=unified?worldCanvas:shipCanvas;
 // Capture before world picking/planet gestures, but ONLY while the ship
 // overlay is active. Outside chase mode normal game gestures are unchanged.
 dragTarget.addEventListener("pointerdown",event=>{
  if(root.hidden)return;
  const roaming=chase&&seatedPilot(get());
  if(!roaming&&get()?.interior?.mode!=="interior")return;
  if(drag!==null||event.isPrimary===false)return;
  drag={id:event.pointerId,x:event.clientX,y:event.clientY,roaming};
  dragTarget.setPointerCapture?.(event.pointerId);
  if(roaming){event.preventDefault();event.stopImmediatePropagation();}
 },true);
 dragTarget.addEventListener("pointermove",event=>{
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
  if(drag.roaming){
   orbitYaw=(orbitYaw+dx*.008)%(2*Math.PI);
   orbitPitch=clamp(orbitPitch+dy*.005,-.42,1.37);
   syncShipCamera();
   event.preventDefault();event.stopImmediatePropagation();
  }else{
   const state=get()?.interior;
   if(state)state.turn(dx*.006,-dy*.004);
  }
  drag.x=event.clientX;drag.y=event.clientY;
 },true);
 for(const type of ["pointerup","pointercancel","lostpointercapture"])
  dragTarget.addEventListener(type,event=>{
   if(drag?.id===event.pointerId){
    if(drag.roaming){event.preventDefault();event.stopImmediatePropagation();}
    drag=null;
   }
  },true);
 dragTarget.addEventListener("wheel",event=>{
  if(root.hidden||!chase||!seatedPilot(get()))return;
  event.preventDefault();event.stopImmediatePropagation();
  chaseDistance=clamp(chaseDistance+Math.sign(event.deltaY)*6,28,150);
  syncShipCamera();
 },{passive:false,capture:true});
 window.addEventListener("blur",()=>{drag=null;});
 function applyMove(dt){
  const v=get(),state=v?.interior;
  if(!state||!Number.isFinite(dt)||dt<=0)return;
  const n=key=>Number(held.has(key));
  if(state.mode==="interior"&&!state.seated){
   state.turn((n("rightTurn")-n("leftTurn"))*dt*1.7);
   const axis=shipPointer===null?{forward:0,sideways:0}:shipTouchAxes(shipStick);
   state.walk(n("forward")-n("back")+axis.forward,n("right")-n("left")+axis.sideways,dt);
  }else if(seatedPilot(v)){
   // Stick is attitude-only. Thrust is exclusively controlled by the lever.
   // Physical climb/descent awaits the continuous-world dynamics implementation.
   const joystick=shipPointer===null?{x:0,y:0}:shipStick;
   const pilot=shipTouchPilot({x:joystick.x+n("right")-n("left"),
    y:joystick.y+n("back")-n("forward")},dt);
   if((pilot.yawDelta||pilot.pitchDelta)&&
      !["docked","preflight","landed","touchdown"].includes(v.status))
    v.setAutopilot?.(false);
   if(!v.autopilot&&!["docked","preflight","landed","touchdown"].includes(v.status)){
    if(pilot.yawDelta&&typeof v.steer==="function")v.steer(pilot.yawDelta);
    if(pilot.pitchDelta&&typeof v.pitch==="function")v.pitch(pilot.pitchDelta);
   }
  }
 }
 $("flight-view").addEventListener("click",()=>{
  const current=get();if(!current)return;
  if(current.kind==="surface-to-surface"){
   const result=current.seated?current.stand():
    current.isNearSeat()?current.sit():{ok:false,message:"船内を歩いて操縦席へ近づいてください"};
   if(result?.message)$("flight-dialogue").textContent=result.message;
   if(!result?.ok)return;
  }else{
   current.interior.mode=current.interior.mode==="interior"?"cockpit":"interior";
  }
  nearKey="";held.clear();resetShipStick();render();
 });

 const throttle=$("flight-throttle"),main=$("flight-main");
 const run=(fn)=>{const result=fn();if(result?.message)notify?.(result.message);return result;};
 throttle.addEventListener("input",()=>{
  const v=get();
  if(!seatedPilot(v)||typeof v.setThrottle!=="function")return;
  v.setThrottle(Number(throttle.value)/100);
  v.setAutopilot?.(false);
  root.querySelector(".flight-engine-lever output").textContent=(v.throttle<0?"逆噴射 ":"推力 ")+Math.round(Math.abs(v.throttle)*100)+"%";
 });
 $("flight-left").addEventListener("click",()=>{const v=get();if(v&&(v.seated!==false))v.steer(-8);});
 $("flight-right").addEventListener("click",()=>{const v=get();if(v&&(v.seated!==false))v.steer(8);});
 $("flight-auto").addEventListener("click",()=>{const v=get();if(v)v.setAutopilot(!v.autopilot);});
 $("flight-save").addEventListener("click",()=>run(onSave));
 $("flight-cancel").addEventListener("click",()=>run(onCancel));
 main.addEventListener("click",()=>{const v=get();if(!v)return;run(["preflight","docked"].includes(v.status)?onLaunch:onLand);});
 function render(dt=0){
  const v=get();root.hidden=!v?.active;if(root.hidden){held.clear();resetShipStick();shipSensors.hide();return;}
  syncShipCamera();
  shipSensors.update(v,{visible:seatedPilot(v),chase,wide,
   distance:chaseDistance,orbitYaw,orbitPitch});
  if(!ship3D.supported&&v.interior.mode==="interior")v.interior.mode="cockpit";
  applyMove(dt);
  const interiorView=v.interior.mode==="interior";
  shipCanvas.hidden=unified||!interiorView;screen.hidden=interiorView;
  $("flight-walk").hidden=!interiorView;$("flight-nearby").hidden=!interiorView;
  $("flight-view").textContent=v.kind==="surface-to-surface"?(v.seated?"🚶 立って船内へ":"🪑 着席"):(interiorView?"🛰️ 操縦席の星図":"🚶 3D船内");
  if(interiorView){updateNearby();if(!unified)ship3D.render();}
  if(lastView!==v.interior.mode){lastView=v.interior.mode;nearKey="";$("flight-dialogue").textContent="";}

  const target=bodyById(v.destinationId)||{name:"目的地未設定",color:"#a8e2e6"},origin=bodyById(v.originId);
  $("flight-route").textContent="🚀 "+origin.name+" → "+target.name;
  const entryView=["entry","touchdown"].includes(v.status);
  const height=entryView?Math.round(groundScenePhase(v).lift):null;
  $("flight-phase").textContent="段階："+v.phase+
   (height!==null?" ／ 対地高度 約"+height.toLocaleString("ja-JP")+"m":"");
  $("flight-fuel").textContent="燃料："+Math.round(v.fuel)+"%";
  const courseSpeed=Math.hypot(v.routeVelocity?.along||0,v.routeVelocity?.cross||0)*100;
  $("flight-heading").textContent="進路："+Math.round(v.heading)+"° / 機首："+Math.round(v.pitchDeg||0)+
   "° / 航路速度 "+courseSpeed.toFixed(2)+"%/秒";
  $("flight-auto").textContent=v.autopilot?"🧭 自動ON":"🧭 自動OFF";
  $("flight-auto").setAttribute("aria-pressed",String(v.autopilot));
  if(document.activeElement!==throttle)throttle.value=String(Math.round(v.throttle*100));
  root.querySelector(".flight-engine-lever output").textContent=(v.throttle<0?"逆噴射 ":"推力 ")+Math.round(Math.abs(v.throttle)*100)+"%";
  $("flight-cancel").hidden=v.kind==="surface-to-surface"||v.status!=="preflight";
  const groundReady=["preflight","docked"].includes(v.status);
  main.textContent=groundReady?"🚀 離陸":v.status==="orbit"?"🔥 大気圏突入":
   v.status==="origin-orbit"||v.status==="parking-orbit"?"🧭 航路を設定":
   v.status==="touchdown"?"🛬 接地確認":v.status==="landed"?"✅ 着陸完了":"🛰️ 航行中";
  main.disabled=v.kind==="surface-to-surface"?
   !["docked","orbit"].includes(v.status):!(groundReady?(v.seated!==false&&v.hatchOpen!==true):v.readyToLand);
  if(v.seated===false){
   $("flight-left").disabled=true;$("flight-right").disabled=true;
  }else{
   $("flight-left").disabled=false;$("flight-right").disabled=false;
  }
  if(interiorView){
   $("flight-hud").textContent=entryView?
    "🛬 "+target.name+" / "+(v.landingSite?"着陸地点を捕捉":"地表測量中")+
    "\n"+(v.status==="touchdown"?"接地・エンジン停止":("高度 約"+height.toLocaleString("ja-JP")+"m"))+
    "\n"+(v.status==="touchdown"?"操縦席から外の地表を確認できます":"進入姿勢を維持してください"):
    "3D SHARED SCENE · "+v.phase+"\n"+target.name+" "+Math.round(v.progress*100)+
    "% / 航路速度 "+courseSpeed.toFixed(2)+"%/秒"+(v.status==="flyby"?"\n⚠ 高速通過・逆噴射で減速":"");
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
  $("flight-hud").textContent="HELIO NAV · "+v.status.toUpperCase()+"\n"+
   target.name+"  接近"+Math.round(p*100)+"%\n航路速度 "+courseSpeed.toFixed(2)+"%/秒"+
   (v.status==="flyby"?"\n⚠ 目標軌道を高速通過。逆噴射で減速":"");
 }
 return {render,close:()=>{held.clear();resetShipStick();root.hidden=true;},show:()=>{root.hidden=false;nearKey="";render();},destroy:ship3D.destroy};
}
