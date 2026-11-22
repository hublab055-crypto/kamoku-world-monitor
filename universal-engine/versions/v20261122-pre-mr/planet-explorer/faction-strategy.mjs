/** Universal Engine faction strategy — offline economic/diplomatic/military simulation.
 * Factions are settlements, not authenticated accounts. NEVER trust client-side
 * actions for online PvP, tax collection, title transfers or shared inventory.
 * The separate TerritoryEconomy remains the sole source of public treasuries
 * and land/building titles. Conquest changes rulerId, never asset.ownerId.
 */
import {DESTINATIONS} from "./settlements.mjs?v=0.8r-towns";

export const STRATEGY_SCHEMA=1;
export const RECRUIT_COST=125;
export const RECRUIT_SIZE=5;
export const MONTHLY_UPKEEP=2;
const MAX_ARMY=250;
const MAX_COIN=999999999;
const IDs=DESTINATIONS.map(d=>d.id);
const NAMES=Object.fromEntries(DESTINATIONS.map(d=>[d.id,d.name]));
const INITIAL=Object.freeze({pioneer:12,capital:65,tower:34,port:31,mountain:17,meadow:19,forest:16});
const validId=id=>IDs.includes(id);
const int=(v,fallback,min=0,max=MAX_COIN)=>
 Number.isSafeInteger(v)&&v>=min&&v<=max?v:fallback;
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const result=(ok,message,extra={})=>({ok,message,...extra});
const snapshotPair=()=>({trust:0,trade:false,pact:false,alliance:false,war:false,
  truceUntil:-1,envoyMonth:-1});
const validPair=(saved)=>{
 const d=snapshotPair();
 if(!saved||typeof saved!=="object")return d;
 const value={...d,trust:int(saved.trust,0,-100,100),
  trade:!!saved.trade,pact:!!saved.pact,alliance:!!saved.alliance,
  war:!!saved.war,truceUntil:int(saved.truceUntil,-1,-1,1000000),
  envoyMonth:int(saved.envoyMonth,-1,-1,1000000)};
 if(value.war){value.trade=false;value.pact=false;value.alliance=false;}
 if(value.alliance)value.pact=true;
 return value;
};
export const stanceOf=r=>r.war?"戦争中":r.alliance?"同盟":r.pact?"不可侵条約":
 r.trade?"通商協定":"通常外交";
