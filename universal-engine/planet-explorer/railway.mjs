/**
 * Deterministic steam railway clock for the Planet Explorer.
 *
 * The railway uses the planet clock (days) as its only time authority. Trains
 * therefore keep the same position after save/restore and while a panel is
 * closed. A full loop is eight game-hours, which divides a 24-hour day and
 * gives every station a stable daily timetable.
 */
export const MINUTES_PER_DAY=1440;
export const RAILWAY_LOOP_KM=7;
export const RAILWAY_DWELL_MINUTES=30;

const freezeSite=site=>Object.freeze({...site});
export const RAIL_STATIONS=Object.freeze([
 Object.freeze({id:"tower",name:"ルミナス中央駅",townName:"塔の街ルミナス",icon:"🗼",
  platform:1,site:freezeSite({x:0,z:-94,yaw:0})}),
 Object.freeze({id:"meadow",name:"フロウベル駅",townName:"草原の村 フロウベル",icon:"🌾",
  platform:1,site:freezeSite({x:0,z:-72,yaw:0})}),
 Object.freeze({id:"capital",name:"アルディナス中央駅",townName:"王都アルディナス",icon:"🏰",
  platform:1,site:freezeSite({x:0,z:-94,yaw:0})}),
 Object.freeze({id:"port",name:"セレノート港駅",townName:"港町セレノート",icon:"⚓",
  platform:1,site:freezeSite({x:0,z:-84,yaw:0})})
]);

// Clockwise segment i connects station i to station i+1.
export const RAIL_SEGMENTS=Object.freeze([
 Object.freeze({from:"tower",to:"meadow",distanceKm:1.55,travelMinutes:82}),
 Object.freeze({from:"meadow",to:"capital",distanceKm:1.85,travelMinutes:98}),
 Object.freeze({from:"capital",to:"port",distanceKm:1.65,travelMinutes:86}),
 Object.freeze({from:"port",to:"tower",distanceKm:1.95,travelMinutes:94})
]);
export const RAILWAY_CYCLE_MINUTES=RAIL_SEGMENTS.reduce((sum,s)=>sum+s.travelMinutes,0)+
 RAIL_STATIONS.length*RAILWAY_DWELL_MINUTES;

export const RAIL_SERVICES=Object.freeze([
 Object.freeze({id:"aurora-out",name:"蒸気環状1号",shortName:"1号",direction:1,
  directionName:"外回り",epochMinute:360,platform:1}),
 Object.freeze({id:"aurora-in",name:"蒸気環状2号",shortName:"2号",direction:-1,
  directionName:"内回り",epochMinute:600,platform:2})
]);

export const RAIL_CARRIAGES=Object.freeze([
 Object.freeze({id:"locomotive",name:"機関車・運転台",icon:"🚂"}),
 Object.freeze({id:"tender",name:"炭水車",icon:"🪨"}),
 Object.freeze({id:"passenger",name:"旅客車",icon:"💺"}),
 Object.freeze({id:"freight",name:"貨車",icon:"📦"})
]);

const mod=(value,size)=>((value%size)+size)%size;
const stationIndex=id=>RAIL_STATIONS.findIndex(station=>station.id===id);
export const stationById=id=>RAIL_STATIONS.find(station=>station.id===id)||null;
export const serviceById=id=>RAIL_SERVICES.find(service=>service.id===id)||null;
export const carriageById=id=>RAIL_CARRIAGES.find(carriage=>carriage.id===id)||null;

function segmentIndexFrom(stationIndexValue,direction){
 return direction===1?stationIndexValue:mod(stationIndexValue-1,RAIL_STATIONS.length);
}

/** Ordered dwell/travel phases for one complete service loop. */
export function serviceTimeline(serviceOrId){
 const service=typeof serviceOrId==="string"?serviceById(serviceOrId):serviceOrId;
 if(!service)throw new RangeError("Unknown railway service");
 const phases=[];
 let minute=0,index=0;
 for(let stop=0;stop<RAIL_STATIONS.length;stop++){
  const nextIndex=mod(index+service.direction,RAIL_STATIONS.length);
  const segment=RAIL_SEGMENTS[segmentIndexFrom(index,service.direction)];
  const arrivalOffset=minute,departureOffset=minute+RAILWAY_DWELL_MINUTES;
  const nextArrivalOffset=departureOffset+segment.travelMinutes;
  phases.push(Object.freeze({stationId:RAIL_STATIONS[index].id,nextStationId:RAIL_STATIONS[nextIndex].id,
   arrivalOffset,departureOffset,nextArrivalOffset,segment}));
  minute=nextArrivalOffset;index=nextIndex;
 }
 return Object.freeze(phases);
}

const TIMELINES=new Map(RAIL_SERVICES.map(service=>[service.id,serviceTimeline(service)]));

