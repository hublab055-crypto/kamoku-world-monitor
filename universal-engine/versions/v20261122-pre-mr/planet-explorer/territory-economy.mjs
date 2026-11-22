/** Universal Engine land titles and territory treasury prototype (offline).
 * Ownership, occupation and governing authority are intentionally distinct.
 * NOT a multiplayer permission boundary: authoritative checks require a server.
 */
import {DESTINATIONS,settlementLayout} from "./settlements.mjs?v=0.8r-towns";
import {PublicBonds} from "./public-bonds.mjs?v=0.9o-public-bonds";

const MAX_COINS=999999999;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const integer=(v,fallback=0,max=MAX_COINS)=>
 Number.isSafeInteger(v)&&v>=0?Math.min(max,v):fallback;
const actor=id=>typeof id==="string"&&/^[a-z][a-z0-9-]{0,39}$/.test(id);
const coordinates=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&
 Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const ok=(message,extra={})=>({ok:true,message,...extra});
const fail=message=>({ok:false,message});
const distance=(a,b)=>{
 const lat=(a.lat+b.lat)*Math.PI/360;
 const dl=((a.lon-b.lon+540)%360)-180;
 return Math.hypot((a.lat-b.lat)*111195,dl*111195*Math.cos(lat));
};
const TOWNS=new Map(DESTINATIONS.map(t=>[t.id,t]));
const PURPOSES=Object.freeze({roads:"道路整備",guards:"衛兵の給与",school:"教育・公共施設"});
function initialTerritory(place){
 return {id:place.id,name:place.name,rulerId:place.id==="pioneer"?"player":"council-"+place.id,
  taxRate:10,exemption:20,treasury:0,support:60,lastReport:null};
}
function validAsset(a){
 return a&&["land","building"].includes(a.kind)&&typeof a.id==="string"&&
 /^[a-z]+:[a-z0-9-]{1,50}$/.test(a.id)&&actor(a.ownerId)&&
 (a.tenantId===null||actor(a.tenantId))&&coordinates(a)&&
 (a.kind!=="land"||(Number.isFinite(a.radiusM)&&a.radiusM>=6&&a.radiusM<=120));
}
export class TerritoryEconomy{
 constructor(saved=null,nowDay=0){
  this.territories=Object.fromEntries(DESTINATIONS.map(t=>[t.id,initialTerritory(t)]));
  this.assets=[];
  this.ledger=[];
  this.nextDeedId=1;
  this.lastCollectedMonth=Math.floor(Math.max(0,Number(nowDay)||0)/30);
  this.bonds=new PublicBonds(this,saved?.bonds||null);
  if(!saved||saved.schemaVersion!==1)return;
  this.lastCollectedMonth=integer(saved.lastCollectedMonth,this.lastCollectedMonth,1000000);
  for(const [id,old] of Object.entries(saved.territories||{})){
   const t=this.territories[id];
   if(!t||!old)continue;
   t.taxRate=integer(old.taxRate,t.taxRate,30);
   t.treasury=integer(old.treasury,0);
   t.support=integer(old.support,60,100);
   if(actor(old.rulerId))t.rulerId=old.rulerId;
   if(old.lastReport&&Number.isSafeInteger(old.lastReport.month)&&old.lastReport.month>=0){
    t.lastReport={month:old.lastReport.month,income:integer(old.lastReport.income),
     assessed:integer(old.lastReport.assessed),collected:integer(old.lastReport.collected),
     residents:integer(old.lastReport.residents,0,200)};
   }
  }
  if(Array.isArray(saved.assets)){
   const ids=new Set();
   for(const a of saved.assets.slice(0,1600)){
    if(!validAsset(a)||ids.has(a.id)||!TOWNS.has(a.territoryId))continue;
    ids.add(a.id);
    this.assets.push({id:a.id,kind:a.kind,ownerId:a.ownerId,tenantId:a.tenantId||null,
     territoryId:a.territoryId,lat:a.lat,lon:a.lon,
     ...(a.kind==="land"?{radiusM:a.radiusM}:{sourceId:integer(a.sourceId)}),
     destroyed:!!a.destroyed});
   }
  }
  this.nextDeedId=integer(saved.nextDeedId,1,1000000)||1;
  if(Array.isArray(saved.ledger))this.ledger=saved.ledger.slice(-80).filter(e=>
   e&&typeof e.type==="string"&&typeof e.text==="string").map(e=>({
    type:e.type.slice(0,24),text:e.text.slice(0,160),month:integer(e.month,0,1000000)}));
 }
 town(id){return this.territories[id]||null;}
 ruler(id,userId="player"){return this.town(id)?.rulerId===userId;}
 write(type,text,month=this.lastCollectedMonth){
  this.ledger.push({type,text,month});if(this.ledger.length>80)this.ledger.shift();
 }
 syncOwnerBuildings(ownerWorld,territoryId="pioneer"){
  if(!ownerWorld||!Array.isArray(ownerWorld.buildings))return 0;
  const seen=new Set();let changed=0;
  for(const b of ownerWorld.buildings){
   if(!Number.isSafeInteger(b.id)||!coordinates(b))continue;
   const id="building:"+b.id;seen.add(id);
   const existing=this.assets.find(a=>a.id===id);
   if(existing){
    if(existing.destroyed||existing.lat!==b.lat||existing.lon!==b.lon){
     existing.destroyed=false;existing.lat=b.lat;existing.lon=b.lon;changed++;
    }
   }else if(this.assets.length<1600){
    this.assets.push({id,kind:"building",sourceId:b.id,ownerId:"player",
     tenantId:null,territoryId,lat:b.lat,lon:b.lon,destroyed:false});
    changed++;
   }
  }
  for(const a of this.assets){
   if(a.kind==="building"&&!seen.has(a.id)&&!a.destroyed){a.destroyed=true;changed++;}
  }
  return changed;
 }
 claimLand(territoryId,p,radiusM=20,ownerId="player"){
  if(!this.town(territoryId)||!coordinates(p)||!actor(ownerId)||
   !Number.isFinite(radiusM)||radiusM<6||radiusM>120)
   return fail("土地登記の条件が不正です");
  if(!this.ruler(territoryId,ownerId))
   return fail("この領地での新規登録には統治者の許可が必要です");
  if(this.assets.length>=1600)return fail("登記件数の上限です");
  if(this.assets.some(a=>a.kind==="land"&&!a.destroyed&&
   distance(a,p)<a.radiusM+radiusM))return fail("既存の土地登記と重複しています");
  const id="land:"+this.nextDeedId++;
  this.assets.push({id,kind:"land",ownerId,tenantId:null,territoryId,
   lat:p.lat,lon:p.lon,radiusM,destroyed:false});
  this.write("deed",id+" を "+ownerId+" 名義で登記");
  return ok("🏡 半径"+Math.round(radiusM)+"mの土地を登記しました",{id});
 }
 transfer(id,from,to){
  const deed=this.assets.find(a=>a.id===id&&!a.destroyed);
  if(!deed||deed.ownerId!==from||!actor(to)||to===from)
   return fail("所有者または譲渡先を確認してください");
  deed.ownerId=to;deed.tenantId=null;
  this.write("transfer",id+" "+from+" → "+to);
  return ok("📜 "+id+" の所有権を "+to+" に移転しました");
 }
 lease(id,ownerId,tenantId){
  const deed=this.assets.find(a=>a.id===id&&!a.destroyed);
  if(!deed||deed.ownerId!==ownerId||!actor(tenantId)||ownerId===tenantId)
   return fail("所有権と借主を確認してください");
  deed.tenantId=tenantId;
  this.write("lease",id+" を "+tenantId+" に賃貸");
  return ok("🏠 居住・利用権を登録しました");
 }
 inherit(from,to){
  if(!actor(from)||!actor(to)||from===to)return fail("相続人を確認してください");
  const ids=this.assets.filter(a=>a.ownerId===from);
  for(const deed of ids){deed.ownerId=to;deed.tenantId=null;}
  if(ids.length)this.write("inherit",from+" → "+to+" "+ids.length+"件相続");
  return ok("📜 "+ids.length+"件の資産を継承しました",{count:ids.length});
 }
 setTaxRate(townId,rate,userId="player"){
  const t=this.town(townId);
  if(!t||!this.ruler(townId,userId))return fail("この領地の徴税権限がありません");
  if(!Number.isSafeInteger(rate)||rate<0||rate>30)return fail("税率は0～30%です");
  t.taxRate=rate;this.write("tax",t.name+" 所得税 "+rate+"%");
  return ok("🪙 "+t.name+" の所得税率を "+rate+"%に設定しました");
 }
 monthlyAssessment(townId){
  const t=this.town(townId);if(!t)return null;
  // NPC salaries are local simulation values; not transfers from the TownLife player wallet.
  const residents=townId==="pioneer"?18:settlementLayout(townId).residents.length;
  let income=0,assessed=0;
  for(let i=0;i<residents;i++){
   const wage=55+(i*29+townId.length*7)%95;
   income+=wage;
   assessed+=Math.floor(Math.max(0,wage-t.exemption)*t.taxRate/100);
  }
  const paymentRate=t.taxRate<=15?100:t.taxRate<=20?88:70;
  return {residents,income,assessed,collected:Math.floor(assessed*paymentRate/100)};
 }
 collectUntil(day){
  if(!Number.isFinite(day)||day<0)return 0;
  const target=Math.floor(day/30);
  if(target<=this.lastCollectedMonth)return 0;
  // Bound processing cost for imported/accelerated time skips.
  const start=Math.max(this.lastCollectedMonth+1,target-23);let n=0;
  for(let month=start;month<=target;month++){
   for(const id of Object.keys(this.territories)){
    const t=this.territories[id],bill=this.monthlyAssessment(id);
    t.treasury=clamp(t.treasury+bill.collected,0,MAX_COINS);
    t.lastReport={month,...bill};
    t.support=clamp(t.support+(t.taxRate<=12?1:t.taxRate>20?-3:-1),0,100);
   }
   n++;
  }
  this.lastCollectedMonth=target;
  this.write("collection",n+"か月分の徴税を確定",target);
  return n;
 }
 spend(townId,purpose,amount=100,userId="player"){
  const t=this.town(townId);
  if(!t||!this.ruler(townId,userId))return fail("公金の支出権限がありません");
  if(!PURPOSES[purpose]||!Number.isSafeInteger(amount)||amount<=0||amount>100000)
   return fail("支出内容が不正です");
  if(t.treasury<amount)return fail("領地の公金庫が不足しています");
  t.treasury-=amount;t.support=clamp(t.support+2,0,100);
  this.write("spend",t.name+" "+PURPOSES[purpose]+" "+amount+"G");
  return ok("🏛️ "+PURPOSES[purpose]+"に"+amount+"Gを支出しました");
 }
 snapshot(){
  return {schemaVersion:1,lastCollectedMonth:this.lastCollectedMonth,
   nextDeedId:this.nextDeedId,territories:JSON.parse(JSON.stringify(this.territories)),
   assets:this.assets.map(a=>({...a})),ledger:this.ledger.map(e=>({...e})),
   bonds:this.bonds.snapshot()};
 }
}
