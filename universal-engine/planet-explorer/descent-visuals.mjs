/** Presentation values shared by the 3D renderer and the mobile HUD.
 * Pure, altitude-based: never changes simulation time, player coordinates,
 * equipment, camera mode, or movement controls. Heights are metres AGL.
 */
export const ORBIT_GROUND_CUTOFF_M=23000;
const clamp01=v=>Math.max(0,Math.min(1,v));
const approach=(hi,lo,h)=>clamp01((hi-h)/(hi-lo));
const bell=(h,center,width)=>Math.exp(-Math.pow(Math.log(Math.max(2.5,h)/center)/width,2));
export function descentVisuals(altitudeM){
 if(!Number.isFinite(altitudeM)||altitudeM<0)throw new RangeError("Invalid descent altitude");
 const h=Math.max(2.5,altitudeM);
 let stage="宇宙空間";
 if(h<2e5)stage="大気圏に接近";
 if(h<8e4)stage="大気圏上層";
 if(h<2.7e4)stage="雲海を通過";
 if(h<1.2e4)stage="山脈と海岸";
 if(h<1700)stage="森林と地形";
 if(h<=12.01)stage="地表";
 // Keep clouds visible while the existing spherical renderer hands off to
 // local metre-accurate terrain at 23 km. The fog peaks right at that seam.
 const fog=clamp01(.91*bell(h,ORBIT_GROUND_CUTOFF_M,.58));
 const clouds=clamp01(.52*bell(h,9500,.85));
 const atmosphere=clamp01(.38*approach(220000,22000,h)*approach(2.5,550,h));
 const glow=clamp01(.30*bell(h,120000,1.18));
 return {stage,fog,clouds,atmosphere,glow,
  detailedTerrain:h<=450000, ground:h<=ORBIT_GROUND_CUTOFF_M};
}
/** Camera zoom uses log metres, with a bounded cinematic speed near ground. */
export function smoothAltitude(current,target,dt){
 if(![current,target,dt].every(Number.isFinite)||current<=0||target<=0||dt<0)
  throw new RangeError("Invalid altitude animation");
 if(dt===0||current===target)return current;
 const seconds=Math.min(dt,.1);
 const delta=Math.log(target/current);
 const smooth=delta*(1-Math.exp(-2.15*seconds));
 const rate=current>170000?3.4:current>2500?2.15:2.7;
 const step=Math.max(-rate*seconds,Math.min(rate*seconds,smooth));
 const next=current*Math.exp(step);
 return Math.abs(Math.log(target/next))<.003?target:next;
}
