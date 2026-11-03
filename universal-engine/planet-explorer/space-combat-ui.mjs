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
  border:2px solid #72b7d5;border-radius:6px;transform:rotate(45deg);background:#08283c35}
 #ship-combat-markers .combat-contact.locked{color:#fff4a0}
 #ship-combat-markers .combat-contact.locked .combat-ring{border:3px solid #ffd25e;box-shadow:0 0 12px #ffad29}
 #ship-combat-markers .combat-contact.hit .combat-ring{box-shadow:0 0 25px 12px #ff6945;border-color:#fff}
 #ship-combat-markers .combat-label{display:block;white-space:nowrap;font-size:11px}
 #ship-combat-markers .combat-gaze{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:17px;height:17px;border:1px solid #bfe6ff;border-radius:50%;opacity:.7}
 #space-flight .ship-weapon-switch,#space-flight .ship-fire-trigger{border-color:#b6c6aa}
 #space-flight .ship-fire-trigger{background:#7d3434;color:#fff}
 #space-flight .ship-weapon-switch[hidden],#space-flight .ship-fire-trigger[hidden]{display:none!important}
 @media(pointer:coarse){#space-flight .ship-fire-trigger{min-width:68px;font-size:13px}}
 `;
 document.head.append(style);
 const markers=document.createElement("div");
 markers.id="ship-combat-markers";markers.hidden=true;markers.setAttribute("aria-hidden","true");
 const gaze=document.createElement("div");gaze.className="combat-gaze";markers.append(gaze);
 document.body.append(markers);
 const weapon=document.createElement("button"),fireButton=document.createElement("button");
 weapon.type="button";fireButton.type="button";
 weapon.className="ship-weapon-switch";fireButton.className="ship-fire-trigger";
 weapon.setAttribute("aria-label","宇宙船の兵装切り替え");
 fireButton.setAttribute("aria-label","宇宙船の選択兵装を発射");
 fireButton.textContent="🔴 発射";
 actions.append(weapon,fireButton);
 let previousVoyage=null,combat=null;
 const targetNodes=new Map();
 function active(){return combatEligible(getVoyage());}
 function getCombat(v=getVoyage()){
  if(!v?.active){previousVoyage=null;combat=null;return null;}
  if(v!==previousVoyage){previousVoyage=v;combat=new SpaceCombat();}
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
 function setWeapon(){
  const model=getCombat();if(!model||!active())return;
  model.setWeapon(model.weapon==="pulse"?"missile":"pulse");
  notify("🎯 兵装："+model.config.name+"（同時ロック "+model.config.locks+"機）");
  update(0,{vr:isVR()});
 }
 weapon.addEventListener("click",setWeapon);
 let gamepadTriggerHeld=false;
 fireButton.addEventListener("click",fire);
 // The main WebGL canvas is the hit region for pointer lock; in VR gaze owns it.
 const canvas=getRenderer()?.canvas;
 canvas?.addEventListener("pointerdown",event=>{
  if(!active()||isVR()||event.button!==0)return;
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
  if(!chosen)return;
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
  model?.syncVisibility(projections,dt,{vr,eligible:engage});
  const show=Boolean(engage&&!vr);
  weapon.hidden=!show;fireButton.hidden=!show;
  markers.hidden=!show;
  if(!show){for(const node of targetNodes.values())node.hidden=true;return;}
  weapon.textContent="⚙️ "+model.config.name+" ["+model.config.locks+"ロック]";
  fireButton.textContent=model.weapon==="missile"?"🚀 発射 ("+model.missiles+")":"🔴 発射";
  const rect=viewer?.canvas?.getBoundingClientRect();
  if(!rect||!rect.width||!rect.height)return;
  gaze.style.left=(rect.left+rect.width*.5)+"px";
  gaze.style.top=(rect.top+rect.height*.5)+"px";
  for(const node of targetNodes.values())node.hidden=true;
  for(const t of projections){
   if(!t.onScreen||!model.visible.has(t.id))continue;
   let node=targetNodes.get(t.id);
   if(!node){
    node=document.createElement("div");node.className="combat-contact";
    const ring=document.createElement("span");ring.className="combat-ring";
    const label=document.createElement("span");label.className="combat-label";
    node.append(ring,label);markers.append(node);
    targetNodes.set(t.id,node);
   }
   const target=model.targets.find(x=>x.id===t.id);
   node.hidden=false;
   node.style.left=(rect.left+t.u*rect.width)+"px";
   node.style.top=(rect.top+t.v*rect.height)+"px";
   node.classList.toggle("locked",model.locked.includes(t.id));
   node.classList.toggle("hit",model.flashes.some(f=>f.id===t.id));
   node.lastElementChild.textContent=(model.locked.includes(t.id)?"🔒 ":"")+t.name+
    " "+target?.distance+"m";
  }
 }
 return {getCombat,update,fire,active,switchWeapon:setWeapon};
}
