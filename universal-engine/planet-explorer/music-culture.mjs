/**
 * Planet-time civic music venues. Pure model: no audio, DOM, WebGL or global
 * timers. A single authoritative transaction debits shared town-life coins.
 */
import {destinationById,settlementLayout} from "./settlements.mjs?v=0.8r-towns";
export const MUSIC_CULTURE_FORMAT="ue/music-culture";
export const MUSIC_VENUES=Object.freeze([
 {id:"tavern",name:"🍺 宿場の演奏会",kind:"tavern",hours:[18,23],shows:[19,21],ticket:5,capacity:12},
 {id:"theater",name:"🎭 街の広場・音楽劇場",kind:"theater",hours:[12,21],shows:[14,18],ticket:8,capacity:24},
 {id:"school",name:"🎓 音楽教室",kind:"school",hours:[9,17],shows:[10,15],ticket:0,capacity:10}
]);
const int=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const bound=(n,a,b)=>Math.max(a,Math.min(b,n));
export const cultureDay=day=>Math.max(0,Math.floor(Number(day)||0));
export const cultureHour=day=>((Number(day)||0)%1+1)%1*24;
const key=(town,venue)=>town+":"+venue;
const present=town=>destinationById(town)&&town!=="pioneer";
export function musicVenue(townId,venueId){
 if(!present(townId))return null;
 const venue=MUSIC_VENUES.find(v=>v.id===venueId);if(!venue)return null;
 // Deterministic stage sites in road/square space, near existing buildings.
 const layout=settlementLayout(townId);
 const lodge=layout.buildings.find(b=>b.type==="lodge");
 const site=venueId==="tavern"&&lodge?{x:lodge.x+9,z:lodge.z+2}:
  venueId==="theater"?{x:0,z:0}:{x:-10,z:-10};
 const count=layout.residents.length;
 const musician=layout.residents[(venueId==="tavern"?4:venueId==="theater"?7:2)%count];
 const audienceCount=bound(Math.floor(count*(venueId==="theater"?.42:.27)),2,venue.capacity);
 return {...venue,townId,site,musicianId:musician.id,musicianLabel:"街の演奏家 "+(1+Number(musician.id.split("-")[1])),
  audienceCount};
}
export function musicNow(venue,day){
 if(!venue)return null;
 const hour=cultureHour(day),time=hour*60;
 let showIndex=-1,minutesToStart=Infinity;
 for(let i=0;i<venue.shows.length;i++){
  const next=venue.shows[i]*60;
  if(time>=next&&time<next+45){showIndex=i;break;}
  if(next>=time&&next-time<minutesToStart)minutesToStart=next-time;
 }
 const open=hour>=venue.hours[0]&&hour<venue.hours[1];
 return {open,showIndex,performing:showIndex>=0,minutesToStart:Number.isFinite(minutesToStart)?Math.ceil(minutesToStart):null,
  showId:showIndex<0?null:key(venue.townId,venue.id)+":"+cultureDay(day)+":"+showIndex};
}
function defaultSave(){return {format:MUSIC_CULTURE_FORMAT,version:1,treasury:{},skill:0,reputation:0,
 showsAttended:{},showsPlayed:{},lessons:{},npcPaid:{},journal:[]};}
