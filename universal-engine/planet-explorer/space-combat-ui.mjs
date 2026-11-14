import {pickShipContact} from "./ship-view-gestures.mjs?v=20261109-cabin-tap";
import {installShipService} from "./ship-service-ui.mjs?v=20261108-ciws-captain";
import {installTurretEditor} from "./ship-turret-editor.mjs?v=20261108-vtol";
import {normalizeTurrets} from "./ship-turrets.mjs?v=20261108-vtol";
import {SpaceCombat,SHIP_WEAPONS,combatEligible,shipContactDistance} from "./space-combat.mjs?v=20261112-warp";
import {xrCockpitControlHit} from "./ship-control-hit.mjs?v=20261114-armrest-holograms";
import {COCKPIT_HOLOGRAM_ACTIONS,applyCockpitHologramAction} from "./ship-cockpit-hologram.mjs?v=20261114-armrest";
import {installCockpitDashboard} from "./ship-cockpit-dashboard-ui.mjs?v=20261107";

/** Screen-space markers share the real WebGL ship projection. XR uses the
 * same projected contacts for gaze dwell, but no DOM markers in the headset.
 */
export function installSpaceCombatUI({getVoyage,getRenderer,isVR=()=>false,notify=()=>{},
 onHatch=()=>({ok:false,message:"ハッチ制御は利用できません"}),
 onCamera=()=>({ok:false,message:"視点切替不可"}),onWide=()=>({ok:false,message:"広画面不可"}),
 getViewSettings=()=>({}),setViewSettings=()=>{},onStar=()=>{},tradeWares=[],onTrade=()=>{}}){
 const root=document.getElementById("space-flight");
 const actions=root?.querySelector(".flight-actions");
 if(!root||!actions)return {getCombat:()=>null,update:()=>{},fire:()=>false,active:()=>false};
 const style=document.createElement("style");
 style.textContent=`
 #ship-combat-markers{position:fixed;inset:0;z-index:3504;pointer-events:none;overflow:hidden;color:#fff;font:12px/1.2 system-ui}
 #ship-combat-markers[hidden]{display:none!important}
 #ship-combat-markers .combat-contact{position:absolute;transform:translate(-50%,-50%);min-width:68px;
  text-align:center;color:#a4d8e7;text-shadow:0 1px 4px #000,0 0 4px #000}
 #ship-combat-markers .combat-contact .combat-ring{display:block;width:31px;height:31px;margin:auto;
  border:2px solid #72b7d5;border-radius:0;transform:rotate(45deg);background:transparent}
 #ship-combat-markers .combat-contact.hostile{color:#ff9c40;--contact:#ff9c40}
 #ship-combat-markers .combat-contact.friendly{color:#61b9ff;--contact:#61b9ff}
 #ship-combat-markers .combat-contact.neutral{color:#62df87;--contact:#62df87}
 #ship-combat-markers .combat-contact .combat-ring{border-color:var(--contact,#ff9c40)}
 #ship-combat-markers .combat-contact.locked{color:#ff6262;--contact:#ff3333}
 #ship-combat-markers .combat-contact.locked .combat-ring{border:3px solid #ff3333;box-shadow:0 0 12px #ff3333}
 #ship-combat-markers .combat-contact.hit .combat-ring{box-shadow:0 0 25px 12px #ff6945;border-color:#fff}
 #ship-combat-markers .combat-label{display:block;white-space:nowrap;font-size:11px}
 #ship-combat-markers .combat-bars{display:block;width:64px;height:9px;margin:3px auto;background:linear-gradient(to bottom,#17232e 0 45%,#352b2b 45%);border:1px solid #b8cbd5}
 #ship-combat-markers .combat-bars i,#ship-combat-markers .combat-bars b{display:block;height:4px;background:#45caff}
 #ship-combat-markers .combat-bars b{height:3px;background:#fa6666}
 #ship-combat-markers .combat-contact.shield .combat-ring{background:#64caff70;box-shadow:0 0 18px 10px #69bfff80}
 #ship-combat-markers .combat-shot{position:absolute;width:8px;height:8px;border-radius:50%;background:#ffde80;box-shadow:0 0 18px 5px #ff6c2e;pointer-events:none}
 #ship-combat-markers .combat-shot.missile{width:14px;height:5px;border-radius:2px;background:#fff;box-shadow:0 0 20px 6px #ff9b34}
 #ship-combat-markers .combat-shot.enemy{background:#ff4444}
 #ship-combat-markers .combat-impact{position:absolute;width:35px;height:35px;border-radius:50%;background:radial-gradient(circle,#fff 0%,#ffda4b 25%,#ff6522 50%,transparent 75%);transform:translate(-50%,-50%);pointer-events:none}
 #ship-combat-markers .combat-player-hud{position:absolute;left:50%;bottom:14%;transform:translateX(-50%);padding:2px 5px;background:transparent;border:0;color:#fff;white-space:nowrap;text-shadow:0 1px 5px #000}
 #ship-combat-markers .combat-player-hud.shield{box-shadow:0 0 18px 5px #6acbff}

 #ship-combat-markers .combat-gaze{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:17px;height:17px;border:1px solid #bfe6ff;border-radius:50%;opacity:.7}
 #space-flight .ship-weapon-switch,#space-flight .ship-fire-trigger{border-color:#b6c6aa}
 #space-flight .ship-combat-console{position:absolute;right:8px;top:calc(57px + env(safe-area-inset-top,0px));bottom:auto;z-index:300;display:flex;align-items:center;flex-wrap:wrap;justify-content:flex-end;gap:5px;padding:6px;background:#0a2039ed;border:1px solid #4c849e;border-radius:7px;pointer-events:auto;max-width:min(350px,calc(100% - 18px));box-shadow:0 4px 16px #0009}
 #space-flight.integrated .ship-combat-console{pointer-events:auto;overflow:visible}
 #space-flight .ship-combat-console[hidden]{display:none!important}
 #space-flight .ship-combat-console button{min-height:40px;padding:6px 9px;background:#193b53;color:#effaff;border:1px solid #5b9ebc;border-radius:5px;font:12px system-ui}
 #space-flight .ship-combat-console .ship-scan-trigger{color:#8cf4ff}
 #space-flight .ship-combat-console .ship-fire-trigger{background:#7d3434}
 #space-flight .ship-combat-console button:disabled{opacity:.4}
 @media(max-width:590px){#space-flight .ship-combat-console{top:55px;right:4px;max-width:calc(100% - 8px);padding:4px;gap:3px}#space-flight .ship-combat-console button{font-size:10px;padding:4px 5px;min-height:35px}}
 #space-flight .ship-fire-trigger{background:#7d3434;color:#fff}
 #space-flight .ship-radio-overlay{position:absolute;z-index:295;left:12px;top:100px;
  max-width:min(440px,calc(100% - 24px));background:transparent!important;
  border:0!important;box-shadow:none!important;color:#daefff;font:12px/1.4 system-ui;
  text-shadow:0 1px 5px #000,0 0 8px #000;pointer-events:none}
 #space-flight .ship-radio-overlay[hidden]{display:none!important}
 #space-flight .ship-radio-overlay .ship-radio-message{display:block;max-width:410px;min-height:17px}
 #space-flight .ship-radio-overlay .ship-radio-options{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;pointer-events:auto}
 #space-flight .ship-radio-overlay .ship-radio-options[hidden]{display:none!important}
 #space-flight .ship-radio-overlay button{border:1px solid #92c9d9;border-radius:5px;
  min-height:32px;background:#112f4290;color:#e2fcff;padding:4px 7px;font:11px system-ui}
 #space-flight .ship-combat-console .ship-radio-toggle{border-color:#9cbed6;color:#e2faff}
 @media(max-width:590px){#space-flight .ship-radio-overlay{top:105px;left:6px;font-size:11px}}
 #space-flight .ship-weapon-switch[hidden],#space-flight .ship-fire-trigger[hidden]{display:none!important}
 @media(pointer:coarse){#space-flight .ship-fire-trigger{min-width:68px;font-size:13px}}
 `;
 document.head.append(style);
 const markers=document.createElement("div");
 markers.id="ship-combat-markers";markers.hidden=true;markers.setAttribute("aria-hidden","true");
 const gaze=document.createElement("div");gaze.className="combat-gaze";markers.append(gaze);
 const playerHud=document.createElement("div");playerHud.className="combat-player-hud";markers.append(playerHud);
 const shotNodes=[];
 document.body.append(markers);
 const dashboard=installCockpitDashboard({root,onAction:handleDashboardAction,
  getViewSettings,setViewSettings});
 const consolePanel=dashboard.panel;
 let scanUntil=0,scannedIds=new Set();
 let previousVoyage=null,combat=null,lastRadioId=0,radioExpanded=false;
 const turretEditor=installTurretEditor({root,panel:consolePanel,getCombat,getVoyage,notify});
 const service=installShipService({root,panel:consolePanel,getCombat,getVoyage,notify});
 const flareButton=document.createElement("button");flareButton.type="button";flareButton.textContent="🔥 フレア";
 flareButton.onclick=()=>{const r=getCombat()?.deployFlares(getVoyage());if(r)notify(r.message);};consolePanel.append(flareButton);
 const ciwsButton=document.createElement("button");ciwsButton.type="button";
 ciwsButton.onclick=()=>{const m=getCombat();if(m)m.ciwsEnabled=!m.ciwsEnabled;};consolePanel.append(ciwsButton);
 const lockButton=document.createElement("button");
 lockButton.type="button";
 lockButton.textContent="🎯 敵をロック";
 lockButton.onclick=()=>{
  const v=getVoyage(),model=getCombat();
  if(!model||!combatEligible(v)){feedbackWhenUnavailable();return;}
  const contacts=model.combatTargets.map(target=>({target,range:shipContactDistance(target,v)}))
   .filter(({range})=>range<=1500).sort((a,b)=>a.range-b.range);
  const nearest=contacts[0]?.target;
  if(nearest)selectNavigation(nearest.id);
  else notify("1.5km以内に攻撃ロックできる敵はいません");
 };
 consolePanel.append(lockButton);
 const fireControl=document.createElement("button");
 fireControl.type="button";
 fireControl.onclick=()=>{const m=getCombat();if(m)m.fireControl=!m.fireControl;};
 consolePanel.append(fireControl);
 const targetNodes=new Map();
 const radio=document.createElement("section");radio.className="ship-radio-overlay";
 radio.hidden=true;radio.setAttribute("role","group");radio.setAttribute("aria-label","宇宙船通信");
 const radioLine=document.createElement("span");radioLine.className="ship-radio-message";
 radioLine.setAttribute("aria-live","polite");radio.append(radioLine);
 const radioOptions=document.createElement("div");radioOptions.className="ship-radio-options";
 radio.append(radioOptions);root.append(radio);
 const radioToggle=document.createElement("button");radioToggle.type="button";
 radioToggle.className="ship-radio-toggle";radioToggle.textContent="📻 通信";
 radioToggle.setAttribute("aria-label","通信交渉メニュー");
 radioToggle.setAttribute("aria-expanded","false");consolePanel.append(radioToggle);
 function radioButton(label,callback){
  const b=document.createElement("button");b.type="button";b.textContent=label;
  b.addEventListener("click",()=>{const result=callback(getCombat());if(result?.message){radioFeedback=result.message;notify(result.message);}refreshRadio();});
  radioOptions.append(b);return b;
 }
 const channel=radioButton("交信する",m=>{
  const id=getVoyage()?.navigationTarget?.id;
  const target=m?.allContacts.find(contact=>contact.id===id);
  return target?{ok:true,message:target.name+"との通信チャンネルを開きました"}:
   {ok:false,message:"HUDで通信相手を選んでください"};
 });
 const trade=document.createElement("div");
 const goods=document.createElement("select");
 goods.setAttribute("aria-label","交易品");
 for(const ware of tradeWares)goods.add(new Option(ware.name+" 購入 "+ware.price+" / 売却 "+Math.max(1,Math.floor(ware.price*.6)),ware.item));
 trade.append(goods);
 for(const [label,direction] of [["購入","buy"],["売却","sell"]]){
  const button=document.createElement("button");
  button.type="button";button.textContent=label;
  button.addEventListener("click",()=>{
   const result=onTrade(goods.value,direction);
   if(result?.message){radioFeedback=result.message;notify(result.message);refreshRadio();}
  });
  trade.append(button);
 }
 radioOptions.append(trade);
 const closeRadio=document.createElement("button");
 closeRadio.type="button";closeRadio.textContent="閉じる";
 radioOptions.append(closeRadio);
 let radioFeedback="";
 closeRadio.addEventListener("click",()=>toggleRadio());
 const demand=radioButton("⚠️ 降伏を勧告",m=>m?.demandSurrender());
 const cease=radioButton("🤝 停戦提案",m=>m?.requestCeasefire());
 const surrender=radioButton("🏳️ 降伏する",m=>m?.offerSurrender());
 const accept=radioButton("✅ 降伏を受諾",m=>{
  const target=m?.targets.find(t=>t.offeredSurrender&&!t.surrendered&&t.hp>0);
  return target?m.respondSurrender(target.id,true):{ok:false,message:"敵からの降伏申請はありません"};
 });
 const reject=radioButton("❌ 申請を拒否",m=>{
  const target=m?.targets.find(t=>t.offeredSurrender&&!t.surrendered&&t.hp>0);
  return target?m.respondSurrender(target.id,false):{ok:false,message:"敵からの降伏申請はありません"};
 });
 function toggleRadio(){
  radioExpanded=!radioExpanded;radioFeedback="";
  radioToggle.setAttribute("aria-expanded",String(radioExpanded));refreshRadio();
 }
 radioToggle.addEventListener("click",toggleRadio);
 function refreshRadio(){
  const m=getCombat(),v=getVoyage();
  const show=Boolean(v?.active&&!isVR());
  radio.hidden=!show||!m?.radioEvents.length&&!radioExpanded;
  if(!show)return;
  const last=m?.radioEvents.at(-1);
  const target=m?.allContacts.find(contact=>contact.id===v.navigationTarget?.id);
  const trading=target&&["friendly","neutral"].includes(target.faction)&&combatEligible(v)&&shipContactDistance(target,v)<=500;
  trade.hidden=!trading;
  channel.disabled=!target;
  radioLine.textContent=radioFeedback||(radioExpanded&&target?
   target.name+" ／ "+Math.round(shipContactDistance(target,v))+" m"+(["friendly","neutral"].includes(target.faction)?" ／ 交易圏500m":""):
   last?.message||"📻 HUDから通信相手を選択");
  radioOptions.hidden=!radioExpanded;
  surrender.textContent=m?.playerSurrendered?"⚔️ 降伏を撤回":"🏳️ 降伏する";
  const pending=Boolean(m?.targets.some(t=>t.offeredSurrender&&!t.surrendered&&t.hp>0));
  accept.hidden=reject.hidden=!pending;
  demand.disabled=cease.disabled=!combatEligible(v);
 }
 function active(){return combatEligible(getVoyage());}
 function getCombat(v=getVoyage()){
  if(!v?.active){previousVoyage=null;combat=null;return null;}
  if(v!==previousVoyage){previousVoyage=v;combat=new SpaceCombat(v.shipSystems);
   let saved=null;try{saved=JSON.parse(localStorage.getItem("ue:ship-turrets:v1")||"null");}catch(_){}
   combat.turrets=normalizeTurrets(v.turrets||saved);combat.autoFire=Boolean(v.autoFire);
   if(v.turrets)v.turrets=normalizeTurrets(combat.turrets);
   scanUntil=0;scannedIds=new Set();lastRadioId=0;}
  return combat;
 }
 function feedbackWhenUnavailable(){
  const v=getVoyage();
  notify(!v?.active?"🚀 宇宙船に乗ってください":
   !v.seated?"🪑 操縦席に座ってください":
   "🛰️ 索敵・火器は宇宙航行中に使用できます。先に離陸してください");
 }
 function fire(){
  const model=getCombat();
  if(!model||!active()){feedbackWhenUnavailable();return false;}
  const result=model.fire(true);
  notify(result.ok?result.message:
   result.message==="敵機をロックオンしてください"?
    "🎯 敵機をタップ／VRの視線でロックオンしてください":result.message);
  update(0,{vr:isVR()});
  return true; // Consume a trigger even when no target is locked.
 }
 const holoIds=new Set(COCKPIT_HOLOGRAM_ACTIONS.map(action=>action.id));
 function pressHologram(id){
  const result=applyCockpitHologramAction(id,{
   voyage:getVoyage(),combat:getCombat(),switchWeapon:()=>setWeapon(),
   scan,radio:toggleRadio
  });
  if(result?.message)notify(result.message);
  return Boolean(result?.ok);
 }
 function pressVRButton({matrix,stage}={}){
  const v=getVoyage(),viewer=getRenderer();
  if(!v?.seated||viewer?.shipCameraMode==="chase")return false;
  const hit=xrCockpitControlHit(matrix,stage);
  if(!hit)return false;
  if(hit.id==="throttle")return cycleLever();
  return holoIds.has(hit.id)?pressHologram(hit.id):dashboard.executeHardware(hit.id);
 }
 function setWeapon(type){
  const voyage=getVoyage(),model=getCombat();
  if(!model||!voyage?.seated){feedbackWhenUnavailable();return;}
  if(!model.setWeapon(type??({pulse:"rapid",rapid:"missile",missile:"pulse"})[model.weapon]))return;
  voyage.shipSystems=model.systemSnapshot();
  notify("🎯 兵装："+model.config.name+"（同時ロック "+model.config.locks+"機）");
  update(0,{vr:isVR()});
 }
 function scan(){
  const model=getCombat();if(!model||!active()){feedbackWhenUnavailable();return false;}
  scannedIds=new Set(model.allContacts.filter(t=>shipContactDistance(t,getVoyage())<=5000).map(t=>t.id));
  const viewer=getRenderer();if(viewer)viewer.shipScannedIds=scannedIds;
  scanUntil=Date.now()+30000;
  const msg="📡 周囲スキャン："+scannedIds.size+"件の船舶を捕捉（自動スキャン継続中）";
  notify(msg+(scannedIds.size===0?"／付近に検出対象はありません":""));
  consolePanel.dataset.scanStatus=String(scannedIds.size);
  update(0,{vr:isVR()});
  return true;
 }
 function handleDashboardAction(id){
  if(id==="radio"){toggleRadio();return true;}
  if(id==="flare"){const r=getCombat()?.deployFlares(getVoyage());if(r)notify(r.message);return Boolean(r?.ok);}
  if(id==="ciws"){const m=getCombat();if(m)m.ciwsEnabled=!m.ciwsEnabled;return Boolean(m);}
  if(id==="scan")return scan();
  if(id==="weapon")return setWeapon();
  if(id==="fire")return fire();
  if(id==="hatch"){
   const result=onHatch();if(result?.message)notify(result.message);return Boolean(result?.ok);
  }
  if(id==="auto"){
   const v=getVoyage();
   if(!v?.seated||typeof v.setAutopilot!=="function"){
    notify("🪑 自動航行は操縦席から操作してください");return false;
   }
   v.setAutopilot(!v.autopilot);notify("🧭 自動航行："+(v.autopilot?"ON":"OFF"));return true;
  }
  const result=id==="camera"?onCamera():id==="wide"?onWide():null;
  if(result?.message)notify(result.message);
  return Boolean(result?.ok);
 }
 function cycleLever(){
  const v=getVoyage();if(!v?.seated)return false;
  const levels=[-1,0,.5,1];
  let next=v.warpEngaged?0:levels.find(n=>n>v.throttle+.01);
  if(next===undefined){
   if(v.canTranslate&&v.destinationId&&!v.warpArrived){
    const result=v.setWarp(true);notify(result.message);
    if(result.ok)return true;
   }
   next=-1;
  }
  v.setThrottle(next);v.setAutopilot(false);
  notify("推力レバー："+Math.round(next*100)+"%");return true;
 }
 function selectNavigation(id){
  const v=getVoyage(),model=getCombat();if(!v||!model)return;
  if(id.startsWith("star:")){onStar(id.slice(5));return;}
  radioFeedback="";
  const contact=id==="planet"?{id:"planet",name:"目的惑星",position:[0,0,12000]}:model.allContacts.find(c=>c.id===id);
  if(!contact)return;
  const navigationSelected=v.selectNavigationTarget?.(contact);
  if(contact.faction==="hostile"){
   if(!combatEligible(v)){notify("🪑 攻撃ロックは操縦席に着席して宇宙航行中に使用してください");return;}
   const locked=model.lockContact(id,v);
   notify(locked?"🎯 攻撃ロック："+contact.name:"🎯 航行目標："+contact.name+"／攻撃ロック射程外（1.5km）");return;
  }
  if(navigationSelected)notify("🎯 航行目標："+contact.name+"／自動操縦ONで追航します");
 }
 let gamepadTriggerHeld=false;
 // The main WebGL canvas is the hit region for pointer lock; in VR gaze owns it.
 function handleShipTap(clientX,clientY){
  const viewer=getRenderer();
  if(!getVoyage()?.active||isVR()||!viewer?.canvas)return;
  const controlRect=viewer.canvas.getBoundingClientRect();
  if(viewer?.shipCameraMode!=="chase"&&controlRect.width&&controlRect.height){
   const physical=(viewer.shipCockpitControls||[]).filter(p=>p.onScreen).map(p=>({...p,distance:
    Math.hypot(controlRect.left+p.u*controlRect.width-clientX,controlRect.top+p.v*controlRect.height-clientY)}))
    .filter(p=>p.distance<24).sort((a,b)=>a.distance-b.distance)[0];
   if(physical){
    if(physical.id==="seat"){const result=getVoyage().sit();notify(result.message);}
    else if(physical.id==="throttle")cycleLever();
    else if(holoIds.has(physical.id))pressHologram(physical.id);
    else dashboard.executeHardware(physical.id);
    return;
   }
  }
  const chosen=pickShipContact(viewer?.shipTargets,controlRect,clientX,clientY);
  if(chosen&&(chosen.id==="planet"||chosen.id.startsWith("star:")||scannedIds.has(chosen.id)))selectNavigation(chosen.id);
 }

 document.addEventListener("keydown",event=>{
  if(event.code!=="Space"||event.repeat||event.altKey||event.ctrlKey||event.metaKey||
   !active()||isVR()||event.target.closest?.("dialog[open]")||["INPUT","TEXTAREA","SELECT","BUTTON"].includes(document.activeElement?.tagName))
   return;
  event.preventDefault();fire();
 },true);
 function update(dt=0,{vr=isVR()}={}){
  const v=getVoyage(),model=getCombat(v),engage=combatEligible(v);
  // Physical gamepad right trigger also works on desktop/tablet.
  const pads=typeof navigator!=="undefined"&&navigator.getGamepads?.();
  const pressed=Boolean(!vr&&pads&&Array.from(pads).some(p=>
   p?.buttons?.[7]?.pressed||p?.buttons?.[7]?.value>.6));
  const fireEdge=pressed&&!gamepadTriggerHeld&&engage;
  gamepadTriggerHeld=pressed;
  if(fireEdge)fire();

  const viewer=getRenderer();
  if(viewer){viewer.shipCombat=model;viewer.selectShipNavigation=selectNavigation;viewer.handleShipTap=handleShipTap;}
  const projections=viewer?.shipTargets||[];
  model?.syncVisibility(projections,dt,{vr,eligible:engage,voyage:v});
  const show=Boolean(v?.active&&!vr);
  // Continuous sensors include friendlies/resources after the last hostile is gone.
  if(model&&v?.active){
   scannedIds=new Set(model.allContacts.filter(t=>shipContactDistance(t,v)<=5000).map(t=>t.id));
   scanUntil=Infinity;v.shipSystems=model.systemSnapshot();
  }
  if(viewer)viewer.shipScannedIds=scannedIds;
  fireControl.hidden=!engage;
  fireControl.textContent="火器管制 "+(model?.fireControl?"ON":"OFF");
  fireControl.setAttribute("aria-pressed",String(Boolean(model?.fireControl)));
  lockButton.hidden=!engage;
  dashboard.refresh({visible:show,model,v});turretEditor.refresh(show);service.refresh(show);
  if(!show){radio.hidden=true;radioExpanded=false;radioToggle.setAttribute("aria-expanded","false");}
  if(viewer)viewer.shipControlLayout=dashboard.layout;
  markers.hidden=!show;
  if(!show){for(const node of targetNodes.values())node.hidden=true;for(const n of shotNodes)n.remove();shotNodes.length=0;return;}
  const rect=viewer?.canvas?.getBoundingClientRect();
  if(!rect||!rect.width||!rect.height)return;
  gaze.style.left=(rect.left+rect.width*.5)+"px";
  gaze.style.top=(rect.top+rect.height*.5)+"px";
  // The single transparent ship-sensor overlay draws ALL target names and
  // range labels. Do not duplicate them as boxed combat target widgets.
  for(const node of targetNodes.values())node.hidden=true;
  ciwsButton.textContent="CIWS "+(model.ciwsEnabled?"ON":"OFF")+" "+model.ciwsAmmo;flareButton.textContent="🔥 フレア "+model.flareAmmo;
  playerHud.textContent="🛡️ "+Math.round(model.player.shield)+" / "+model.player.maxShield+"   ❤️ "+Math.round(model.player.hp)+" / "+model.player.maxHp;
  playerHud.classList.toggle("shield",model.player.shieldFlash>0);
  // Missile trails, impact fire and destruction shards are real WebGL meshes
  // projected by the renderer in cockpit, chase and stereoscopic Quest views.
  for(const n of shotNodes)n.remove();shotNodes.length=0;
  const recent=model.radioEvents.filter(event=>event.id>lastRadioId);
  for(const message of recent)notify(message.message);
  if(recent.length)lastRadioId=recent.at(-1).id;
  refreshRadio();
 }
 return {getCombat,update,fire,active,scan,toggleRadio,switchWeapon:setWeapon,pressVRButton};
}
