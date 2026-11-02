/**
 * Deterministic daily routines for existing town residents.
 * Pure JS: time and stable settlement-layout IDs determine positions.
 * Models are handled by a separate art/animation workstream (issue #76).
 */
import {sharedRoom} from "./town-shared-world.mjs?v=0.9at";
const JOBS=Object.freeze([
 {type:"workshop",name:"職人",activity:"work"},
 {type:"market",name:"商人",activity:"trade"},
 {type:"lodge",name:"給仕",activity:"serve"},
 {type:"granary",name:"倉庫係",activity:"stock"},
 {type:"stable",name:"馬の世話係",activity:"care"},
 {type:"barn",name:"農作業員",activity:"work"}
]);
export const RESIDENT_ACTION_NAMES=Object.freeze({
 sleep:"睡眠",breakfast:"朝食",commute:"通勤",work:"作業",trade:"販売",
 serve:"給仕",stock:"荷役",care:"家畜の世話",lunch:"昼食",dinner:"夕食",
 leisure:"団らん",rest:"休憩"
});
const cleanDay=days=>Number.isFinite(days)?days:0;
const frac=n=>n-Math.floor(n);
const idOf=(layout,site)=>site?("village-"+layout.buildings.indexOf(site)):null;
const closest=(sites,x,z)=>sites.reduce((best,site)=>{
 const value=(site.x-x)**2+(site.z-z)**2;
 return !best||value<best.value?{site,value}:best;
},null)?.site||null;
export function residentLifePlan(layout,resident){
 if(!layout?.buildings||!resident?.id)return null;
 const num=Number(/^resident-(\d+)$/.exec(resident.id)?.[1]);
 if(!Number.isInteger(num)||num<0)return null;
 const homeChoices=layout.buildings.filter(b=>b.type==="cabin");
 const job=JOBS[num%JOBS.length];
 const home=closest(homeChoices,resident.x,resident.z);
 const work=closest(layout.buildings.filter(b=>b.type===job.type),
  home?.x??resident.x,home?.z??resident.z);
 if(!home)return null;
 return {id:resident.id,home,homeId:idOf(layout,home),
  work:work||home,workId:idOf(layout,work||home),
  job:job.name,workActivity:work?job.activity:"work",number:num,
  clothing:resident.clothing};
}
function inner(site,kind){
 const room=sharedRoom(site?.type);
 return {x:site.x,z:site.z+(room?.halfZ?Math.min(.4,room.halfZ-2):0),
  buildingId:kind,inside:Boolean(room)};
}
function door(site){
 const room=sharedRoom(site?.type);
 return {x:site.x,z:site.z+(room?.halfZ||3.6)+1.3,inside:false,buildingId:null};
}
function pathBetween(home,work){
 const from=door(home),to=door(work),middleX=home.x<0?-14:14;
 return [inner(home,null),from,
  {x:middleX,z:from.z,inside:false},
  {x:middleX,z:to.z,inside:false},
  to,inner(work,null)];
}
function pointPath(path,portion){
 if(portion<=1e-9)return {...path[0],moving:false};
 if(portion>=1-1e-9)return {...path[path.length-1],moving:false};
 // Constant duration per waypoint for deterministic, low-cost animation.
 const k=portion*(path.length-1),index=Math.min(path.length-2,Math.floor(k)),a=path[index],b=path[index+1],t=k-index;
 return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,
  yaw:Math.atan2(b.x-a.x,b.z-a.z),inside:false,buildingId:null,moving:true};
}
function stationary(plan,where,activity){
 const site=where==="home"?plan.home:plan.work,
  id=where==="home"?plan.homeId:plan.workId,at=inner(site,id);
 return {...at,yaw:where==="home"?Math.PI:0,moving:false,activity,job:plan.job};
}
/** Planet days may advance by large steps; samples are independent of frame dt. */
export function residentLifePose(plan,day){
 if(!plan)return null;
 const raw=frac(cleanDay(day))*24;
 const hour=Math.abs(raw-Math.round(raw))<1e-9?Math.round(raw):raw;
 const sleep=()=>stationary(plan,"home","sleep");
 if(hour<6.25||hour>=22)return sleep();
 if(hour<7)return stationary(plan,"home","breakfast");
 if(hour<8){
  const p=pointPath(pathBetween(plan.home,plan.work),Math.min(1,(hour-7)));
  return {...p,activity:"commute",job:plan.job};
 }
 if(hour<12)return stationary(plan,"work",plan.workActivity);
 if(hour<13)return stationary(plan,"work","lunch");
 if(hour<17)return stationary(plan,"work",plan.workActivity);
 if(hour<18){
  const p=pointPath(pathBetween(plan.work,plan.home),hour-17);
  return {...p,activity:"commute",job:plan.job};
 }
 if(hour<20)return stationary(plan,"home","dinner");
 return stationary(plan,"home","leisure");
}
export function townResidentPositions(layout,days){
 return (layout?.residents||[]).map(resident=>{
  const plan=residentLifePlan(layout,resident);
  return {id:resident.id,...residentLifePose(plan,days)};
 });
}