export function absoluteMinutes(timeDays){
 if(!Number.isFinite(timeDays))throw new TypeError("Invalid planet time");
 return timeDays*MINUTES_PER_DAY;
}

export function formatClock(totalMinutes,{withDay=false}={}){
 if(!Number.isFinite(totalMinutes))return "--:--";
 const rounded=Math.floor(totalMinutes+1e-6);
 const day=Math.floor(rounded/MINUTES_PER_DAY);
 const minute=mod(rounded,MINUTES_PER_DAY);
 const hh=String(Math.floor(minute/60)).padStart(2,"0");
 const mm=String(minute%60).padStart(2,"0");
 return (withDay?"第"+(day+1)+"日 ":"")+hh+":"+mm;
}

export function formatCountdown(minutes){
 if(!Number.isFinite(minutes))return "時刻未定";
 if(minutes<=.75)return "まもなく";
 const rounded=Math.ceil(minutes);
 if(rounded<60)return "あと"+rounded+"分";
 const hours=Math.floor(rounded/60),rest=rounded%60;
 return "あと"+hours+"時間"+(rest?rest+"分":"");
}

/** Exact live state of a scheduled train at an arbitrary planet time. */
export function trainState(serviceOrId,timeDays){
 const service=typeof serviceOrId==="string"?serviceById(serviceOrId):serviceOrId;
 if(!service)throw new RangeError("Unknown railway service");
 const now=absoluteMinutes(timeDays),timeline=TIMELINES.get(service.id);
 const phase=mod(now-service.epochMinute,RAILWAY_CYCLE_MINUTES);
 const cycleStart=now-phase;
 for(const item of timeline){
  if(phase<item.departureOffset){
   const station=stationById(item.stationId),next=stationById(item.nextStationId);
   return {mode:"stopped",service,stationId:item.stationId,station,nextStationId:item.nextStationId,
    nextStation:next,arrivalMinute:cycleStart+item.arrivalOffset,
    departureMinute:cycleStart+item.departureOffset,
    nextArrivalMinute:cycleStart+item.nextArrivalOffset,progress:0,
    platform:service.platform};
  }
  if(phase<item.nextArrivalOffset){
   const elapsed=phase-item.departureOffset,duration=item.segment.travelMinutes;
   return {mode:"travel",service,fromStationId:item.stationId,fromStation:stationById(item.stationId),
    nextStationId:item.nextStationId,nextStation:stationById(item.nextStationId),
    departureMinute:cycleStart+item.departureOffset,
    nextArrivalMinute:cycleStart+item.nextArrivalOffset,
    progress:Math.max(0,Math.min(1,elapsed/duration)),segment:item.segment,
    platform:service.platform};
  }
 }
 // Floating-point rounding can land exactly on the next cycle boundary.
 return trainState(service,(cycleStart+RAILWAY_CYCLE_MINUTES+.001)/MINUTES_PER_DAY);
}

function departureOffset(service,stationId){
 const item=TIMELINES.get(service.id).find(phase=>phase.stationId===stationId);
 return item?.departureOffset;
}

export function stopsAfter(serviceOrId,stationId){
 const service=typeof serviceOrId==="string"?serviceById(serviceOrId):serviceOrId;
 const start=stationIndex(stationId);
 if(!service||start<0)return [];
 return Array.from({length:RAIL_STATIONS.length-1},(_,offset)=>
  RAIL_STATIONS[mod(start+service.direction*(offset+1),RAIL_STATIONS.length)]);
}

/** Future departures at one station, sorted across both directions. */
export function nextDepartures(stationId,timeDays,count=6){
 if(!stationById(stationId))return [];
 const now=absoluteMinutes(timeDays),rows=[];
 for(const service of RAIL_SERVICES){
  const offset=departureOffset(service,stationId);
  const first=service.epochMinute+offset;
  let cycle=Math.ceil((now-first-1e-7)/RAILWAY_CYCLE_MINUTES);
  for(let i=0;i<Math.max(2,count);i++){
   const departureMinute=first+(cycle+i)*RAILWAY_CYCLE_MINUTES;
   const destination=stopsAfter(service,stationId)[0];
   rows.push({serviceId:service.id,serviceName:service.name,directionName:service.directionName,
    platform:service.platform,stationId,destinationId:destination.id,destinationName:destination.name,
    stops:stopsAfter(service,stationId),arrivalMinute:departureMinute-RAILWAY_DWELL_MINUTES,
    departureMinute,time:formatClock(departureMinute),countdownMinutes:Math.max(0,departureMinute-now)});
  }
 }
 return rows.sort((a,b)=>a.departureMinute-b.departureMinute||a.serviceId.localeCompare(b.serviceId)).slice(0,count);
}

