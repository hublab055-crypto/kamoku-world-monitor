/**
 * Native MR Living social rules. No camera frames, tracking logs or intimate
 * contact history are sent to a server. NPC permission is never inferred from
 * affection alone. This module is shared by Quest input and HTML controls.
 */
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:lo));
export const MR_SOCIAL_KEY="universal-engine:mr-living:social:v1";
export const MR_SENSITIVE=new Set(["chest","pelvis","buttocks"]);
const defaults=()=>({affinity:0,anger:0,warnings:0,reported:false,adult:true,personalSpace:1,allies:[],lastAlert:-20,nearTime:0});
export class MRLivingSocial {
 constructor({saved=null,onEvent=()=>{},mode="universe"}={}){
  this.people=new Map();this.consent=new Map();this.time=0;this.onEvent=onEvent;this.mode=mode;
  if(saved)this.restore(saved);
 }
 register(id,{affinity=0,adult=true,allies=[]}={}){
  const prior=this.people.get(id);
  if(!prior)this.people.set(id,{...defaults(),affinity:clamp(affinity,-100,100),adult:adult===true,allies:allies.slice(0,8)});
  return this.people.get(id);
 }
 get(id){return this.people.get(id)||this.register(id);}
 setAffinity(id,points){this.get(id).affinity=clamp(points,-100,100);}
 comfort(id){const p=this.get(id);return clamp(1.08-p.affinity*.005, .4, 1.65)*p.personalSpace;}
 emit(type,id,details={}){const message={type,id,...details};this.onEvent(message);return message;}
 advance(dt){this.time+=clamp(dt,0,.12);for(const [key,c] of this.consent)if(c<=this.time)this.consent.delete(key);}
 approach(id,distance,dt=.05){
  if(!Number.isFinite(distance)||distance<0)return null;
  const p=this.get(id),required=this.comfort(id);
  if(distance>=required){p.nearTime=0;return null;}
  p.nearTime+=clamp(dt,0,.12);
  if(p.nearTime<1||this.time-p.lastAlert<6)return null;
  p.nearTime=0;p.lastAlert=this.time;
  return this.emit(distance<required*.65?"avoid":"step_back",id,{text:"少し距離を空けてもらえますか？",required,distance});
 }
 key(id,kind){return id+"|"+kind;}
 offer(id,kind){
  const p=this.get(id);
  if(!["handshake","hug"].includes(kind))return false;
  const accept=kind==="handshake"?p.affinity>=-10:p.affinity>=40;
  if(accept)this.consent.set(this.key(id,kind),this.time+8);
  this.emit(accept?"accepted":"declined",id,{kind,text:accept?"いいですよ。":"今は遠慮します。"});
  return accept;
 }
 grantExplicit(id,zone,{adultConfirmation=false,ttl=8}={}){
  const p=this.get(id);
  if(!MR_SENSITIVE.has(zone)||!adultConfirmation||!p.adult)return false;
  this.consent.set(this.key(id,zone),this.time+clamp(ttl,1,15));return true;
 }
 consume(id,kind){const k=this.key(id,kind),ok=(this.consent.get(k)||-1)>this.time;if(ok)this.consent.delete(k);return ok;}
 touch(id,zone,{kind="touch",witnesses=[]}={}){
  const p=this.get(id),sensitive=MR_SENSITIVE.has(zone);
  if(this.consume(id,kind==="handshake"||kind==="hug"?kind:zone))return this.emit("permitted",id,{zone,kind});
  if(!sensitive&&kind==="touch")return {type:"ignored",id};
  if(this.time-p.lastAlert<1)return {type:"debounced",id};
  p.lastAlert=this.time;p.warnings++;p.anger=clamp(p.anger+(sensitive?35:16),0,100);
  p.affinity=clamp(p.affinity-(sensitive?16:6),-100,100);
  this.emit("warning",id,{zone,text:"やめてください。"});
  if(p.anger>=50&&!p.reported){
   p.reported=true;
   for(const allyId of [...new Set([...p.allies,...witnesses])])if(allyId!==id){
    const ally=this.people.get(allyId);if(ally)ally.affinity=clamp(ally.affinity-10,-100,100);
   }
   this.emit("report",id,{text:"仲間にも相談します。"});
  }
  if(p.anger>=90&&p.warnings>=3){
   if(this.mode==="creative")return this.emit("avoid",id,{text:"離れてください。"});
   return this.emit("defend",id,{text:"身を守ります。",nonLethal:true,incapacitate:true,gameOver:this.mode==="universe"});
  }
  return {type:"warning",id,anger:p.anger};
 }
 talk(id,text){
  const p=this.get(id),q=String(text||"").trim().slice(0,200);
  const tense=p.anger>45;
  const answer=tense?"少し一人にしてください。":/テレビ|動画/.test(q)?"一緒に観ましょうか。":/飲み|お茶|コーラ|ビール|日本酒/.test(q)?"飲み物を用意しましょう。":
   /座|休/.test(q)?"座布団のある場所で休みましょう。":"はい、聞いていますよ。";
  this.emit("dialogue",id,{text:answer,query:q});return answer;
 }
 apologize(id){const p=this.get(id);p.anger=Math.max(0,p.anger-12);this.emit("apology",id,{text:"わかりました。少しずつ信頼を取り戻しましょう。"});}
 snapshot(){return {version:1,time:this.time,people:Object.fromEntries(this.people)};}
 restore(saved){if(saved?.version!==1)return false;this.people.clear();this.consent.clear();
  this.time=clamp(saved.time,0,1e12);
  for(const [id,raw] of Object.entries(saved.people||{}).slice(0,8)){
   if(!/^[a-z0-9_-]{1,48}$/i.test(id))continue;
   this.people.set(id,{...defaults(),affinity:clamp(raw?.affinity,-100,100),
    anger:clamp(raw?.anger,0,100),warnings:clamp(raw?.warnings,0,99),reported:raw?.reported===true,
    adult:raw?.adult===true,allies:Array.isArray(raw?.allies)?raw.allies.slice(0,8):[],
    lastAlert:clamp(raw?.lastAlert,-1e12,1e12),personalSpace:clamp(raw?.personalSpace,.7,1.7),nearTime:0});
  }return true;
 }
}
