/** Lightweight spacecraft flight controls. Not a rigid-body/6DoF solver.
 * The existing "heading" represents yaw/course error; this module stores
 * additional pitch/roll attitude, landing gear and a bounded joystick mapping.
 */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class ShipFlightControl {
 constructor(data={}){
  this.pitch=Number.isFinite(data?.pitch)?clamp(data.pitch,-35,35):0;
  this.roll=Number.isFinite(data?.roll)?clamp(data.roll,-60,60):0;
  // Default deployed for compatibility with old saves in a landing state.
  this.gearDeployed=data?.gearDeployed!==false;
 }
 input({x=0,y=0,mode="yaw",dt=0}={}){
  const step=clamp(Number.isFinite(dt)?dt:0,0,.08);
  const horizontal=clamp(Number(x)||0,-1,1),vertical=clamp(Number(y)||0,-1,1);
  const h=Math.abs(horizontal)<.12?0:horizontal;
  const v=Math.abs(vertical)<.12?0:vertical;
  this.pitch=clamp(this.pitch-v*step*27,-35,35);
  if(mode==="roll")this.roll=clamp(this.roll+h*step*38,-60,60);
  return {yawDelta:mode==="yaw"?h*step*42:0,pitch:this.pitch,roll:this.roll};
 }
 stabilize(dt){
  const t=clamp(Number.isFinite(dt)?dt:0,0,.12);
  this.pitch*=Math.exp(-1.8*t);
  this.roll*=Math.exp(-1.8*t);
  if(Math.abs(this.pitch)<.005)this.pitch=0;
  if(Math.abs(this.roll)<.005)this.roll=0;
 }
 get landingAligned(){return Math.abs(this.pitch)<=15&&Math.abs(this.roll)<=20;}
 get maneuverEfficiency(){
  return clamp(1-(Math.abs(this.pitch)/35*.18+Math.abs(this.roll)/60*.20),.62,1);
 }
 setGear(deployed,status){
  if(!["docked","landed","preflight","orbit","origin-orbit","parking-orbit","approach","entry","descent","ascent","cruise","launch","touchdown"].includes(status))
   return {ok:false,message:"現在の航行状態では降着脚を操作できません"};
  if(["entry","descent","touchdown"].includes(status)&&deployed===false)
   return {ok:false,message:"降下中にランディングギアを収納することはできません"};
  this.gearDeployed=Boolean(deployed);
  return {ok:true,message:this.gearDeployed?"🛬 ランディングギア展開":"🚀 ランディングギア格納"};
 }
 snapshot(){return {pitch:this.pitch,roll:this.roll,gearDeployed:this.gearDeployed};}
}
