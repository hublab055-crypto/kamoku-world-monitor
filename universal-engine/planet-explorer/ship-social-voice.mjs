/** Universal Engine native shipboard adapter for Avatar Social Voice v0.4.
 * Works with the engine's procedural/WebGL avatar renderer (no Three.js globals).
 * Browser speech synthesis is 2D; preserve the existing ship-local motions and crew social save model.
 */
import {AvatarVoiceDirector} from './social-voice/avatar-voice.mjs';
import {planSocialLine} from './social-voice/social-dialogue.mjs';

const STORAGE_KEY='universal-engine:avatar-social-voice:settings:v1';
const CREW={
 navigator:{role:'officer',warmth:.58,formality:.94,expressiveness:.48,rate:.93,pitch:.93},
 engineer:{role:'engineer',warmth:.7,formality:.48,expressiveness:.65,rate:.94,pitch:.85},
 companion:{role:'companion',warmth:.84,formality:.36,expressiveness:.78,rate:1.02,pitch:1.12}
};
const LEVELS={comrade:'colleague',friend:'friend',bestFriend:'close_friend',lover:'partner',family:'family'};
const cap=(x,a,b)=>Math.max(a,Math.min(b,x));
const safe=(x,max=240)=>String(x??'').trim().slice(0,max);

export function crewVoiceProfile(id,interior){
 const base=CREW[id];if(!base)return null;
 const member=interior?.crew?.find(c=>c.id===id),level=interior?.social?.status?.(id);
 const points=cap(Number(level?.points)||0,0,500);
 return {id,name:member?.name||id,role:base.role,isOfficer:id==='navigator',
  personality:{warmth:base.warmth,formality:base.formality,expressiveness:base.expressiveness,caution:.5},
  relationship:{kind:LEVELS[level?.id]||'colleague',affinity:Math.round(points/5),trust:cap(.3+points/800,0,1)},
  voice:{rate:base.rate,pitch:base.pitch,volume:1}};
}

