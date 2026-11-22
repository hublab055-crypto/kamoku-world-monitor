/** Local public bonds (government borrowing, not tax income).
 * Bonds are bought with TownLife.coins and redeemed from the issuing treasury.
 * All bonds are held by the single offline player in this prototype.
 * Multiplayer issuance, trades and wallet transfers require server authority.
 */
export const BOND_FACE_VALUES=Object.freeze([10,50,100]);
export const BOND_TERMS=Object.freeze([3,6,12]); // game months, 30 days each
export const BOND_INTEREST=Object.freeze([10,20]); // total fixed return at maturity
const MAX_ISSUES=100;
const MAX_UNITS=1000;
const MAX_TREASURY=999999999;
const MAX_WALLET=999999;
const validInt=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const monthOf=day=>Math.floor(Math.max(0,Number(day)||0)/30);
const result=(ok,message,extra={})=>({ok,message,...extra});

export class PublicBonds{
 constructor(economy,saved=null){
  this.economy=economy;
  this.issues=[];
  this.nextId=1;
  if(!saved||saved.schemaVersion!==1)return;
  if(Array.isArray(saved.issues)){
   const seen=new Set();let maxId=0;
   for(const b of saved.issues.slice(0,MAX_ISSUES)){
    const match=typeof b?.id==="string"?/^bond:(\d+)$/.exec(b.id):null;
    if(!match||seen.has(b.id)||!economy.town(b.townId)||
     !BOND_FACE_VALUES.includes(b.face)||!BOND_TERMS.includes(b.termMonths)||
     !BOND_INTEREST.includes(b.interestPercent)||
     !validInt(b.units,1,MAX_UNITS)||!validInt(b.sold,0,b.units)||
     !validInt(b.issuedMonth,0,1000000)||
     b.maturityMonth!==b.issuedMonth+b.termMonths)continue;
    const numeric=Number(match[1]);
    if(!validInt(numeric,1,1000000))continue;
    seen.add(b.id);maxId=Math.max(maxId,numeric);
    this.issues.push({id:b.id,townId:b.townId,face:b.face,units:b.units,
     sold:b.sold,termMonths:b.termMonths,interestPercent:b.interestPercent,
     issuedMonth:b.issuedMonth,maturityMonth:b.maturityMonth,
     closed:!!b.closed,lastLateMonth:validInt(b.lastLateMonth,-1,1000000)?b.lastLateMonth:-1});
   }
   this.nextId=maxId+1;
  }
  if(validInt(saved.nextId,this.nextId,1000001))this.nextId=saved.nextId;
 }
 outstanding(issue){
  if(!issue||issue.closed||!issue.sold)return 0;
  const principal=issue.face*issue.sold;
  return principal+Math.floor(principal*issue.interestPercent/100);
 }
 debt(townId){
  return this.issues.filter(b=>b.townId===townId)
   .reduce((total,b)=>total+this.outstanding(b),0);
 }
 status(issue,day){
  if(issue.closed)return "終了";
  if(monthOf(day)>=issue.maturityMonth)return issue.sold?"償還待ち":"募集終了";
  return issue.sold>=issue.units?"完売":"募集中";
 }
 issue(townId,{face=10,units=20,termMonths=6,interestPercent=10}={},userId="player"){
  const town=this.economy.town(townId);
  if(!town||!this.economy.ruler(townId,userId))
   return result(false,"この国・都市の公債発行権限がありません");
  if(!BOND_FACE_VALUES.includes(face)||!BOND_TERMS.includes(termMonths)||
   !BOND_INTEREST.includes(interestPercent)||!validInt(units,1,MAX_UNITS)||
   face*units>100000)return result(false,"額面・発行口数・満期・利率を確認してください");
  if(this.issues.length>=MAX_ISSUES||this.nextId>1000000)
   return result(false,"発行記録の上限です");
  const month=this.economy.lastCollectedMonth;
  const bond={id:"bond:"+this.nextId++,townId,face,units,sold:0,
   termMonths,interestPercent,issuedMonth:month,maturityMonth:month+termMonths,
   closed:false,lastLateMonth:-1};
  this.issues.push(bond);
  this.economy.write("bond",town.name+" "+bond.id+" 公債発行（"+face+"G×"+units+"口）");
  return result(true,"🏦 "+town.name+"が公債を発行しました。購入されるまで公金は増えません。",{id:bond.id});
 }
 buy(id,units,wallet){
  const b=this.issues.find(x=>x.id===id);
  if(!b||b.closed||monthOf(this.economy.lastCollectedMonth*30)>=b.maturityMonth)
   return result(false,"この債券は現在購入できません");
  if(!validInt(units,1,MAX_UNITS)||units>b.units-b.sold)
   return result(false,"購入口数が募集残数を超えています");
  if(!wallet||!validInt(wallet.coins,0,MAX_WALLET))
   return result(false,"プレイヤーの所持金を確認できません");
  const town=this.economy.town(b.townId);
  const price=b.face*units;
  if(wallet.coins<price)return result(false,"所持金が不足しています（必要："+price+"G）");
  if(town.treasury>MAX_TREASURY-price)return result(false,"公金庫が上限に達しています");
  wallet.coins-=price;
  town.treasury+=price;
  b.sold+=units;
  this.economy.write("bond",town.name+" "+b.id+" "+units+"口購入：公金 +"+price+"G");
  return result(true,"🪙 "+units+"口を購入。所持金 −"+price+"G / "+town.name+"公金 +"+price+"G",
   {cost:price,treasury:town.treasury});
 }
 settle(day,wallet){
  if(!Number.isFinite(day)||day<0||!wallet||!validInt(wallet.coins,0,MAX_WALLET))return 0;
  const month=monthOf(day);let changed=0;
  for(const b of this.issues){
   if(b.closed||month<b.maturityMonth)continue;
   const town=this.economy.town(b.townId);
   if(b.sold===0){
    b.closed=true;changed++;
    continue;
   }
   const owed=this.outstanding(b);
   if(town.treasury>=owed&&wallet.coins<=MAX_WALLET-owed){
    town.treasury-=owed;
    wallet.coins+=owed;
    b.closed=true;
    const interest=owed-b.face*b.sold;
    this.economy.write("bond",town.name+" "+b.id+" 償還 "+owed+"G（利息 "+interest+"G）",month);
    changed++;
   }else if(town.treasury<owed&&b.lastLateMonth!==month){
    b.lastLateMonth=month;
    town.support=Math.max(0,town.support-2);
    this.economy.write("bond",town.name+" "+b.id+" 返済遅延（必要 "+owed+"G）",month);
    changed++;
   }
  }
  return changed;
 }
 snapshot(){
  return {schemaVersion:1,nextId:this.nextId,issues:this.issues.map(b=>({...b}))};
 }
}
