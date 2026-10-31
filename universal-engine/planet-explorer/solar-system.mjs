import {Planet} from "../planet/planet-core.mjs";

export const AU_M=149597870700;
export const STAR=Object.freeze({id:"helios",name:"ヘリオス",kind:"star",radiusM:696340000,color:"#ffd888",temperatureC:5500});
export const BODIES=Object.freeze([
 {id:"terra",name:"Terra Nova",kind:"planet",seed:77,radiusM:6371000,gravity:9.81,rotationHours:24,orbitDays:365.25,au:1,phase:0,axialTiltDeg:23.4,oceanLevel:0,temperatureC:16,atmosphere:"窒素・酸素",pressure:1,materials:["木材","石","鉄","水"],color:"#59bddd",landable:true},
 {id:"cinder",name:"シンダー",kind:"planet",seed:408,radiusM:3389000,gravity:3.71,rotationHours:24.6,orbitDays:687,au:1.52,phase:1.2,axialTiltDeg:25,oceanLevel:1.15,temperatureC:-32,atmosphere:"薄い二酸化炭素",pressure:.008,materials:["鉄鉱石","シリカ","硫黄"],color:"#d28b63",landable:true},
 {id:"nix",name:"ニクス",kind:"planet",seed:954,radiusM:2600000,gravity:2.4,rotationHours:41,orbitDays:1440,au:2.5,phase:2.1,axialTiltDeg:12,oceanLevel:1.1,temperatureC:-112,atmosphere:"希薄な窒素",pressure:.02,materials:["氷","ニッケル","希土類"],color:"#b3dcf5",landable:true},
 {id:"selene",name:"セレーネ",kind:"moon",parent:"terra",seed:331,radiusM:1737000,gravity:1.62,rotationHours:655.7,orbitDays:365.25,moonOrbitDays:27.32,moonAU:.00257,au:1,phase:.7,axialTiltDeg:1.5,oceanLevel:1.3,temperatureC:-23,atmosphere:"ほぼ真空",pressure:0,materials:["レゴリス","チタン","氷"],color:"#dfdcce",landable:true},
 {id:"zephyr",name:"ゼファー",kind:"gas-giant",seed:881,radiusM:51000000,gravity:18.2,rotationHours:10.5,orbitDays:4100,au:5.1,phase:2.7,axialTiltDeg:3,oceanLevel:0,temperatureC:-145,atmosphere:"水素・ヘリウム",pressure:null,materials:["水素","ヘリウム"],color:"#d5b18c",landable:false},
 {id:"belt",name:"アステリア小惑星帯",kind:"asteroid-belt",au:3.1,phase:0,radiusM:0,color:"#a4a7ab",landable:false,materials:["鉄","ニッケル","白金","氷"]}
]);
const finite=n=>Number.isFinite(n);
const vec=(x,y,z)=>({x,y,z});
const diff=(a,b)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const length=v=>Math.hypot(v.x,v.y,v.z);
const norm=v=>{const d=length(v)||1;return vec(v.x/d,v.y/d,v.z/d);};
const rad=Math.PI/180;
const deg=180/Math.PI;
export const bodyById=id=>BODIES.find(b=>b.id===id)||null;

