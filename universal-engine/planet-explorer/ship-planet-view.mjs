/**
 * Universal Engine v0.9al: camera-relative astronomical views and curved terrain.
 * All positions and angles are derived from the same SI-metre ship frame.
 * Only the final render-space body is scaled for WebGL's finite depth precision.
 */
import {bodyById} from "./solar-system.mjs";
import {bodyCenterM,bodySpinRadians,inertialToShipLocal,surfaceShipFrame} from "./unified-space-frame.mjs?v=3";
import {samplePatch,terrainSurface,geoNormal} from "./geo.mjs?v=0.8y-harbor";

const finite=Number.isFinite;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const norm=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const renderDepthM=26000;
const spinY=(a,v)=>[v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],-v[0]*Math.sin(a)+v[2]*Math.cos(a)];
const fromBasis=(parent,other,position)=>{
 const columns=[other.right,other.up,other.back].map(v=>
  [dot(v,parent.right),dot(v,parent.up),dot(v,parent.back)]);
 return [columns[0][0],columns[0][1],columns[0][2],0,
  columns[1][0],columns[1][1],columns[1][2],0,
  columns[2][0],columns[2][1],columns[2][2],0,
  position[0],position[1],position[2],1];
};
const toArray=local=>[local.x,local.y,local.z];

export function shipLocalFrameMatrix(shipFrame,otherFrame){
 if(!shipFrame||!otherFrame)throw new TypeError("Two frames required");
 const local=inertialToShipLocal(shipFrame,otherFrame.position);
 return fromBasis(shipFrame,otherFrame,toArray(local));
}
/**
 * Planet sphere is deliberately compressed only after projecting its physical
 * centre into ship space; centre/radius is preserved, hence angular size.
 * The real, double precision position is never changed or written to saves.
 */
export function planetRenderPose(shipFrame,bodyId,days,{maxRenderDistanceM=renderDepthM}={}){
 const body=bodyById(bodyId);
 if(!shipFrame||!body?.radiusM||!finite(days)||!finite(maxRenderDistanceM)||maxRenderDistanceM<=0)
  throw new RangeError("Invalid visible planet");
 const real=inertialToShipLocal(shipFrame,bodyCenterM(bodyId,days));
 const dist=Math.hypot(real.x,real.y,real.z);
 if(dist<=0)throw new RangeError("Ship cannot be at body centre");
 const shrink=Math.min(1,maxRenderDistanceM/dist);
 const c=[real.x*shrink,real.y*shrink,real.z*shrink],radiusM=body.radiusM*shrink;
 const spin=bodySpinRadians(bodyId,days);
 const x=spinY(spin,[1,0,0]),y=[0,1,0],z=spinY(spin,[0,0,1]);
 // Incoming sphere vertex is body-fixed, unit radius.
 const columns=[x,y,z].map(axis=>[
  dot(axis,shipFrame.right)*radiusM,
  dot(axis,shipFrame.up)*radiusM,
  dot(axis,shipFrame.back)*radiusM]);
 const matrix=[
  columns[0][0],columns[0][1],columns[0][2],0,
  columns[1][0],columns[1][1],columns[1][2],0,
  columns[2][0],columns[2][1],columns[2][2],0,
  c[0],c[1],c[2],1
 ];
 return {bodyId,position:c,matrix,radiusM,distanceM:dist,
  altitudeM:dist-body.radiusM,angularRadiusRad:Math.asin(clamp(body.radiusM/dist,0,1)),
  renderScale:shrink};
}
export function shipTerrainTier(altitudeM){
 if(!finite(altitudeM))return null;
 if(altitudeM>90000)return null;
 if(altitudeM<110)return {radiusM:650,resolution:52};
 if(altitudeM<750)return {radiusM:1850,resolution:48};
 if(altitudeM<3500)return {radiusM:6500,resolution:48};
 if(altitudeM<20000)return {radiusM:22000,resolution:48};
 return {radiusM:85000,resolution:48};
}
/** Spherical surface at a given landing site, in its own ship-local coordinates.
 * Vertex Y includes curvature (-distance²/(2R)) instead of flat terrain patches.
 */
