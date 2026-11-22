/** Transient falling animation: the persistent harvest state remains 'fallen'.
 * Only nearby newly felled trees animate; on completion the saved log appears.
 */
export const TREE_FALL_SECONDS=1.45;
export function fallingTreeYaw(id){
 let hash=2166136261;
 for(const char of String(id))hash=Math.imul(hash^char.charCodeAt(0),16777619);
 return ((hash>>>0)/4294967296)*Math.PI*2;
}
export function fallingTreeAngle(elapsed,duration=TREE_FALL_SECONDS){
 if(!Number.isFinite(elapsed))return 0;
 const t=Math.min(1,Math.max(0,elapsed/duration));
 // Brief hesitation then accelerating hinge fall; do not overshoot the ground.
 const progress=t<.12?0:Math.pow((t-.12)/.88,2.2);
 return progress*Math.PI*.495;
}
export function scaledMatrix(scale=1){
 const s=Math.max(.05,Math.min(30,Number(scale)||1));
 return [s,0,0,0, 0,s,0,0, 0,0,s,0, 0,0,0,1];
}