export class FactionStrategy{
 constructor(economy,saved=null,nowDay=0){
  if(!economy||typeof economy.town!=="function")throw Error("領地経済への接続が必要です");
  this.economy=economy;
  this.armies=Object.fromEntries(IDs.map(id=>[id,INITIAL[id]]));
  this.relations=Object.fromEntries(IDs.filter(id=>id!=="pioneer")
   .map(id=>[id,snapshotPair()]));
  this.ledger=[];
  this.lastMonth=Math.floor(Math.max(0,Number(nowDay)||0)/30);
  if(!saved||saved.schemaVersion!==STRATEGY_SCHEMA)return;
  this.lastMonth=int(saved.lastMonth,this.lastMonth,0,1000000);
  for(const id of IDs){
   this.armies[id]=int(saved.armies?.[id],INITIAL[id],0,MAX_ARMY);
   if(id!=="pioneer")this.relations[id]=validPair(saved.relations?.[id]);
  }
  if(Array.isArray(saved.ledger))this.ledger=saved.ledger.slice(-80)
   .filter(x=>x&&typeof x.text==="string").map(x=>({
    month:int(x.month,0,0,1000000),text:x.text.slice(0,170)}));
 }
 own(id){return validId(id)&&this.economy.ruler(id,"player");}
 log(text){this.ledger.push({month:this.lastMonth,text});
  if(this.ledger.length>80)this.ledger.shift();}
 relation(id){return this.relations[id]||null;}
 // All player-vs-NPC diplomacy is negotiated with the NPC's original capital.
 eligible(id){return validId(id)&&id!=="pioneer"&&!this.own(id);}
 treasury(id){return this.economy.town(id)?.treasury||0;}
 changeTreasury(id,delta){
  const town=this.economy.town(id);
  if(!town||!Number.isSafeInteger(delta))return false;
  if(delta<0&&town.treasury<(-delta))return false;
  town.treasury=cap(town.treasury+delta,0,MAX_COIN);
  return true;
 }
 monthOfDay(day){return Math.floor(Math.max(0,Number(day)||0)/30);}
 sendEnvoy(id){
  const r=this.relation(id);
  if(!this.eligible(id)||!r||r.war)return result(false,"交渉できる相手国ではありません");
  if(r.envoyMonth===this.lastMonth)return result(false,"この月は既に使節を派遣しました");
  if(!this.changeTreasury("pioneer",-35))return result(false,"国庫が不足しています（35G）");
  r.envoyMonth=this.lastMonth;r.trust=cap(r.trust+20,-100,100);
  this.log("🤝 "+NAMES[id]+"へ使節を派遣。友好度 "+r.trust);
  return result(true,"外交使節が訪問しました。友好度 +20");
 }
 startTrade(id){
  const r=this.relation(id);
  if(!this.eligible(id)||!r||r.war||r.trust<0||r.trade)
   return result(false,"交易可能な相手か外交関係を確認してください");
  if(!this.changeTreasury("pioneer",-40))return result(false,"通商路の開設に40G必要です");
  r.trade=true;r.trust=cap(r.trust+10,-100,100);
  this.log("📦 "+NAMES[id]+"と通商路を開設");
  return result(true,"通商協定を締結。ゲーム内の毎月、双方の国庫に交易収入が入ります");
 }
 signPact(id){
  const r=this.relation(id);
  if(!this.eligible(id)||!r||r.war||r.pact||r.trust<40)
   return result(false,"不可侵条約には友好度40以上が必要です");
  r.pact=true;this.log("🕊️ "+NAMES[id]+"と不可侵条約を締結");
  return result(true,"不可侵条約が成立しました");
 }
 signAlliance(id){
  const r=this.relation(id);
  if(!this.eligible(id)||!r||r.war||!r.pact||r.trust<70||r.alliance)
   return result(false,"同盟には不可侵条約と友好度70以上が必要です");
  r.alliance=true;this.log("🛡️ "+NAMES[id]+"と防衛同盟を締結");
  return result(true,"防衛同盟を締結しました。次月から相互の交易収入が増えます");
 }
 withdraw(id){
  const r=this.relation(id);
  if(!this.eligible(id)||!r||r.war||!(r.trade||r.pact||r.alliance))
   return result(false,"破棄できる条約がありません");
  r.trade=false;r.pact=false;r.alliance=false;r.trust=cap(r.trust-35,-100,100);
  this.log("📃 "+NAMES[id]+"との条約を破棄");
  return result(true,"条約を破棄しました。外交上の信頼が低下しました");
 }
 declareWar(id){
  const r=this.relation(id);
  if(!this.eligible(id)||!r||r.war||r.trade||r.pact||r.alliance)
   return result(false,"宣戦できません。既存条約がある場合は先に破棄してください");
  if(this.lastMonth<r.truceUntil)return result(false,"停戦期限中のため宣戦できません");
  r.war=true;r.trust=-100;
  this.economy.town("pioneer").support=cap(this.economy.town("pioneer").support-4,0,100);
  this.log("⚔️ "+NAMES[id]+"に宣戦");
  return result(true,NAMES[id]+"と戦争状態になりました。遠征には兵力と補給費が必要です");
 }
 seekPeace(id){
  const r=this.relation(id);
  if(!this.eligible(id)||!r||!r.war)return result(false,"交戦中の相手ではありません");
  r.war=false;r.trust=-35;r.truceUntil=this.lastMonth+2;
  this.log("🕊️ "+NAMES[id]+"と停戦（2か月）");
  return result(true,"停戦が成立しました。2か月間は再宣戦できません");
 }
 recruit(id){
  if(!this.own(id))return result(false,"統治していない領地では徴兵できません");
  if(this.armies[id]>MAX_ARMY-RECRUIT_SIZE)return result(false,"駐屯軍の定員を超えています");
  if(!this.changeTreasury(id,-RECRUIT_COST))return result(false,"国庫が不足しています（125G）");
  this.armies[id]+=RECRUIT_SIZE;
  this.log("🛡️ "+NAMES[id]+"で"+RECRUIT_SIZE+"人を募集");
  return result(true,"守備隊を"+RECRUIT_SIZE+"人増員しました");
 }
 campaign(from,target,requested){
  const r=this.relation(target),n=Number(requested);
  if(!this.own(from)||!this.eligible(target)||!r?.war)
   return result(false,"自国領から交戦中の外国領へだけ遠征できます");
  if(!Number.isSafeInteger(n)||n<5||n>=this.armies[from])
   return result(false,"遠征兵は5人以上、守備兵を1人以上残してください");
  const logistics=20+Math.ceil(n*.75);
  if(!this.changeTreasury(from,-logistics))
   return result(false,"遠征の補給費が不足しています（"+logistics+"G）");
  const defense=this.armies[target],home=this.economy.town(from);
  const fortification=1.3+this.economy.town(target).support/500;
  const attackPower=n*(.9+home.support/500);
  const defensePower=defense*fortification;
  this.armies[from]-=n;
  const won=attackPower>defensePower;
  if(won){
   const losses=cap(Math.ceil(n*.24+defense*.23),1,n-1);
   const survivors=n-losses;
   this.armies[target]=survivors;
   this.economy.town(target).rulerId="player";
   this.economy.town(target).support=cap(this.economy.town(target).support-15,0,100);
   r.war=false;r.trade=false;r.pact=false;r.alliance=false;r.trust=-55;r.truceUntil=this.lastMonth+3;
   // Title deeds remain unchanged: only governance and taxation authority move.
   this.log("🏳️ "+NAMES[target]+"を占領。戦死"+losses+"人、私有財産の所有権は維持");
   return result(true,"🏳️ 占領成功。生存"+survivors+"人、戦死"+losses+"人。住民の土地・建物の所有権は変わりません",
    {won:true,losses,survivors,logistics});
  }
  const losses=cap(Math.ceil(n*(.42+defensePower/(attackPower+defensePower)*.46)),1,n);
  const survivors=n-losses;
  this.armies[from]+=survivors;
  this.armies[target]=Math.max(1,defense-Math.floor(n*.24));
  this.log("🛡️ "+NAMES[target]+"への遠征は失敗。戦死"+losses+"人");
  return result(true,"守備隊に撃退されました。帰還"+survivors+"人、戦死"+losses+"人",
   {won:false,losses,survivors,logistics});
 }
 advanceUntil(day){
  if(!Number.isFinite(day)||day<0)return 0;
  const target=this.monthOfDay(day);
  if(target<=this.lastMonth)return 0;
  let months=0;
  for(let month=Math.max(this.lastMonth+1,target-23);month<=target;month++){
   for(const id of IDs){
    const territory=this.economy.town(id);
    const garrison=this.armies[id];
    const upkeep=garrison*MONTHLY_UPKEEP;
    const paid=Math.min(territory.treasury,upkeep);
    this.changeTreasury(id,-paid);
    if(paid<upkeep){
     // Desertion when the army cannot be paid. Never negative coins/units.
     this.armies[id]=Math.max(0,garrison-Math.max(1,Math.ceil((upkeep-paid)/8)));
     territory.support=cap(territory.support-2,0,100);
    }
    if(id!=="pioneer"&&!this.own(id)&&this.armies[id]<MAX_ARMY &&
      this.treasury(id)>=190){
     this.changeTreasury(id,-25);
     this.armies[id]+=1;
    }
   }
   for(const [id,r] of Object.entries(this.relations)){
    if(!r.trade||r.war||!this.eligible(id))continue;
    const bonus=r.alliance?50:30;
    this.changeTreasury("pioneer",bonus);
    this.changeTreasury(id,bonus);
    r.trust=cap(r.trust+1,-100,100);
   }
   months++;
  }
  this.lastMonth=target;
  this.log("📊 第"+target+"月の維持費・交易収益を確定");
  return months;
 }
 summary(){
  return IDs.map(id=>({
   id,name:NAMES[id],player:this.own(id),treasury:this.treasury(id),
   army:this.armies[id],support:this.economy.town(id).support,
   trade:id==="pioneer"?Object.values(this.relations).filter(r=>r.trade).length:
    Number(!!this.relation(id)?.trade)
  }));
 }
 snapshot(){
  return {schemaVersion:STRATEGY_SCHEMA,lastMonth:this.lastMonth,
   armies:{...this.armies},
   relations:Object.fromEntries(Object.entries(this.relations).map(([id,r])=>[id,{...r}])),
   ledger:this.ledger.map(e=>({...e}))};
 }
}
