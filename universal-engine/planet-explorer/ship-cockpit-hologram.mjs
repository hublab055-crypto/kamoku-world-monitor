import {SHIP_WEAPONS} from "./space-combat.mjs?v=20261112-warp";

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const near=(n,target,radius)=>Math.abs(n-target)<=radius;

/** Percent detents are shared by mouse, touch, keyboard and saved flight state. */
export function snapHologramLever(value,{vol=false}={}){
 const max=vol?100:125;
 if(!Number.isFinite(value))return 0;
 const n=clamp(Math.round(value),-100,max);
 if(near(n,0,4))return 0;
 if(near(n,100,4))return 100;
 if(near(n,-100,4))return -100;
 if(!vol&&near(n,125,5))return 125;
 return n;
}
/** Route speed is a normalized flight-corridor value, not a real solar-system m/s. */
export function hologramTelemetry(v,{altitude=null}={}){
 const gravitating=Boolean(v&&["docked","landed","ascent","entry","atmosphere","vtol","touchdown"].includes(v.status));
 const onGround=v?.status==="docked"||v?.status==="landed"||v?.status==="touchdown";
 const route= Math.hypot(v?.routeVelocity?.along||0,v?.routeVelocity?.cross||0,v?.verticalVelocity||0)*100;
 const alt=onGround?0:Number.isFinite(altitude)?alt:Number.isFinite(v?.airAltitude)?v.airAltitude:0;
 return {
  speed:gravitating?(Number.isFinite(v?.airSpeed)?Math.max(0,v.airSpeed).toFixed(1)+" m/s":"—"):
   route.toFixed(2)+" %/s",
  speedLabel:gravitating?"対地速度":"航路速度",
  altitude:gravitating?Math.max(0,Math.round(alt)).toLocaleString("ja-JP")+" m":"—",
  gravity:gravitating&&Number.isFinite(v?.gravityMps2)?v.gravityMps2.toFixed(2)+" m/s²":"—",
  fuel:Math.round(clamp(v?.fuel||0,0,100))+"%",
  gear:(v?.gearMode||"auto").toUpperCase()+(v?.gearDown?" / DOWN":" / UP")
 };
}

/** 2D first-person holograms are an alternative input to the existing ship model.
 * They never create a second flight state or bypass launch/landing interlocks.
 * WebXR continues to use the existing physical cockpit control mapping.
 */
