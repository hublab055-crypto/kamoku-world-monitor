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

