/** Universal Engine native shipboard adapter for Avatar Social Voice v0.4.
 * Works with the engine's procedural/WebGL avatar renderer (no Three.js globals).
 * Browser speech synthesis is 2D; preserve the existing ship-local motions and crew social save model.
 */
import {AvatarVoiceDirector} from './social-voice/avatar-voice.mjs';
import {planSocialLine} from './social-voice/social-dialogue.mjs';
import {japaneseVoices,modelVoiceStyle,voiceSelectionStatus} from './social-voice/voice-selection.mjs';

const STORAGE_KEY='universal-engine:avatar-social-voice:settings:v1';
const CREW={
 navigator:{role:'officer',warmth:.58,formality:.94,expressiveness:.48,rate:.96,pitch:1.0},
 engineer:{role:'engineer',warmth:.7,formality:.48,expressiveness:.65,rate:.98,pitch:.98},
 companion:{role:'companion',warmth:.84,formality:.36,expressiveness:.78,rate:1.0,pitch:1.02}
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
 constructor({voice=null,doc=globalThis.document,storage=globalThis.localStorage,getRenderer=()=>null,getAvatarModel=id=>({navigator:'lyra',engineer:'elio',companion:'mina'})[id],onError=()=>{}}={}){
  this.doc=doc;this.storage=storage;this.getRenderer=getRenderer;this.getAvatarModel=getAvatarModel;this.onError=onError;
  this.voiceNames={navigator:'',engineer:'',companion:''};this.tuning=Object.fromEntries(Object.keys(CREW).map(id=>[id,{rate:1,pitch:1}]));
  this.voiceRows=[];this.voiceChangeHandler=null;
  this.enabled=false;this.activated=false;this.subtitles=true;this.activeSpeaker=null;
  this.interior=null;this.routineKey='';this.greetId=null;
  this.ui=new Set();this.caption=null;this.lastCaption='';
  try{const saved=JSON.parse(this.storage?.getItem(STORAGE_KEY)||'null');
   this.enabled=Boolean(saved?.enabled);this.subtitles=saved?.subtitles!==false;
   for(const id of Object.keys(CREW)){
    if(typeof saved?.voiceNames?.[id]==='string')this.voiceNames[id]=saved.voiceNames[id].slice(0,100);
    for(const key of ['rate','pitch'])if(Number.isFinite(saved?.tuning?.[id]?.[key]))this.tuning[id][key]=cap(saved.tuning[id][key],.82,1.12);
   }}catch(_){}
  this.voice=voice||new AvatarVoiceDirector({
   onSubtitle:event=>this._subtitle(event),onState:event=>this._speechState(event)
  });
  for(const [id,base] of Object.entries(CREW))this.voice.registerAvatar?.(id,{lang:'ja-JP',rate:base.rate,pitch:base.pitch,volume:1,voiceStyle:this.voiceStyle(id)});
 }
 _save(){try{this.storage?.setItem(STORAGE_KEY,JSON.stringify({enabled:this.enabled,subtitles:this.subtitles,voiceNames:this.voiceNames,tuning:this.tuning}));}catch(_){}}
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
   void this.voice.say(id,safe(text),{interrupt,voiceName:this.voiceNames[id]||null,voiceStyle:this.voiceStyle(id),
    rate:cap((voice?.rate??base.rate)*this.tuning[id].rate,.80,1.22),
    pitch:cap((voice?.pitch??base.pitch)*this.tuning[id].pitch,.82,1.20),
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
 voiceStyle(id){return modelVoiceStyle(this.getAvatarModel?.(id),{navigator:'feminine',engineer:'masculine',companion:'feminine'}[id]||'neutral');}
 voiceStatus(id){return voiceSelectionStatus(this.voice.voices||[],{voiceName:this.voiceNames[id],style:this.voiceStyle(id)});}
 setVoiceName(id,name){
  if(!Object.hasOwn(CREW,id))return false;
  const chosen=String(name||'');
  if(chosen&&!japaneseVoices(this.voice.voices||[]).some(v=>v.name===chosen||v.voiceURI===chosen))return false;
  this.voiceNames[id]=chosen;this._save();this._refreshVoiceRows();return true;
 }
 setTuning(id,key,value){
  if(!Object.hasOwn(CREW,id)||!['rate','pitch'].includes(key)||!Number.isFinite(Number(value)))return false;
  this.tuning[id][key]=cap(Number(value),.82,1.12);this._save();return true;
 }
 preview(id){
  if(!Object.hasOwn(CREW,id))return false;
  if(!this.enabled||!this.activated)this.setEnabled(true);
  const lines={navigator:'艦長、お帰りなさい。航路の確認は完了しています。',
   engineer:'推進器の点検は完了しました。いつでも出航できます。',
   companion:'おかえり！今日はどの星を探検する？'};
  const base=CREW[id];
  try{void this.voice.say(id,lines[id],{interrupt:true,voiceName:this.voiceNames[id]||null,
   voiceStyle:this.voiceStyle(id),rate:cap(base.rate*this.tuning[id].rate,.80,1.22),
   pitch:cap(base.pitch*this.tuning[id].pitch,.82,1.20),volume:1});return true;}
  catch(e){this.onError(e);return false;}
 }
 _refreshVoiceRows(){
  const voices=japaneseVoices(this.voice.voices||[]);
  for(const {id,select,status} of this.voiceRows){
   const keep=this.voiceNames[id]||'';
   select.replaceChildren();
   const auto=this.doc.createElement('option');auto.value='';auto.textContent='自動（現在のアバターに合わせる）';
   select.append(auto);
   for(const v of voices){const option=this.doc.createElement('option');option.value=v.voiceURI||v.name;
    option.textContent=v.name+' · '+v.lang;select.append(option);}
   if(keep&&!voices.some(v=>v.name===keep||v.voiceURI===keep)){
    const missing=this.doc.createElement('option');missing.value=keep;missing.textContent='未検出: '+keep;select.append(missing);
   }
   select.value=keep;
   const result=this.voiceStatus(id);
   const styleLabel={feminine:'女性系',masculine:'男性系',neutral:'指定なし'}[this.voiceStyle(id)];
   status.textContent='自動の優先: '+styleLabel+' ／ '+(result.selected||'利用可能な日本語音声なし')+
    (result.warning?' ／ ⚠ '+result.warning:'');
  }
 }
 _voiceSettings(parent){
  if(!parent)return;
  const details=this.doc.createElement('details');details.style.cssText=
   'position:relative;z-index:4500;color:#e2f5f5;font:12px system-ui';
  const summary=this.doc.createElement('summary');summary.textContent='🎙 声の設定・試聴';
  summary.style.cssText='cursor:pointer;padding:7px;background:#23485b;border-radius:7px';
  details.append(summary);
  const body=this.doc.createElement('div');body.style.cssText=
   'min-width:270px;max-width:calc(100vw - 24px);max-height:60vh;overflow:auto;background:#092b39;color:white;border:1px solid #8bc7d2;border-radius:8px;padding:10px;box-shadow:0 5px 22px #0008;';
  if(parent.id!=='ship-crew-social')body.style.cssText+='position:absolute;right:0;top:100%;';
  const info=this.doc.createElement('p');info.textContent='端末内の日本語音声をキャラクターごとに選べます。自動選択は声の名前から推定します。';
  body.append(info);
  for(const [id,title] of [['navigator','副官'],['engineer','機関士'],['companion','同行者']]){
   const label=this.doc.createElement('label');label.style.cssText='display:block;margin-top:9px';
   label.append(this.doc.createTextNode(title+' '));
   const select=this.doc.createElement('select');select.setAttribute('aria-label',title+'の声');
   select.style.cssText='display:block;max-width:100%;width:100%;padding:6px;background:#173e50;color:white';
   select.addEventListener('change',()=>this.setVoiceName(id,select.value));
   label.append(select);body.append(label);
   const test=this.doc.createElement('button');test.type='button';test.textContent='▶ '+title+'を試聴';
   test.style.cssText='padding:7px;background:#21536a;color:white;border:1px solid #8cb9c5;border-radius:5px';
   test.addEventListener('click',()=>this.preview(id));body.append(test);
   const status=this.doc.createElement('p');status.style.cssText='font:11px/1.5 system-ui;color:#bedadf;margin:4px 0';
   body.append(status);this.voiceRows.push({id,select,status});
   for(const [key,title,min,max] of [['rate','話速',.82,1.12],['pitch','高さ',.82,1.12]]){
    const control=this.doc.createElement('label');control.style.cssText='display:flex;gap:7px;align-items:center;margin:3px 0;color:#d3eef1';
    control.append(this.doc.createTextNode(title));
    const slider=this.doc.createElement('input');slider.type='range';slider.min=String(min);slider.max=String(max);slider.step='0.02';
    slider.value=String(this.tuning[id][key]);slider.style.cssText='width:135px;accent-color:#71c7d0';
    const output=this.doc.createElement('span');output.textContent=Number(slider.value).toFixed(2)+'×';
    slider.addEventListener('input',()=>{this.setTuning(id,key,slider.value);output.textContent=Number(slider.value).toFixed(2)+'×';});
    control.append(slider,output);body.append(control);
   }
  }
  const note=this.doc.createElement('small');note.textContent='女性系の声が表示されない場合は、ブラウザ・端末側に追加の日本語音声が必要です。高さの調整だけでは女性の声にできません。';
  body.append(note);details.append(body);parent.append(details);
  details.addEventListener('toggle',()=>{if(details.open)this._refreshVoiceRows();});
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
   cb.addEventListener('change',()=>this.setSubtitles(cb.checked));label.append(cb,this.doc.createTextNode('字幕'));line.append(label);panel.append(line);
   this._voiceSettings(panel);
  }
  if(flightHeader){const group=this.doc.createElement('div');group.style.cssText='display:flex;align-items:center;gap:5px';
   createButton(group);this._voiceSettings(group);flightHeader.append(group);}
  this.voiceChangeHandler=()=>this._refreshVoiceRows();
  this.voice.synthesis?.addEventListener?.('voiceschanged',this.voiceChangeHandler);
  this._refreshVoiceRows();this._refresh();
 }
 stop(){this._setInterior(null);}
 destroy(){this.stop();this.voice.stop?.();this.voice.synthesis?.removeEventListener?.('voiceschanged',this.voiceChangeHandler);this.voiceRows.length=0;this.ui.clear();this.caption?.remove?.();this.caption=null;}
}