export function installShipCockpitHologram({
 root,getVoyage,getCombat,onLaunch,onTransfer,onLand,onHatch,switchWeapon,notify=()=>{}
}){
 const viewport=root?.querySelector(".flight-display");
 if(!viewport)return {update:()=>{},destroy:()=>{}};
 const style=document.createElement("style");
 style.textContent=[
 '#space-flight .ship-holo-wrap{position:absolute;z-index:286;top:21%;left:8px;right:8px;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;pointer-events:none;font:12px/1.4 system-ui;color:#d7faff}',
 '#space-flight .ship-holo-wrap[hidden]{display:none!important}',
 '#space-flight .ship-holo-panel{box-sizing:border-box;width:min(225px,38vw);max-height:min(61dvh,520px);overflow-y:auto;overscroll-behavior:contain;pointer-events:auto;border:1px solid #71e5f5ae;border-radius:12px;background:linear-gradient(120deg,#062b40d9,#063444b9);box-shadow:inset 0 0 20px #29c8dd22,0 0 20px #17aecd40;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
 '#space-flight .ship-holo-panel[data-folded="true"] .ship-holo-body{display:none}',
 '#space-flight .ship-holo-toggle{width:100%;text-align:left;font-weight:750;letter-spacing:.06em;color:#a7f6ff;background:#0d465da8;border:0;border-bottom:1px solid #63cee28c;min-height:39px;padding:7px 9px;cursor:pointer}',
 '#space-flight .ship-holo-body{padding:9px;display:grid;gap:8px}',
 '#space-flight .ship-holo-body button,#space-flight .ship-holo-body select{min-height:35px;border-radius:6px;border:1px solid #80dce8;background:#15485e;color:#f2ffff;font:12px system-ui;padding:5px 7px;cursor:pointer}',
 '#space-flight .ship-holo-body button:disabled{opacity:.45;cursor:not-allowed}',
 '#space-flight .ship-holo-body button[aria-pressed="true"]{background:#287968;border-color:#a9ffde}',
 '#space-flight .ship-holo-body .ship-holo-main{background:#1b6b63;font-weight:750}',
 '#space-flight .ship-holo-body label{display:flex;align-items:center;justify-content:space-between;gap:7px;min-width:0}',
 '#space-flight .ship-holo-body select{max-width:142px;min-width:90px}',
 '#space-flight .ship-holo-gauges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}',
 '#space-flight .ship-holo-gauges div{border:1px solid #6cd2dd55;padding:4px;background:#0a263c8f;border-radius:5px;min-width:0}',
 '#space-flight .ship-holo-gauges small{display:block;color:#8fd4df;font-size:10px}',
 '#space-flight .ship-holo-gauges output{font:700 12px ui-monospace,monospace;white-space:nowrap}',
 '#space-flight .ship-holo-levers{display:flex;justify-content:space-evenly;gap:6px;align-items:center}',
 '#space-flight .ship-holo-levers label{display:flex;flex-direction:column;gap:2px;align-items:center;font-size:10px}',
 '#space-flight .ship-holo-levers input{height:116px;width:36px;writing-mode:vertical-lr;direction:rtl;accent-color:#70e9f5;touch-action:none;cursor:ns-resize}',
 '#space-flight .ship-holo-levers output{font:700 12px ui-monospace,monospace}',
 '#space-flight .ship-holo-status{color:#bde6ed;min-height:16px;font-size:10px}',
 '#space-flight .ship-holo-body .ship-holo-pair{display:grid;grid-template-columns:1fr 1fr;gap:5px}',
 '#space-flight .ship-holo-body .ship-holo-levers small{font-size:9px;color:#99d3dd}',
 '#space-flight .ship-holo-panel:focus-within{border-color:#d4ffff}',
 '@media(max-width:700px){#space-flight .ship-holo-wrap{top:23%;left:4px;right:4px;gap:3px}#space-flight .ship-holo-panel{width:min(210px,47vw);max-height:55dvh}#space-flight .ship-holo-panel[data-folded="true"]{width:110px}#space-flight .ship-holo-body{padding:6px;gap:5px}#space-flight .ship-holo-levers input{height:83px}#space-flight .ship-holo-toggle{font-size:11px;padding:5px;min-height:34px}}',
 '@media(max-height:420px){#space-flight .ship-holo-wrap{top:18%}#space-flight .ship-holo-panel{max-height:57dvh}}'
 ].join("");
 document.head.append(style);
 const wrap=document.createElement("div");wrap.className="ship-holo-wrap";wrap.hidden=true;
 wrap.setAttribute("aria-label","操縦席ホログラム操作盤");
 wrap.innerHTML=
 '<section class="ship-holo-panel" data-side="left"><button type="button" class="ship-holo-toggle" aria-expanded="true">◀ 推進 / NAV</button><div class="ship-holo-body">'+
 '<div class="ship-holo-gauges"><div><small data-speed-label>対地速度</small><output data-speed>—</output></div><div><small>高度</small><output data-altitude>—</output></div><div><small>重力</small><output data-gravity>—</output></div><div><small>燃料</small><output data-fuel>—</output></div></div>'+
 '<div class="ship-holo-levers"><label>MAIN<input data-lever="main" type="range" min="-100" max="125" step="1" value="0" aria-label="主推進スロットル：ゼロ、最大、ワープにスナップ"><output data-main>0%</output><small>逆噴射 / WARP</small></label>'+
 '<label>VOL<input data-lever="vol" type="range" min="-100" max="100" step="1" value="0" aria-label="VOL上下推力：ゼロと上下の最大位置にスナップ"><output data-vol>0%</output><small>降下 / 上昇</small></label></div>'+
 '<div class="ship-holo-pair"><button type="button" data-action="hatch">🚪 ハッチ</button><button type="button" data-action="gear">🛬 脚 AUTO</button></div>'+
 '<button type="button" class="ship-holo-main" data-action="primary">🚀 離陸</button><button type="button" data-action="autopilot" aria-pressed="false">🧭 自動操縦 OFF</button>'+
 '<small class="ship-holo-status" data-flight-note></small></div></section>'+
 '<section class="ship-holo-panel" data-side="right"><button type="button" class="ship-holo-toggle" aria-expanded="true">SYS / 兵装 ▶</button><div class="ship-holo-body">'+
 '<label>兵装<select data-weapon aria-label="兵装切り替え"></select></label>'+
 '<button type="button" data-action="lock" aria-pressed="false">🎯 自動ロック OFF</button><button type="button" data-action="autoFire" aria-pressed="false">🔴 自動火器 OFF</button>'+
 '<div class="ship-holo-pair"><button type="button" data-action="ciws" aria-pressed="false">CIWS</button><button type="button" data-action="refuel">⛽ 補給</button></div>'+
 '<label>修理箇所<select data-part><option value="engine">推進機</option><option value="hull">船体</option><option value="weapons">兵装</option><option value="shield">バリア</option></select></label>'+
 '<button type="button" data-action="repair">🔧 修理キットを使用</button>'+
 '<small class="ship-holo-status" data-supplies></small></div></section>';
 viewport.append(wrap);
 const pick=q=>wrap.querySelector(q);
 const levers=[pick('[data-lever="main"]'),pick('[data-lever="vol"]')];
 const weapon=pick("[data-weapon]");
 for(const [id,config] of Object.entries(SHIP_WEAPONS))weapon.add(new Option(config.name,id));
 for(const panel of wrap.querySelectorAll(".ship-holo-panel")){
  const toggle=panel.querySelector(".ship-holo-toggle");
  toggle.addEventListener("click",()=>{
   const folded=panel.dataset.folded!=="true";panel.dataset.folded=String(folded);
   toggle.setAttribute("aria-expanded",String(!folded));
  });
 }
 // Keep the cockpit clear on a phone; both holograms remain a tap away.
 if(typeof window!=="undefined"&&window.matchMedia?.("(max-width:700px)")?.matches){
  for(const panel of wrap.querySelectorAll(".ship-holo-panel")){
   panel.dataset.folded="true";panel.querySelector(".ship-holo-toggle").setAttribute("aria-expanded","false");
  }
 }
 const seated=()=>{const v=getVoyage();return v?.seated===true&&!v.isCrewTest?v:null;};
 const combat=()=>getCombat?.();
 function notice(result){
  if(result?.message)notify(result.message);
  update(lastView);
  return result;
 }
 function changeLever(which,n){
  const v=seated();if(!v)return;
  const val=snapHologramLever(n,{vol:which==="vol"});
  if(which==="vol"){
   if(v.inWarp)return;
   v.volThrottle=val/100;
   if(val)v.setAutopilot(false);
  }else{
   if(val>=120){
    if(!v.warpEngaged)notice(v.setWarp(true));
    return;
   }
   v.setThrottle(Math.min(100,val)/100);
   v.setAutopilot(false);
  }
 }
 for(const input of levers){
  input.addEventListener("input",()=>changeLever(input.dataset.lever,Number(input.value)));
  input.addEventListener("change",()=>changeLever(input.dataset.lever,Number(input.value)));
  input.addEventListener("keydown",event=>event.stopPropagation());
 }
 weapon.addEventListener("change",()=>{if(seated())switchWeapon?.(weapon.value);});
 function action(id){
  const v=seated();if(!v)return;
  const m=combat();let result=null;
  if(id==="primary"){
   result=["docked","landed","preflight"].includes(v.status)?onLaunch?.():
    v.status==="origin-orbit"?onTransfer?.():onLand?.();
  }else if(id==="hatch")result=onHatch?.();
  else if(id==="gear"){v.cycleGear?.();result={ok:true,message:"着陸脚："+v.gearMode.toUpperCase()};}
  else if(id==="autopilot"){v.setAutopilot(!v.autopilot);result={ok:true,message:"自動操縦："+(v.autopilot?"ON":"OFF")};}
  else if(m){
   if(id==="lock")m.fireControl=!m.fireControl;
   else if(id==="autoFire"){m.autoFire=!m.autoFire;v.autoFire=m.autoFire;}
   else if(id==="ciws")m.ciwsEnabled=!m.ciwsEnabled;
   else if(id==="refuel")result=m.refuel(v,v.fuel===0&&m.supplies.fuel===0);
   else if(id==="repair")result=m.repairPart(pick("[data-part]").value);
   if(["lock","autoFire","ciws","refuel","repair"].includes(id))v.shipSystems=m.systemSnapshot();
  }
  if(result)notice(result);else update(lastView);
 }
 wrap.addEventListener("click",event=>{
  const button=event.target.closest?.("button[data-action]");
  if(button&&wrap.contains(button))action(button.dataset.action);
 });
 const txt=(selector,value)=>{const el=pick(selector);if(el&&el.textContent!==value)el.textContent=value;};
 function press(id,enabled){const button=pick('[data-action="'+id+'"]');if(button)button.setAttribute("aria-pressed",String(Boolean(enabled)));}
 let lastView={};
 function update({visible=false,altitude=null}={}){
  lastView={visible,altitude};
  const v=getVoyage(),canUse=Boolean(visible&&v?.seated&&!v.isCrewTest);
  wrap.hidden=!canUse;
  if(!canUse)return;
  const t=hologramTelemetry(v,{altitude}),m=combat();
  txt("[data-speed-label]",t.speedLabel);txt("[data-speed]",t.speed);
  txt("[data-altitude]",t.altitude);txt("[data-gravity]",t.gravity);txt("[data-fuel]",t.fuel);
  txt("[data-action=gear]","🛬 脚 "+t.gear);
  txt("[data-action=hatch]",v.hatchOpen?"🔒 ハッチを閉じる":"🚪 ハッチを開く");
  txt("[data-action=autopilot]","🧭 自動操縦 "+(v.autopilot?"ON":"OFF"));press("autopilot",v.autopilot);
  txt("[data-action=lock]","🎯 自動ロック "+(m?.fireControl?"ON":"OFF"));press("lock",m?.fireControl);
  txt("[data-action=autoFire]","🔴 自動火器 "+(m?.autoFire?"ON":"OFF"));press("autoFire",m?.autoFire);
  txt("[data-action=ciws]","CIWS "+(m?.ciwsEnabled?"ON":"OFF"));press("ciws",m?.ciwsEnabled);
  txt("[data-supplies]",m?"燃料パック "+m.supplies.fuel+" / 修理キット "+m.supplies.kits:"機体システム接続待ち");
  txt("[data-main]",v.warpEngaged?"WARP":Math.round(v.throttle*100)+"%");
  txt("[data-vol]",Math.round((v.volThrottle||0)*100)+"%");
  const dragging=el=>el.matches?.(":active")||document.activeElement===el;
  if(!dragging(levers[0]))levers[0].value=String(v.warpEngaged?125:Math.round(v.throttle*100));
  if(!dragging(levers[1]))levers[1].value=String(Math.round((v.volThrottle||0)*100));
  if(m&&document.activeElement!==weapon)weapon.value=m.weapon;
  weapon.disabled=!m;
  for(const id of ["lock","autoFire","ciws","refuel","repair"])pick('[data-action="'+id+'"]').disabled=!m;
  const ready=["docked","landed","preflight"].includes(v.status);
  const enter=v.readyToLand===true;
  const primary=pick("[data-action=primary]");
  primary.textContent=ready?"🚀 離陸":v.status==="atmosphere"?"🛬 VTOL着陸":
   v.status==="origin-orbit"?"🛰️ 航行開始":enter?"🔥 大気圏突入":"航行中";
  primary.disabled=!(ready||v.status==="atmosphere"||v.status==="origin-orbit"&&v.destinationId||enter)||v.status==="vtol";
  txt("[data-flight-note]",v.hatchOpen?"ハッチを閉鎖後に離陸可能":
   v.inWarp?"ワープ飛行中":v.status==="origin-orbit"&&!v.destinationId?"航路を先に設定してください":"主推進 / VOLは独立制御");
  pick("[data-action=hatch]").disabled=!["docked","landed"].includes(v.status);
  pick("[data-action=gear]").disabled=typeof v.cycleGear!=="function";
  pick("[data-action=refuel]").disabled=!m||v.fuel>=100;
 }
 return {update,destroy(){wrap.remove();style.remove();}};
}
