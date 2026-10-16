/**
 * Articulated low-poly character rig. All poses and joint matrices are pure data.
 * +Y up, +Z forward. Each matrix is column-major WebGL convention.
 */
export const JOINT_NAMES = Object.freeze([
  "pelvis","waist","torso","neck","head",
  "leftShoulder","leftElbow","leftWrist","leftHand",
  "rightShoulder","rightElbow","rightWrist","rightHand",
  "leftHip","leftKnee","leftAnkle","leftFoot",
  "rightHip","rightKnee","rightAnkle","rightFoot"
]);
export const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
export function matrixMultiply(a,b) {
  const r=new Array(16).fill(0);
  for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)
    r[c*4+row]+=a[k*4+row]*b[c*4+k];
  return r;
}
export const translate=(x=0,y=0,z=0)=>[1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1];
export const rotX=a=>[1,0,0,0, 0,Math.cos(a),Math.sin(a),0, 0,-Math.sin(a),Math.cos(a),0, 0,0,0,1];
export const rotY=a=>[Math.cos(a),0,-Math.sin(a),0, 0,1,0,0, Math.sin(a),0,Math.cos(a),0, 0,0,0,1];
export const rotZ=a=>[Math.cos(a),Math.sin(a),0,0, -Math.sin(a),Math.cos(a),0,0, 0,0,1,0, 0,0,0,1];
export const point=(matrix,v=[0,0,0])=>[
  matrix[0]*v[0]+matrix[4]*v[1]+matrix[8]*v[2]+matrix[12],
  matrix[1]*v[0]+matrix[5]*v[1]+matrix[9]*v[2]+matrix[13],
  matrix[2]*v[0]+matrix[6]*v[1]+matrix[10]*v[2]+matrix[14]
];
const chain=(...ms)=>ms.reduce(matrixMultiply,identity());
const mix=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
/** Return normalized bow stages shared by animation and rendering.
 * Raising ends at 22%, nocking at 40%, drawing at 71%; release begins at 76%.
 */
export function bowDrawState(progress){
 const t=clamp(progress,0,1);
 const raised=ease(t/.22),nocked=ease((t-.22)/.18);
 const drawn=ease((t-.40)/.31),released=ease((t-.76)/.06);
 const recovery=ease((t-.84)/.16);
 return {raised,nocked,drawn,released,recovery,visible:t>=.22,
   tension:drawn*(1-released),flight:t<=.78?0:ease((t-.78)/.22)*7.5};
}
/**
 * Animations: idle/walk/jump/sword/axe/mine/build. Walk phase follows distance
 * travelled, so stopping doesn't cause moonwalking. Action progress 0..1.
 */
