/**
 * Streaming spherical panorama around the playable ground patch.
 * A 0..47 km radial LOD surface keeps distant peaks and genuine open plains
 * visible without increasing the resolution/cost of collision or picking.
 * All samples use the same authoritative terrainSurface as ground movement.
 */
import {geoOffset,terrainSurface,clamp} from "./geo.mjs?v=0.8v-alpine-horizon";
export const HORIZON_RADII_M=Object.freeze([4,350,650,1100,1900,3200,5400,8500,12500,18000,26000,36500,47000]);
const SECTORS=96;
export function buildDistantLandscape(terrain,lat,lon,{radii=HORIZON_RADII_M,sectors=SECTORS}={}){
 if(!terrain?.planet||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||
   !Array.isArray(radii)||radii.length<2||sectors<12||sectors>256)throw RangeError("Invalid distant landscape");
 const positions=[],normals=[],colors=[],indices=[],R=terrain.planet.radiusM;
 for(const r of radii){
  for(let i=0;i<sectors;i++){
   const theta=i*2*Math.PI/sectors,x=r*Math.sin(theta),z=r*Math.cos(theta);
   const coord=geoOffset(lat,lon,x,z,R),s=terrainSurface(terrain,coord.lat,coord.lon);
   const h=s.water?0:s.lake?s.waterLevelM:s.elevationM;
   // Tangent-plane curvature: distant lowlands fall naturally below the
   // visual horizon, but snowy mountain silhouettes remain visible.
   positions.push(x,h-r*r/(2*R),z);
   normals.push(0,1,0);
   let col=s.water?[.09,.34,.57]:
    s.lake||s.landform==="river"?[.13,.39,.57]:
    h>2550?[.88,.91,.93]:
    h>1900?[.47,.48,.48]:
    s.landform==="canyon"?[.53,.40,.29]:
    s.landform==="mountain-range"||s.landform==="mountain"?[.42,.47,.44]:
    s.landform==="grassland"||s.landform==="plain"?[.52,.61,.34]:
    s.category==="forest"?[.22,.40,.26]:[.35,.51,.29];
   // Atmospheric perspective on far peaks and the long plain horizon.
   const haze=clamp((r-10000)/44000,0,.58);
   const sky=[.60,.70,.79];
   col=col.map((v,k)=>v*(1-haze)+sky[k]*haze);
   colors.push(...col);
  }
 }
 for(let row=0;row<radii.length-1;row++)
  for(let i=0;i<sectors;i++){
   const next=(i+1)%sectors,a=row*sectors+i,b=row*sectors+next;
   const c=(row+1)*sectors+i,d=(row+1)*sectors+next;
   indices.push(a,c,b,b,c,d);
  }
 if(positions.length/3>65535)throw RangeError("Distant terrain index overflow");
 return {positions,normals,colors,indices,outerRadiusM:radii[radii.length-1]};
}
