/**
 * Numeric, non-graphic paired-gesture poses. Angles are radians, local XYZ
 * hand targets are metres relative to the actor's body orientation.
 *
 * The authored values drive Hips/Chest/Head quaternion blends and both hand
 * IK effectors; this is NOT an explicit intimate-scene animation format.
 * All motion state is ephemeral and confined to an adult-gated local UI.
 */
const freezeFrame=frame=>Object.freeze({
 t:frame.t,blend:frame.blend,curl:frame.curl,
 bones:Object.freeze(Object.fromEntries(Object.entries(frame.bones).map(([k,v])=>[k,Object.freeze([...v])]))),
 hands:Object.freeze(Object.fromEntries(Object.entries(frame.hands).map(([k,v])=>[k,Object.freeze([...v])])))
});
const pose=(t,blend,bones,hands,curl=.18)=>freezeFrame({t,blend,bones,hands,curl});

export const NUMERIC_PAIR_POSES=Object.freeze({
 "9989":Object.freeze({
  id:"9989",motion:"closeEmbrace",label:"長い抱擁",
  seconds:4.60,distance:1.50,gap:.56,
  frames:Object.freeze([
   pose(0,0,{Hips:[0,0,0],Chest:[0,0,0],Head:[0,0,0]}, {L:[.30,1.19,.31],R:[-.30,1.19,.31]}),
   pose(.75,1,{Hips:[.018,0,0],Chest:[.11,0,.015],Head:[.08,.09,.09]}, {L:[.31,1.20,.53],R:[-.31,1.37,.51]},.28),
   pose(3.45,1,{Hips:[.018,0,0],Chest:[.11,0,.015],Head:[.08,.09,.09]}, {L:[.31,1.20,.53],R:[-.31,1.37,.51]},.28),
   pose(4.60,0,{Hips:[0,0,0],Chest:[0,0,0],Head:[0,0,0]}, {L:[.30,1.19,.31],R:[-.30,1.19,.31]})
  ])
 }),
 "9966":Object.freeze({
  id:"9966",motion:"foreheadRest",label:"額を寄せる",
  seconds:3.80,distance:1.72,gap:.68,
  frames:Object.freeze([
   pose(0,0,{Hips:[0,0,0],Chest:[0,0,0],Head:[0,0,0]}, {L:[.29,1.18,.33],R:[-.29,1.18,.33]}),
   pose(.90,1,{Hips:[.012,0,0],Chest:[.075,0,0],Head:[.16,.025,-.045]}, {L:[.26,1.16,.40],R:[-.26,1.16,.40]},.12),
   pose(2.85,1,{Hips:[.012,0,0],Chest:[.075,0,0],Head:[.16,.025,-.045]}, {L:[.26,1.16,.40],R:[-.26,1.16,.40]},.12),
   pose(3.80,0,{Hips:[0,0,0],Chest:[0,0,0],Head:[0,0,0]}, {L:[.29,1.18,.33],R:[-.29,1.18,.33]})
  ])
 })
});
export const numericPairPose=id=>Object.hasOwn(NUMERIC_PAIR_POSES,id)?NUMERIC_PAIR_POSES[id]:null;
export const numericPairPoseByMotion=motion=>Object.values(NUMERIC_PAIR_POSES).find(p=>p.motion===motion)||null;
const ease=v=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const vec=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
export function sampleNumericPairPose(motion,time){
 const spec=numericPairPoseByMotion(motion);
 if(!spec||!Number.isFinite(time))return null;
 const frames=spec.frames,clamped=Math.max(0,Math.min(spec.seconds,time));
 let i=0;
 while(i<frames.length-2&&clamped>frames[i+1].t)i++;
 const a=frames[i],b=frames[i+1],p=ease((clamped-a.t)/Math.max(.0001,b.t-a.t));
 return {
  id:spec.id,motion:spec.motion,time:clamped,
  blend:lerp(a.blend,b.blend,p),curl:lerp(a.curl,b.curl,p),
  bones:Object.fromEntries(Object.keys(a.bones).map(k=>[k,vec(a.bones[k],b.bones[k],p)])),
  hands:Object.fromEntries(Object.keys(a.hands).map(k=>[k,vec(a.hands[k],b.hands[k],p)]))
 };
}
