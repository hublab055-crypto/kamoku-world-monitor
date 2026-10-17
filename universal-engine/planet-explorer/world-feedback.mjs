/** Lightweight screen-space feedback for actions, combat and dialogue.
 * UI only; neither WebGL meshes nor campaign save data are mutated.
 */
export const FEEDBACK_TYPES=Object.freeze(["damage","hurt","gain","heal","guard","speech","notice"]);
const COLORS=Object.freeze({damage:"damage",hurt:"hurt",gain:"gain",heal:"heal",
 guard:"guard",speech:"speech",notice:"notice"});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const cleanText=value=>String(value??"").slice(0,180);
export class WorldFeedback{
 constructor({limit=32}={}){
  this.maxVisible=clamp(Math.round(limit),5,64);this.nextId=1;this.events=[];
 }
 emit({kind="notice",text="",actorId=null,enemyId=null,x=null,z=null,duration=null}={}){
  const category=FEEDBACK_TYPES.includes(kind)?kind:"notice";
  const event={id:this.nextId++,kind:category,text:cleanText(text),
   actorId:typeof actorId==="string"?actorId:null,
   enemyId:Number.isInteger(enemyId)?enemyId:null,
   x:Number.isFinite(x)?x:null,z:Number.isFinite(z)?z:null,
   ttl:clamp(Number(duration)||(category==="speech"?3.4:1.25),.4,8),
   age:0};
  this.events.push(event);
  if(this.events.length>this.maxVisible)this.events.splice(0,this.events.length-this.maxVisible);
  return event;
 }
 speech(actorId,text,duration=3.4){
  // A character speaks one line at a time, not several overlapping bubbles.
  this.events=this.events.filter(e=>!(e.kind==="speech"&&e.actorId===actorId));
  return this.emit({kind:"speech",actorId,text,duration});
 }
 advance(dt){
  if(!Number.isFinite(dt)||dt<0)throw TypeError("Invalid effect delta");
  const step=clamp(dt,0,.1);
  for(const e of this.events)e.age+=step;
  this.events=this.events.filter(e=>e.age<e.ttl);
 }
 clear(){this.events=[];}
 /** Renderer screens use normalized u,v; output remains inside viewport. */
 layout({actors=[],enemies=[],player=null,width=1,height=1}={}){
  const byId=new Map(actors.filter(a=>a?.onScreen).map(a=>[a.id,a]));
  const byEnemy=new Map(enemies.filter(e=>e?.onScreen).map(e=>[e.id,e]));
  const out=[],stacks=new Map();
  for(const e of this.events){
   let pt=e.enemyId!=null?byEnemy.get(e.enemyId):null;
   if(!pt&&e.actorId)pt=byId.get(e.actorId);
   if(!pt&&e.x!=null&&e.z!=null&&typeof player==="function")pt=player(e.x,e.z);
   if(!pt&&e.actorId==="player")pt=byId.get("player")||null;
   if(!pt||!pt.onScreen||!Number.isFinite(pt.u)||!Number.isFinite(pt.v))continue;
   const normalized=clamp(e.age/e.ttl,0,1);
   const anchor=e.enemyId!=null?"enemy:"+e.enemyId:e.actorId||"world";
   const stack=e.kind==="speech"?0:(stacks.get(anchor)||0);
   if(e.kind!=="speech")stacks.set(anchor,stack+1);
   const stagger=(e.id%3-1)*16;
   out.push({...e,screenX:clamp(pt.u*width+stagger,34,Math.max(34,width-34)),
    screenY:clamp(pt.v*height-12-stack*24-normalized*(e.kind==="speech"?8:46),
     38,Math.max(38,height-60)),opacity:e.kind==="speech"?
      clamp((1-normalized)*4,0,1):clamp((1-normalized)*2.6,0,1),
    color:COLORS[e.kind]});
  }
  return out;
 }
}
/** Ordered buffer, distinct from the short legacy status list. */
export class GameConsole{
 constructor(maxEntries=250){this.maxEntries=clamp(maxEntries,20,1000);this.lines=[];this.nextId=1;}
 append(message,category="info",time=null){
  const line={id:this.nextId++,message:cleanText(message),category:
   ["info","combat","resource","social","system"].includes(category)?category:"info",
   time:Number.isFinite(time)?time:Date.now()};
  this.lines.push(line);
  if(this.lines.length>this.maxEntries)this.lines.splice(0,this.lines.length-this.maxEntries);
  return line;
 }
 clear(){this.lines=[];}
 filter(category="all",query=""){
  const q=String(query||"").toLocaleLowerCase();
  return this.lines.filter(line=>(category==="all"||line.category===category)&&
   line.message.toLocaleLowerCase().includes(q));
 }
}
