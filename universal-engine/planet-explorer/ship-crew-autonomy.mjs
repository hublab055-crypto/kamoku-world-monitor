/** Deterministic, saveable shipboard daily life.
 * Autonomous crew schedules never take over manual follower, guest or pilot commands.
 * All locations are ship-local and movement is delegated to collision-aware ShipInterior.
 */
const finite=Number.isFinite;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const PAIRS=Object.freeze([
 ["engineer","companion"],["navigator","companion"],["navigator","engineer"]
]);
const TOPICS=Object.freeze([
 Object.freeze({id:"maintenance",label:"整備",
  lines:["今朝の推進器チェックは問題なし。","それなら次の星まで安心して眠れそう。","気になる音がしたらすぐ知らせて。","もちろん。いつも助かるよ。"]}),
 Object.freeze({id:"stargazing",label:"星空",
  lines:["窓の向こう、あの星がきれいだね。","航法データには載っていない光もある。","次の寄港地から眺めたら違うかな。","一緒に見に行こう。"]}),
 Object.freeze({id:"provisions",label:"食事",
  lines:["補給品の棚は整理しておいたよ。","ありがとう。温かい食事が楽しみ。","次の港では新しい食材も探そう。","賛成。みんなにも声をかけよう。"]}),
 Object.freeze({id:"navigation",label:"航路",
  lines:["この先の航路は穏やかそうだ。","でも観測は続けよう。油断は禁物。","了解。センサーの記録も共有する。","いいね、協力して進もう。"]})
]);
export const CREW_ROUTINE_CRITICAL=Object.freeze(["ascent","vtol","touchdown"]);
export const CREW_ROUTINE_ALLOWED=Object.freeze([
 "preflight","docked","landed","origin-orbit","orbit","cruise","approach",
 "flyby","entry","atmosphere"
]);
export function crewRoutineSafety(status){
 return CREW_ROUTINE_CRITICAL.includes(status)?"secure":
  CREW_ROUTINE_ALLOWED.includes(status)?"active":"hold";
}
export function crewRoutineEligible(member,{status="docked",autopilot=true}={}){
 if(!member||member.following||member.returning||member.seatLocked)return false;
 if(crewRoutineSafety(status)!=="active")return false;
 // The first officer remains on the bridge during entry, atmosphere flight
 // and manual navigation. Crew on break may still visit the lounge.
 if(member.id==="navigator"&&(["entry","atmosphere"].includes(status)||!autopilot))return false;
 return true;
}
export class ShipCrewAutonomy{
 constructor(saved={}){
  this.clock=finite(saved?.clock)?Math.max(0,saved.clock):0;
  this.cycle=finite(saved?.cycle)?Math.max(0,Math.floor(saved.cycle)):0;
  this.nextAt=finite(saved?.nextAt)?Math.max(0,saved.nextAt):7;
  this.phase=["idle","gather","talk","return"].includes(saved?.phase)?saved.phase:"idle";
  this.pair=Array.isArray(saved?.pair)&&saved.pair.length===2&&
   saved.pair.every(id=>["engineer","navigator","companion"].includes(id))?
   [...saved.pair]:[];
  this.topic=finite(saved?.topic)?Math.abs(Math.floor(saved.topic))%TOPICS.length:0;
  this.line=finite(saved?.line)?clamp(Math.floor(saved.line),0,TOPICS[0].lines.length-1):0;
  this.elapsed=finite(saved?.elapsed)?Math.max(0,saved.elapsed):0;
  this.bonds=saved?.bonds&&typeof saved.bonds==="object"?{
   "engineer:companion":Math.max(0,Number(saved.bonds["engineer:companion"])||0),
   "navigator:companion":Math.max(0,Number(saved.bonds["navigator:companion"])||0),
   "navigator:engineer":Math.max(0,Number(saved.bonds["navigator:engineer"])||0)
  }:{};
 }
 get speech(){
  if(this.phase!=="talk"||this.pair.length!==2)return null;
  const speakerId=this.pair[this.line%2],listenerId=this.pair[(this.line+1)%2];
  return {speakerId,listenerId,text:TOPICS[this.topic].lines[this.line],
   topic:TOPICS[this.topic].label,line:this.line+1,total:TOPICS[this.topic].lines.length};
 }
 /** Conversation trigger never relocates characters; the gathering walk is real. */
 begin(interior,context={}){
  if(this.phase!=="idle"||crewRoutineSafety(context.status)!=="active")return false;
  const choices=PAIRS.map((_,i)=>PAIRS[(this.cycle+i)%PAIRS.length]);
  const pair=choices.find(ids=>ids.every(id=>crewRoutineEligible(
   interior.crew.find(c=>c.id===id),context)));
  if(!pair)return false;
  this.pair=[...pair];this.topic=this.cycle%TOPICS.length;
  this.line=0;this.elapsed=0;this.phase="gather";
  // Public lounge is between the two pressure bulkheads, never in the hatch.
  for(const [i,id]of pair.entries()){
   const member=interior.crew.find(c=>c.id===id);
   member.seated=false;member.returning=false;member.routineTarget={
    x:i===0?-.92:.92,z:1.15
   };
  }
  return true;
 }
 end(interior,{completed=false}={}){
  if(completed&&this.pair.length===2){
   const key=this.pair.join(":");
   this.bonds[key]=Math.min(500,(this.bonds[key]||0)+2);
  }
  for(const id of this.pair){
   const member=interior.crew.find(c=>c.id===id);
   if(member&&!member.following&&!member.seatLocked){
    member.routineTarget=null;member.returning=true;member.seated=false;
   }else if(member)member.routineTarget=null;
  }
  this.phase="return";this.elapsed=0;
  this.cycle++;
  this.nextAt=this.clock+18;
 }
 advance(interior,dt,context={}){
  if(!finite(dt)||dt<=0)return;
  const step=Math.min(.16,dt);
  this.clock+=step;
  const status=context.status??"docked",safe=crewRoutineSafety(status);
  const members=this.pair.map(id=>interior.crew.find(c=>c.id===id));
  if(["gather","talk"].includes(this.phase)&&
   (safe!=="active"||members.some(c=>!c||c.following||c.seatLocked)||
    members.some(c=>!crewRoutineEligible(c,{...context,status}))||
    interior.greetings?.pair&&members.includes(interior.greetings.pair.member))){
   this.end(interior);return;
  }
  if(this.phase==="idle"){
   if(this.clock>=this.nextAt)this.begin(interior,{...context,status});return;
  }
  if(this.phase==="gather"){
   this.elapsed+=step;
   if(members.length===2&&members.every(c=>c&&c.routineTarget&&
    Math.hypot(c.x-c.routineTarget.x,c.z-c.routineTarget.z)<.45)){
    this.phase="talk";this.elapsed=0;this.line=0;
    members.forEach((c,i)=>{c.moving=false;c.routineTarget=null;
     c.yaw=Math.atan2(members[1-i].x-c.x,members[1-i].z-c.z);});
   }else if(this.elapsed>42)this.end(interior);
  }else if(this.phase==="talk"){
   if(members.some(c=>!c||Math.hypot(c.x-members[1-members.indexOf(c)].x,
    c.z-members[1-members.indexOf(c)].z)>2.8)){this.end(interior);return;}
   this.elapsed+=step;
   if(this.elapsed>=4.3){
    this.elapsed-=4.3;this.line++;
    if(this.line>=TOPICS[this.topic].lines.length)this.end(interior,{completed:true});
   }
  }else if(this.phase==="return"){
   if(this.pair.every(id=>{
    const c=interior.crew.find(member=>member.id===id);
    return !c||!c.returning||c.following;
   })){
    this.phase="idle";this.pair=[];this.elapsed=0;
   }
  }
 }
 snapshot(){return {schemaVersion:1,clock:this.clock,cycle:this.cycle,
  nextAt:this.nextAt,phase:this.phase,pair:[...this.pair],topic:this.topic,
  line:this.line,elapsed:this.elapsed,bonds:{...this.bonds}};}
}
