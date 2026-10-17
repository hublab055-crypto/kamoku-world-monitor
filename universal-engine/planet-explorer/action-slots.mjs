import {normalizeEquipmentHands} from "./social-equipment.mjs";
/** Five configurable action decks, distinct from item inventory.
 * Pure state module, snapshots compatible with old five-item quick slots.
 */
export const DECK_KINDS=Object.freeze({
 melee:{icon:"⚔️",name:"戦闘",hands:{right:"sword",left:"shield"},
  commands:["sweep","guard","thrust","heal"]},
 bow:{icon:"🏹",name:"弓矢",hands:{right:"bow",left:"none"},
  commands:["shoot","aim","heal","config"]},
 work:{icon:"🔨",name:"作業",hands:{right:"axe",left:"pickaxe"},
  commands:["mine","chop","build","rest"]},
 social:{icon:"💬",name:"交流",hands:{right:"none",left:"none"},
  commands:["talk","gift","emote","follow"]},
 system:{icon:"⚙️",name:"メニュー",hands:{right:"none",left:"none"},
  commands:["inventory","book","config","rest"]}
});
export const COMMAND_LABELS=Object.freeze({
 sweep:"⚔️ 薙ぎ払う",guard:"🛡️ ガード",thrust:"🗡️ 突く",heal:"🧪 回復薬",
 shoot:"🏹 射る",aim:"🎯 狙う",mine:"⛏️ 採掘",chop:"🪓 伐採",
 build:"🔨 建築",rest:"💤 休む",talk:"💬 話す",gift:"🎁 プレゼント",
 emote:"🙂 エモート",follow:"👣 ついてきて",inventory:"🎒 持ち物",
 book:"📖 読書",config:"⚙️ 設定"});
const allowedHands=new Set(["none","sword","spear","greatsword","shield","axe","bow","pickaxe","hammer","book","cup"]);
const legacyKind=id=>id==="bow"?"bow":id==="sword"||id==="axe"?"melee":id==="pickaxe"?"work":id==="book"?"system":"social";
const clean=(slot,kind="melee")=>{
 const def=DECK_KINDS[DECK_KINDS[slot?.kind]?slot.kind:kind],selected=DECK_KINDS[slot?.kind]?slot.kind:kind;
 const commands=Array.isArray(slot?.commands)?slot.commands:undefined;
 return {kind:selected,hands:normalizeEquipmentHands(Object.fromEntries(["right","left"].map(hand=>[hand,
  allowedHands.has(slot?.hands?.[hand])?slot.hands[hand]:def.hands[hand]]))),
  commands:Array.from({length:4},(_,i)=>Object.hasOwn(COMMAND_LABELS,commands?.[i])?
   commands[i]:def.commands[i])};
};
export const defaultActionSlots=()=>["melee","bow","work","social","system"].map(kind=>clean(null,kind));
function migrateLegacy(legacy){
 const old=legacy?.slots||[];
 if(old.join(",")==="sword,axe,pickaxe,cup,book")return defaultActionSlots();
 return Array.from({length:5},(_,i)=>clean(null,legacyKind(old[i])));
}
export class ActionSlots{
 constructor(snapshot=null,legacy=null){
  this.slots=defaultActionSlots();this.selected=0;this.autoTarget=true;
  this.manualTargetId=null;this.targetId=null;
  if(snapshot)this.restore(snapshot,legacy);
  else if(legacy?.slots?.length) {
   this.slots=migrateLegacy(legacy);
   this.selected=Math.max(0,Math.min(4,legacy.selected||0));
  }
 }
 current(){return this.slots[this.selected];}
 select(index){
  if(!Number.isInteger(index)||index<0||index>=5)return false;
  this.selected=index;this.manualTargetId=null;this.targetId=null;return true;
 }
 configure(index,patch){
  if(!Number.isInteger(index)||index<0||index>=5)return false;
  const prev=this.slots[index],kind=DECK_KINDS[patch.kind]?patch.kind:prev.kind;
  const next=kind!==prev.kind?clean(null,kind):clean({
   kind,hands:{...prev.hands,...patch.hands},
   commands:patch.commands||prev.commands
  },kind);
  if(patch.hands){
   const changed=Object.hasOwn(patch.hands,"right")?"right":Object.hasOwn(patch.hands,"left")?"left":null;
   next.hands=normalizeEquipmentHands({...next.hands,...patch.hands},changed);
  }
  this.slots[index]=next;
  if(index===this.selected&&kind!==prev.kind){this.manualTargetId=null;this.targetId=null;}
  return true;
 }
 setCommand(index,position,command){
  if(!Number.isInteger(position)||position<0||position>=4||
     !Object.hasOwn(COMMAND_LABELS,command))return false;
  const slot=this.slots[index];if(!slot)return false;
  slot.commands[position]=command;return true;
 }
 setManualTarget(id){
  if(!Number.isInteger(id)||id<1)return false;
  this.manualTargetId=id;this.targetId=id;return true;
 }
 clearManual(){this.manualTargetId=null;this.targetId=null;}
 resolveTarget(enemies,player,range=18){
  const living=(enemies||[]).filter(e=>e.hp>0);
  const manual=living.find(e=>e.id===this.manualTargetId);
  if(manual){this.targetId=manual.id;return manual;}
  this.manualTargetId=null;
  if(!this.autoTarget){this.targetId=null;return null;}
  const yaw=player?.yaw||0,fx=Math.sin(yaw),fz=Math.cos(yaw);
  let best=null,score=Infinity;
  for(const e of living){
   const dx=e.x-(player?.x||0),dz=e.z-(player?.z||0),d=Math.hypot(dx,dz);
   if(d>range+e.radius||d<.01)continue;
   const forward=(dx*fx+dz*fz)/d;
   if(forward<.25)continue; // in front of the player; not behind
   const cost=d+3*(1-forward);
   if(cost<score){best=e;score=cost;}
  }
  this.targetId=best?.id??null;return best;
 }
 snapshot(){return {version:1,slots:this.slots.map(s=>clean(s)),selected:this.selected,autoTarget:this.autoTarget};}
 restore(data,legacy=null){
  if(data?.version!==1||!Array.isArray(data.slots)){
   if(legacy?.slots)this.slots=migrateLegacy(legacy);
   this.selected=Math.max(0,Math.min(4,legacy?.selected||0));return false;
  }
  this.slots=Array.from({length:5},(_,i)=>clean(data.slots[i],defaultActionSlots()[i].kind));
  this.selected=Number.isInteger(data.selected)?Math.max(0,Math.min(4,data.selected)):0;
  this.autoTarget=data.autoTarget!==false;this.manualTargetId=null;this.targetId=null;
  return true;
 }
}
