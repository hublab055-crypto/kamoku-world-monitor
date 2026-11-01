import {MOBILE_ACTIONS,normalizeMobileConfig,defaultMobileConfig} from "./mobile-controls.mjs?v=2";

const KEY="universal-engine:mobile-four-actions:v1";
const mobile=()=>typeof matchMedia==="function"&&matchMedia("(max-width: 1024px) and (pointer: coarse)").matches;
function load(){
 try{return normalizeMobileConfig(JSON.parse(localStorage.getItem(KEY)));}
 catch(_){return defaultMobileConfig();}
}
const save=config=>{try{localStorage.setItem(KEY,JSON.stringify(config));}catch(_){}};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const el=(tag,cls,text)=>{
 const node=document.createElement(tag);if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;return node;
};
/** Fullscreen ship has its own input surface: it is above the world viewport.
 * Walking is resolved in ShipInterior; piloting reuses the actual voyage heading
 * and throttle, never a disconnected decorative stick. */
export function installShipMobileUI({host,get,onAction,getRoutes,onChooseRoute,onTransfer,notify}){
 const css=el("style");css.textContent=`
#space-flight .ship-mobile-layer[hidden]{display:none!important}
#space-flight .ship-mobile-layer{position:absolute;inset:0;z-index:35;pointer-events:none}
#space-flight .ship-mobile-stick,#space-flight .ship-mobile-actions,
#space-flight .ship-mobile-settings-toggle,#space-flight .ship-mobile-settings,
#space-flight .ship-mobile-nav{pointer-events:auto}
#space-flight .ship-mobile-stick{position:absolute;left:calc(13px + env(safe-area-inset-left,0px));bottom:calc(13px + env(safe-area-inset-bottom,0px));
 width:116px;height:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;touch-action:none;user-select:none;color:#e0f5fa}
#space-flight .ship-mobile-stick-ring{width:94px;height:94px;border-radius:50%;display:grid;place-items:center;background:#123f5baa;border:2px solid #9bd9e6;box-shadow:0 0 0 5px #001a2b44}
#space-flight .ship-mobile-stick-nub{width:43px;height:43px;border-radius:50%;background:#88b9ca;border:2px solid #e7faff;pointer-events:none}
#space-flight .ship-mobile-stick-caption{font-size:10px;text-shadow:0 1px 3px #001}
#space-flight .ship-mobile-actions{position:absolute;right:calc(13px + env(safe-area-inset-right,0px));bottom:calc(13px + env(safe-area-inset-bottom,0px));display:grid;grid-template-columns:repeat(2,59px);gap:7px}
#space-flight .ship-mobile-button{border-radius:50%;width:59px;height:59px;min-width:59px;min-height:59px;padding:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#effbff;background:#153b55e8;border:1px solid #91c6d7;touch-action:manipulation;user-select:none}
#space-flight .ship-mobile-button:active{background:#267a91}
#space-flight .ship-mobile-button-icon{font-size:22px}
#space-flight .ship-mobile-button-name{font-size:9px;text-align:center;line-height:1.08}
#space-flight .ship-mobile-settings-toggle{position:absolute;top:calc(7px + env(safe-area-inset-top,0px));right:calc(8px + env(safe-area-inset-right,0px));background:#0b354fdc;color:white;border:1px solid #88becc;min-width:44px;min-height:43px}
#space-flight .ship-mobile-settings,#space-flight .ship-mobile-nav{position:absolute;top:calc(55px + env(safe-area-inset-top,0px));right:8px;width:min(340px,calc(100% - 16px));max-height:65%;overflow-y:auto;touch-action:pan-y;background:#092c43f7;color:#e9f7fa;border:1px solid #78aabb;border-radius:11px;padding:10px;box-shadow:0 8px 23px #000a}
#space-flight .ship-mobile-settings[hidden],#space-flight .ship-mobile-nav[hidden]{display:none!important}
#space-flight .ship-mobile-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}
#space-flight .ship-mobile-assignment{display:grid;grid-template-columns:20px 1fr 1fr;gap:7px;margin:6px 0;align-items:end}
#space-flight .ship-mobile-assignment label{display:flex;flex-direction:column;gap:3px;min-width:0;font-size:11px}
#space-flight .ship-mobile-assignment select{width:100%;min-width:0}
#space-flight .ship-mobile-settings button,#space-flight .ship-mobile-settings select,
#space-flight .ship-mobile-nav button,#space-flight .ship-mobile-nav select{background:#204c62;color:white;border:1px solid #81b6c3;min-height:38px;max-width:100%;font-size:12px}
#space-flight .ship-mobile-extra{display:flex;gap:8px;align-items:center;margin:10px 0}
#space-flight .ship-mobile-nav{left:50%;right:auto;transform:translateX(-50%);width:min(370px,calc(100% - 16px))}
#space-flight .ship-mobile-nav select{width:100%;margin-bottom:7px}
#space-flight .ship-mobile-nav button{margin:3px}
#space-flight.ship-mobile-active:not(.ship-mobile-advanced) .flight-head>div,
#space-flight.ship-mobile-active:not(.ship-mobile-advanced) .flight-readout,
#space-flight.ship-mobile-active:not(.ship-mobile-advanced) .flight-actions,
#space-flight.ship-mobile-active:not(.ship-mobile-advanced) .flight-walk,
#space-flight.ship-mobile-active:not(.ship-mobile-advanced) .flight-crew,
#space-flight.ship-mobile-active:not(.ship-mobile-advanced) .flight-guide,
#space-flight.ship-mobile-active:not(.ship-mobile-advanced) #seamless-ship{display:none!important}
#space-flight.ship-mobile-active .flight-display{min-height:140px;max-height:none}
#space-flight.ship-mobile-active .flight-head{padding-right:60px}
#space-flight.ship-mobile-active .flight-hud{max-width:calc(100% - 70px);font-size:10px}
@media(orientation:landscape){#space-flight .ship-mobile-stick{width:96px;height:102px}
 #space-flight .ship-mobile-stick-ring{width:78px;height:78px}
 #space-flight .ship-mobile-actions{grid-template-columns:repeat(2,49px);gap:5px}
 #space-flight .ship-mobile-button{width:49px;height:49px;min-width:49px;min-height:49px}
 #space-flight .ship-mobile-button-icon{font-size:18px}
 #space-flight .ship-mobile-button-name{font-size:8px}}
`;document.head.append(css);
 const ui=el("div","ship-mobile-layer");
 ui.innerHTML='<div class="ship-mobile-stick" role="group" aria-label="宇宙船の移動または操縦スティック"><div class="ship-mobile-stick-ring"><div class="ship-mobile-stick-nub"></div></div><small class="ship-mobile-stick-caption"></small></div>'+
  '<div class="ship-mobile-actions" role="group" aria-label="宇宙船の4アクション"></div>'+
  '<button class="ship-mobile-settings-toggle" type="button" aria-label="宇宙船の操作設定">⚙</button>'+
  '<section class="ship-mobile-settings" role="dialog" aria-label="宇宙船のスマホ操作設定" hidden></section>'+
  '<section class="ship-mobile-nav" role="region" aria-label="宇宙船航路設定" hidden></section>';
 host.append(ui);
 const $=sel=>ui.querySelector(sel);
 const ring=$(".ship-mobile-stick"),nub=$(".ship-mobile-stick-nub"),
  grid=$(".ship-mobile-actions"),settings=$(".ship-mobile-settings"),
  nav=$(".ship-mobile-nav"),toggle=$(".ship-mobile-settings-toggle");
 let config=load(),lastMode="",stateMode="shipInterior",pointer=null,stick={x:0,y:0};
 let advanced=false,navOpen=false;
 const notifyResult=result=>{if(result?.message)notify?.(result.message);return result};
 function clearStick(){pointer=null;stick={x:0,y:0};nub.style.transform="translate(0px,0px)";}
 function moveStick(e){
  const r=ring.getBoundingClientRect(),radius=Math.max(1,Math.min(r.width,r.height)*.33);
  const dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;
  const scale=Math.min(1,radius/Math.max(1,Math.hypot(dx,dy)));
  stick={x:dx*scale/radius,y:dy*scale/radius};
  nub.style.transform="translate("+Math.round(dx*scale)+"px,"+Math.round(dy*scale)+"px)";
 }
 ring.addEventListener("pointerdown",e=>{
  if(pointer!==null||!mobile()||(e.pointerType==="mouse"&&e.button!==0))return;
  e.preventDefault();pointer=e.pointerId;ring.setPointerCapture?.(e.pointerId);moveStick(e);
 });
 ring.addEventListener("pointermove",e=>{if(e.pointerId===pointer){e.preventDefault();moveStick(e);}});
 for(const event of ["pointerup","pointercancel","lostpointercapture"])
  ring.addEventListener(event,e=>{if(e.pointerId===pointer)clearStick();});
 window.addEventListener("blur",clearStick);
 function dispatch(action){
  if(action==="none")return;
  if(action==="shipSettings"){openSettings(true);return;}
  if(action==="navigation"){showNavigation(!navOpen);return;}
  notifyResult(onAction?.(action));
 }
 function renderButtons(force=false){
  if(!force&&stateMode===lastMode&&grid.childElementCount===4)return;
  lastMode=stateMode;grid.replaceChildren();
  config.profiles[stateMode].forEach((slot,i)=>{
   const info=MOBILE_ACTIONS[slot.tap],heldInfo=MOBILE_ACTIONS[slot.hold],button=el("button","ship-mobile-button");
   button.type="button";button.title=info.label+" ／ 長押し "+heldInfo.label;
   button.setAttribute("aria-label",button.title);
   button.append(el("span","ship-mobile-button-icon",info.icon),el("small","ship-mobile-button-name",info.label));
   let timer=null,held=false,activePointer=null;
   function clear(){if(timer!==null)clearTimeout(timer);timer=null;activePointer=null;}
   button.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse"&&e.button!==0)return;
    clear();held=false;activePointer=e.pointerId;
    timer=setTimeout(()=>{timer=null;held=true;dispatch(slot.hold);},520);
   });
   for(const ev of ["pointerup","pointercancel","pointerleave","lostpointercapture"])
    button.addEventListener(ev,clear);
   button.addEventListener("contextmenu",e=>e.preventDefault());
   button.addEventListener("click",e=>{if(held){e.preventDefault();held=false;return;}dispatch(slot.tap);});
   grid.append(button);
  });
 }
 function showNavigation(open){
  navOpen=Boolean(open);nav.hidden=!navOpen;
  if(!navOpen)return;
  const v=get(),routes=getRoutes?.()||[];
  nav.replaceChildren();
  const header=el("div","ship-mobile-panel-heading");
  header.append(el("strong","","🪐 航路設定"));
  const close=el("button","","×");close.type="button";close.addEventListener("click",()=>showNavigation(false));header.append(close);nav.append(header);
  if(v?.status!=="origin-orbit"||v?.seated!==true){
   nav.append(el("p","","航路は出発惑星の軌道上で、操縦席に着席して設定します。"));return;
  }
  const select=el("select");select.setAttribute("aria-label","目的惑星を選択");
  for(const route of routes){const option=el("option","",route.name+" ／ "+route.flightDays.toFixed(1)+"ゲーム日");option.value=route.id;select.append(option);}
  if(routes.some(r=>r.id===v.destinationId))select.value=v.destinationId;
  nav.append(select);
  const choose=el("button","","🧭 選択した惑星を設定");choose.type="button";
  choose.disabled=!routes.length;choose.addEventListener("click",()=>notifyResult(onChooseRoute?.(select.value)));
  const depart=el("button","","🛰️ 惑星間航行を開始");depart.type="button";
  depart.addEventListener("click",()=>{const result=notifyResult(onTransfer?.());if(result?.ok)showNavigation(false);});
  nav.append(choose,depart);
 }
 function makeSelect(value,callback,label){
  const select=el("select");select.setAttribute("aria-label",label);
  const allowed=["interact","talk","sit","stand","hatch","disembark","cargo","launchLand","autopilot","navigation","transfer","throttleUp","throttleDown","shipSettings","logs","menu","none"];
  for(const key of allowed){const info=MOBILE_ACTIONS[key];
   const option=el("option","",info.icon+" "+info.label);option.value=key;select.append(option);
  }
  select.value=value;select.addEventListener("change",()=>callback(select.value));return select;
 }
 function openSettings(open){
  settings.hidden=!open;
  if(!open)return;
  config=load();settings.replaceChildren();
  const head=el("div","ship-mobile-panel-heading");head.append(el("strong","","🎮 宇宙船の操作設定"));
  const close=el("button","","×");close.type="button";close.addEventListener("click",()=>openSettings(false));head.append(close);settings.append(head);
  const mode=el("select");mode.setAttribute("aria-label","変更する操作");
  for(const [name,label] of [["shipInterior","船内の徒歩"],["shipCockpit","操縦席"]]){
   const option=el("option","",label);option.value=name;mode.append(option);
  }
  mode.value=stateMode;
  mode.addEventListener("change",()=>drawAssignments(mode.value));
  settings.append(mode);
  const assignments=el("div","ship-mobile-assignments");settings.append(assignments);
  function drawAssignments(name){
   assignments.replaceChildren();
   config.profiles[name].forEach((slot,i)=>{
    const row=el("div","ship-mobile-assignment");row.append(el("strong","","ABCD"[i]));
    for(const key of ["tap","hold"]){
     const label=el("label","",key==="tap"?"短押し":"長押し");
     label.append(makeSelect(slot[key],value=>{
      config.profiles[name][i][key]=value;save(config);renderButtons(true);
     },"宇宙船"+name+"ボタン"+(i+1)+(key==="tap"?"短押し":"長押し")));
     row.append(label);
    }
    assignments.append(row);
   });
  }
  drawAssignments(stateMode);
  const extra=el("label","ship-mobile-extra","☑️ 従来の操縦・船内ボタンも表示");
  const checkbox=el("input");checkbox.type="checkbox";checkbox.checked=advanced;
  checkbox.addEventListener("change",()=>{advanced=checkbox.checked;host.classList.toggle("ship-mobile-advanced",advanced);});
  extra.prepend(checkbox);settings.append(extra);
  const reset=el("button","","宇宙船ボタンを初期化");reset.type="button";
  reset.addEventListener("click",()=>{
   const initial=defaultMobileConfig();config=load();
   for(const key of ["shipInterior","shipCockpit"])config.profiles[key]=initial.profiles[key];
   save(config);renderButtons(true);openSettings(true);
  });settings.append(reset);
 }
 toggle.addEventListener("click",()=>openSettings(settings.hidden));
 function apply(dt){
  if(pointer===null||!mobile())return;
  const v=get();if(!v||!v.active||!Number.isFinite(dt)||dt<=0)return;
  const dead=.12,x=Math.abs(stick.x)>dead?stick.x:0,y=Math.abs(stick.y)>dead?-stick.y:0;
  if(v.seated===true||v.interior?.mode==="cockpit"){
   if(v.seated===false)return; // never fly a surface-to-surface ship standing
   if(x&&typeof v.steer==="function")v.steer(x*Math.min(dt,.08)*42);
   if(y&&typeof v.setThrottle==="function")v.setThrottle(clamp(v.throttle+y*Math.min(dt,.08)*.42,0,1));
  }else if(v.interior?.mode==="interior"){
   v.interior.walk(y,x,Math.min(dt,.08));
  }
 }
 function render(dt=0){
  const v=get(),shown=mobile()&&Boolean(v?.active);
  host.classList.toggle("ship-mobile-active",shown);
  ui.hidden=!shown;
  if(!shown){clearStick();openSettings(false);showNavigation(false);return;}
  const mode=v?.seated===true||v?.interior?.mode==="cockpit"?"shipCockpit":"shipInterior";
  if(mode!==stateMode){stateMode=mode;clearStick();showNavigation(false);openSettings(false);}
  $(".ship-mobile-stick-caption").textContent=mode==="shipCockpit"?"操舵 ↔ ／ 出力 ↕":"船内を移動";
  renderButtons();
  apply(dt);
 }
 ui.hidden=true;
 return {render,clear:clearStick,openSettings:()=>openSettings(true),get stick(){return {...stick};}};
}
