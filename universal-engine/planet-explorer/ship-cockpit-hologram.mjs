/** Side-mounted cockpit hologram actions. Shared by screen/touch and Quest ray controls.
 * State changes are applied to the existing voyage/combat instances, not shadow UI state.
 */
export const COCKPIT_HOLOGRAM_ACTIONS=Object.freeze([
 {id:"speed-down",label:"減速 −"}, {id:"speed-up",label:"加速 ＋"},
 {id:"weapon",label:"兵装切替"}, {id:"auto-fire",label:"自動火器管制"},
 {id:"auto-lock",label:"自動ロックオン"}, {id:"repair",label:"損傷修理"},
 {id:"fuel",label:"予備燃料投入"}, {id:"shield",label:"バリア復旧"},
 {id:"scan",label:"周辺スキャン"}, {id:"radio",label:"通信"},
 {id:"gear",label:"着陸脚"}, {id:"horizon",label:"ホライゾン"}
]);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/** Returns a result object for feedback. Does not bypass combat/landing rules. */
export function applyCockpitHologramAction(id,{voyage,combat,switchWeapon,scan,radio}={}){
 if(!voyage?.seated)return {ok:false,message:"操縦席への着席が必要です"};
 let result={ok:false,message:"この操作は利用できません"};
 switch(id){
 case "speed-up":case "speed-down":{
  if(voyage.warpEngaged)return {ok:false,message:"ワープ中は通常スロットルを変更できません"};
  const next=clamp((voyage.throttle||0)+(id==="speed-up"?.1:-.1),-1,1);
  voyage.setThrottle(next);voyage.setAutopilot(false);
  result={ok:true,message:"スロットル "+Math.round(next*100)+"%"};break;
 }
 case "weapon":
  if(!combat)return {ok:false,message:"兵装システムが利用できません"};
  if(typeof switchWeapon!=="function")return result;
  switchWeapon();result={ok:true,message:"兵装："+combat.config.name};break;
 case "auto-lock":
  if(!combat)return result;
  combat.fireControl=!combat.fireControl;
  result={ok:true,message:"自動ロックオン "+(combat.fireControl?"ON":"OFF")};break;
 case "auto-fire":
  if(!combat)return result;
  combat.autoFire=!combat.autoFire;voyage.autoFire=combat.autoFire;
  result={ok:true,message:"自動火器管制（自動射撃） "+(combat.autoFire?"ON":"OFF")};break;
 case "repair":{
  if(!combat)return result;
  const part=Object.entries(combat.parts).filter(([,health])=>health<100)
   .sort((a,b)=>a[1]-b[1])[0]?.[0];
  result=part||combat.player.hp<combat.player.maxHp?combat.repairPart(part||"hull"):
   {ok:false,message:"修理が必要な機関・船体・兵装・バリア発生器はありません"};break;
 }
 case "fuel":
  result=combat?.refuel(voyage)??result;break;
 case "shield":{
  if(!combat)return result;
  if(combat.parts.shield<100){result=combat.repairPart("shield");break;}
  if(combat.player.shield>=combat.player.maxShield)return {ok:false,message:"バリアは既に最大値です"};
  if(combat.elapsed-combat.lastHit<8)return {ok:false,message:"被弾後8秒間はバリアを緊急復旧できません"};
  if(combat.supplies.kits<2)return {ok:false,message:"緊急復旧には修理キットが2個必要です"};
  combat.supplies.kits-=2;
  combat.player.shield=clamp(combat.player.shield+35,0,combat.player.maxShield);
  result={ok:true,message:"バリアを緊急復旧："+Math.round(combat.player.shield)+"%（キット2個消費）"};break;
 }
 case "scan":return typeof scan==="function"&&scan()===true?
  {ok:true,message:"周辺スキャン実行"}:{ok:false,message:"周辺スキャンが使用できません"};
 case "radio":if(typeof radio!=="function")return result;
  radio();return {ok:true,message:"通信画面を切り替えました"};
 case "gear":
  if(typeof voyage.cycleGear!=="function")return result;
  voyage.cycleGear();result={ok:true,message:"着陸脚："+voyage.gearMode};break;
 case "horizon":
  if(voyage.status!=="atmosphere")return {ok:false,message:"ホライゾンは大気中で使用できます"};
  voyage.horizon=!voyage.horizon;result={ok:true,message:"ホライゾン "+(voyage.horizon?"ON":"OFF")};break;
 default:return result;
 }
 if(combat)voyage.shipSystems=combat.systemSnapshot();
 return result;
}
