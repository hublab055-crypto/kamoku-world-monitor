import {stationById} from "./railway.mjs?v=0.8x-rail-safety";

export const RAIL_CORRIDOR_HALF_WIDTH=2.65;
export const RAIL_CORRIDOR_HALF_LENGTH=380;
export const RAIL_WARNING_WINDOW_SECONDS=30;
export const RAIL_WARNING_INTERVAL_SECONDS=4;
export const RAIL_WARNING_LIMIT=3;
export const RAIL_BAIL_FINE=120;

function localAt(station,x,z){
 const yaw=station.site.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
 const dx=x-station.site.x,dz=z-station.site.z;
 return {x:c*dx-s*dz,z:s*dx+c*dz,c,s};
}
function worldAt(station,local){
 const yaw=station.site.yaw||0,c=Math.cos(yaw),s=Math.sin(yaw);
 return {x:station.site.x+c*local.x+s*local.z,
  z:station.site.z-s*local.x+c*local.z};
}

/** True only between the two safety fences, not on the passenger platform. */
export function isRailRestricted(stationId,x,z,{margin=0}={}){
 const station=stationById(stationId);
 if(!station||![x,z,margin].every(Number.isFinite))return false;
 const local=localAt(station,x,z);
 return Math.abs(local.x)<RAIL_CORRIDOR_HALF_WIDTH+margin&&
  Math.abs(local.z)<RAIL_CORRIDOR_HALF_LENGTH+margin;
}

/** Move ambient residents to the town side of the fence without moving the player. */
export function keepResidentOffRail(stationId,x,z,clearance=2.2){
 const station=stationById(stationId);
 if(!station||![x,z,clearance].every(Number.isFinite))return {x,z};
 const local=localAt(station,x,z);
 if(Math.abs(local.z)>=RAIL_CORRIDOR_HALF_LENGTH+4||
  Math.abs(local.x)>=RAIL_CORRIDOR_HALF_WIDTH+clearance)return {x,z};
 local.x=(local.x<0?-1:1)*(RAIL_CORRIDOR_HALF_WIDTH+clearance);
 return worldAt(station,local);
}

/** Warnings and pursuit use real elapsed seconds, independent of planet fast-forward. */
export class RailwaySecurity{
 constructor(snapshot=null){
  const saved=snapshot?.schemaVersion===1?snapshot:null;
  this.elapsed=Number.isFinite(saved?.elapsed)?Math.max(0,saved.elapsed):0;
  this.warningTimes=Array.isArray(saved?.warningAges)?saved.warningAges
   .filter(Number.isFinite).map(age=>this.elapsed-Math.max(0,age)).slice(-RAIL_WARNING_LIMIT):[];
  this.nextWarningAt=this.elapsed;
  this.wasRestricted=false;
  this.wanted=Boolean(saved?.wanted);
  this.guard=saved?.guard&&[saved.guard.x,saved.guard.z].every(Number.isFinite)?{...saved.guard}:null;
  this.jailed=saved?.jailed&&stationById(saved.jailed.stationId)?
   {stationId:saved.jailed.stationId,fine:RAIL_BAIL_FINE}:null;
 }
 get warningCount(){return this.warningTimes.length;}
 get state(){return this.jailed?"jailed":this.wanted?"wanted":this.warningCount?"warned":"clear";}
 advance(dt,{stationId,x,z,eligible=true}={}){
  if(!Number.isFinite(dt)||dt<0)throw new RangeError("Invalid security time delta");
  this.elapsed+=Math.min(dt,.25);
  this.warningTimes=this.warningTimes.filter(t=>this.elapsed-t<=RAIL_WARNING_WINDOW_SECONDS);
  const events=[];
  if(this.jailed)return events;
  const station=stationById(stationId);
  const restricted=Boolean(eligible&&station&&isRailRestricted(stationId,x,z));
  if(this.wanted&&station&&this.guard){
   if(this.guard.stationId!==stationId){
    this.guard={stationId,x:station.site.x+10,z:station.site.z-7};
   }
   const dx=x-this.guard.x,dz=z-this.guard.z,distance=Math.hypot(dx,dz);
   const step=Math.min(distance,5.4*Math.min(dt,.25));
   if(distance>.001){this.guard.x+=dx/distance*step;this.guard.z+=dz/distance*step;}
   if(distance<=1.65){
    this.jailed={stationId,fine:RAIL_BAIL_FINE};this.wanted=false;this.guard=null;
    this.wasRestricted=false;
    events.push({type:"jailed",stationId,fine:RAIL_BAIL_FINE,
     message:"衛兵に確保され、駅の留置所へ勾留されました。罰金 "+RAIL_BAIL_FINE+"G で保釈できます。"});
   }
   return events;
  }
  if(restricted&&(!this.wasRestricted||this.elapsed>=this.nextWarningAt)){
   this.warningTimes.push(this.elapsed);
   this.warningTimes=this.warningTimes.slice(-RAIL_WARNING_LIMIT);
   this.nextWarningAt=this.elapsed+RAIL_WARNING_INTERVAL_SECONDS;
   if(this.warningCount>=RAIL_WARNING_LIMIT){
    this.wanted=true;
    this.guard={stationId,x:station.site.x+10,z:station.site.z-7};
    events.push({type:"pursuit",stationId,count:this.warningCount,
     message:"3回目の警告に背きました。衛兵が追跡を開始しました。線路から離れても追跡は続きます。"});
   }else events.push({type:"warning",stationId,count:this.warningCount,
    message:"保安員：線路内は立入禁止です。柵の外へ出てください（警告 "+this.warningCount+"/"+RAIL_WARNING_LIMIT+"）。"});
  }
  if(!restricted){
   this.nextWarningAt=this.elapsed;
   if(!this.warningCount)this.wasRestricted=false;
  }
  this.wasRestricted=restricted;
  return events;
 }
 payFine(pay){
  if(!this.jailed)return {ok:false,message:"勾留されていません"};
  const result=typeof pay==="function"?pay(RAIL_BAIL_FINE):{ok:false};
  if(result===false||result?.ok===false)return {ok:false,message:result?.message||"罰金を支払えません"};
  const stationId=this.jailed.stationId;
  this.jailed=null;this.wanted=false;this.guard=null;this.warningTimes=[];
  this.wasRestricted=false;this.nextWarningAt=this.elapsed;
  return {ok:true,stationId,message:"罰金 "+RAIL_BAIL_FINE+"G を支払い、保釈されました。"};
 }
 snapshot(){
  return {schemaVersion:1,elapsed:this.elapsed,
   warningAges:this.warningTimes.map(t=>Math.max(0,this.elapsed-t)),wanted:this.wanted,
   guard:this.guard?{...this.guard}:null,jailed:this.jailed?{...this.jailed}:null};
 }
}