export function samplePose({phase=0,moving=false,jumpHeight=0,action="idle",progress=0,variant="overhead"}={}) {
  if(!Number.isFinite(phase)||!Number.isFinite(jumpHeight)||!Number.isFinite(progress))
    throw new TypeError("Pose parameters must be finite.");
  const swing=moving?Math.sin(phase)*.54:0;
  const kneeL=moving?Math.max(0,Math.sin(phase+1.2))*.54:0;
  const kneeR=moving?Math.max(0,Math.sin(phase+1.2+Math.PI))*.54:0;
  const pose={
    rootY:moving ? .027*Math.cos(2*phase) : 0,torsoX:0,torsoY:0,headY:0,
    leftHipX:swing,rightHipX:-swing,leftKneeX:kneeL,rightKneeX:kneeR,
    leftAnkleX:-kneeL*.35,rightAnkleX:-kneeR*.35,
    leftShoulderX:-swing*.78,rightShoulderX:swing*.78,
    leftShoulderZ:-.12,rightShoulderZ:.12,
    leftElbowX:-.14,rightElbowX:-.14,leftWristX:0,rightWristX:0,
    tool:null
  };
  if(jumpHeight>.01 || action==="jump"){
    const k=clamp(jumpHeight,0,2);
    pose.rootY=0;
    pose.leftHipX=-.32;pose.rightHipX=-.32;
    pose.leftKneeX=.54;pose.rightKneeX=.54;
    pose.leftShoulderX=-1.15;pose.rightShoulderX=-1.15;
    pose.leftElbowX=-.35;pose.rightElbowX=-.35;
    pose.torsoX=.06;
    return pose;
  }
  if(["sword","axe","mine","bow","build"].includes(action)){
    let t=clamp(progress,0,1);
    const lerp=(a,b,f)=>a+(b-a)*f;
    pose.leftHipX=0;pose.rightHipX=0;pose.leftKneeX=0;pose.rightKneeX=0;
    if(action==="bow"){
      // Stage 1: raise the bow. Stage 2: place the arrow on the string with the
      // off hand. Stage 3: pull the string toward the cheek. Stage 4: release.
      const b=bowDrawState(t);
      pose.rightShoulderX=lerp(-.48,-1.52,b.raised)+.20*b.recovery;
      pose.rightShoulderZ=lerp(.12,-.06,b.raised);
      pose.rightElbowX=lerp(-.18,-.10,b.raised);
      pose.rightWristX=lerp(0,-.13,b.raised);
      pose.leftShoulderX=lerp(-.36,-.83,b.nocked)-.29*b.tension+.50*b.recovery;
      pose.leftShoulderZ=lerp(-.12,-.25,b.nocked);
      pose.leftElbowX=lerp(-.18,-.88,b.nocked)-.75*b.tension+.66*b.released;
      pose.leftWristX=-.22*b.nocked+.15*b.released;
      pose.torsoY=.08*b.nocked*(1-b.released);
      pose.torsoX=-.045*b.tension;
    }else if(action==="build"){
      const beat=Math.abs(Math.sin(t*5*Math.PI));
      pose.rightShoulderX=-.95-.85*beat;
      pose.rightShoulderZ=.2;pose.rightElbowX=-.75;pose.rightWristX=-.22;
      pose.leftShoulderX=-.55;pose.leftElbowX=-.55;pose.torsoX=.09;
    }else{
      let style=variant;
      if(action==="axe"&&style==="thrust")style="overhead";
      if(!["overhead","sweep","thrust","combo"].includes(style))style="overhead";
      if(action==="mine")style="overhead";
      if(style==="combo"){
        const strokes=action==="axe"?["overhead","sweep"]:["overhead","sweep","thrust"];
        const frame=Math.min(strokes.length-1,Math.floor(t*strokes.length));
        style=strokes[frame];t=clamp(t*strokes.length-frame,0,1);
      }
      const windup=ease(t/.24),strike=ease((t-.24)/.39),
        recovery=ease((t-.68)/.32);
      pose.rightElbowX=-.20;
      pose.leftShoulderX=action==="axe"?-.79-.88*windup*(1-strike):-.32;
      pose.leftElbowX=-.51;
      if(style==="sweep"){
        // Horizontal cut driven by torso twist and shoulder abduction.
        const twist=lerp(lerp(-.40,-.56,windup),.49,strike)*(1-recovery);
        pose.torsoY=twist;
        pose.torsoX=.07*strike*(1-recovery);
        pose.rightShoulderX=lerp(-.57,-1.15,windup)*(1-recovery)-.57*recovery;
        pose.rightShoulderZ=lerp(lerp(.26,.60,windup),-.47,strike)*(1-recovery)+.15*recovery;
        pose.rightWristX=-.09*windup+.18*strike;
      }else if(style==="thrust"){
        // Draw the elbow back, then extend the hand and blade toward +Z.
        pose.torsoX=-.15*strike*(1-recovery);
        pose.torsoY=-.10*(1-recovery);
        pose.rightShoulderX=lerp(-.55,-1.10,windup)-.16*strike+.71*recovery;
        pose.rightShoulderZ=.12;
        pose.rightElbowX=lerp(-.22,-1.25,windup)+1.18*strike-.15*recovery;
        pose.rightWristX=.11*strike;
      }else{
        // True overhead windup followed by a quicker high-to-low impact.
        const rest=action==="axe"?-.53:action==="mine"?-.56:-.48;
        const high=action==="axe"?-2.38:action==="mine"?-2.20:-2.15;
        const low=action==="axe"?.46:action==="mine"?.35:.43;
        pose.rightShoulderX=lerp(lerp(lerp(rest,high,windup),low,strike),rest,recovery);
        pose.rightShoulderZ=action==="sword"?.14:.20;
        pose.rightWristX=lerp(lerp(0,-.24,windup),.48,strike)*(1-recovery);
        pose.torsoY=action==="sword"?.16*windup*(1-strike)-.12*strike*(1-recovery):0;
        pose.torsoX=action==="mine"?.14:.08*strike*(1-recovery);
      }
    }
    pose.tool=action==="sword"?"sword":action==="axe"?"axe":action==="mine"?"pickaxe":action==="bow"?"bow":"hammer";
    return pose;
  }
  return pose;
}
/**
 * Joint hierarchy produces one matrix per anatomical pivot.
 * Body part meshes are hung on the named pivot transforms by renderer.
 */
