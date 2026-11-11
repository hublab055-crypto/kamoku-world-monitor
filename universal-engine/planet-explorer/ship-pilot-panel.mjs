import {SHIP_WEAPONS} from "./space-combat.mjs?v=20261112-pilot";
const STORAGE_KEY="ue:pilot-action-slots:v1";

export function installShipPilotPanel({getVoyage,getCombat,switchWeapon,getCargo,actionOptions,defaults}){
 const host=document.querySelector(".canvas-wrap");
 const shortcuts=document.createElement("div");
 shortcuts.className="ship-pilot-shortcuts";
 shortcuts.hidden=true;
 shortcuts.innerHTML='<button type="button" data-weapon></button><button type="button" data-settings aria-haspopup="dialog">⚙️ 機体設定</button>';
 const weaponShortcut=shortcuts.querySelector("[data-weapon]");
 const settings=shortcuts.querySelector("[data-settings]");
 const dialog=document.createElement("dialog");
 dialog.className="ship-pilot-panel";
 dialog.setAttribute("aria-label","機体設定");
 dialog.addEventListener("keydown",event=>event.stopPropagation());
 dialog.innerHTML=`
  <header><strong>機体設定</strong><button type="button" data-close>閉じる</button></header>
  <label>兵装 <select data-weapon></select></label>
  <label><input type="checkbox" data-fire-control> 自動ロックオン</label>
  <label><input type="checkbox" data-auto-fire> 自動射撃</label>
  <label><input type="checkbox" data-ciws> CIWS自動迎撃</label>
  <details open><summary>⚙️ アクションボタンの割り当て</summary><div data-slots></div>
   <button type="button" data-reset>初期配置に戻す</button>
  </details>
  <details><summary>📦 積荷</summary><ul data-cargo></ul><p data-empty>積荷はありません</p></details>`;
 host.append(shortcuts,dialog);
 const weapon=dialog.querySelector("[data-weapon]");
 for(const [id,config] of Object.entries(SHIP_WEAPONS))weapon.add(new Option(config.name,id));
 const knownActions=new Set(actionOptions.map(action=>action.id));
 let saved;
 try{saved=JSON.parse(localStorage.getItem(STORAGE_KEY));}catch{}
 let slots=defaults.map((fallback,index)=>knownActions.has(saved?.[index])?saved[index]:fallback);
 const slotInputs=slots.map((_,index)=>{
  const label=document.createElement("label");
  label.textContent="ボタン "+(index+1);
  const input=document.createElement("select");
  for(const action of actionOptions)input.add(new Option(action.label,action.id));
  input.addEventListener("change",()=>{slots[index]=input.value;persist();});
  label.append(input);
  dialog.querySelector("[data-slots]").append(label);
  return input;
 });
 function persist(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(slots));}catch{}
 }
 function showSlots(){slotInputs.forEach((input,index)=>{input.value=slots[index];});}
 dialog.querySelector("[data-reset]").addEventListener("click",()=>{slots=[...defaults];persist();showSlots();});
 const fireControl=dialog.querySelector("[data-fire-control]");
 const autoFire=dialog.querySelector("[data-auto-fire]");
 const ciws=dialog.querySelector("[data-ciws]");
 for(const [input,field] of [[fireControl,"fireControl"],[autoFire,"autoFire"],[ciws,"ciwsEnabled"]]){
  input.addEventListener("change",()=>{
   const voyage=getVoyage(),combat=getCombat();
   if(!voyage?.seated||!combat)return;
   combat[field]=input.checked;
   voyage.autoFire=combat.autoFire;
   voyage.shipSystems=combat.systemSnapshot();
  });
 }
 weapon.addEventListener("change",()=>switchWeapon(weapon.value));
 weaponShortcut.addEventListener("click",()=>switchWeapon());
 settings.addEventListener("click",open);
 dialog.querySelector("[data-close]").addEventListener("click",()=>dialog.close());
 function open(){
  const voyage=getVoyage(),combat=getCombat();
  if(!voyage?.seated||!combat||dialog.open)return;
  weapon.value=combat.weapon;
  fireControl.checked=combat.fireControl;
  autoFire.checked=combat.autoFire;
  ciws.checked=combat.ciwsEnabled;
  showSlots();
  const cargo=getCargo();
  const list=dialog.querySelector("[data-cargo]");
  list.replaceChildren(...cargo.map(([name,count])=>{
   const item=document.createElement("li");item.textContent=name+" ×"+count;return item;
  }));
  dialog.querySelector("[data-empty]").hidden=cargo.length>0;
  dialog.showModal();
 }
 function update(visible){
  shortcuts.hidden=!visible;
  if(!visible){if(dialog.open)dialog.close();return;}
  const combat=getCombat();
  if(!combat)return;
  const label="兵装 "+combat.config.name;
  if(weaponShortcut.textContent!==label)weaponShortcut.textContent=label;
 }
 return {open,update,actions:catalog=>slots.map(id=>catalog[id]??null)};
}
