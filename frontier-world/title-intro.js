/* FW52.5: Title intro and 8 distinct chapter music previews (procedural Web Audio demos).
   This file deliberately does not modify save state or in-game BGM.
   Replace score definitions with mastered licensed audio in a future release. */
(function(){
'use strict';
const screen=document.getElementById('fwTitleOverlay');
const splash=document.getElementById('fwTrademarkSplash');
const button=document.getElementById('fwSplashStart');
const settings=document.getElementById('settingsPanel');
if(!screen||!splash||!button)return;
const scene=screen.querySelector('#fwTitleMain .fw-title-scene');
if(scene)screen.insertBefore(scene,screen.firstChild);
const storeKey='fw_title_audio_v1';
let opt={enabled:true,volume:40};
try{
 const obj=JSON.parse(localStorage.getItem(storeKey)||'null');
 if(obj&&typeof obj==='object'){
  opt.enabled=obj.enabled!==false;
  const v=Number(obj.volume);
  if(Number.isFinite(v))opt.volume=Math.max(0,Math.min(100,v));
 }
}catch(_){}
const persist=()=>{try{localStorage.setItem(storeKey,JSON.stringify(opt));}catch(_){}};

/* MIDI pitch numbers; all melodies are original sketches, not copies of existing tracks. */
const scores={
 title:{name:'はじまりの灯',bpm:84,meter:4,lead:'sine',harmony:'triangle',bass:'triangle',mode:'gentle',
  bars:[
   {b:48,c:[60,64,67],m:[72,74,76,79]},
   {b:45,c:[57,60,64],m:[76,74,72,69]},
   {b:41,c:[53,57,60],m:[69,72,76,72]},
   {b:43,c:[55,59,62],m:[74,71,69,67]}
  ]},
 frontier:{name:'はじまりの村',bpm:90,meter:4,lead:'triangle',harmony:'sine',bass:'triangle',mode:'gentle',
  bars:[
   {b:43,c:[55,59,62],m:[74,76,79,81]},
   {b:48,c:[60,64,67],m:[79,76,74,72]},
   {b:45,c:[57,60,64],m:[72,76,81,79]},
   {b:43,c:[55,59,62],m:[76,74,71,74]}
  ]},
 grassland:{name:'草原の覇者',bpm:114,meter:4,lead:'sawtooth',harmony:'triangle',bass:'triangle',mode:'gallop',
  bars:[
   {b:38,c:[50,53,57],m:[74,77,81,79]},
   {b:41,c:[53,57,60],m:[77,79,81,84]},
   {b:43,c:[55,58,62],m:[86,84,81,79]},
   {b:38,c:[50,53,57],m:[81,79,77,74]}
  ]},
 vinland:{name:'北海の旅路',bpm:76,meter:4,lead:'triangle',harmony:'sine',bass:'sine',mode:'march',
  bars:[
   {b:45,c:[57,60,64],m:[69,72,76,74]},
   {b:41,c:[53,57,60],m:[72,69,67,69]},
   {b:40,c:[52,55,59],m:[71,74,79,76]},
   {b:45,c:[57,60,64],m:[76,74,72,69]}
  ]},
 samurai:{name:'戦国の風',bpm:94,meter:4,lead:'square',harmony:'triangle',bass:'sine',mode:'taiko',
  bars:[
   {b:40,c:[52,55,59],m:[76,79,81,83]},
   {b:43,c:[55,59,62],m:[83,81,79,76]},
   {b:45,c:[57,60,64],m:[81,79,76,74]},
   {b:40,c:[52,55,59],m:[76,74,71,76]}
  ]},
 oasis:{name:'砂漠の星',bpm:99,meter:4,lead:'sawtooth',harmony:'sine',bass:'triangle',mode:'caravan',
  bars:[
   {b:38,c:[50,53,57],m:[74,77,81,85]},
   {b:45,c:[57,61,65],m:[82,81,77,76]},
   {b:43,c:[55,58,61],m:[74,76,77,81]},
   {b:38,c:[50,53,57],m:[85,82,81,74]}
  ]},
 maritime:{name:'大海原への出航',bpm:104,meter:6,lead:'sawtooth',harmony:'triangle',bass:'sine',mode:'wave',
  bars:[
   {b:48,c:[60,64,67],m:[72,76,79,84,79,76]},
   {b:43,c:[55,59,62],m:[74,79,83,86,83,79]},
   {b:45,c:[57,60,64],m:[76,81,84,88,84,81]},
   {b:41,c:[53,57,60],m:[77,81,84,81,79,76]}
  ]},
 tropical:{name:'南海の陽光',bpm:118,meter:6,lead:'sine',harmony:'triangle',bass:'sine',mode:'island',
  bars:[
   {b:45,c:[57,61,64],m:[81,83,85,88,85,83]},
   {b:50,c:[62,66,69],m:[86,85,81,78,81,85]},
   {b:47,c:[59,62,66],m:[83,86,90,88,86,83]},
   {b:45,c:[57,61,64],m:[85,83,81,76,78,81]}
  ]},
 mountain:{name:'天空の峰',bpm:68,meter:4,lead:'triangle',harmony:'sine',bass:'sine',mode:'echo',
  bars:[
   {b:43,c:[55,58,62],m:[74,null,79,82]},
   {b:39,c:[51,55,58],m:[79,null,77,74]},
   {b:41,c:[53,57,60],m:[72,null,77,81]},
   {b:43,c:[55,58,62],m:[82,null,79,74]}
  ]}
};
const Audio=window.AudioContext||window.webkitAudioContext;
let ac=null,mix=null,clock=null,track=null,currentTheme='title',entered=false;
function voice(p,start,duration,level,wave,target,cutoff,attack){
 if(!ac||!target||p==null)return;
 const oscillator=ac.createOscillator(),filter=ac.createBiquadFilter(),amp=ac.createGain();
 const t=Math.max(ac.currentTime+.001,start),len=Math.max(.06,duration);
 oscillator.type=wave||'sine';
 oscillator.frequency.value=440*Math.pow(2,(p-69)/12);
 filter.type='lowpass';filter.frequency.value=cutoff||2100;
 const a=Math.max(.008,Math.min(attack||.025,len*.36));
 amp.gain.setValueAtTime(.0001,t);
 amp.gain.exponentialRampToValueAtTime(Math.max(.0002,level),t+a);
 amp.gain.exponentialRampToValueAtTime(.0001,t+len);
 oscillator.connect(filter);filter.connect(amp);amp.connect(target);
 oscillator.start(t);oscillator.stop(t+len+.025);
 oscillator.onended=()=>{try{oscillator.disconnect();filter.disconnect();amp.disconnect();}catch(_){}};
}
function lowDrum(t,dest,level){
 if(!ac)return;
 const o=ac.createOscillator(),g=ac.createGain();
 o.type='sine';o.frequency.setValueAtTime(125,t);
 o.frequency.exponentialRampToValueAtTime(48,t+.17);
 g.gain.setValueAtTime(Math.max(.001,level),t);
 g.gain.exponentialRampToValueAtTime(.0001,t+.19);
 o.connect(g);g.connect(dest);o.start(t);o.stop(t+.21);
 o.onended=()=>{try{o.disconnect();g.disconnect();}catch(_){}};
}
function tap(t,dest,level){
 voice(91,t,.095,level,'triangle',dest,2300,.008);
}
function rhythm(def,t,beat,dest){
 const mode=def.mode,span=def.meter;
 if(mode==='gallop'){
  for(let b=0;b<span;b++){lowDrum(t+b*beat,dest,b%2===0?.12:.065);tap(t+(b+.55)*beat,dest,.028);}
 }else if(mode==='taiko'){
  lowDrum(t,dest,.15);lowDrum(t+beat*2,dest,.12);tap(t+beat*3,dest,.042);
 }else if(mode==='march'){
  lowDrum(t,dest,.085);tap(t+beat*2,dest,.026);
 }else if(mode==='caravan'){
  lowDrum(t,dest,.075);tap(t+beat*.75,dest,.025);tap(t+beat*2.5,dest,.027);
 }else if(mode==='wave'){
  lowDrum(t,dest,.062);tap(t+beat*1.5,dest,.018);lowDrum(t+beat*3,dest,.058);tap(t+beat*4.5,dest,.018);
 }else if(mode==='island'){
  lowDrum(t,dest,.06);
  for(let b=1;b<span;b+=1.5)tap(t+b*beat,dest,.028);
 }else if(mode==='echo'){
  lowDrum(t,dest,.035);
 }
}
function scheduleBar(active){
 const def=scores[active.id]||scores.title;
 const entry=def.bars[active.bar%def.bars.length];
 const beat=60/def.bpm,meter=def.meter,t=active.next,bus=active.bus;
 const cinematic=def.mode==='echo',pluck=def.mode==='taiko'||def.mode==='island';
 voice(entry.b,t,beat*(meter-.12),cinematic?.075:.078,def.bass,bus,550,cinematic?.13:.04);
 entry.c.forEach(function(n,i){
  voice(n,t+(pluck?i*.035:0),beat*(cinematic?meter*.91:meter*.77),cinematic?.018:.022,
   def.harmony,bus,cinematic?900:1500,cinematic?.2:.07);
 });
 entry.m.forEach(function(n,i){
  if(n==null)return;
  const start=t+i*beat;
  voice(n,start,beat*(cinematic?1.48:pluck?.41:.76),
    cinematic?.052:pluck?.043:.056,def.lead,bus,
    def.lead==='sawtooth'?1150:def.lead==='square'?900:2600,
    cinematic?.12:pluck?.008:.028);
  if(def.mode==='caravan'&&i===2)voice(n-1,start+beat*.3,beat*.19,.02,def.lead,bus,900,.008);
 });
 rhythm(def,t,beat,bus);
 active.next=t+beat*meter;active.bar++;
}
function tick(){
 if(!ac||!track||screen.hidden||document.hidden)return;
 while(track.next<ac.currentTime+.55)scheduleBar(track);
}
function stop(){
 if(clock!==null){clearInterval(clock);clock=null;}
 const c=ac;ac=null;mix=null;track=null;
 if(c)try{c.close().catch(()=>{});}catch(_){}
}
function play(){
 if(!entered||!opt.enabled||opt.volume<=0||screen.hidden||!Audio||document.hidden)return;
 if(!ac){
  try{
   ac=new Audio();mix=ac.createGain();
   mix.gain.value=opt.volume/100*.19;mix.connect(ac.destination);
   clock=setInterval(tick,130);
  }catch(_){stop();return;}
 }
 if(ac.state==='suspended')ac.resume().catch(()=>{});
 if(track&&track.id===currentTheme){tick();return;}
 const now=ac.currentTime,old=track;
 if(old){
  old.bus.gain.cancelScheduledValues(now);
  old.bus.gain.setTargetAtTime(.0001,now,.14);
  setTimeout(()=>{try{old.bus.disconnect();}catch(_){}},1400);
 }
 const bus=ac.createGain();
 bus.gain.setValueAtTime(.0001,now);
 bus.gain.linearRampToValueAtTime(1,now+.46);
 bus.connect(mix);
 track={id:currentTheme,bus:bus,next:now+.045,bar:0};
 tick();
}
function selectTheme(id){
 currentTheme=Object.prototype.hasOwnProperty.call(scores,id)?id:'title';
 play();
}
window.addEventListener('fw-title-chapter-selected',function(event){
 const picker=document.getElementById('fwTitleChapters');
 if(picker&&!picker.hidden)selectTheme(event.detail&&event.detail.id);
});
window.addEventListener('fw-title-chapters-opened',function(event){
 selectTheme(event.detail&&event.detail.id);
});
window.addEventListener('fw-title-chapters-closed',function(){selectTheme('title');});
function enter(){
 if(entered)return;
 entered=true;
 const picker=document.getElementById('fwTitleChapters');
 if(picker&&!picker.hidden){
  const active=picker.querySelector('[data-chapter-id][aria-pressed="true"]');
  if(active)currentTheme=active.dataset.chapterId;
 }
 play();splash.classList.add('fw-splash-out');button.disabled=true;
 const done=()=>{
  splash.hidden=true;splash.setAttribute('aria-hidden','true');
  screen.querySelector('[data-fw-title-choice="new"]')?.focus({preventScroll:true});
 };
 if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)done();
 else setTimeout(done,650);
}
button.addEventListener('click',enter);
splash.addEventListener('keydown',e=>{
 if(e.key==='Enter'||e.key===' '){e.preventDefault();button.click();}
});
const watch=new MutationObserver(()=>{
 if(screen.hidden){stop();watch.disconnect();}
});
watch.observe(screen,{attributes:true,attributeFilter:['hidden']});
window.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{
 if(!ac)return;
 if(document.hidden)ac.suspend().catch(()=>{});
 else if(!screen.hidden&&opt.enabled){ac.resume().catch(()=>{});tick();}
});
if(settings){
 const tile=document.createElement('section');
 tile.id='fwIntroAudioControls';tile.className='tileCard';
 tile.innerHTML='<b>🎵 タイトル・物語BGM</b><p class="note">タイトルは「はじまりの灯」、物語選択中は各地域のオリジナル仮BGMを再生します。タップすると切り替わります。</p><label><input id="fwIntroMusicOn" type="checkbox"> タイトル・物語BGMを流す</label><label for="fwIntroMusicVol">BGM音量 <output id="fwIntroMusicOutput"></output></label><input id="fwIntroMusicVol" type="range" min="0" max="100" step="5">';
 const theme=document.getElementById('fwTitleThemeCard');
 if(theme&&theme.parentElement===settings)theme.insertAdjacentElement('afterend',tile);
 else settings.appendChild(tile);
 const on=tile.querySelector('#fwIntroMusicOn'),vol=tile.querySelector('#fwIntroMusicVol'),out=tile.querySelector('#fwIntroMusicOutput');
 on.checked=opt.enabled;vol.value=opt.volume;out.textContent=opt.volume+'%';
 on.addEventListener('change',()=>{
  opt.enabled=on.checked;persist();
  if(!opt.enabled)stop();
  else if(entered)play();
 });
 vol.addEventListener('input',()=>{
  opt.volume=Number(vol.value);out.textContent=opt.volume+'%';persist();
  if(opt.volume<=0){stop();return;}
  if(mix&&ac)mix.gain.setTargetAtTime(opt.volume/100*.19,ac.currentTime,.09);
  else if(entered&&opt.enabled)play();
 });
}
})();