export function routeSummary(){
 return RAIL_STATIONS.map(station=>station.name.replace(/中央駅|駅/g,"")).join(" → ")+" → "+
  RAIL_STATIONS[0].name.replace(/中央駅|駅/g,"");
}

/** Persistent player-on-train state; live train position remains schedule-derived. */
export class RailwaySystem{
 constructor(snapshot=null){
  this.boarded=null;
  const saved=snapshot?.schemaVersion===1?snapshot.boarded:null;
  if(saved&&serviceById(saved.serviceId)&&carriageById(saved.carriage)){
   this.boarded={serviceId:saved.serviceId,carriage:saved.carriage,
    lastStationId:stationById(saved.lastStationId)?.id||null,lastMinute:null,nextArrivalMinute:null};
  }
 }
 station(id){return stationById(id);}
 live(timeDays){return RAIL_SERVICES.map(service=>trainState(service,timeDays));}
 stoppedAt(stationId,timeDays){
  return this.live(timeDays).filter(state=>state.mode==="stopped"&&state.stationId===stationId&&
   state.departureMinute-absoluteMinutes(timeDays)>.02);
 }
 board(stationId,timeDays,carriage="passenger",serviceId=null){
  if(this.boarded)return {ok:false,message:"すでに列車内です"};
  if(!stationById(stationId))return {ok:false,message:"この街には環状線の駅がありません"};
  if(!carriageById(carriage))return {ok:false,message:"車両を選び直してください"};
  const available=this.stoppedAt(stationId,timeDays)
   .filter(state=>!serviceId||state.service.id===serviceId)
   .sort((a,b)=>a.departureMinute-b.departureMinute);
  const state=available[0];
  if(!state){
   const next=nextDepartures(stationId,timeDays,1)[0];
   return {ok:false,message:next?"列車はまだ到着していません。次発 "+next.time+"（"+formatCountdown(next.countdownMinutes)+"）":"停車中の列車がありません"};
  }
  const now=absoluteMinutes(timeDays);
  this.boarded={serviceId:state.service.id,carriage,lastStationId:stationId,lastMinute:now,
   nextArrivalMinute:state.nextArrivalMinute};
  return {ok:true,message:state.service.name+"の"+carriageById(carriage).name+"に乗車しました",
   service:state.service,state:this.status(timeDays)};
 }
 changeCarriage(carriage,timeDays){
  if(!this.boarded)return {ok:false,message:"列車に乗っていません"};
  if(!carriageById(carriage))return {ok:false,message:"車両を選び直してください"};
  this.boarded.carriage=carriage;
  return {ok:true,message:carriageById(carriage).name+"へ移動しました",state:this.status(timeDays)};
 }
 status(timeDays){
  if(!this.boarded)return null;
  const state=trainState(this.boarded.serviceId,timeDays);
  return {...state,carriage:this.boarded.carriage,carriageInfo:carriageById(this.boarded.carriage)};
 }
 alight(timeDays){
  if(!this.boarded)return {ok:false,message:"列車に乗っていません"};
  const state=this.status(timeDays);
  if(state.mode!=="stopped")return {ok:false,message:"走行中は降車できません。次の"+state.nextStation.name+"までお待ちください"};
  const station=state.station,service=state.service;
  this.boarded=null;
  return {ok:true,stationId:station.id,message:station.name+"で降車しました",station,service};
 }
 /**
  * Returns the first scheduled arrival crossed since the previous frame.
  * This remains reliable when the user selects a very fast planet-time speed.
  */
 advance(timeDays){
  if(!this.boarded)return [];
  const now=absoluteMinutes(timeDays),state=this.status(timeDays);
  if(this.boarded.lastMinute===null||now<this.boarded.lastMinute-.5){
   this.boarded.lastMinute=now;
   this.boarded.lastStationId=state.mode==="stopped"?state.stationId:this.boarded.lastStationId;
   this.boarded.nextArrivalMinute=state.nextArrivalMinute;
   return [];
  }
  const target=this.boarded.nextArrivalMinute;
  this.boarded.lastMinute=now;
  if(Number.isFinite(target)&&now+1e-6>=target){
   const arrival=trainState(this.boarded.serviceId,(target+.01)/MINUTES_PER_DAY);
   this.boarded.lastStationId=arrival.stationId;
   this.boarded.nextArrivalMinute=arrival.nextArrivalMinute;
   return [{type:"arrival",minute:target,stationId:arrival.stationId,
    station:arrival.station,service:arrival.service,nextStation:arrival.nextStation}];
  }
  return [];
 }
 snapshot(){
  return {schemaVersion:1,boarded:this.boarded?{
   serviceId:this.boarded.serviceId,carriage:this.boarded.carriage,
   lastStationId:this.boarded.lastStationId}:null};
 }
}
