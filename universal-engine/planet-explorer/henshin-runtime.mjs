/** Native Universal Engine state, room-space input and shared workshop projects. */
import {PROFILES,JOINTS,newProject,validateProject,TransformState,sampleMotion} from './henshin-studio/core.mjs';
import {xrMul,xrTranslate,xrRotateY,xrScale,xrHeading,xrForward} from './xr-spatial.mjs';
export {PROFILES,validateProject};
export const HENSHIN_PROJECT_KEY='universal-engine:henshin:project:v1';
export const HENSHIN_KEYS=[['STEP','advance',-.18,.17],['HIT','attack',0,.17],['RESET','reset',.18,.17],['NEXT','next',-.18,0],['POSE','edit',0,0],['REC','record',.18,0],['PLAY','play',-.18,-.17],['WAIST','calibrate',0,-.17],['EXIT','exit',.18,-.17]];
const matrix=m=>m?.length===16&&Array.from(m).every(Number.isFinite);
const at=m=>[m[12],m[13],m[14]],dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
export function localPoint(m,p){const d=p.map((v,i)=>v-m[12+i]);return [0,4,8].map(col=>{const n=m[col]**2+m[col+1]**2+m[col+2]**2;return (d[0]*m[col]+d[1]*m[col+1]+d[2]*m[col+2])/(n||1);});}
export function worldPoint(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]);}
export function henshinPanelHit(ray,model){if(!matrix(ray)||!matrix(model))return null;const from=localPoint(model,at(ray)),p=localPoint(model,worldPoint(ray,[0,0,-1])),d=p.map((v,i)=>v-from[i]);if(d[2]>=-1e-5)return null;const t=-from[2]/d[2];if(t<.01||t>3)return null;const x=from[0]+d[0]*t,y=from[1]+d[1]*t;if(Math.abs(x)>.29||Math.abs(y)>.27)return null;return HENSHIN_KEYS.find(k=>Math.abs(k[2]-x)<.08&&Math.abs(k[3]-y)<.067)?.[1]||null;}
export class HenshinRuntime{
 constructor({notify=()=>{},onAction=()=>{},onChange=()=>{}}={}){this.project=newProject();this.state=new TransformState();this.enabled=false;this.revision=0;this.notify=notify;this.onAction=onAction;this.onChange=onChange;this.fxAt=-Infinity;this.fxKind='transform';this.effectPower=.5;this.motionStart=null;this.recording=false;this.editing=false;this.playStart=null;this.resetXR();}
 get transformed(){return this.state.transformed;}
 get now(){return (globalThis.performance?.now?.()??Date.now())/1000;}
 changed(){this.onChange(this);}
 setEnabled(value){this.enabled=!!value;if(!this.enabled){this.state.reset();this.resetXR();this.playStart=null;this.recording=false;this.fxAt=-Infinity;}this.changed();}
 loadProject(p){const next=validateProject(p);this.project=next;this.revision++;this.state.reset();this.fxAt=-Infinity;this.playStart=null;this.recording=false;this.resetXR();this.changed();}
 advance(){if(!this.enabled)return false;const action=this.state.advance();if(action==='transform'||action==='attack'){this.fxAt=this.now;this.fxKind=action;}this.onAction({profile:this.project.profile,action,transformed:this.transformed});this.notify(this.transformed?'変身完了！':PROFILES[this.project.profile].steps[this.state.step]);this.changed();return true;}
 attack(){if(!this.enabled||!this.transformed)return false;this.fxAt=this.now;this.fxKind='attack';this.onAction({profile:this.project.profile,action:'attack',transformed:true});this.changed();return true;}
 reset(){this.state.reset();this.fxAt=-Infinity;this.inserted=false;this.held=null;this.changed();}
 next(){const ids=Object.keys(PROFILES),id=ids[(ids.indexOf(this.project.profile)+1)%ids.length];this.loadProject(newProject(id));}
 resetXR(){this.head=null;this.hands={left:null,right:null};this.root=null;this.panel=null;this.preview=null;this.height=null;this.floor=null;this.held=null;this.itemModel=null;this.beltModel=null;this.inserted=false;this.grabbed=new Map();if(this.recording){this.recording=false;this.changed();}}
 setRecording(value){if(value&&!this.head)return false;this.recording=!!value;if(this.recording){this.project.motion=[];this.motionStart=this.now;this.lastSample=-Infinity;this.playStart=null;}this.changed();return true;}
 play(){if(!this.project.motion.length)return false;this.playStart=this.now;this.recording=false;this.changed();return true;}
 poseAt(now=this.now,{moving=false,phase=0}={}){if(this.playStart!==null){const t=now-this.playStart,pose=sampleMotion(this.project.motion,t);if(t>this.project.motion.at(-1).t)this.playStart=null;if(pose)return pose;}const pose=structuredClone(this.project.pose);if(moving&&!this.editing){for(const side of ['left','right']){const sign=side==='left'?1:-1;pose[side+'Foot'][2]+=.17*Math.sin(phase)*sign;pose[side+'Knee'][2]+=.12*Math.sin(phase)*sign;pose[side+'Hand'][2]-=.14*Math.sin(phase)*sign;}}return pose;}
 updateXR({head,left=null,right=null,time=this.now,floorY=0}={}){
  if(!this.enabled)return;this.head=matrix(head)?Array.from(head):null;this.hands={left:matrix(left)?Array.from(left):null,right:matrix(right)?Array.from(right):null};
  if(!this.head){this.held=null;this.itemModel=null;this.grabbed.clear();return;}
  const h=this.head;if(this.floor===null)this.floor=Number.isFinite(floorY)?floorY:h[13]-1.64;if(this.height===null)this.height=Math.max(.8,Math.min(2.1,h[13]-this.floor));
  const yaw=xrHeading(h)+Math.PI,scale=this.height/1.64;this.root=xrMul(xrTranslate(h[12],this.floor,h[14]),xrMul(xrRotateY(yaw),xrScale(scale)));
  if(!this.panel){const f=xrForward(h),n=Math.hypot(f[0],f[2])||1,right=[h[0],0,h[2]];this.preview=xrMul(xrTranslate(h[12]+f[0]/n*1.5,this.floor,h[14]+f[2]/n*1.5),xrMul(xrRotateY(yaw+Math.PI),xrScale(scale)));this.panel=xrMul(xrTranslate(h[12]+f[0]/n*.95-right[0]*.58,h[13]-.12,h[14]+f[2]/n*.95-right[2]*.58),xrRotateY(yaw+Math.PI));}
  this.beltModel=xrMul(this.root,xrTranslate(0,this.project.waist*1.64,.12));
  for(const [hand,joint]of this.grabbed){const m=this.hands[hand];if(!m){this.grabbed.delete(hand);continue;}this.project.pose[joint]=localPoint(this.preview,at(m)).map(x=>Math.max(-2.5,Math.min(2.5,x)));}
  if(this.recording&&!this.editing){for(const hand of ['left','right']){const m=this.hands[hand];if(!m)continue;const pos=localPoint(this.root,at(m));this.project.pose[hand+'Hand']=pos.map(x=>Math.max(-2.5,Math.min(2.5,x)));this.project.pose[hand+'Elbow']=this.project.pose[hand+'Shoulder'].map((x,i)=>x*.45+pos[i]*.55+(i===1?-.08:0));}}
  if(this.held&&!this.hands[this.held])this.held=null;
  this.itemModel=this.held?this.hands[this.held]:this.inserted?xrMul(this.beltModel,xrTranslate(0,0,.14)):xrMul(this.root,xrTranslate(.34,.95,.38));
  if(this.recording&&time-this.lastSample>=1/15){const t=time-this.motionStart;if(t>120||this.project.motion.length>=1800)this.setRecording(false);else{this.project.motion.push({t:Math.max(0,t),pose:structuredClone(this.project.pose)});this.lastSample=time;}}
 }
 gripStart(hand){if(!this.enabled||!this.hands[hand])return false;const p=at(this.hands[hand]);if(this.editing&&this.preview){const choices=JOINTS.map(j=>[j,dist(p,worldPoint(this.preview,this.project.pose[j]))]).filter(([j,d])=>d<.14&&!Array.from(this.grabbed.values()).includes(j)).sort((a,b)=>a[1]-b[1]);if(choices.length){this.grabbed.set(hand,choices[0][0]);return true;}}
  if(!this.inserted&&!this.held&&this.itemModel&&dist(p,at(this.itemModel))<.24){this.held=hand;if(this.state.step===0)this.advance();return true;}return false;}
 gripEnd(hand){if(this.grabbed.delete(hand))return true;if(this.held!==hand)return false;this.held=null;if(this.hands[hand]&&this.beltModel&&dist(at(this.hands[hand]),at(this.beltModel))<.34){this.inserted=true;if(this.state.step===1)this.advance();}return true;}
 trigger(hand,ray){if(!this.enabled)return null;const action=henshinPanelHit(ray,this.panel);if(action){if(action==='advance')this.advance();else if(action==='attack')this.attack();else if(action==='reset')this.reset();else if(action==='next')this.next();else if(action==='edit'){this.editing=!this.editing;this.changed();}else if(action==='record')this.setRecording(!this.recording);else if(action==='play')this.play();else if(action==='calibrate'&&this.hands.left){this.project.waist=Math.max(.25,Math.min(.85,(this.hands.left[13]-this.floor)/this.height));this.changed();}return action;}
  if(this.hands[hand]&&this.beltModel&&dist(at(this.hands[hand]),at(this.beltModel))<.38){this.advance();return 'advance';}return null;}
}
