/**
 * v0.7b expressive low-poly face: emotive mouth, eyebrows, gaze and blinking.
 * No voice, social-AI, automatic psychological inference or external imagery.
 */
import {Shape} from "../original-assets/original-models.mjs";
export const EXPRESSIONS=Object.freeze([
 ["neutral","平常"],["joy","喜び"],["sadness","悲しみ"],
 ["anger","怒り"],["fear","不安"],["surprise","驚き"],["fatigue","疲労"]
]);
const tags=new Set(EXPRESSIONS.map(x=>x[0]));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const target={
 neutral:{jaw:0,brow:0,eyes:0,mouthWidth:1,mouthHeight:0,headTilt:0},
 joy:{jaw:-.055,brow:-.12,eyes:-.1,mouthWidth:1.25,mouthHeight:.045,headTilt:.035},
 sadness:{jaw:.05,brow:.26,eyes:-.12,mouthWidth:.78,mouthHeight:-.045,headTilt:-.12},
 anger:{jaw:.10,brow:-.33,eyes:-.15,mouthWidth:.9,mouthHeight:0,headTilt:-.06},
 fear:{jaw:-.08,brow:.31,eyes:.05,mouthWidth:.7,mouthHeight:.025,headTilt:.05},
 surprise:{jaw:-.30,brow:.28,eyes:.15,mouthWidth:.58,mouthHeight:.06,headTilt:0},
 fatigue:{jaw:.02,brow:.08,eyes:-.4,mouthWidth:.87,mouthHeight:-.018,headTilt:-.14}
};
const close=(a,b,eps=.00001)=>Math.abs(a-b)<eps;
export class ExpressionController {
 constructor({preset="neutral",autoBlink=true,gazeX=0,gazeY=0}={}){
  if(!tags.has(preset))throw Error("Unknown expression");
  this.preset=preset;this.autoBlink=!!autoBlink;this.gazeX=clamp(gazeX,-1,1);this.gazeY=clamp(gazeY,-1,1);
  this.elapsed=0;this.blink=0;
  this.current={...target.neutral,gazeX:this.gazeX,gazeY:this.gazeY,blink:0};
 }
 setPreset(preset){
  if(!tags.has(preset))throw RangeError("Unknown expression");
  this.preset=preset;return preset;
 }
 setGaze(x,y=0){
  if(![x,y].every(Number.isFinite))throw TypeError("Invalid gaze");
  this.gazeX=clamp(x,-1,1);this.gazeY=clamp(y,-1,1);
 }
 setAutoBlink(yes){this.autoBlink=!!yes;}
 update(dt){
  if(!Number.isFinite(dt)||dt<0)throw TypeError("Invalid expression delta");
  this.elapsed+=Math.min(dt,.25);
  const phase=this.elapsed%4.3;
  // two quick eyelid closures per cycle, plus small pauses.
  const blinkWindow=Math.max(0,1-Math.abs(phase-2.55)/.105);
  const doubleBlink=Math.max(0,1-Math.abs(phase-2.79)/.07)*.64;
  const b=this.autoBlink?Math.max(blinkWindow,doubleBlink):0;
  const desired={...target[this.preset],gazeX:this.gazeX,gazeY:this.gazeY,blink:b};
  const a=1-Math.exp(-Math.min(dt,.25)/.24);
  const next={};
  for(const key of Object.keys(desired)){
   const tau=key==="blink"?Math.max(a,.65):a;
   next[key]=this.current[key]+(desired[key]-this.current[key])*tau;
  }
  this.blink=next.blink;this.current=next;
  return {...next,preset:this.preset};
 }
 snapshot(){
  return {version:1,preset:this.preset,autoBlink:this.autoBlink,gazeX:this.gazeX,gazeY:this.gazeY};
 }
 static fromSnapshot(x){
  if(x?.version!==1||!tags.has(x.preset)||typeof x.autoBlink!=="boolean"||
   ![x.gazeX,x.gazeY].every(v=>Number.isFinite(v)&&v>=-1&&v<=1))throw Error("Invalid expression save");
  return new ExpressionController(x);
 }
}
const complexion=[.84,.64,.48],eyeWhite=[.89,.87,.78],ink=[.14,.16,.17],browColor=[.28,.22,.18],lipColor=[.54,.24,.28];
export function makeFaceParts(){
 const parts=[],add=(name,pivot,fn,faceKind=null)=>{
  const geometry=new Shape();fn(geometry);parts.push({name,pivot,geometry,faceKind});
 };
 for(const side of ["left","right"]){
  const eye=side+"Eye";
  add(side+"-eye-white",eye,m=>m.crystal(0,0,.041,.058,.04,.022,eyeWhite));
  add(side+"-pupil",eye,m=>m.crystal(0,0,.070,.025,.029,.011,ink));
  add(side+"-eyelid",eye,m=>m.box(0,-.044,.093,.070,.093,.015,complexion),"lid");
  add(side+"-eyebrow",eye,m=>m.box(0,.070,.052,.081,.029,.016,browColor),side+"Brow");
 }
 add("animated-mouth","jaw",m=>{
  m.box(0,-.0,.091,.052,.023,.016,lipColor);
  m.box(0,-.012,.094,.043,.009,.017,ink);
 },"mouth");
 return parts;
}
export function expressionPoseValues(expr){
 if(!expr||![expr.blink,expr.gazeX,expr.gazeY,expr.jaw,expr.headTilt].every(Number.isFinite))
  throw TypeError("Invalid face pose");
 return {
  jawX:expr.jaw,
  leftEyeY:clamp(expr.gazeX,-1,1)*.32,
  rightEyeY:clamp(expr.gazeX,-1,1)*.32,
  leftEyeX:clamp(expr.gazeY,-1,1)*.20,
  rightEyeX:clamp(expr.gazeY,-1,1)*.20,
  faceHeadY:expr.headTilt
 };
}
