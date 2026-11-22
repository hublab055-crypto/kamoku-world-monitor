/** Presentation-only capture sequence: standing -> fall -> three circling stars.
 * The state is never stored in save slots; the underlying law/custody data is authoritative.
 */
export const CAPTURE_FALL_SECONDS=0.72;
export const CAPTURE_DURATION_SECONDS=3.35;
export const CAPTURE_STAR_COUNT=3;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
/** Avatar rigs are Y-up, with feet at y=0. Rotation tips the body to the ground. */
export function capturePose(elapsed){
 const t=clamp(Number(elapsed)||0,0,CAPTURE_DURATION_SECONDS);
 const fall=clamp(t/CAPTURE_FALL_SECONDS,0,1);
 const eased=fall*fall*(3-2*fall);
 const angle=eased*Math.PI*.49;
 return {angle,fallen:fall>=1,stars:t>.3&&t<CAPTURE_DURATION_SECONDS,
  finished:t>=CAPTURE_DURATION_SECONDS,
  headHeight:Math.max(.1,1.9*Math.cos(angle)),
  headZ:1.9*Math.sin(angle)};
}
/** 3 distinct positions, circling the actual head; not a fixed HUD sticker. */
export function captureStars(elapsed,{yaw=0}={}){
 const pose=capturePose(elapsed);
 if(!pose.stars)return [];
 const age=Number(elapsed)||0,rx=Math.sin(yaw),rz=Math.cos(yaw);
 const baseX=rx*pose.headZ,baseZ=rz*pose.headZ;
 return Array.from({length:CAPTURE_STAR_COUNT},(_,i)=>{
  const a=age*7.0+i*Math.PI*2/CAPTURE_STAR_COUNT;
  return {x:baseX+.43*Math.cos(a),y:pose.headHeight+.38+.10*Math.sin(a*1.8),
   z:baseZ+.43*Math.sin(a),scale:.22+.035*Math.sin(age*9+i)};
 });
}
/** Triangles with vertical two-sided golden surfaces, small enough to reuse per frame. */
export function captureStarGeometry(){
 const g={positions:[],normals:[],colors:[],indices:[]},gold=[1,.84,.16],dark=[.93,.49,.08];
 const points=Array.from({length:10},(_,i)=>{
  const a=Math.PI/2+i*Math.PI/5,r=i%2?.45:1;
  return [Math.cos(a)*r,Math.sin(a)*r,0];
 });
 for(let i=0;i<10;i++){
  const k=g.positions.length/3,c=[0,0,0],u=points[i],v=points[(i+1)%10];
  g.positions.push(...c,...u,...v,...c,...v,...u);
  g.normals.push(0,0,1,0,0,1,0,0,1,0,0,-1,0,0,-1,0,0,-1);
  const shade=i%2?gold:dark;for(let j=0;j<6;j++)g.colors.push(...shade);
  g.indices.push(k,k+1,k+2,k+3,k+4,k+5);
 }
 return g;
}