export class MusicCulture{
 constructor(saved=null){
  const d=defaultSave();
  this.treasury={};this.skill=0;this.reputation=0;this.showsAttended={};this.showsPlayed={};this.lessons={};this.npcPaid={};this.journal=[];
  if(!saved)return;
  if(saved.format!==MUSIC_CULTURE_FORMAT||saved.version!==1)throw Error("音楽文化セーブ形式が不正です");
  if(!int(saved.skill,0,1000)||!int(saved.reputation,0,1000))throw Error("音楽文化の値が不正です");
  this.skill=saved.skill;this.reputation=saved.reputation;
  const load=(field,max=1000000)=>{
   const raw=saved[field];if(!raw||typeof raw!=="object"||Array.isArray(raw))return;
   let count=0;
   for(const [k,v]of Object.entries(raw)){if(++count>700)break;
    if(k.length>96||!int(v,0,max))continue;this[field][k]=v;}
  };
  load("treasury",1000000);load("showsAttended");load("showsPlayed");
  load("lessons");load("npcPaid");
  this.journal=Array.isArray(saved.journal)?saved.journal.slice(-30).filter(x=>typeof x==="string").map(x=>x.slice(0,140)):[];
 }
 venue(townId,venueId){return musicVenue(townId,venueId);}
 balance(townId,venueId){return this.treasury[key(townId,venueId)]??120;}
 log(message){this.journal.push(String(message).slice(0,140));if(this.journal.length>30)this.journal.shift();}
 /** NPC salary is paid from an existing venue budget at most once/day.
  * This is not a minting operation and never touches player coins. */
 payNPC(townId,venueId,day){
  const venue=this.venue(townId,venueId);if(!venue)return {ok:false,message:"会場がありません"};
  const id=key(townId,venueId),d=cultureDay(day);
  if(this.npcPaid[id]===d+1)return {ok:false,message:"本日の演奏家報酬は支払済み"};
  const salary=Math.min(this.balance(townId,venueId),venueId==="school"?6:10);
  this.treasury[id]=this.balance(townId,venueId)-salary;
  this.npcPaid[id]=d+1;this.log(venue.name+"：NPC演奏家へ "+salary+"G 支給");
  return {ok:true,salary,message:"演奏家への日当を支払いました"};
 }
 check(venue,day,local){
  if(!venue)return "会場がありません";
  if(!local)return "その街の会場近くへ移動してください";
  if(!musicNow(venue,day).open)return "会場の営業時間外です";
  return "";
 }
 attend(townId,venueId,day,wallet,{near=false}={}){
  const venue=this.venue(townId,venueId),error=this.check(venue,day,near);
  if(error)return {ok:false,message:error};
  const now=musicNow(venue,day);
  if(!now.performing||venueId==="school")return {ok:false,message:"いまは公演中ではありません"};
  if(this.showsAttended[now.showId])return {ok:false,message:"この公演はすでに鑑賞しました"};
  if(!wallet||!int(wallet.coins,0,999999))return {ok:false,message:"所持金を確認できません"};
  if(wallet.coins<venue.ticket)return {ok:false,message:"入場料が足りません"};
  wallet.coins-=venue.ticket;
  const id=key(townId,venueId);
  this.treasury[id]=this.balance(townId,venueId)+venue.ticket;
  this.showsAttended[now.showId]=1;
  this.reputation=bound(this.reputation+1,0,1000);
  this.log(venue.name+"を鑑賞（"+venue.ticket+"G）");
  return {ok:true,message:"🎶 "+venue.musicianLabel+"の演奏を鑑賞。音楽文化への関心が高まりました",venue};
 }
 perform(townId,venueId,day,wallet,{near=false,hasInstrument=false}={}){
  const venue=this.venue(townId,venueId),error=this.check(venue,day,near);
  if(error)return {ok:false,message:error};
  const now=musicNow(venue,day);
  if(!now.performing||venueId==="school")return {ok:false,message:"公演の時間帯だけ出演できます"};
  if(!hasInstrument)return {ok:false,message:"自分の楽器を制作・所持してから出演してください"};
  if(this.showsPlayed[now.showId])return {ok:false,message:"同じ公演には再出演できません"};
  const id=key(townId,venueId);
  const offered=bound(6+Math.floor(this.skill/8)+Math.floor(this.reputation/20)+Math.floor(venue.audienceCount/4),6,35);
  const salary=Math.min(offered,this.balance(townId,venueId));
  if(salary<1)return {ok:false,message:"会場の出演料が不足しています"};
  if(!wallet||!int(wallet.coins,0,999999)||wallet.coins+salary>999999)
   return {ok:false,message:"所持金の上限を確認してください"};
  wallet.coins+=salary;this.treasury[id]=this.balance(townId,venueId)-salary;
  this.showsPlayed[now.showId]=1;
  this.skill=bound(this.skill+2,0,1000);this.reputation=bound(this.reputation+2,0,1000);
  this.log(venue.name+"に出演し "+salary+"G 受領");
  return {ok:true,salary,message:"🎸 公演に出演しました。報酬 "+salary+"G／演奏技能+2／評判+2"};
 }
 lesson(townId,day,wallet,{near=false}={}){
  const venue=this.venue(townId,"school"),error=this.check(venue,day,near);
  if(error)return {ok:false,message:error};
  const dayKey=townId+":"+cultureDay(day);
  if(this.lessons[dayKey])return {ok:false,message:"今日の授業は受講済みです"};
  const fee=12;
  if(!wallet||!int(wallet.coins,0,999999)||wallet.coins<fee)return {ok:false,message:"授業料12Gが必要です"};
  wallet.coins-=fee;this.treasury[key(townId,"school")]=this.balance(townId,"school")+fee;
  this.lessons[dayKey]=1;this.skill=bound(this.skill+5,0,1000);
  this.log(townId+"で演奏を学習（12G）");
  return {ok:true,message:"🎓 音楽授業を受講しました。授業料12G／演奏技能+5"};
 }
 snapshot(){return {format:MUSIC_CULTURE_FORMAT,version:1,treasury:{...this.treasury},
  skill:this.skill,reputation:this.reputation,showsAttended:{...this.showsAttended},
  showsPlayed:{...this.showsPlayed},lessons:{...this.lessons},
  npcPaid:{...this.npcPaid},journal:[...this.journal]};}
}
