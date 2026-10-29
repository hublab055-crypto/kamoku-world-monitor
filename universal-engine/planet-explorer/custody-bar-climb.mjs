/**
 * Quest Touch hand-over-hand climbing of a CLOSED cell's iron-bar front.
 * Transient VR-only mechanics; does not alter saved world coordinates or
 * custody release rules. Matrix coordinates use WebXR column-major transforms.
 */
export const BAR_FRONT_Z=-6.15;
export const BAR_FLOOR_Y=3.8;
export const BAR_CLIMB_HEIGHT_M=1.05; // unbraced ascent, preserving prior behavior
export const BAR_BRACED_HEIGHT_M=1.75; // virtual footholds; head stays under roof beams
export const BAR_LEDGE_HEIGHT_M=1.35; // actual raised platform INSIDE the cell
export const BAR_LEDGE_Z=-6.76;
export const BAR_REACH_M=.30;
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const validMatrix=m=>m&&m.length>=16&&[12,13,14].every(i=>Number.isFinite(m[i]));
const validStage=m=>validMatrix(m)&&[0,1,2,4,5,6,8,9,10].every(i=>Number.isFinite(m[i]));
export function custodyGripPoint(pose,stage,player){
 if(!validMatrix(pose)||!validStage(stage)||!player)return null;
 const dx=pose[12]-stage[12],dy=pose[13]-stage[13],dz=pose[14]-stage[14];
 // Inverse of stage's orthonormal rotation, plus the actor translation
 // used by renderRailwayJail; never project grips into outdoor coordinates.
 return {x:player.x+stage[0]*dx+stage[1]*dy+stage[2]*dz,
  y:player.y+stage[4]*dx+stage[5]*dy+stage[6]*dz,
  z:player.z+stage[8]*dx+stage[9]*dy+stage[10]*dz};
}
export function custodyBarGrippable(point,player,door=0){
 if(!point||!player||door>.88||player.y<BAR_FLOOR_Y-.02||
  player.z>=-6.12||player.z< -9.5||Math.abs(player.x)>1.67)return false;
 // The player's barred cell is centred on x=0. The central doorway has
 // its own locked bars unless the guard actually opens the hinged leaf.
 const low=BAR_FLOOR_Y+.26,high=BAR_FLOOR_Y+3.0;
 return Math.abs(point.z-BAR_FRONT_Z)<=BAR_REACH_M&&
  Math.abs(point.x)<=1.85&&point.y>=low&&point.y<=high;
}
export function newCustodyBarClimb(){
 return {hands:{left:null,right:null},fallVelocity:0,movedM:0,active:false,
  footBraced:false,mantle:null,onLedge:false};
}
export function custodyClimbHeld(state){
 return Boolean(state?.hands?.left||state?.hands?.right);
}
export function grabCustodyBar(state,player,hand,pose,stage,door=0){
 if(!state||!player||state.mantle||state.onLedge||!["left","right"].includes(hand))return {ok:false};
 const point=custodyGripPoint(pose,stage,player);
 if(!custodyBarGrippable(point,player,door))return {ok:false};
 state.hands[hand]={lastY:pose[13],trackingAge:0};
 state.fallVelocity=0;state.active=true;
 return {ok:true,hand,grips:Number(Boolean(state.hands.left))+Number(Boolean(state.hands.right))};
}
export function releaseCustodyBar(state,hand){
 if(!state||!["left","right"].includes(hand))return false;
 const held=Boolean(state.hands[hand]);
 state.hands[hand]=null;
 if(!custodyClimbHeld(state))state.footBraced=false;
 return held;
}
export function releaseAllCustodyBars(state){
 if(!state)return;
 state.hands.left=null;state.hands.right=null;state.fallVelocity=0;
 state.footBraced=false;state.mantle=null;state.onLedge=false;
 // Keep active until settleCustodyBarClimb completes the fall.
}
/**
 * The real hand moves DOWN while gripping; the virtual body climbs UP.
 * A missing tracked hand loses its grip (never use a cached/stale pose).
 * Independent hands let the player alternate pulls without double speed.
 */
