/** Geodesic voyage statistics independent of planar render x/z.
 * Longitude is unwrapped at every nautical update, so the ±180° seam
 * cannot cause a false 360° teleport.
 */
const RAD=Math.PI/180,DEG=180/Math.PI;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const planetCircumference=radius=>2*Math.PI*radius;
export function seaDistance(a,b,radius=6371000){
 if(![a?.lat,a?.lon,b?.lat,b?.lon,radius].every(Number.isFinite)||radius<=0)throw RangeError("Invalid sea coordinates");
 const dLat=(b.lat-a.lat)*RAD,dLon=(b.lon-a.lon)*RAD;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dLon/2)**2;
 return 2*radius*Math.asin(Math.sqrt(clamp(h,0,1)));
}
const deltaLon=(before,after)=>((after-before+540)%360+360)%360-180;
export class VoyageLog{
 constructor(saved=null,initial=null){
  const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
  const start=valid(saved?.start)?{...saved.start}:valid(initial)?{...initial}:{lat:0,lon:0};
  this.start=start;
  this.last=valid(saved?.last)?{...saved.last}:{...start};
  this.distanceM=Number.isFinite(saved?.distanceM)&&saved.distanceM>=0?Math.min(1e13,saved.distanceM):0;
  this.longitudeTurns=Number.isFinite(saved?.longitudeTurns)?clamp(saved.longitudeTurns,-10000,10000):0;
  this.laps=Number.isSafeInteger(saved?.laps)&&saved.laps>=0?Math.min(10000,saved.laps):0;
 }
 advance(lat,lon,radius){
  const next={lat,lon};
  if(![lat,lon].every(Number.isFinite)||Math.abs(lat)>90||Math.abs(lon)>180)return false;
  const distance=seaDistance(this.last,next,radius);
  // Reject scene teleports and stale data; start a new voyage instead.
  if(distance>60000){
   this.start={...next};this.last={...next};this.distanceM=0;this.longitudeTurns=0;this.laps=0;
   return false;
  }
  this.distanceM+=distance;
  this.longitudeTurns+=deltaLon(this.last.lon,lon)/360;
  this.last={...next};
  const circumference=planetCircumference(radius);
  // A real lap needs one full revolution in longitude AND return near origin.
  // Merely sailing a great distance round a small island never counts.
  const nextLap=Math.floor(Math.abs(this.longitudeTurns)+1e-8);
  if(nextLap>this.laps&&this.distanceM>circumference*.8*nextLap&&
     seaDistance(this.start,next,radius)<Math.max(15000,circumference*.012)){
   this.laps=nextLap;return true;
  }
  return false;
 }
 progress(radius){
  const circumference=planetCircumference(radius);
  return {distanceM:this.distanceM,longitudeTurns:this.longitudeTurns,
    laps:this.laps,percent:Math.min(100,Math.abs(this.longitudeTurns)%1*100),
    circumferenceM:circumference,fromStartM:seaDistance(this.start,this.last,radius)};
 }
 snapshot(){return {version:1,start:{...this.start},last:{...this.last},
  distanceM:this.distanceM,longitudeTurns:this.longitudeTurns,laps:this.laps};}
}
