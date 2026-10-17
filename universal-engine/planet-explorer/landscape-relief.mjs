/**
 * Playable pioneer valley: coherent hills, mountain ridges, incised canyon,
 * meandering stream, banks and a true water surface. All coordinates are fixed
 * to one seed-specific geographical anchor, not to the moving camera.
 *
 * This complements the planet-wide terrain generator without moving its seas.
 * A height field cannot form caves/overhangs. River water is static visually;
 * it is not a fluid dynamics solver.
 */
import {geoLocal,geoOffset} from "./geo.mjs";
const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const riverCenterX=z=>145+21*Math.sin(z/155)+9*Math.sin(z/61);
export const riverHalfWidth=z=>14+3*Math.sin(z/225);
export const riverLevel=(anchor,z)=>Math.max(8,anchor.elevationM-12-z*.004);
export function frontierValleyAt(terrain,lat,lon,elevationM){
 const anchor=terrain.landscapeAnchor;
 if(!anchor||!Number.isFinite(anchor.elevationM))return null;
 if(Math.abs(lat-anchor.lat)>.075||Math.abs((((lon-anchor.lon+540)%360)+360)%360-180)>.09)return null;
 const {eastM:x,northM:z}=geoLocal(anchor.lat,anchor.lon,lat,lon,terrain.planet.radiusM);
 if(Math.max(Math.abs(x),Math.abs(z))>4500)return null;
 const reach=1-smooth(1500,3600,Math.hypot(x,z));
 if(reach<=0)return null;
 const hillWest=smooth(90,380,-x)*76;
 const risingMountains=smooth(190,640,z)*(95+140*(.5+.5*Math.sin((x+85)*.0105)));
 const gorgeX=-305+34*Math.sin(z/145);
 const canyonMask=smooth(120,270,-x)*(1-smooth(20,90,Math.abs(x-gorgeX)));
 const canyon=-canyonMask*92;
 const ridge=(hillWest+risingMountains+canyon)*reach;
 const center=riverCenterX(z),width=riverHalfWidth(z);
 const distance=Math.abs(x-center);
 const level=riverLevel(anchor,z);
 // Cut a channel into the height-field and smoothly raise outer banks.
 const bankTarget=level-3.2+7*smooth(width*.62,width*1.47,distance)+
     Math.max(0,distance-width*1.47)*.105;
 const mix=1-smooth(width*1.48,130,distance);
 const relief=elevationM+ridge;
 const ground=relief+(bankTarget-relief)*mix*reach;
 const river=reach>.9&&distance<=width*.98;
 const landform=river?"river":canyonMask>.52?"canyon":
  risingMountains>105?"mountain-range":hillWest>40?"hills":
  distance<width*2.5?"valley":null;
 return {elevationM:ground,river,riverDistanceM:distance,
   riverWidthM:width,waterLevelM:river?level:null,landform};
}
/**
 * Low-poly opaque river water ribbon, matching the same spherical geography
 * used by terrainSurface and the player controller.
 */
export function buildRiverWaterPatch(terrain,patchCenter,radiusM){
 const anchor=terrain.landscapeAnchor;
 const empty=()=>({positions:[],normals:[],colors:[],indices:[]});
 const out=empty();
 if(!anchor||radiusM>2100)return out;
 const center=geoLocal(anchor.lat,anchor.lon,patchCenter.lat,patchCenter.lon,terrain.planet.radiusM);
 if(Math.abs(center.eastM)>radiusM+420||Math.abs(center.northM)>radiusM+1600)return out;
 const r=Math.min(radiusM,1800),step=radiusM<=500?10:radiusM<=1000?16:30;
 const start=Math.floor((center.northM-radiusM*1.1)/step)*step;
 const end=center.northM+radiusM*1.1;
 const R=terrain.planet.radiusM;
 const side=(z,sign)=>{
  const geo=geoOffset(anchor.lat,anchor.lon,riverCenterX(z)+sign*riverHalfWidth(z)*.90,z,R);
  const pos=geoLocal(patchCenter.lat,patchCenter.lon,geo.lat,geo.lon,R);
  return [pos.eastM,riverLevel(anchor,z)+.18,pos.northM];
 };
 for(let z=start;z<end;z+=step){
  const a=side(z,-1),b=side(z,1),c=side(z+step,-1),d=side(z+step,1);
  const minX=Math.min(a[0],b[0],c[0],d[0]),maxX=Math.max(a[0],b[0],c[0],d[0]);
  const minZ=Math.min(a[2],b[2],c[2],d[2]),maxZ=Math.max(a[2],b[2],c[2],d[2]);
  if(maxX< -r||minX>r||maxZ< -r||minZ>r)continue;
  const idx=out.positions.length/3;
  out.positions.push(...a,...b,...c,...d);
  out.normals.push(0,1,0,0,1,0,0,1,0,0,1,0);
  const variant=.025*Math.sin(z*.047);
  out.colors.push(...[.12+variant,.34+variant,.53+variant],...[.17,.41,.60],
    ...[.12+variant,.34+variant,.53+variant],...[.17,.41,.60]);
  out.indices.push(idx,idx+2,idx+1,idx+1,idx+2,idx+3);
 }
 return out;
}
