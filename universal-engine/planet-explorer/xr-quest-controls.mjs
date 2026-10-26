/**
 * Quest Touch / WebXR Gamepad controls. No XR browser globals, testable in Node.
 *
 * Buttons 0=trigger, 1=grip, 3=stick click, 4=A/X, 5=B/Y for standard
 * xr-standard mapping. Trigger & grip ACTIONS use WebXR select/squeeze events
 * to avoid firing twice; only non-select gamepad buttons are polled here.
 */
export const XR_VR_MAPPING=Object.freeze({
 left:"Move: left stick; X: jump; Y: next action deck; left trigger: left hand; left grip: shoot",
 right:"Turn: right stick; A: tabletop RTS; B: first/third-person; right trigger: right hand or RTS select/move; right grip: guard",
 rts:"A: exit RTS; right trigger: choose ally / ground move; left trigger: left-hand action; left grip: bow volley; right stick: rotate table; right stick click: select all"
});
const deadzone=(v,d=.19)=>{
 const n=Number(v);
 return Number.isFinite(n)&&Math.abs(n)>d?Math.max(-1,Math.min(1,(Math.abs(n)-d)/(1-d)*Math.sign(n))):0;
};
export function xrStick(gamepad){
 const a=gamepad?.axes;
 if(!a||!a.length)return {x:0,y:0};
 // WebXR xr-standard uses [2,3] for thumbsticks. Some Quest Browser
 // configurations expose only [0,1], or leave [2,3] as placeholders.
 // Prefer the standard pair whenever it has active input.
 const standard=a.length>=4?{x:deadzone(a[2]),y:deadzone(a[3])}:null;
 const legacy={x:deadzone(a[0]),y:deadzone(a[1])};
 return standard&&(standard.x!==0||standard.y!==0)?standard:
  legacy.x!==0||legacy.y!==0?legacy:standard||legacy;
}
export function xrButtonPressed(gamepad,index){
 return Boolean(gamepad?.buttons?.[index]?.pressed);
}
/** Keep button edges per handedness, independent of frame rate. */
export function xrButtonEdges(sources,previous=new Set()){
 const next=new Set(),pressed=[];
 for(const source of sources||[]){
  if(!["left","right"].includes(source?.handedness))continue;
  // An XRInputSource is already scoped to the active immersive session.
  // Some Quest Browser versions expose a generic "standard" mapping here.
  if(source.gamepad?.mapping&&!["xr-standard","standard"].includes(source.gamepad.mapping))continue;
  for(const buttonIndex of [3,4,5]){
   const key=source.handedness+":"+buttonIndex;
   if(xrButtonPressed(source.gamepad,buttonIndex)){
    next.add(key);if(!previous.has(key))pressed.push(key);
   }
  }
 }
 return {next,pressed};
}
export function xrVRMovement(sources,{rts=false}={}){
 const result={forward:0,strafe:0,turn:0,tableTurn:0};
 for(const source of sources||[]){
  // An XRInputSource is already scoped to the active immersive session.
  // Some Quest Browser versions expose a generic "standard" mapping here.
  if(source.gamepad?.mapping&&!["xr-standard","standard"].includes(source.gamepad.mapping))continue;
  const {x,y}=xrStick(source.gamepad);
  if(source.handedness==="left"&&!rts){
      result.forward=-y;
      // xrStage faces the actor along world +Z. Its yaw includes a 180deg
      // turn for headset -Z, so world +X appears to the viewer's LEFT.
      // Invert strafe here (not in world/indoor physics): Touch right must
      // move toward the viewer's right in both custody and open-world VR.
      result.strafe=-x;
    }
  if(source.handedness==="right"){
   if(rts)result.tableTurn=x;
   else result.turn=x;
  }
 }
 return result;
}

/**
 * Quest input sources may briefly move between inputSources and trackedSources.
 * Use the *same* hand selection for stick motion and button edge detection.
 * This does not synthesize movement when a controller is actually missing.
 */
export function xrControllerSources(session){
 const chosen=new Map();
 for(const group of [session?.trackedSources||[],session?.inputSources||[]]){
  for(const source of group){
   if(!["left","right"].includes(source?.handedness))continue;
   const previous=chosen.get(source.handedness);
   // Favor a usable gamepad over a tracked-only controller. When equal,
   // prefer the standard session input source over an optional fallback.
   if(!previous||Boolean(source.gamepad)||!previous.gamepad)
    chosen.set(source.handedness,source);
  }
 }
 return [...chosen.values()];
}

/**
 * The displayed VR stage and the movement controller MUST use the same yaw.
 * Prison movement advances its own local actor, not the outdoor controller.
 * Keep the existing vehicle/interior yaw choices as fallbacks.
 */
export function xrVRActorYaw(renderer,controller){
  return renderer?.custodyFacility?.player?.yaw ??
    renderer?.custodyCell?.yaw ??
    renderer?.trainInterior?.pose?.yaw ??
    renderer?.townInterior?.pose?.yaw ??
    (renderer?.ferry?.boarded?renderer.ferry.pose?.yaw:undefined) ??
    controller?.yaw ?? 0;
}
