/** Character metabolism and recovery, in 0-100 percentage points.
 * Hunger is satiety (100=full, 0=starving), unlike legacy Lifestyle.hunger
 * where 100 means the sensation of hunger. Values are game-only.
 */
export const VITALS_VERSION=1;
const clamp=n=>Math.max(0,Math.min(100,n));
export const DEFAULT_VITALS=Object.freeze({
 hunger:78,stamina:100,mental:100,healingPotions:2
});
export function normalizeVitals(p={}){
 return {
  hunger:clamp(Number.isFinite(p.hunger)?p.hunger:DEFAULT_VITALS.hunger),
  stamina:clamp(Number.isFinite(p.stamina)?p.stamina:100),
  mental:clamp(Number.isFinite(p.mental)?p.mental:100),
  healingPotions:Number.isSafeInteger(p.healingPotions)?Math.max(0,Math.min(999,p.healingPotions)):2
 };
}
export function damageStress(p,damage,maxHp=100){
 const amount=Math.max(0,Number(damage)||0);
 if(amount<=0)return 0;
 const before=p.mental;
 p.mental=clamp((p.mental??100)-amount*.45*100/Math.max(1,maxHp));
 return before-p.mental;
}
/** Mutates one actor's saved vitals and returns its new canonical HP.
 * Called once per running simulation frame, AFTER combat and manual actions.
 */
export function advanceVitals(p,dt,{hp=100,maxHp=100,moving=false,working=false,resting=false,damage=0,externalStamina=false}={}){
 if(!Number.isFinite(dt)||dt<0)throw Error("不正な経過時間です");
 const n=Math.min(dt,.25);
 p.hunger=clamp(Number.isFinite(p.hunger)?p.hunger:78);
 p.stamina=clamp(Number.isFinite(p.stamina)?p.stamina:100);
 p.mental=clamp(Number.isFinite(p.mental)?p.mental:100);
 if(damage>0)damageStress(p,damage,maxHp);
 const motion=working?.26:moving?.16:.008;
 if(!externalStamina){
  if(resting){
   const gain=Math.min(100-p.stamina,9*n,p.hunger*9);
   p.stamina=clamp(p.stamina+gain);
   p.hunger=clamp(p.hunger-gain/9);
  }else p.stamina=clamp(p.stamina-motion*n);
 }
 p.hunger=clamp(p.hunger-(.035+(moving?.025:0)+(working?.025:0))*n);
 let recovered=0;
 if(hp>0&&hp<maxHp&&p.stamina>12&&p.hunger>8){
  const possible=Math.min(maxHp-hp,(resting?.095:.028)*n);
  const capStamina=(p.stamina-12)/2.2,capHunger=(p.hunger-8)/1.4;
  recovered=Math.max(0,Math.min(possible,capStamina,capHunger));
  hp+=recovered;p.stamina=clamp(p.stamina-recovered*2.2);
  p.hunger=clamp(p.hunger-recovered*1.4);
 }
 let strain=0;
 if(p.hunger<25)strain+=(25-p.hunger)*.0065;
 if(p.stamina<25)strain+=(25-p.stamina)*.0060;
 if(hp<maxHp*.3)strain+=.025;
 p.mental=clamp(p.mental+(strain? -strain:resting?.12:.017)*n);
 return {hp:Math.max(0,Math.min(maxHp,hp)),recovered,stamina:p.stamina,hunger:p.hunger,mental:p.mental};
}
export function eatVitals(p,{quality="meal"}={}){
 const amounts={meal:45,apple:20,carrot:18,rawFood:13,food:28};
 const gain=amounts[quality];
 if(!gain)return {ok:false,message:"食べられないアイテムです"};
 const before=p.hunger??78;
 if(before>=99.99)return {ok:false,message:"満腹です"};
 p.hunger=clamp(before+gain);
 p.stamina=clamp((p.stamina??100)+(quality==="meal"?8:2));
 p.mental=clamp((p.mental??100)+(quality==="meal"?3:1));
 return {ok:true,amount:p.hunger-before,message:"🍽️ 食事で空腹ゲージが "+Math.round(p.hunger-before)+" 回復"};
}
export function healVitals(p,hp,maxHp=100,kind="potion",{atChurch=false}={}){
 if(!["potion","magic","church"].includes(kind))return {ok:false,message:"回復方法が不明です"};
 if(hp>=maxHp)return {ok:false,message:"HPは満タンです"};
 if(kind==="potion"){
  if((p.healingPotions||0)<1)return {ok:false,message:"回復薬がありません"};
  p.healingPotions--;
 }else if(kind==="magic"){
  if((p.mental||0)<20)return {ok:false,message:"回復魔法にはメンタル20が必要です"};
  p.mental=clamp(p.mental-20);
 }else if(!atChurch)return {ok:false,message:"教会の近くで回復してください"};
 const quantity=kind==="potion"?45:kind==="magic"?38:85;
 const restored=Math.min(maxHp-hp,quantity);
 if(kind==="church"){
  p.mental=clamp((p.mental||0)+24);
  p.stamina=clamp((p.stamina||0)+32);
 }else if(kind==="potion")p.mental=clamp((p.mental||0)+4);
 return {ok:true,hp:hp+restored,healed:restored,
  message:(kind==="potion"?"🧪 回復薬":kind==="magic"?"✨ 回復魔法":"⛪ 教会で治療")+" HP +"+Math.round(restored)};
}

/** Rest/sleep have distinct effects; food is consumed even when sleeping. */
export function restVitals(p,{sleep=false}={}){
 if(!Number.isFinite(p.hunger))p.hunger=78;
 const foodCost=sleep?9:1,target=sleep?55:12;
 const gained=Math.min(target,Math.max(0,100-(p.stamina??100)),p.hunger/foodCost*target);
 if(gained<=0)return {ok:false,message:"空腹で回復できません。先に食事をしてください"};
 p.hunger=clamp(p.hunger-foodCost*gained/target);
 p.stamina=clamp((p.stamina??100)+gained);
 p.mental=clamp((p.mental??100)+(sleep?14:3)*gained/target);
 return {ok:true,message:sleep?"🛏️ 睡眠で体力・メンタル回復（空腹消費）":"💤 休憩で体力回復（空腹消費）"};
}