export class ShipSocialVoice {
 constructor({voice=null,doc=globalThis.document,storage=globalThis.localStorage,getRenderer=()=>null,onError=()=>{}}={}){
  this.doc=doc;this.storage=storage;this.getRenderer=getRenderer;this.onError=onError;
  this.enabled=false;this.activated=false;this.subtitles=true;this.activeSpeaker=null;
  this.interior=null;this.routineKey='';this.greetId=null;
  this.ui=new Set();this.caption=null;this.lastCaption='';
  try{const saved=JSON.parse(this.storage?.getItem(STORAGE_KEY)||'null');
   this.enabled=Boolean(saved?.enabled);this.subtitles=saved?.subtitles!==false;}catch(_){}
  this.voice=voice||new AvatarVoiceDirector({
   onSubtitle:event=>this._subtitle(event),onState:event=>this._speechState(event)
  });
  for(const [id,base] of Object.entries(CREW))this.voice.registerAvatar?.(id,{lang:'ja-JP',rate:base.rate,pitch:base.pitch,volume:1});
 }
 _save(){try{this.storage?.setItem(STORAGE_KEY,JSON.stringify({enabled:this.enabled,subtitles:this.subtitles}));}catch(_){}}
 _speaker(id){const renderer=this.getRenderer?.();if(renderer){renderer.shipVoiceSpeakerId=id||null;}}
 _speechState(event){
  if(event?.speaking)this.activeSpeaker=event.avatarId;
  else if(this.activeSpeaker===event?.avatarId)this.activeSpeaker=null;
  this._speaker(this.activeSpeaker);
 }
 _subtitle({avatarId,text,visible}){
  if(!this.caption||!this.subtitles)return;
  if(visible){const name=this.interior?.crew?.find(c=>c.id===avatarId)?.title||
    this.interior?.crew?.find(c=>c.id===avatarId)?.name||avatarId;
   this.caption.textContent=name+'「'+safe(text)+'」';this.caption.hidden=false;this.lastCaption=avatarId;}
  else if(this.lastCaption===avatarId){this.caption.hidden=true;this.lastCaption='';}
 }
 _refresh(){for(const button of this.ui)if(button?.isConnected!==false){
   button.textContent=this.enabled&&this.activated?'🔊 クルー音声 ON':'🔇 クルー音声 OFF';
   button.setAttribute?.('aria-pressed',String(this.enabled&&this.activated));}}
 setEnabled(value,{test=false,interior=this.interior}={}){
  this.enabled=Boolean(value);this.activated=this.enabled;this._save();this._refresh();
  if(!this.enabled){this.voice.stop?.();this.activeSpeaker=null;this._speaker(null);
   if(this.caption)this.caption.hidden=true;}
  if(test&&this.enabled){const person=interior?.crew?.find(c=>c.id==='navigator');
   this.speak('navigator','音声案内を開始します。',{interior,viaRadio:true,event:'acknowledge'});
   return Boolean(person||this.enabled);}
  return this.enabled;
 }
 setSubtitles(value){this.subtitles=Boolean(value);this._save();if(this.caption&&!this.subtitles)this.caption.hidden=true;}
 _setInterior(interior){if(this.interior===interior)return;
  this.voice.stop?.();this.interior=interior;this.greetId=null;this.routineKey='';this.activeSpeaker=null;
  this._speaker(null);if(this.caption)this.caption.hidden=true;
 }
 /** Call after ShipCrewGreetings.advance and ShipCrewAutonomy.advance in the game frame. */
 observe(interior){
  this._setInterior(interior||null);if(!interior)return;
  const formal=interior.greetings?.formal?.member||null;
  const id=formal?.id||null;
  if(id!==this.greetId){this.greetId=id;
   if(id&&this.enabled&&this.activated&&interior.distance(formal)<=2.6)
    this.speakSocial(id,'greet',{interior,distance:interior.distance(formal)});}
  const routine=interior.routine;
  const line=routine?.speech;
  const key=line?[routine.cycle,line.speakerId,line.topic,line.line,line.text].join(':'):'';
  if(key!==this.routineKey){this.routineKey=key;
   if(key&&this.enabled&&this.activated){const member=interior.crew.find(c=>c.id===line.speakerId);
    if(member)this.speak(line.speakerId,line.text,{interior,event:'report',
     distance:interior.distance(member),viaRadio:true});}}
 }
 speakSocial(id,event,{interior=this.interior,distance=null,viaRadio=false}={}){
  const member=interior?.crew?.find(c=>c.id===id);if(!member)return false;
  const profile=crewVoiceProfile(id,interior);
  if(!profile)return false;
  const computedDistance=Number.isFinite(distance)?distance:interior.distance(member);
  const plan=planSocialLine(profile,{event,distance:computedDistance,viaRadio});
  if(!plan)return false;
  return this.speak(id,plan.text,{interior,event,distance:computedDistance,viaRadio,
   interrupt:plan.interrupt,voice:plan.voice});
 }
 speak(id,text,{interior=this.interior,event='report',distance=0,viaRadio=false,interrupt=false,voice=null}={}){
  if(!this.enabled||!this.activated||!CREW[id]||!safe(text)||!interior?.crew?.some(c=>c.id===id))return false;
  if(!viaRadio&&Number.isFinite(distance)&&distance>8&&!interrupt)return false;
  try{const base=CREW[id];
   void this.voice.say(id,safe(text),{interrupt,rate:voice?.rate??base.rate,pitch:cap((voice?.pitch??1)*base.pitch,.5,1.8),
    volume:voice?.volume??1,emotion:event});return true;
  }catch(e){this.onError(e);return false;}
 }
 /** Explicit '話す' command: use the exact existing ShipInterior.talk() text. */
 sayReport(interior,id,text){const member=interior?.crew?.find(c=>c.id===id);
  return member?this.speak(id,text,{interior,event:'report',distance:interior.distance(member)}):false;}
 /** Reuse pre-existing ShipCrewSocial status without promoting relationships from dialogue. */
 sayInteraction(interior,id,action){
  const event=action==='gift'?'gift':'acknowledge';
  return this.speakSocial(id,event,{interior});
 }
 installControls({panel=null,flightHeader=null}={}){
  if(!this.doc)return;
  if(!this.caption){const c=this.doc.createElement('div');c.id='ue-ship-voice-caption';c.hidden=true;
   c.setAttribute('role','status');c.setAttribute('aria-live','polite');
   c.style.cssText='position:fixed;left:50%;bottom:max(72px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:6000;pointer-events:none;background:#091e2de8;border:1px solid #6bb9c9;border-radius:9px;max-width:min(90vw,540px);padding:8px 14px;color:#f0fcff;font:14px/1.5 system-ui;text-align:center;text-shadow:0 1px 3px #000';
   this.doc.body.append(c);this.caption=c;}
  const createButton=parent=>{if(!parent)return;
   const b=this.doc.createElement('button');b.type='button';b.setAttribute('aria-label','クルー音声の切り替え');
   b.style.cssText='padding:7px 10px;background:#23516b;color:#fff;border:1px solid #88bed0;border-radius:7px;min-height:36px';
   b.addEventListener('click',()=>this.setEnabled(!this.enabled||!this.activated,{test:true}));parent.append(b);this.ui.add(b);};
  if(panel){const line=this.doc.createElement('div');line.style.cssText='display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:8px 0';
   createButton(line);const label=this.doc.createElement('label');label.style.cssText='display:flex;align-items:center;gap:4px;color:#d4eef4;font:12px system-ui';
   const cb=this.doc.createElement('input');cb.type='checkbox';cb.checked=this.subtitles;
   cb.addEventListener('change',()=>this.setSubtitles(cb.checked));label.append(cb,this.doc.createTextNode('字幕'));line.append(label);panel.append(line);}
  createButton(flightHeader);this._refresh();
 }
 stop(){this._setInterior(null);}
 destroy(){this.stop();this.voice.stop?.();this.ui.clear();this.caption?.remove?.();this.caption=null;}
}