/**
 * Wrist terminal clock and sandbox time controls.
 * No WebXR/DOM dependencies; multiplayer remains read-only.
 */
export const WATCH_STYLES=Object.freeze(["mechanical","smart"]);
export const WATCH_MODES=Object.freeze(["universe","creative","multiverse"]);
export const WATCH_SPEEDS=Object.freeze([.25,1,60,600,3600]);
export const WATCH_ACTIONS=Object.freeze(["menu","settings","view","xr","tablet","time"]);
const pad=n=>String(n).padStart(2,"0");
export function watchClocks(gameDays,at=new Date()){
 const actual=at instanceof Date?at:new Date(at);
 const date=Number.isFinite(actual.getTime())?actual:new Date(0);
 const seconds=Number.isFinite(gameDays)?
  Math.floor((((gameDays%1)+1)%1)*86400):0;
 return {
  real:pad(date.getHours())+":"+pad(date.getMinutes())+":"+pad(date.getSeconds()),
  realDate:date.getFullYear()+"-"+pad(date.getMonth()+1)+"-"+pad(date.getDate()),
  world:pad(Math.floor(seconds/3600))+":"+pad(Math.floor(seconds%3600/60))+":"+pad(seconds%60),
  worldDay:Number.isFinite(gameDays)?Math.floor(gameDays)+1:1
 };
}
export function watchStyle(value){return WATCH_STYLES.includes(value)?value:"smart";}
export function watchMode(value){return WATCH_MODES.includes(value)?value:"universe";}
export function watchSpeed(value){const n=Number(value);return WATCH_SPEEDS.includes(n)?n:1;}
const clone=value=>JSON.parse(JSON.stringify(value));
/**
 * Rolling bounded snapshots supplied by the owning game. Rewind never
 * fabricates state: it restores only fields the game explicitly captures.
 */
export class WristTimeline{
 constructor({maxSeconds=30,intervalMs=1000}={}){
  this.maxSeconds=maxSeconds;this.intervalMs=intervalMs;this.items=[];
 }
 capture(nowMs,snapshot){
  if(!Number.isFinite(nowMs)||snapshot==null)return false;
  const last=this.items.at(-1);
  if(last&&nowMs-last.at<this.intervalMs)return false;
  this.items.push({at:nowMs,state:clone(snapshot)});
  this.items=this.items.filter(item=>nowMs-item.at<=this.maxSeconds*1000);
  return true;
 }
 rewind(nowMs,seconds,contextKey){
  if(!Number.isFinite(seconds)||seconds<=0)return null;
  const target=nowMs-seconds*1000;
  const candidates=this.items.filter(item=>item.at<=target&&item.state.contextKey===contextKey);
  const found=candidates.at(-1);
  if(!found)return null;
  this.items=this.items.filter(item=>item.at<=found.at);
  return clone(found.state);
 }
 clear(){this.items=[];}
}
export class WristWatch{
 constructor({style="smart",mode="universe",onPause=()=>{},onSpeed=()=>{},capture=()=>null,restore=()=>false}={}){
  this.style=watchStyle(style);this.mode=watchMode(mode);
  this.paused=false;this.speed=1;this.open=false;
  this.onPause=onPause;this.onSpeed=onSpeed;
  this.capture=capture;this.restore=restore;
  this.timeline=new WristTimeline();
 }
 setMode(mode){
  const next=watchMode(mode);
  if(next!==this.mode){
   if(this.paused){this.paused=false;this.onPause(false);}
   this.timeline.clear();this.mode=next;
  }
  return this.mode;
 }
 setStyle(style){return this.style=watchStyle(style);}
 setPause(paused){
  if(this.mode==="multiverse")return false;
  const next=Boolean(paused);
  if(next===this.paused)return true;
  this.paused=next;this.onPause(this.paused);return true;
 }
 setSpeed(scale){
  if(this.mode!=="creative")return false;
  this.speed=watchSpeed(scale);this.onSpeed(this.speed);return true;
 }
 tick(realTimeMs){
  if(this.mode!=="creative"||this.paused)return false;
  return this.timeline.capture(realTimeMs,this.capture());
 }
 rewind(realTimeMs,seconds=5){
  if(this.mode!=="creative")return false;
  const current=this.capture(),saved=this.timeline.rewind(realTimeMs,seconds,current?.contextKey);
  if(!saved)return false;
  // Pause before restoring snapshots so autonomous actors do not immediately advance.
  this.setPause(true);
  return Boolean(this.restore(saved));
 }
 dispose(){if(this.paused)this.setPause(false);this.timeline.clear();}
}
