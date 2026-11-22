/** Shared daily-life poses for classic RIG_V2 and named Avatar V10 GLB joints.
 * The animation only changes joints; world position, pickups, meals, sleep
 * eligibility and baby-feeding resources are owned by their game systems.
 */
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ease=n=>{const t=clamp(n);return t*t*(3-2*t);};
export const AVATAR_DAILY_ACTIONS=Object.freeze({
 run:{label:"🏃 走る",seconds:0,loop:true},
 crouch:{label:"🧎 しゃがむ",seconds:0,loop:true},
 sleep:{label:"🛌 寝る",seconds:0,loop:true},
 eat:{label:"🍽️ 食べる",seconds:2.4,loop:true},
 pickup:{label:"🤏 片手で拾う",seconds:1.7,loop:false},
 lift:{label:"📦 しゃがんで両手で持ち上げる",seconds:2.5,loop:false},
 holdBaby:{label:"👶 赤ちゃんを抱える（姿勢テスト）",seconds:0,loop:true},
 wave:{label:"👋 手を振る",seconds:2,loop:true},
 stretch:{label:"🙆 両腕のストレッチ",seconds:3,loop:true},
 kneel:{label:"🧎 片膝をつく",seconds:3,loop:true},
 pelvicTilt:{label:"🧘 骨盤をゆっくり傾ける",seconds:4,loop:true},
 supportedSquat:{label:"🤲 支えを使ったしゃがみ姿勢（教材用）",seconds:4,loop:true},
 laborBreathing:{label:"🫁 呼吸法の姿勢練習（産科教材）",seconds:6,loop:true},
 sideRest:{label:"🛏️ 横向き休息の姿勢（教材用）",seconds:5,loop:true},
 rockBaby:{label:"👶 抱っこのゆらし動作",seconds:3,loop:true}
});
export function sampleAvatarDailyPose(action,{time=0,progress=0,hand="right"}={}){
 if(!Object.hasOwn(AVATAR_DAILY_ACTIONS,action))return null;
 if(![time,progress].every(Number.isFinite))throw TypeError("Avatar pose time/progress must be finite");
 const t=clamp(progress),wave=Math.sin(time*5),left=hand==="left";
 const p={rootY:0,torsoX:0,torsoY:0,headY:0,
  leftHipX:0,rightHipX:0,leftKneeX:0,rightKneeX:0,
  leftAnkleX:0,rightAnkleX:0,leftShoulderX:0,rightShoulderX:0,
  leftShoulderZ:-.12,rightShoulderZ:.12,
  leftElbowX:-.14,rightElbowX:-.14,
  leftWristX:0,rightWristX:0};
 if(action==="run"){
  const s=Math.sin(time*9.5),k=Math.max(0,Math.sin(time*9.5+1.2));
  p.rootY=.06*Math.cos(time*19);
  p.torsoX=.10;p.leftHipX=.86*s;p.rightHipX=-.86*s;
  p.leftKneeX=.98*k;p.rightKneeX=.98*Math.max(0,Math.sin(time*9.5+1.2+Math.PI));
  p.leftShoulderX=-.74*s-.28;p.rightShoulderX=.74*s-.28;
  p.leftElbowX=-1.08;p.rightElbowX=-1.08;
 }else if(action==="crouch"){
  p.rootY=-.48;p.torsoX=.24;
  p.leftHipX=-1.08;p.rightHipX=-1.08;p.leftKneeX=1.65;p.rightKneeX=1.65;
  p.leftAnkleX=-.52;p.rightAnkleX=-.52;
  p.leftShoulderX=-.36;p.rightShoulderX=-.36;
  p.leftElbowX=-.42;p.rightElbowX=-.42;
 }else if(action==="sleep"){
  // A low lying/resting posture. The nearby bed/camp system owns placement.
  p.rootY=-.69;p.torsoX=-1.31;p.headY=-.08;
  p.leftHipX=-1.20;p.rightHipX=-1.15;
  p.leftKneeX=1.36;p.rightKneeX=1.32;
  p.leftShoulderX=-.64;p.rightShoulderX=-.51;
  p.leftElbowX=-.35;p.rightElbowX=-.25;
 }else if(action==="eat"){
  // Right arm reaches the mouth in repeating bites, left hand holds food.
  const bite=(wave+1)*.5;
  p.headY=.03;p.torsoX=.07;
  p.rightShoulderX=-.80-.20*bite;p.rightElbowX=-1.20-.22*bite;
  p.leftShoulderX=-.53;p.leftElbowX=-.88;
  p.rightWristX=-.16;
 }else if(action==="pickup"){
  const down=ease(t/.48),rise=ease((t-.57)/.40),bend=down*(1-rise);
  p.rootY=-.24*bend;p.torsoX=.69*bend;p.headY=-.13*bend;
  p.leftHipX=-.48*bend;p.rightHipX=-.48*bend;
  p.leftKneeX=.84*bend;p.rightKneeX=.84*bend;
  p.leftAnkleX=-.30*bend;p.rightAnkleX=-.30*bend;
  const arm=left?"left":"right",other=left?"right":"left";
  p[arm+"ShoulderX"]=.20*bend-.78*rise;
  p[arm+"ElbowX"]=-.18*bend-.86*rise;
  p[arm+"WristX"]=-.18*bend+.24*rise;
  p[other+"ShoulderX"]=-.23*bend;
  p[other+"ElbowX"]=-.32;
 }else if(action==="lift"){
  // Squat first, place both hands below the load, then extend knees and hips.
  const squat=ease(t/.38)*(1-ease((t-.57)/.36));
  const hold=ease((t-.44)/.34);
  p.rootY=-.51*squat;p.torsoX=.34*squat+.06*hold;
  p.leftHipX=-1.16*squat;p.rightHipX=-1.16*squat;
  p.leftKneeX=1.69*squat;p.rightKneeX=1.69*squat;
  p.leftAnkleX=-.54*squat;p.rightAnkleX=-.54*squat;
  p.leftShoulderX=.22*squat-.77*hold;
  p.rightShoulderX=.22*squat-.77*hold;
  p.leftShoulderZ=-.23;p.rightShoulderZ=.23;
  p.leftElbowX=-.35*squat-1.10*hold;
  p.rightElbowX=-.35*squat-1.10*hold;
  p.leftWristX=-.12+.25*hold;p.rightWristX=-.12+.25*hold;
 }else if(action==="wave"){
  p.rightShoulderX=-1.27;p.rightShoulderZ=.30;
  p.rightElbowX=-1.02;p.rightWristX=.28*Math.sin(time*5.5);
  p.headY=.06*Math.sin(time*2);
 }else if(action==="stretch"){
  const v=Math.sin(time*2.15);
  p.leftShoulderX=-1.65-.09*v;p.rightShoulderX=-1.65-.09*v;
  p.leftShoulderZ=-.57;p.rightShoulderZ=.57;
  p.leftElbowX=-.08;p.rightElbowX=-.08;
  p.torsoX=.08*v;
 }else if(action==="kneel"){
  p.rootY=-.34;p.torsoX=.11;
  p.leftHipX=-.79;p.leftKneeX=1.57;
  p.rightHipX=-.34;p.rightKneeX=.72;
  p.leftAnkleX=-.31;p.rightAnkleX=-.22;
  p.leftShoulderX=-.32;p.rightShoulderX=-.32;
 }else if(action==="pelvicTilt"){
  const v=Math.sin(time*1.55);
  p.torsoX=.18*v;p.rootY=-.015+.022*v;
  p.leftHipX=-.17*v;p.rightHipX=-.17*v;
  p.leftKneeX=.13;p.rightKneeX=.13;
  p.leftShoulderX=-.36;p.rightShoulderX=-.36;
 }else if(action==="supportedSquat"){
  const phase=.5-.5*Math.cos(time*1.55);
  p.rootY=-.40*phase;p.torsoX=.22*phase;
  p.leftHipX=-1.02*phase;p.rightHipX=-1.02*phase;
  p.leftKneeX=1.53*phase;p.rightKneeX=1.53*phase;
  p.leftAnkleX=-.41*phase;p.rightAnkleX=-.41*phase;
  p.leftShoulderX=-.84;p.rightShoulderX=-.84;
  p.leftElbowX=-.48;p.rightElbowX=-.48;
 }else if(action==="laborBreathing"){
  // Calm posture rehearsal, not a simulation of actual labor physiology.
  const inhale=.5+.5*Math.sin(time*1.05);
  p.torsoX=.10+.035*inhale;p.rootY=-.03;
  p.leftShoulderX=-.41-.045*inhale;p.rightShoulderX=-.41-.045*inhale;
  p.leftElbowX=-.89;p.rightElbowX=-.89;
  p.leftShoulderZ=-.23;p.rightShoulderZ=.23;
  p.headY=-.08*inhale;
 }else if(action==="sideRest"){
  p.rootY=-.62;p.torsoX=-1.12;p.torsoZ=.42;
  p.leftHipX=-1.16;p.rightHipX=-.96;
  p.leftKneeX=1.33;p.rightKneeX=1.25;
  p.leftShoulderX=-.45;p.rightShoulderX=-.58;
 }else if(action==="rockBaby"){
  p.torsoX=.04*Math.sin(time*2.1);p.torsoY=.06*Math.sin(time*1.6);
  p.leftShoulderX=-.90;p.rightShoulderX=-.90;
  p.leftShoulderZ=-.28;p.rightShoulderZ=.28;
  p.leftElbowX=-1.26;p.rightElbowX=-1.26;
  p.leftWristX=.19;p.rightWristX=.19;
 }else if(action==="holdBaby"){
  // Balanced two-arm cradle; does not instantiate a baby or transfer milk.
  p.torsoX=-.045;p.headY=-.12;
  p.leftShoulderX=-.85;p.rightShoulderX=-.85;
  p.leftShoulderZ=-.27;p.rightShoulderZ=.27;
  p.leftElbowX=-1.20;p.rightElbowX=-1.20;
  p.leftWristX=.21;p.rightWristX=.21;
 }
 return p;
}
/** Torso-local attachment targets in normalized 1.8-m adult avatar metres.
 * These are *placement guides*, not clinical anatomy or milk simulation.
 * They move with the torso/chest and can be used for infant alignment later.
 */
export const NURSING_SITES=Object.freeze({
 left:Object.freeze({joint:"chest",positionM:Object.freeze([-.105,1.20,.20]),normal:Object.freeze([0,0,1])}),
 right:Object.freeze({joint:"chest",positionM:Object.freeze([.105,1.20,.20]),normal:Object.freeze([0,0,1])})
});
export function avatarNursingSite(side="left"){
 if(!Object.hasOwn(NURSING_SITES,side))throw RangeError("Unknown nursing attachment");
 return NURSING_SITES[side];
}
