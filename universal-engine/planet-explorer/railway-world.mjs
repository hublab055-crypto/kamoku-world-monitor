/** Planet-scale rail route sampling. Service time is authoritative; visuals use great-circle
 * railway paths, sampled as terrain-respecting rails and approaches. No station teleport.
 */
import {geoNormal,geoLocal,geoOffset,terrainSurface,wrapLon} from "./geo.mjs";
import {stationById,trainState} from "./railway.mjs";
const RAD=180/Math.PI,DEG=Math.PI/180;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const unit=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const siteGeo=(terrain,dest,station)=>{
 const p=stationById(station);
 if(!dest||!p)return null;
 return geoOffset(dest.lat,dest.lon,p.site.x,p.site.z,terrain.planet.radiusM);
};
/** Physical endpoint is the platform tracks, not the town centre. */
export function railwayStationCoordinates(terrain,locations,id){
 const d=locations.find(p=>p.id===id);
 return siteGeo(terrain,d,id);
}
function greatCircle(a,b,t){
 const p=geoNormal(a.lat,a.lon),q=geoNormal(b.lat,b.lon);
 const cos=clamp(dot(p,q),-1,1),ang=Math.acos(cos);
 const blend=ang<1e-8?p.map((v,i)=>v+(q[i]-v)*t):
  p.map((v,i)=>(v*Math.sin((1-t)*ang)+q[i]*Math.sin(t*ang))/Math.sin(ang));
 const n=unit(blend);
 return {lat:Math.asin(n[1])*RAD,lon:wrapLon(Math.atan2(n[2],n[0])*RAD)};
}
/** Use eased approach to produce real station arrivals and smooth acceleration. */
export function railwayRoutePosition(terrain,locations,fromId,toId,progress){
 const a=railwayStationCoordinates(terrain,locations,fromId),b=railwayStationCoordinates(terrain,locations,toId);
 if(!a||!b)return null;
 const t=clamp(progress,0,1),ease=.5-.5*Math.cos(Math.PI*t);
 const point=greatCircle(a,b,ease);
 const p0=greatCircle(a,b,clamp(ease-.000015,0,1)),p1=greatCircle(a,b,clamp(ease+.000015,0,1));
 const local=geoLocal(p0.lat,p0.lon,p1.lat,p1.lon,terrain.planet.radiusM);
 const yaw=Math.atan2(local.eastM,local.northM);
 const surface=terrainSurface(terrain,point.lat,point.lon);
 // Temporary viaduct over waterways, keeping the train above local ground.
 const elevationM=Math.max(surface.elevationM,0)+.45;
 return {...point,yaw,elevationM,bridge:Boolean(surface.water||surface.river),progress:t};
}
export function railwayJourneyPose(terrain,locations,service,timeDays){
 const state=typeof service==="object"&&service.mode?service:trainState(service,timeDays);
 const fromId=state.mode==="stopped"?state.stationId:state.fromStationId;
 const toId=state.nextStationId,progress=state.mode==="stopped"?0:state.progress;
 const value=railwayRoutePosition(terrain,locations,fromId,toId,progress);
 if(!value)return null;
 const next=railwayRoutePosition(terrain,locations,fromId,toId,clamp(progress+.00002,0,1));
 const R=terrain.planet.radiusM;
 const a=railwayStationCoordinates(terrain,locations,fromId);
 const b=railwayStationCoordinates(terrain,locations,toId);
 const dotAngle=clamp(dot(geoNormal(a.lat,a.lon),geoNormal(b.lat,b.lon)),-1,1);
 const totalM=Math.acos(dotAngle)*R;
 const duration=state.segment?.travelMinutes||95;
 const metresPerMinute=state.mode==="travel"?totalM*Math.PI*.5*Math.sin(Math.PI*progress)/duration:0;
 const speedMps=metresPerMinute/60;
 return {...value,state,fromId,toId,totalM,speedMps,lookAhead:next};
}
/** Local track cross sections from the actual spherical path, sampled near the train. */
export function railwayTrackSamples(terrain,locations,pose,{spanM=900,steps=44}={}){
 if(!pose)return [];
 const R=terrain.planet.radiusM;
 const angular=pose.totalM>0?spanM/pose.totalM:.005;
 const rows=[];
 for(let i=0;i<=steps;i++){
  const t=clamp(pose.progress+(i/steps-.5)*angular,0,1);
  const geo=railwayRoutePosition(terrain,locations,pose.fromId,pose.toId,t);
  const local=geoLocal(pose.lat,pose.lon,geo.lat,geo.lon,R);
  // 3D relief and track both use actual terrain elevation, but rail may cross
  // water on short low-poly trestles.
  const surface=terrainSurface(terrain,geo.lat,geo.lon);
  const y=Math.max(surface.elevationM,0)+.28;
  if(!rows.length||Math.hypot(local.eastM-rows.at(-1).x,local.northM-rows.at(-1).z)>.025)
   rows.push({x:local.eastM,z:local.northM,y,bridge:Boolean(surface.water||surface.river)});
 }
 return rows;
}
export function railwayStationTrack(station,{span=340,steps=30}={}){
 if(!station)return [];
 return Array.from({length:steps+1},(_,i)=>({
  x:station.site.x,z:station.site.z-span/2+i*span/steps,y:0,bridge:false
 }));
}
