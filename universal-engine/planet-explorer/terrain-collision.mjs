/** Shared grade limits used by TPV and auto navigation.
 * Segmented checks prevent stepping directly into a steep hill between frames.
 */
export const MAX_WALK_SLOPE_DEG=38;
export function walkableSegment(from,to,heightAt,{maxSlopeDeg=MAX_WALK_SLOPE_DEG,maxStepM=.65,stepLengthM=.40}={}){
 const length=Math.hypot(to.x-from.x,to.z-from.z);
 if(!Number.isFinite(length)||!Number.isFinite(from.y)||length===0)return {ok:false,reason:"invalid"};
 const samples=Math.max(1,Math.ceil(length/stepLengthM));
 let previous={x:from.x,z:from.z,height:from.y};
 const tangent=Math.tan(maxSlopeDeg*Math.PI/180);
 for(let i=1;i<=samples;i++){
  const t=i/samples,point={x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t};
  const sample=heightAt(point.x,point.z);
  if(!sample||sample.water||sample.river||!Number.isFinite(sample.elevationM)||sample.elevationM>2800)
   return {ok:false,reason:"water-or-impassable",at:point};
  const horizontal=Math.hypot(point.x-previous.x,point.z-previous.z);
  const rise=sample.elevationM-previous.height;
  if(Math.abs(rise)>Math.max(maxStepM,horizontal*tangent))
   return {ok:false,reason:"steep-slope",at:point,slopeDeg:Math.atan2(Math.abs(rise),horizontal)*180/Math.PI};
  previous={...point,height:sample.elevationM};
 }
 return {ok:true};
}
export function chooseWorkPoint(actor,node,canStand,{reach=2.5}={}){
 const ax=actor.x,az=actor.z,dx=ax-node.x,dz=az-node.z,range=Math.hypot(dx,dz);
 if(range<=reach)return {x:ax,z:az};
 // Try positions on an accessible ring before giving up on a steep side.
 const direct=Math.atan2(dz,dx);
 for(let i=0;i<16;i++){
  const angle=direct+(i===0?0:(i%2?-1:1)*Math.ceil(i/2)*Math.PI/9);
  const x=node.x+Math.cos(angle)*reach*.84,z=node.z+Math.sin(angle)*reach*.84;
  if(canStand(x,z))return {x,z};
 }
 return null;
}
