import {geoOffset,terrainSurface} from "./geo.mjs";

export const FOG_MODES=Object.freeze(["off","light","realistic","auto"]);
export function normalizeFogMode(mode){
 return FOG_MODES.includes(mode)?mode:"auto";
}
const limit=(v,a,b)=>Math.min(b,Math.max(a,v));

/** Atmospheric perspective only. Geometry culling is handled separately by LOD.
 * Distances and elevations are in real metres, not render-scaled globe units.
 */
export function fogForGround({mode="auto",weather={},illumination=1,cameraHeightM=2,underwater=false}={}){
 mode=normalizeFogMode(mode);
 const rain=weather?.precipitation==="rain",snow=weather?.precipitation==="snow";
 const clouds=limit(Number.isFinite(weather?.cloudCover)?weather.cloudCover:.25,0,1);
 const intensity=limit(Number.isFinite(weather?.precipitationIntensity)?weather.precipitationIntensity:.5,0,1);
 const daylight=limit(Number.isFinite(illumination)?illumination:.8,0,1);
 if(mode==="off")return {enabled:false,startM:0,endM:1,opacity:0,color:[.64,.74,.82]};
 let endM=mode==="light"?9000:mode==="realistic"?5500:Math.round(9200-clouds*2400);
 if(rain||snow)endM*=rain?.36:.52;
 if(rain||snow)endM*=1-intensity*.38;
 if(underwater)endM=120;
 // A high-altitude camera normally looks through less near-ground haze.
 if(!underwater)endM*=1+Math.min(2.5,Math.max(0,cameraHeightM)/2400);
 endM=limit(endM,underwater?45:650,48000);
 const startM=underwater?4:Math.max(85,endM*(mode==="light"?.27:.10));
 const sky=daylight<.34?[.17,.24,.36]:[.62,.74,.85];
 const color=underwater?[.045,.20,.27]:sky.map((n,i)=>limit(n*(1-clouds*.18)+(rain||snow?[.025,.035,.042][i]:0),0,1));
 return {enabled:true,startM,endM,opacity:underwater?.92:mode==="light"?.46:(rain||snow)?.88:.78,color};
}

export function sceneryRadiusForQuality(radius,qualityLevel=0){
 if(!Number.isFinite(radius)||radius<=0)throw new RangeError("Invalid scenery radius");
 return qualityLevel>=2?Math.min(radius,270):qualityLevel===1?Math.min(radius,355):radius;
}

/** Hysteresis prevents rebuilding terrain meshes during every brief FPS dip. */
export class AdaptiveTerrainLOD{
 constructor(){this.level=0;this.slowSeconds=0;this.fastSeconds=0;}
 observe(fps,seconds){
  if(!Number.isFinite(fps)||fps<=0||!Number.isFinite(seconds)||seconds<=0)return this.level;
  const span=Math.min(seconds,1.5);
  if(fps<38){this.slowSeconds+=span;this.fastSeconds=0;}
  else if(fps>=54){this.fastSeconds+=span;this.slowSeconds=0;}
  else{this.slowSeconds=0;this.fastSeconds=0;}
  if(this.slowSeconds>=2.5&&this.level<2){this.level++;this.slowSeconds=0;}
  if(this.fastSeconds>=7&&this.level>0){this.level--;this.fastSeconds=0;}
  return this.level;
 }
}

/** A light annular terrain mesh outside the detailed square patch.
 * Its inner boundary meets the exact square edge, so distant landforms remain
 * visible without drawing duplicate terrain underneath the playable patch.
 */
export function buildDistantTerrainRing(terrain,{lat,lon,innerRadiusM,nearHeightAt,
 outerRadiusM=Math.max(18000,innerRadiusM*2.1),segments=72,bands=8}={}){
 if(!terrain?.planet||!Number.isFinite(lat)||!Number.isFinite(lon)||
    !Number.isFinite(innerRadiusM)||innerRadiusM<15||
    !Number.isFinite(outerRadiusM)||outerRadiusM<=innerRadiusM*Math.SQRT2||
    !Number.isInteger(segments)||segments<8||segments>240||
    !Number.isInteger(bands)||bands<2||bands>24)throw new RangeError("Invalid horizon ring");
 const positions=[],normals=[],colors=[],indices=[],planetRadius=terrain.planet.radiusM;
 for(let j=0;j<=bands;j++)for(let i=0;i<=segments;i++){
  const angle=i/segments*Math.PI*2,c=Math.cos(angle),s=Math.sin(angle);
  const edge=innerRadiusM/Math.max(Math.abs(c),Math.abs(s));
  const progress=j/bands,radius=edge*Math.pow(outerRadiusM/edge,progress);
  const x=c*radius,z=s*radius;
  const geo=geoOffset(lat,lon,x,z,planetRadius);
  const surface=terrainSurface(terrain,geo.lat,geo.lon);
  const height=j===0&&typeof nearHeightAt==="function"?
   nearHeightAt(x,z):(surface.water?0:surface.elevationM);
  // The planet curves beneath the tangent plane outside the local patch.
  const drop=j===0?0:radius*radius/(2*planetRadius);
  positions.push(x,height-drop,z);
  normals.push(0,1,0);
  let color=surface.water?[.09,.36,.62]:
   surface.elevationM>2400?[.85,.86,.83]:
   surface.elevationM>1550?[.47,.46,.41]:
   surface.landform==="mountain-range"||surface.landform==="mountain"?[.44,.46,.40]:
   surface.landform==="forest"?[.16,.40,.20]:
   surface.landform==="coast"?[.77,.71,.51]:
   surface.landform==="grassland"?[.49,.59,.27]:[.33,.50,.27];
  colors.push(...color);
 }
 for(let j=0;j<bands;j++)for(let i=0;i<segments;i++){
  const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;
  indices.push(a,c,b,b,c,d);
 }
 return {positions,normals,colors,indices,vertexCount:positions.length/3};
}