export function orbitalPosition(id,days){
 if(!finite(days))throw new RangeError("Invalid stellar clock");
 if(id===STAR.id)return vec(0,0,0);
 const b=bodyById(id);
 if(!b)return null;
 if(b.kind==="asteroid-belt")return vec(b.au,0,0);
 if(b.parent){
  const parent=orbitalPosition(b.parent,days);
  const phase=2*Math.PI*days/b.moonOrbitDays+b.phase;
  return vec(parent.x+b.moonAU*Math.cos(phase),b.moonAU*.04*Math.sin(phase*.41),parent.z+b.moonAU*Math.sin(phase));
 }
 const angle=2*Math.PI*days/b.orbitDays+b.phase;
 return vec(b.au*Math.cos(angle),0,b.au*Math.sin(angle));
}
export function skyFromSurface(bodyId,planet,latitude,longitude,days){
 const center=orbitalPosition(bodyId,days);
 if(!center||!planet)return [];
 const up=norm(planet.surfaceNormal(latitude,longitude));
 const east=norm(diff(planet.surfaceNormal(latitude,longitude+.02),planet.surfaceNormal(latitude,longitude-.02)));
 const north=norm(diff(planet.surfaceNormal(Math.min(89.99,latitude+.02),longitude),
   planet.surfaceNormal(Math.max(-89.99,latitude-.02),longitude)));
 return [STAR,...BODIES.filter(b=>b.id!==bodyId&&b.kind!=="asteroid-belt")].map(b=>{
  const p=orbitalPosition(b.id,days),v=diff(p,center),d=length(v);
  if(d<=1e-10)return null;
  const direction=norm(v);
  const altitudeDeg=Math.asin(Math.max(-1,Math.min(1,dot(direction,up))))*deg;
  const azimuthDeg=(Math.atan2(dot(direction,east),dot(direction,north))*deg+360)%360;
  const diameterDeg=2*Math.atan2(b.radiusM||0,d*AU_M)*deg;
  return {id:b.id,name:b.name,kind:b.kind,color:b.color,altitudeDeg,azimuthDeg,diameterDeg,distanceAU:d,visible:altitudeDeg>0};
 }).filter(Boolean).sort((a,b)=>b.diameterDeg-a.diameterDeg);
}
export function createCelestialPlanet(id,days=.24){
 const b=bodyById(id);
 if(!b?.landable)throw new RangeError("Surface not available");
 return new Planet({id:b.id,name:b.name,seed:b.seed,radiusM:b.radiusM,
  gravity:b.gravity,rotationHours:b.rotationHours,orbitDays:b.orbitDays,
  axialTiltDeg:b.axialTiltDeg,oceanLevel:b.oceanLevel,timeDays:Math.max(0,days)});
}
export function applyCelestialClimate(weather,bodyId){
 const body=bodyById(bodyId);
 if(!body||bodyId==="terra")return weather;
 const sample=weather.sample.bind(weather);
 weather.sample=(lat,lon,elevationM=0,timeDays=weather.planet.timeDays)=>{
  const original=sample(lat,lon,elevationM,timeDays);
  const temp=body.temperatureC-(Math.abs(lat)/90)*18-Math.max(0,elevationM)*.002+
   9*Math.cos(2*Math.PI*(timeDays*24/body.rotationHours+lon/360));
  const air=body.pressure??0;
  return {...original,temperatureC:Math.round(temp*10)/10,
   cloudCover:air<.05?0:original.cloudCover,
   moisture:air<.05?0:original.moisture,
   precipitation:air<.05?"none":original.precipitation,
   precipitationIntensity:air<.05?0:original.precipitationIntensity};
 };
 return weather;
}
// Data is scoped to a body; saved capsules never contain their own stellar-system snapshot.
export class SolarSystem{
 constructor(data=null){
  this.currentId=bodyById(data?.currentId)?.landable?data.currentId:"terra";
  this.days=finite(data?.days)&&data.days>=0?data.days:.24;
  this.surfaces=data?.surfaces&&typeof data.surfaces==="object"?data.surfaces:{};
  this.mined=data?.mined&&typeof data.mined==="object"?data.mined:{};
  this.visited=Array.isArray(data?.visited)?data.visited.filter(id=>bodyById(id)?.landable):["terra"];
 }
 sync(days){if(finite(days)&&days>=0)this.days=days;}
 store(id,game){
  if(!bodyById(id)?.landable||game?.format!=="ue/explorer-demo")throw Error("Invalid body save");
  const copy=JSON.parse(JSON.stringify(game));delete copy.v0_aa;
  this.surfaces[id]=copy;
 }
 load(id){return this.surfaces[id]?JSON.parse(JSON.stringify(this.surfaces[id])):null;}
 travelPlan(targetId){
  const target=bodyById(targetId);
  if(!target||(!target.landable&&target.kind!=="asteroid-belt"))
   return {ok:false,message:"指定した天体へは航行できません"};
  if(targetId===this.currentId)return {ok:false,message:"現在滞在中の天体です"};
  const start=orbitalPosition(this.currentId,this.days);
  let flightDays=1;
  for(let i=0;i<4;i++){
   const end=target.kind==="asteroid-belt"?vec(target.au*Math.cos(this.days*.01),0,target.au*Math.sin(this.days*.01)):orbitalPosition(targetId,this.days+flightDays);
   const delta=length(diff(end,start));
   flightDays=Math.max(.3,delta*12);
  }
  return {ok:true,target,flightDays:Math.round(flightDays*10)/10,
   distanceAU:Math.round(length(diff(orbitalPosition(targetId,this.days+flightDays),start))*1000)/1000};
 }
 arrive(targetId,flightDays){
  if(!bodyById(targetId)?.landable||!finite(flightDays)||flightDays<0)throw Error("Invalid arrival");
  this.days+=flightDays;this.currentId=targetId;
  if(!this.visited.includes(targetId))this.visited.push(targetId);
 }
 mineBelt(){
  const turn=(this.mined.asteria||0)+1;
  this.mined.asteria=turn;
  const iron=2+(turn*13%5),stone=4+(turn*17%7),rare=turn%4===0?1:0;
  this.days+=.6;
  return {iron,stone,rare,days:.6,description:"探査機による小惑星採掘（簡易シミュレーション）"};
 }
 snapshot(){
  return {schemaVersion:1,currentId:this.currentId,days:this.days,
   visited:[...this.visited],mined:{...this.mined},surfaces:this.surfaces};
 }
 static fromSnapshot(data){return new SolarSystem(data?.schemaVersion===1?data:null);}
}
