/** Relative headset-rise detection for cockpit VR.
 * Learns the user's sitting HMD height during the first 0.4 s after the
 * cabin session/seat begins. A physical rise over 38 cm, held for 0.3 s,
 * stands the avatar. Never infers a sit action on crouch. Manual X works
 * if the headset was already standing when the VR session began.
 */
export function sampleShipVRStanding(previous,{seated=false,headY=NaN,dt=0}={}){
 const blank=()=>({baseline:null,calibration:0,held:0});
 if(!seated||!Number.isFinite(headY))return {state:blank(),stand:false};
 const state={...blank(),...(previous||{})};
 const step=Number.isFinite(dt)?Math.max(0,Math.min(.12,dt)):0;
 if(state.baseline===null)state.baseline=headY;
 if(state.calibration<.4){
  // First frames may be an HMD recenter; establish the reference before
  // accepting an actual standing motion.
  state.baseline=(state.baseline*(Math.max(.01,state.calibration)/.4)+headY*(step/.4))/
   (Math.max(.01,state.calibration)/.4+step/.4||1);
  state.calibration=Math.min(.4,state.calibration+step);
  state.held=0;
  return {state,stand:false};
 }
 state.held=headY-state.baseline>=.38?state.held+step:0;
 return {state,stand:state.held>=.30};
}