export function curvedShipTerrainGeometry(terrain,site,radiusM,resolution=48){
 if(!terrain?.planet?.radiusM||!site||![site.lat,site.lon,site.yaw,site.padElevationM].every(finite))
  throw new RangeError("Invalid curved terrain site");
 const p=samplePatch(terrain,site.lat,site.lon,radiusM,resolution);
 const positions=[],normals=[];
 const R=terrain.planet.radiusM,siteYaw=site.yaw,c=Math.cos(siteYaw),s=Math.sin(siteYaw);
 for(let i=0;i<p.vertexCount;i++){
  const j=i*3,east=p.vertices[j],north=p.vertices[j+2],height=p.vertices[j+1];
  const distance=Math.hypot(east,north),theta=distance/R;
  const horizontal=distance>0?(R+height)*Math.sin(theta)/distance:1;
  const e=east*horizontal,n=north*horizontal;
  const up=(R+height)*Math.cos(theta)-(R+site.padElevationM+2);
  positions.push(e*c-n*s,up,e*s+n*c);
  const worldNormal=norm([p.normals[j]+east/R,p.normals[j+1],
    p.normals[j+2]+north/R]);
  normals.push(worldNormal[0]*c-worldNormal[2]*s,worldNormal[1],
   worldNormal[0]*s+worldNormal[2]*c);
 }
 return {positions,normals,colors:p.colors,indices:p.indices,
  radiusM,resolution};
}
export function shipSiteRenderFrame(shipFrame,site,days){
 if(!site?.bodyId||![site.lat,site.lon,site.yaw,site.padElevationM].every(finite))
  throw new RangeError("Invalid site frame");
 const frame=surfaceShipFrame(site.bodyId,days,site.lat,site.lon,site.padElevationM+2,site.yaw);
 return shipLocalFrameMatrix(shipFrame,frame);
}
/** Palette follows the same water/land/altitude regions as geo.samplePatch. */
export function shipPlanetSurfaceColor(s,bodyId){
 if(bodyId==="cinder")return [.57,.34,.24];
 if(bodyId==="nix")return [.66,.80,.89];
 if(bodyId==="selene")return [.52,.53,.57];
 if(s.water)return [.09,.36,.62];
 if(s.landform==="lake")return [.13,.40,.58];
 if(s.landform==="lakeshore")return [.67,.68,.42];
 if(s.elevationM>2400)return [.85,.86,.83];
 if(s.elevationM>1550)return [.47,.46,.41];
 if(s.elevationM<85)return [.75,.70,.48];
 if(s.landform==="river")return [.10,.37,.63];
 if(s.landform==="island")return [.62,.66,.37];
 if(s.landform==="coast")return [.77,.71,.51];
 if(s.landform==="mountain-range"||s.landform==="mountain")return [.44,.46,.40];
 if(s.landform==="canyon")return [.53,.35,.25];
 if(s.landform==="grassland")return [.49,.59,.27];
 if(s.landform==="forest")return [.16,.40,.20];
 if(s.landform==="valley")return [.36,.56,.26];
 return [.33,.50,.27];
}
/** Cached colour LOD from the same terrain seed and surface sampler as ground.
 * Body-fixed sphere normals guarantee that a given continent retains its
 * longitude as the planet spins in view. One mesh per planet/terrain object.
 */
export function shipPlanetSurfaceGeometry(terrain,{latSteps=36,lonSteps=72}={}){
 if(!terrain?.planet||latSteps<6||lonSteps<12||!Number.isSafeInteger(latSteps)||
    !Number.isSafeInteger(lonSteps)||(latSteps+1)*(lonSteps+1)>65535)
  throw new RangeError("Invalid globe tessellation");
 const positions=[],normals=[],colors=[],indices=[];
 for(let j=0;j<=latSteps;j++){
  const lat=-90+180*j/latSteps;
  for(let i=0;i<=lonSteps;i++){
   const lon=-180+360*i/lonSteps;
   const normal=geoNormal(lat,lon);
   positions.push(...normal);normals.push(...normal);
   const s=terrainSurface(terrain,lat,lon);
   colors.push(...shipPlanetSurfaceColor(s,terrain.planet.id));
  }
 }
 for(let j=0;j<latSteps;j++)for(let i=0;i<lonSteps;i++){
  const k=j*(lonSteps+1)+i;
  indices.push(k,k+lonSteps+1,k+1,k+1,k+lonSteps+1,k+lonSteps+2);
 }
 return {positions,normals,colors,indices};
}