export function pullCustodyBars(state,player,poses={},stage,dt=1/90){
 if(!state||!player||!custodyClimbHeld(state))return 0;
 const t=clamp(Number.isFinite(dt)?dt:0,0,.15);
 const pulls=[];
 for(const hand of ["left","right"]){
  const hold=state.hands[hand];
  if(!hold)continue;
  const pose=poses[hand];
  if(!validMatrix(pose)){
   hold.trackingAge+=t;
   if(hold.trackingAge>.25)state.hands[hand]=null;
   continue;
  }
  hold.trackingAge=0;
  const contact=custodyGripPoint(pose,stage,player);
  // A detached or sideways hand cannot continue pulling on invisible bars.
  if(!contact||Math.abs(contact.z-BAR_FRONT_Z)>BAR_REACH_M+.13||
    Math.abs(contact.x)>1.98||contact.y<BAR_FLOOR_Y+.1||
    contact.y>BAR_FLOOR_Y+3.15){
   state.hands[hand]=null;
   continue;
  }
  // Ignore headset recentering / tracking jumps. No synthetic climb if
  // a valid but stationary controller is being held.
  const delta=clamp(hold.lastY-pose[13],-.07,.07);
  hold.lastY=pose[13];
  pulls.push(delta);
 }
 if(!pulls.length)return 0;
 const dominant=pulls.reduce((a,b)=>Math.abs(a)>=Math.abs(b)?a:b,0);
 const before=player.y;
 player.y=clamp(player.y+dominant,BAR_FLOOR_Y,
  BAR_FLOOR_Y+(state.footBraced?BAR_BRACED_HEIGHT_M:BAR_CLIMB_HEIGHT_M));
 player.moving=Math.abs(player.y-before)>.00001;
 player.movedM=Math.abs(player.y-before);
 state.movedM=player.movedM;
 return player.y-before;
}
/** Meta Quest controllers do not track feet. Left trigger deliberately places
 * a simulated foot on the barred door's visible low cross-rung while a hand
 * supports weight. The player must still pull down physically to rise.
 */
export function braceCustodyFoot(state,player,door=0){
 if(!state||!player||state.mantle||state.onLedge||door>.88||
    !custodyClimbHeld(state)||Math.abs(player.x)>1.15||
    player.z < -7.20||player.z> -6.12)return {ok:false,reason:"not-near-bar"};
 state.footBraced=!state.footBraced;
 return {ok:true,braced:state.footBraced};
}
/** Mantle onto the raised INSIDE ledge only. The gallery is across locked bars:
 * this is not a shortcut around the barred wall, even at maximum height.
 */
export function beginCustodyLedgeMantle(state,player,door=0){
 if(!state||!player||door>.88)return {ok:false};
 if(state.onLedge)return {ok:true,descending:beginCustodyLedgeDescent(state,player)};
 if(state.mantle)return {ok:false,reason:"animating"};
 if(!state.footBraced||!custodyClimbHeld(state)||
    player.y<BAR_FLOOR_Y+.83||Math.abs(player.x)>1.01||
    player.z< -7.12||player.z>-6.20)
  return {ok:false,reason:"need-grip-foot-and-height"};
 state.mantle={progress:0,fromY:player.y,fromZ:player.z};
 state.hands.left=null;state.hands.right=null;state.footBraced=false;
 state.fallVelocity=0;state.active=true;
 return {ok:true,mantling:true};
}
export function beginCustodyLedgeDescent(state,player){
 if(!state?.onLedge||!player)return false;
 state.onLedge=false;state.mantle=null;state.active=true;
 state.fallVelocity=0;
 // Leave the platform toward the cell interior, never through the bars.
 player.z=Math.min(player.z,-7.21);
 return true;
}
export function stepOffCustodyLedge(state,player,input={}){
 if(!state?.onLedge||!player)return false;
 if((Number(input.forward)||0)>=-.48)return false;
 return beginCustodyLedgeDescent(state,player);
}
export function advanceCustodyLedgeMantle(state,player,dt=1/90){
 if(!state?.mantle||!player)return 0;
 const a=state.mantle,t=clamp(Number.isFinite(dt)?dt:0,0,.1);
 const prevY=player.y,prevZ=player.z;
 a.progress=clamp(a.progress+t/.56,0,1);
 const ease=a.progress*a.progress*(3-2*a.progress);
 player.y=a.fromY+(BAR_FLOOR_Y+BAR_LEDGE_HEIGHT_M-a.fromY)*ease;
 player.z=a.fromZ+(BAR_LEDGE_Z-a.fromZ)*ease;
 player.movedM=Math.hypot(player.y-prevY,player.z-prevZ);
 player.moving=player.movedM>.00001;
 if(a.progress>=1){state.mantle=null;state.onLedge=true;state.active=true;}
 state.movedM=player.movedM;
 return player.movedM;
}
/** Falling only when neither hand grips the bars. Stays entirely in the cell. */
export function settleCustodyBarClimb(state,player,dt=0){
 if(!state||!player)return 0;
 state.movedM=0;
 if(state.mantle)return advanceCustodyLedgeMantle(state,player,dt);
 if(state.onLedge)return 0;
 if(custodyClimbHeld(state))return 0;
 state.footBraced=false;
 if(player.y<=BAR_FLOOR_Y+.0001){
  if(player.y>=BAR_FLOOR_Y-.02)player.y=BAR_FLOOR_Y;
  state.fallVelocity=0;state.active=false;
  return 0;
 }
 const t=clamp(Number.isFinite(dt)?dt:0,0,.08);
 state.fallVelocity=Math.min(6,state.fallVelocity+9.81*t);
 const old=player.y;
 player.y=Math.max(BAR_FLOOR_Y,player.y-state.fallVelocity*t);
 const moved=old-player.y;
 player.moving=moved>0;player.movedM=moved;state.movedM=moved;
 if(player.y===BAR_FLOOR_Y){state.fallVelocity=0;state.active=false;}
 return moved;
}
