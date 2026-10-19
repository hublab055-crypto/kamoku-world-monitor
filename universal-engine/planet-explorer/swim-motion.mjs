/** Four independent swimming strokes, standing treading, free diving and seabed walking.
 * Pure 60-FPS-compatible semantic joint poses shared by GLBs and articulated avatars.
 */
export const AQUATIC_ACTIONS=Object.freeze(["swim","crawl","breast","back","tread","dive","seabed"]);
export const isAquaticAction=action=>AQUATIC_ACTIONS.includes(action);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const sin=Math.sin,cos=Math.cos;
export function swimStroke(action,time=0,moving=true){
 if(!isAquaticAction(action))throw new RangeError("Unknown aquatic action");
 if(!Number.isFinite(time))throw new TypeError("Invalid aquatic animation time");
 const t=Math.max(0,time),isTread=action==="tread"||!moving,walk=action==="seabed";
 const mode=action==="swim"?"crawl":action;
 const phase=t*(isTread?3.3:mode==="breast"?5.2:mode==="back"?6.4:mode==="seabed"?4.1:7.1);
 const s=sin(phase),c=cos(phase),opp=sin(phase+Math.PI),o=Math.max(0,s),k=Math.max(0,-s);
 let armL,armR,elbowL,elbowR,hipL,hipR,kneeL,kneeR,zL=-.23,zR=.23;
 if(walk){
  armL=-.15-s*.32;armR=-.15+s*.32;elbowL=-.15;elbowR=-.15;
  hipL=s*.38;hipR=-s*.38;kneeL=o*.54;kneeR=k*.54;
 }else if(isTread){
  armL=-.49+s*.22;armR=-.49-s*.22;
  zL=-.52;zR=.52;elbowL=-.58-.11*c;elbowR=-.58+.11*c;
  hipL=-.42+.19*s;hipR=-.42-.19*s;kneeL=.75+.21*c;kneeR=.75-.21*c;
 }else if(mode==="breast"){
  // Symmetric pull-and-reach and frog kick, alternating the pull/push cycle.
  armL=-1.15+.75*c;armR=armL;
  zL=-.25-.28*o;zR=-zL;elbowL=-.32-.46*o;elbowR=elbowL;
  hipL=-.28+.38*s;hipR=hipL;kneeL=.25+.84*k;kneeR=kneeL;
 }else if(mode==="back"){
  // Alternate overhead recovery arms and small flutter kicks on the back.
  armL=-.85+.85*s;armR=-.85-.85*s;
  zL=-.18-.14*c;zR=.18+.14*c;elbowL=-.2-.25*k;elbowR=-.2-.25*o;
  hipL=.43*s;hipR=-.43*s;kneeL=.10+.24*o;kneeR=.10+.24*k;
 }else{
  // Asymmetric front crawl/underwater frog-flutter kick.
  const amp=mode==="dive"?.85:1;
  armL=-.96+.68*s*amp;armR=-.96-.68*s*amp;
  zL=-.23-.16*c;zR=.23+.16*c;
  elbowL=-.45-.42*k;elbowR=-.45-.42*o;
  hipL=.45*s*amp;hipR=-.45*s*amp;
  kneeL=.17+.31*o;kneeR=.17+.31*k;
 }
 return {
  rootY:isTread?.035*sin(phase):.015*sin(phase*2),
  torsoX:walk?.04:isTread?.055*sin(phase*.5):mode==="back"?.04:-.08,
  torsoY:.045*sin(phase*.42),headY:0,
  leftShoulderX:armL,rightShoulderX:armR,
  leftShoulderZ:zL,rightShoulderZ:zR,
  leftElbowX:elbowL,rightElbowX:elbowR,
  leftWristX:.08*sin(phase+.7),rightWristX:.08*sin(phase+Math.PI+.7),
  leftHipX:hipL,rightHipX:hipR,
  leftKneeX:kneeL,rightKneeX:kneeR,
  leftAnkleX:-.12-.22*k,rightAnkleX:-.12-.22*o
 };
}
/** Match body orientation and waterline to selected stroke. Legacy 5-arg calls remain valid. */
export function swimmingPresentation(travelMode,moving,waterY=0,depthM=0,time=0,style="crawl",seabed=false){
 if(![waterY,depthM,time].every(Number.isFinite))throw new TypeError("Invalid water presentation");
 const t=Math.max(0,time),mode=["crawl","breast","back","tread"].includes(style)?style:"crawl";
 if(travelMode==="swim"){
  if(!moving||mode==="tread")return {pitch:0,baseY:waterY-1.27+.055*sin(t*3.5),action:"tread"};
  return {pitch:mode==="back"?-1.22:mode==="breast"?1.15:1.28,
    baseY:waterY-(mode==="back"?.31:.28)+.035*sin(t*11),action:mode};
 }
 if(travelMode==="dive"){
  if(seabed)return {pitch:0,baseY:waterY-clamp(depthM,0,100)-.05,action:"seabed"};
  return {pitch:1.31,baseY:waterY-clamp(depthM,0,100)-.40+.025*sin(t*9),action:"dive"};
 }
 return {pitch:0,baseY:waterY,action:null};
}