export function jointTransforms(pose={},yaw=0) {
  if(!Number.isFinite(yaw))throw new TypeError("Invalid orientation.");
  const root=chain(translate(0,(pose.rootY||0),0),rotY(yaw));
  const m={};
  m.pelvis=chain(root,translate(0,.96,0));
  m.waist=chain(m.pelvis,rotX(pose.torsoX||0),rotY(pose.torsoY||0));
  m.torso=chain(m.waist,translate(0,.15,0));
  m.neck=chain(m.torso,translate(0,.78,0),rotY(pose.headY||0));
  m.head=chain(m.neck,translate(0,.13,0));
  for(const side of ["left","right"]){
    const sign=side==="left"?-1:1;
    const shoulder=side+"Shoulder",elbow=side+"Elbow",wrist=side+"Wrist",hand=side+"Hand";
    m[shoulder]=chain(m.torso,translate(sign*.43,.65,0),
      rotZ(pose[shoulder+"Z"]||0),rotX(pose[shoulder+"X"]||0));
    m[elbow]=chain(m[shoulder],translate(0,-.45,0),rotX(pose[elbow+"X"]||0));
    m[wrist]=chain(m[elbow],translate(0,-.39,0),rotX(pose[wrist+"X"]||0));
    m[hand]=chain(m[wrist],translate(0,-.11,0));
    const hip=side+"Hip",knee=side+"Knee",ankle=side+"Ankle",foot=side+"Foot";
    m[hip]=chain(m.pelvis,translate(sign*.21,-.03,0),rotX(pose[hip+"X"]||0));
    m[knee]=chain(m[hip],translate(0,-.47,0),rotX(pose[knee+"X"]||0));
    m[ankle]=chain(m[knee],translate(0,-.43,0),rotX(pose[ankle+"X"]||0));
    m[foot]=chain(m[ankle],translate(0,-.06,0));
  }
  return m;
}
export const RIG_SEGMENTS = Object.freeze([
  {name:"pelvis",pivot:"pelvis",w:.33,y:-.06,h:.23,d:.18,color:[.24,.35,.45]},
  {name:"torso",pivot:"torso",w:.40,y:-.02,h:.72,d:.22,color:[.16,.37,.65]},
  {name:"neck",pivot:"neck",w:.13,y:0,h:.15,d:.13,color:[.86,.65,.47]},
  {name:"head",pivot:"head",w:.25,y:0,h:.37,d:.23,color:[.87,.66,.48]},
  ...["left","right"].flatMap(side=>[
    {name:side+"UpperArm",pivot:side+"Shoulder",w:.115,y:-.45,h:.45,d:.12,color:[.24,.45,.66]},
    {name:side+"Forearm",pivot:side+"Elbow",w:.097,y:-.39,h:.39,d:.10,color:[.85,.64,.46]},
    {name:side+"HandPart",pivot:side+"Wrist",w:.095,y:-.13,h:.14,d:.105,color:[.88,.69,.50]},
    {name:side+"Thigh",pivot:side+"Hip",w:.155,y:-.47,h:.47,d:.15,color:[.29,.34,.37]},
    {name:side+"Calf",pivot:side+"Knee",w:.13,y:-.43,h:.43,d:.13,color:[.32,.38,.43]},
    {name:side+"FootPart",pivot:side+"Foot",w:.15,y:-.025,h:.12,d:.26,color:[.22,.25,.29],z:.13}
  ])
]);
