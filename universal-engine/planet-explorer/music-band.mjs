/** Contracted NPC music ensemble. Pure data; no renderer or DOM dependency.
 * Performer IDs always come from the existing deterministic settlement roster.
 */
import {settlementLayout,destinationById} from "./settlements.mjs?v=0.8r-towns";
const cultureDay=day=>Math.max(0,Math.floor(Number(day)||0));

export const MUSIC_BAND_ROLES=Object.freeze([
 {id:"guitar",name:"🎸 ギター",fee:24},
 {id:"keys",name:"🎹 鍵盤",fee:28},
 {id:"bass",name:"🎼 ベース",fee:22},
 {id:"drums",name:"🥁 ドラム",fee:26}
]);
export const MUSIC_CONTRACT_DAYS=3;
const bounded=(n,min,max)=>Math.max(min,Math.min(max,n));
const valid=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const citizenId=id=>/^resident-\d{1,3}$/.test(id);
const contractValid=c=>c&&typeof c.townId==="string"&&
 /^[a-z]{1,16}$/.test(c.townId)&&citizenId(c.residentId)&&
 MUSIC_BAND_ROLES.some(role=>role.id===c.role)&&
 valid(c.startsDay,0,1000000)&&valid(c.endsDay,0,1000000)&&
 c.endsDay===c.startsDay+MUSIC_CONTRACT_DAYS&&valid(c.fee,0,1000);

export function musicianCandidates(townId,venueId){
 if(!destinationById(townId)||townId==="pioneer"||
  !["tavern","theater","school"].includes(venueId))return [];
 const residents=settlementLayout(townId).residents;
 if(!residents.length)return [];
 const leadIndex=venueId==="tavern"?4:venueId==="theater"?7:2;
 const leadId=residents[leadIndex%residents.length].id;
 return residents
  .filter(r=>r.id!==leadId)
  .slice(0,12)
  .map((r,index)=>({
   id:r.id,name:"住人 "+(1+Number(r.id.split("-")[1])),
   preferredRole:MUSIC_BAND_ROLES[index%MUSIC_BAND_ROLES.length].id
  }));
}
export function restoreBandContracts(raw){
 if(raw===undefined||raw===null)return {};
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("楽団契約データが不正です");
 const bands={};let total=0;
 for(const [town,contracts]of Object.entries(raw)){
  if(!/^[a-z]{1,16}$/.test(town)||!Array.isArray(contracts)||contracts.length>4)
   throw Error("楽団契約の形式が不正です");
  const roster=new Set(),roles=new Set(),clean=[];
  for(const entry of contracts){
   if(++total>28||!contractValid(entry)||entry.townId!==town||
     !settlementLayout(town).residents.some(c=>c.id===entry.residentId)||
     roster.has(entry.residentId)||roles.has(entry.role))
    throw Error("楽団契約が不正です");
   roster.add(entry.residentId);roles.add(entry.role);clean.push({...entry});
  }
  bands[town]=clean;
 }
 return bands;
}
export function currentBand(bands,townId,day){
 const d=cultureDay(day);
 return (bands?.[townId]||[]).filter(c=>c.startsDay<=d&&c.endsDay>d)
  .map(c=>({...c}));
}
export function hireBandContract(bands,townId,venueId,residentId,role,day,wallet,{near=false}={}){
 if(!near)return {ok:false,message:"演奏家のいる会場近くに行ってください"};
 const definition=MUSIC_BAND_ROLES.find(r=>r.id===role);
 if(!definition||!musicianCandidates(townId,venueId).some(r=>r.id===residentId))
  return {ok:false,message:"雇用対象の演奏家・役割が不正です"};
 if(!wallet||!valid(wallet.coins,0,999999))return {ok:false,message:"所持金を確認できません"};
 const d=cultureDay(day),existing=currentBand(bands,townId,d);
 if(existing.length>=4)return {ok:false,message:"楽団は4人まで雇用できます"};
 if(existing.some(c=>c.residentId===residentId||c.role===role))
  return {ok:false,message:"同じ演奏者または担当楽器を重複して雇えません"};
 if(wallet.coins<definition.fee)return {ok:false,message:"契約金 "+definition.fee+"G が足りません"};
 const contract={townId,residentId,role,fee:definition.fee,startsDay:d,endsDay:d+MUSIC_CONTRACT_DAYS};
 // Only successful validations reach the mutation point.
 const next=restoreBandContracts(bands);
 next[townId]=[...existing,contract];wallet.coins-=definition.fee;
 return {ok:true,message:"🎼 "+role+" 担当と3日間契約（"+definition.fee+"G）",bands:next,contract};
}
export function releaseBandContract(bands,townId,residentId,day){
 const current=currentBand(bands,townId,day),match=current.find(c=>c.residentId===residentId);
 if(!match)return {ok:false,message:"有効な契約がありません"};
 const next=restoreBandContracts(bands);
 next[townId]=current.filter(c=>c.residentId!==residentId);
 return {ok:true,message:"楽団員との契約を終了しました。既払い契約金は返還されません",bands:next,contract:match};
}
export function bandAppearance(venue,bands,day){
 const active=currentBand(bands,venue.townId,day);
 return [{residentId:venue.musicianId,role:"lead",x:0,z:-1.8},
  ...active.map((c,i)=>({...c,x:(i-1.5)*1.15,z:-.15+((i%2)*.45)}))];
}
