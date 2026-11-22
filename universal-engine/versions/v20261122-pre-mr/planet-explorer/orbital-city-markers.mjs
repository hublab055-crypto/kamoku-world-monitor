/** Project settled locations onto the visible hemisphere of the globe.
 * The camera and view-projection must be the same as the WebGL globe frame.
 */
import {geoNormal} from "./geo.mjs";

/** No DOM and no renderer imports: unit-testable back-face culling. */
export function projectOrbitalCities(locations,{viewProjection,camera,radius,spinOffsetDeg=0}={}){
 if(!Array.isArray(locations)||!Array.isArray(viewProjection)||viewProjection.length!==16||
  !Array.isArray(camera)||camera.length!==3||![radius,spinOffsetDeg,...camera].every(Number.isFinite)||
  radius<=0)return [];
 return locations.map(place=>{
  if(!Number.isFinite(place.lat)||!Number.isFinite(place.lon))
   return {id:place.id,onScreen:false};
  const n=geoNormal(place.lat,place.lon+spinOffsetDeg);
  const point=n.map(v=>v*(radius+.85));
  // Prevent markers from bleeding through the planet or the back hemisphere.
  const face=camera.reduce((sum,v,i)=>sum+v*point[i],0)>radius*radius;
  if(!face)return {id:place.id,onScreen:false};
  const m=viewProjection;
  const x=m[0]*point[0]+m[4]*point[1]+m[8]*point[2]+m[12];
  const y=m[1]*point[0]+m[5]*point[1]+m[9]*point[2]+m[13];
  const w=m[3]*point[0]+m[7]*point[1]+m[11]*point[2]+m[15];
  if(!Number.isFinite(w)||w<=1e-5)return {id:place.id,onScreen:false};
  const u=.5+.5*x/w,v=.5-.5*y/w;
  return {id:place.id,u,v,onScreen:Number.isFinite(u)&&Number.isFinite(v)&&
   u>=.025&&u<=.975&&v>=.025&&v<=.975};
 });
}
