/** Deterministic melee narrow phase for two-handed weapons.
 * Distances are metres in the actor's local X/Z plane (+Z faces forward).
 * Each moving shaft/blade is approximated by swept capsules rather than an
 * all-or-nothing attack cone. Rendering still uses the animated joint rig.
 */
export const CONTACT_WEAPONS=Object.freeze(["spear","greatsword"]);
export const CONTACT_STYLES=Object.freeze(["thrust","sweep","overhead"]);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const twoHanded=kind=>CONTACT_WEAPONS.includes(kind);
const specs=Object.freeze({
 spear:Object.freeze({thrust:27,sweep:16,overhead:22}),
 greatsword:Object.freeze({thrust:23,sweep:31,overhead:34})
});
export function contactDamage(kind,style){
 return specs[kind]?.[style]||0;
}
export function attackStrokes(kind,variant="overhead"){
 if(variant!=="combo")return [CONTACT_STYLES.includes(variant)?variant:"overhead"];
 return kind==="spear"?["sweep","thrust"]:
  kind==="greatsword"?["overhead","sweep"]:null;
}
/** Local weapon capsule at a normalized attack time; no collider during
 * preparation/recovery. The inner endpoint is the striking blade, not the arm.
 */
export function weaponCapsule(kind,style,progress){
 if(!twoHanded(kind)||!CONTACT_STYLES.includes(style))return null;
 const t=clamp(progress,0,1);
 const start=style==="thrust"?.25:.29,end=style==="thrust"?.75:.74;
 if(t<start||t>end)return null;
 if(style==="thrust"){
  const stretch=smooth((t-start)/(end-start));
  const long=kind==="spear";
  const near=long?.92:.82;
  const tip=long?1.05+3.55*stretch:1.08+2.32*stretch;
  return {a:{x:0,z:near},b:{x:0,z:tip},width:long?.105:.16};
 }
 if(style==="sweep"){
  const travel=smooth((t-start)/(end-start));
  const aperture=kind==="greatsword"?1.27:1.07;
  const angle=-aperture+2*aperture*travel;
  const sin=Math.sin(angle),cos=Math.cos(angle);
  const inner=kind==="greatsword"?1.05:1.16;
  const outer=kind==="greatsword"?3.58:3.49;
  return {a:{x:inner*sin,z:inner*cos},
   b:{x:outer*sin,z:outer*cos},width:kind==="greatsword"?.20:.12};
 }
 // Vertical overhead cuts move in a narrow corridor instead of sweeping
 // through every target on either side.
 const impact=smooth((t-start)/(end-start));
 const tip=kind==="greatsword"?2.60+.68*impact:2.90+.85*impact;
 return {a:{x:0,z:.88},b:{x:.13*(1-impact),z:tip},
  width:kind==="greatsword"?.23:.15};
}
export function capsuleTouch(circle,segment){
 if(!segment||!circle||!Number.isFinite(circle.x)||!Number.isFinite(circle.z))return null;
 const a=segment.a,b=segment.b,dx=b.x-a.x,dz=b.z-a.z;
 const span=dx*dx+dz*dz;
 const t=span?clamp(((circle.x-a.x)*dx+(circle.z-a.z)*dz)/span,0,1):0;
 const x=a.x+dx*t,z=a.z+dz*t;
 const distance=Math.hypot(circle.x-x,circle.z-z);
 const radius=Math.max(0,Number(circle.radius)||0)+segment.width;
 return distance<=radius?{x,z,distance,penetration:radius-distance}:null;
}
/** Sub-step a moving blade between animation samples. Result order follows
 * target order; each enemy is returned at most once per call. Actor yaw/position
 * are handled here so this same routine can serve player and NPC attacks.
 */
export function sweptWeaponContacts(actor,targets,kind,style,{from=0,to=1}={}){
 if(!twoHanded(kind)||!actor||!CONTACT_STYLES.includes(style)||!Array.isArray(targets))return [];
 if(!Number.isFinite(from)||!Number.isFinite(to))return [];
 const lo=clamp(Math.min(from,to),0,1),hi=clamp(Math.max(from,to),0,1);
 if(hi<.25||lo>.75)return [];
 const count=Math.max(1,Math.min(48,Math.ceil((hi-lo)*48)));
 const yaw=Number.isFinite(actor.yaw)?actor.yaw:0;
 const c=Math.cos(yaw),s=Math.sin(yaw);
 const hits=new Map();
 for(let i=0;i<=count;i++){
  const frame=lo+(hi-lo)*i/count;
  const capsule=weaponCapsule(kind,style,frame);
  if(!capsule)continue;
  for(const enemy of targets){
   if(!enemy||enemy.hp<=0||hits.has(enemy.id))continue;
   // World delta transformed into local space, inverse of yaw rotation.
   const dx=enemy.x-(actor.x||0),dz=enemy.z-(actor.z||0);
   const local={x:dx*c-dz*s,z:dx*s+dz*c,radius:enemy.radius};
   const point=capsuleTouch(local,capsule);
   if(point)hits.set(enemy.id,{
    target:enemy,style,kind,phase:frame,
    x:(actor.x||0)+point.x*c+point.z*s,
    z:(actor.z||0)-point.x*s+point.z*c,
    penetration:point.penetration
   });
  }
 }
 return [...hits.values()];
}
