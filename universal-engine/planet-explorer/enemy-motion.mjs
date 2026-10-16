/** Deterministic local joint poses for humanoid battle-test actors.
 * +Y up, +Z forward. All angles are radians and previewable without WebGL.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const HUMANOID_MONSTERS=Object.freeze(["goblin","bandit","skeleton","orc","lizardman","demon"]);
export function enemyMotion(enemy){
 const state=enemy?.anim||"idle",t=Math.max(0,Number(enemy?.animTime)||0);
 const phase=Number(enemy?.walkPhase)||0;
 const pose={state,bodyX:0,bodyY:0,bodyZ:0,rootFall:0,rootBob:0,
  headX:0,rightArmX:-.22,leftArmX:-.22,rightArmZ:0,leftArmZ:0,
  rightElbowX:-.16,leftElbowX:-.16,
  leftLegX:0,rightLegX:0,leftKneeX:0,rightKneeX:0,opacity:1};
 if(state==="walk"){
  const s=Math.sin(phase);
  pose.rootBob=Math.abs(Math.sin(phase))*.036;
  pose.bodyY=Math.sin(phase*.5)*.065;
  pose.leftLegX=s*.52;pose.rightLegX=-s*.52;
  pose.leftKneeX=Math.max(0,-s)*.42;
  pose.rightKneeX=Math.max(0,s)*.42;
  pose.leftArmX=-.22-s*.37;pose.rightArmX=-.22+s*.37;
 }else if(state==="attack"){
  const ready=ease(t/.32),impact=ease((t-.32)/.27),
    restore=ease((t-.69)/.34);
  pose.rightArmX=(-.22-2.02*ready+2.5*impact)*(1-restore)-.22*restore;
  pose.rightElbowX=-.35-.26*ready+.45*impact;
  pose.rightArmZ=.27*ready-.39*impact;
  pose.leftArmX=-.58-.29*ready;
  pose.bodyY=(-.38*ready+.64*impact)*(1-restore);
  pose.bodyX=.22*impact*(1-restore);
  pose.headX=-.10*impact;
 }else if(state==="guard"){
  const up=ease(t/.16),down=ease((t-.38)/.14);
  const weight=up*(1-down);
  pose.bodyX=-.16*weight;pose.bodyY=.10*weight;
  pose.leftArmX=-1.48*weight-.22*(1-weight);
  pose.leftElbowX=-1.08*weight-.16*(1-weight);
  pose.rightArmX=-.97*weight-.22*(1-weight);
  pose.rightElbowX=-.60*weight;
  pose.rightLegX=-.15*weight;pose.leftLegX=.16*weight;
 }else if(state==="hit"){
  const jerk=Math.sin(Math.PI*clamp(t/.34,0,1));
  pose.bodyX=-.43*jerk;pose.bodyZ=.17*jerk;
  pose.headX=-.22*jerk;
  pose.rightArmX=.57*jerk;pose.leftArmX=.40*jerk;
  pose.rightArmZ=.36*jerk;pose.leftArmZ=-.39*jerk;
 }else if(state==="death"||enemy?.hp===0){
  const d=ease((Number(enemy?.deathTime)||0)/.86);
  pose.rootFall=1.42*d;
  pose.bodyX=-.18*d;pose.headX=.18*d;
  pose.rightArmX=-.75*d;pose.leftArmX=-.93*d;
  pose.rightArmZ=.27*d;pose.leftArmZ=-.25*d;
  pose.leftLegX=.32*d;pose.rightLegX=-.19*d;
  pose.opacity=1;
 }
 return pose;
}
