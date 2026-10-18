/** Pure, time-continuous strokes shared by skeletal GLBs and the procedural rig.
 * The player is Y-up and faces +Z; world travel stays in the controller.
 */
export const AQUATIC_ACTIONS=Object.freeze(["swim","tread","dive"]);
export const isAquaticAction=action=>AQUATIC_ACTIONS.includes(action);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export function swimStroke(action,time=0,moving=true){
 if(!isAquaticAction(action))throw new RangeError("Unknown aquatic action");
 if(!Number.isFinite(time))throw new TypeError("Invalid aquatic animation time");
 const t=Math.max(0,time),active=moving&&action!=="tread";
 const phase=t*(active?7.1:3.3),swing=Math.sin(phase),opposite=Math.sin(phase+Math.PI);
 const amplitude=active?1:.48;
 return {
  rootY:active?.022*Math.sin(phase*2):.035*Math.sin(phase),
  torsoX:active?-.08:.055*Math.sin(phase*.5),
  torsoY:active?.045*Math.sin(phase):.045*Math.sin(phase*.42),
  headY:0,
  leftShoulderX:-.96+.57*swing*amplitude,
  rightShoulderX:-.96+.57*opposite*amplitude,
  leftShoulderZ:-.23-.16*Math.cos(phase),
  rightShoulderZ:.23+.16*Math.cos(phase),
  leftElbowX:-.45-.42*Math.max(0,-swing)*amplitude,
  rightElbowX:-.45-.42*Math.max(0,-opposite)*amplitude,
  leftWristX:.08*Math.sin(phase+.7),
  rightWristX:.08*Math.sin(phase+Math.PI+.7),
  leftHipX:.37*swing*amplitude,
  rightHipX:.37*opposite*amplitude,
  leftKneeX:.17+.31*Math.max(0,swing)*amplitude,
  rightKneeX:.17+.31*Math.max(0,opposite)*amplitude,
  leftAnkleX:-.14-.23*Math.max(0,-swing)*amplitude,
  rightAnkleX:-.14-.23*Math.max(0,-opposite)*amplitude
 };
}
/** Root pitch rotates the vertical rig into a front crawl.
 * Retain the head above the wave plane while swimming on the surface.
 */
export function swimmingPresentation(travelMode,moving,waterY=0,depthM=0,time=0){
 if(![waterY,depthM,time].every(Number.isFinite))throw new TypeError("Invalid water presentation");
 const t=Math.max(0,time);
 if(travelMode==="swim"){
  return moving?
   {pitch:1.28,baseY:waterY-.28+.035*Math.sin(t*11),action:"swim"}:
   {pitch:0,baseY:waterY-1.27+.055*Math.sin(t*3.5),action:"tread"};
 }
 if(travelMode==="dive"){
  return {pitch:1.31,baseY:waterY-clamp(depthM,0,12)-.40+.025*Math.sin(t*9),action:"dive"};
 }
 return {pitch:0,baseY:waterY,action:null};
}
