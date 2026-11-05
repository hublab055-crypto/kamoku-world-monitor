import {SpaceCombat,SHIP_WEAPONS,combatEligible} from "./space-combat.mjs?v=1";

/** Screen-space markers share the real WebGL ship projection. XR uses the
 * same projected contacts for gaze dwell, but no DOM markers in the headset.
 */
export function installSpaceCombatUI({getVoyage,getRenderer,isVR=()=>false,notify=()=>{}}){
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
 #ship-combat-markers .combat-player-hud{position:absolute;left:50%;bottom:14%;transform:translateX(-50%);padding:5px 10px;background:#091727bb;border-radius:6px;color:#fff;white-space:nowrap}
 #ship-combat-markers .combat-player-hud.shield{box-shadow:0 0 18px 5px #6acbff}

 #ship-combat-markers .combat-gaze{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:17px;height:17px;border:1px solid #bfe6ff;border-radius:50%;opacity:.7}
 #space-flight .ship-weapon-switch,#space-flight .ship-fire-trigger{border-color:#b6c6aa}
 #space-flight .ship-combat-console{position:absolute;right:12px;bottom:12px;z-index:45;display:flex;align-items:center;gap:5px;padding:7px;background:#0a2039dc;border:1px solid #4c849e;border-radius:7px;pointer-events:auto}
 #space-flight .ship-combat-console[hidden]{display:none!important}
 #space-flight .ship-combat-console button{min-height:40px;padding:6px 9px;background:#193b53;color:#effaff;border:1px solid #5b9ebc;border-radius:5px;font:12px system-ui}
 #space-flight .ship-combat-console .ship-scan-trigger{color:#8cf4ff}
 #space-flight .ship-combat-console .ship-fire-trigger{background:#7d3434}
 #space-flight .ship-combat-console button:disabled{opacity:.4}
 @media(max-width:590px){#space-flight .ship-combat-console{right:4px;bottom:4px;padding:4px;gap:3px}#space-flight .ship-combat-console button{font-size:10px;padding:4px 5px;min-height:35px}}
 #space-flight .ship-fire-trigger{background:#7d3434;color:#fff}
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
 const consolePanel=document.createElement("div");consolePanel.className="ship-combat-console";consolePanel.setAttribute("role","group");consolePanel.setAttribute("aria-label","操縦席の索敵・兵装・発射操作盤");
 const scanButton=document.createElement("button");scanButton.type="button";scanButton.className="ship-scan-trigger";scanButton.textContent="📡 スキャン";
 const weapon=document.createElement("button"),fireButton=document.createElement("button");
 weapon.type="button";fireButton.type="button";
 weapon.className="ship-weapon-switch";fireButton.className="ship-fire-trigger";
 weapon.setAttribute("aria-label","宇宙船の兵装切り替え");
 fireButton.setAttribute("aria-label","宇宙船の選択兵装を発射");
 fireButton.textContent="🔴 発射";
 consolePanel.append(scanButton,weapon,fireButton);
 (root.querySelector(".flight-display")||root).append(consolePanel);
 let scanUntil=0,scannedIds=new Set();
 let previousVoyage=null,combat=null;
 const targetNodes=new Map();
 function active(){return combatEligible(getVoyage());}
 function getCombat(v=getVoyage()){
  if(!v?.active){previousVoyage=null;combat=null;return null;}
  if(v!==previousVoyage){previousVoyage=v;combat=new SpaceCombat();scanUntil=0;scannedIds=new Set();}
  return combat;
 }
 function fire(){
  const model=getCombat();
  if(!model||!active())return false;
  const result=model.fire(true);
  if(result.message)notify(result.message);
  update(0,{vr:isVR()});
  return true; // Consume an XR trigger even when no lock is available.
 }
 function pressVRButton({matrix,hand}={}){
  const viewer=getRenderer(),v=getVoyage();
  if(!active()||!v?.seated||viewer?.shipCameraMode==="chase"||
   !Array.isArray(matrix)||matrix.length!==16)return false;
  // XR target-ray matrices are column-major, -Z points out of the controller.
  const origin=[matrix[12],matrix[13],matrix[14]];
  const dir=[-matrix[8],-matrix[9],-matrix[10]];
  if(!origin.every(Number.isFinite)||!dir.every(Number.isFinite)||Math.abs(dir[2])<.0001)return false;
  const t=(-2.15-origin[2])/dir[2];
  if(t<.08||t>1.8)return false;
  const x=origin[0]+dir[0]*t,y=origin[1]+dir[1]*t;
  if(Math.abs(y-.88)>.25)return false;
  const controls=[["scan",-.75],["weapon",0],["fire",.75]];
  const hit=controls.find(([,cx])=>Math.abs(x-cx)<.27);
  if(!hit)return false;
  if(hit[0]==="scan")scan();
  else if(hit[0]==="weapon")setWeapon();
  else fire();
  return true;
 }
 function setWeapon(){
  const model=getCombat();if(!model||!active())return;
  model.setWeapon(model.weapon==="pulse"?"missile":"pulse");
  notify("🎯 兵装："+model.config.name+"（同時ロック "+model.config.locks+"機）");
  update(0,{vr:isVR()});
 }
 function scan(){
  const model=getCombat();if(!model||!active())return;
  scannedIds=new Set(model.liveTargets.filter(t=>t.distance<=1500).map(t=>t.id));
  scanUntil=Date.now()+30000;
  notify("📡 周囲スキャン："+scannedIds.size+"件の船舶を捕捉（30秒間表示）");
  update(0,{vr:isVR()});
 }
 scanButton.addEventListener("click",scan);
 weapon.addEventListener("click",setWeapon);
 let gamepadTriggerHeld=false;
 fireButton.addEventListener("click",fire);
 // The main WebGL canvas is the hit region for pointer lock; in VR gaze owns it.
 const canvas=getRenderer()?.canvas;
 canvas?.addEventListener("pointerdown",event=>{
  if(!active()||isVR()||event.button!==0)return;
  const viewer=getRenderer();
  const controlRect=canvas.getBoundingClientRect();
  const cockpit=viewer?.shipCameraMode!=="chase";
  if(cockpit&&controlRect.width&&controlRect.height){
   const physical=(viewer.shipCockpitControls||[]).find(p=>p.onScreen&&
    Math.hypot(controlRect.left+p.u*controlRect.width-event.clientX,
     controlRect.top+p.v*controlRect.height-event.clientY)<32);
   if(physical){
    event.preventDefault();event.stopImmediatePropagation();
    if(physical.id==="scan")scan();
    else if(physical.id==="weapon")setWeapon();
    else if(physical.id==="fire")fire();
    return;
   }
  }
  const model=getCombat(),rect=canvas.getBoundingClientRect();
  if(!model||!rect.width||!rect.height)return;
  const projected=getRenderer()?.shipTargets||[];
  let chosen=null,nearest=52;
  for(const t of projected){
   if(!t.onScreen)continue;
   const d=Math.hypot(rect.left+t.u*rect.width-event.clientX,
    rect.top+t.v*rect.height-event.clientY);
   if(d<nearest){chosen=t;nearest=d;}
  }
  if(!chosen||!scannedIds.has(chosen.id)||Date.now()>scanUntil)return;
  // Re-check projection before acquisition; clicking a marker is not a fire command.
  model.syncVisibility(projected,0,{eligible:true});
  if(model.acquire(chosen.id)){
   event.preventDefault();event.stopImmediatePropagation();
   notify("🎯 ロック："+chosen.name);
  }
 },true);
 document.addEventListener("keydown",event=>{
  if(event.code!=="Space"||event.repeat||event.altKey||event.ctrlKey||event.metaKey||
   !active()||isVR()||["INPUT","TEXTAREA","SELECT","BUTTON"].includes(document.activeElement?.tagName))
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
  if(viewer)viewer.shipCombat=model;
  const projections=viewer?.shipTargets||[];
  model?.syncVisibility(projections,dt,{vr,eligible:engage,voyage:v});
  const show=Boolean(v?.active&&!vr);
  if(Date.now()>scanUntil)scannedIds.clear();
  consolePanel.hidden=!show||viewer?.shipCameraMode!=="chase";scanButton.disabled=!engage;
  weapon.hidden=!show;fireButton.hidden=!show;
  weapon.disabled=!engage;fireButton.disabled=!engage;
  weapon.title=fireButton.title=engage?"火器管制":"操縦席に着席すると使用できます";
  markers.hidden=!show;
  if(!show){for(const node of targetNodes.values())node.hidden=true;for(const n of shotNodes)n.remove();shotNodes.length=0;return;}
  weapon.textContent="🎯 火器管制： "+model.config.name+" ["+model.config.locks+"ロック]";
  fireButton.textContent=model.weapon==="missile"?"🚀 発射 ("+model.missiles+")":"🔴 発射";
  const rect=viewer?.canvas?.getBoundingClientRect();
  if(!rect||!rect.width||!rect.height)return;
  gaze.style.left=(rect.left+rect.width*.5)+"px";
  gaze.style.top=(rect.top+rect.height*.5)+"px";
  for(const node of targetNodes.values())node.hidden=true;
  for(const t of projections){
   if(!t.onScreen||!model.visible.has(t.id)||!scannedIds.has(t.id))continue;
   let node=targetNodes.get(t.id);
   if(!node){
    node=document.createElement("div");node.className="combat-contact";
    const ring=document.createElement("span");ring.className="combat-ring";
    const label=document.createElement("span");label.className="combat-label";
    const bars=document.createElement("span");bars.className="combat-bars";bars.innerHTML="<i></i><b></b>";
    node.append(ring,label,bars);markers.append(node);
    targetNodes.set(t.id,node);
   }
   const target=model.targets.find(x=>x.id===t.id);
   node.hidden=false;
   node.style.left=(rect.left+t.u*rect.width)+"px";
   node.style.top=(rect.top+t.v*rect.height)+"px";
   node.classList.toggle("locked",model.locked.includes(t.id));
   node.classList.toggle("hostile",(target?.faction||"hostile")==="hostile");
   node.classList.toggle("friendly",target?.faction==="friendly");
   node.classList.toggle("neutral",target?.faction==="neutral");
   node.classList.toggle("shield",target?.shieldFlash>0);
   node.querySelector(".combat-bars i").style.width=(100*(target?.shield||0)/(target?.maxShield||100))+"%";
   node.querySelector(".combat-bars b").style.width=(100*(target?.hp||0)/(target?.maxHp||100))+"%";
   node.classList.toggle("hit",model.flashes.some(f=>f.id===t.id));
   node.querySelector(".combat-label").textContent=(model.locked.includes(t.id)?"🔒 ":"")+t.name+
    " "+Math.round(target?.distance||0)+"m";
  }
  playerHud.textContent="🛡️ "+Math.round(model.player.shield)+" / "+model.player.maxShield+"   ❤️ "+Math.round(model.player.hp)+" / "+model.player.maxHp;
  playerHud.classList.toggle("shield",model.player.shieldFlash>0);
  for(const n of shotNodes)n.remove();shotNodes.length=0;
  for(const shot of model.projectiles){
   const target=projections.find(t=>t.id===shot.id);if(!target?.onScreen)continue;
   const progress=1-Math.max(0,shot.seconds)/shot.total;
   const u=shot.enemy?target.u+(.5-target.u)*progress:.5+(target.u-.5)*progress;
   const w=shot.enemy?target.v+(.5-target.v)*progress:.5+(target.v-.5)*progress;
   const dot=document.createElement("span");dot.className="combat-shot "+(shot.enemy?"enemy":shot.weapon);
   dot.style.left=(rect.left+u*rect.width)+"px";dot.style.top=(rect.top+w*rect.height)+"px";
   markers.append(dot);shotNodes.push(dot);
  }
  for(const flash of model.flashes){
   if(flash.shield)continue;const target=projections.find(t=>t.id===flash.id);if(!target?.onScreen)continue;
   const blast=document.createElement("span");blast.className="combat-impact";
   blast.style.left=(rect.left+target.u*rect.width)+"px";blast.style.top=(rect.top+target.v*rect.height)+"px";
   markers.append(blast);shotNodes.push(blast);
  }
 }
 return {getCombat,update,fire,active,switchWeapon:setWeapon};
}
