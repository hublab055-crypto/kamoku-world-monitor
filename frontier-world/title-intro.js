/* FW52.4 Intro, title signpost and accessible gesture-start BGM. */
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
let opt={enabled:true,volume:40},ac=null,mix=null,clock=null,next=0,bar=0,entered=false;
try{const obj=JSON.parse(localStorage.getItem(storeKey)||'null');if(obj&&typeof obj==='object'){opt.enabled=obj.enabled!==false;opt.volume=Math.max(0,Math.min(100,Number(obj.volume)||0));}}catch(_){}
const persist=()=>{try{localStorage.setItem(storeKey,JSON.stringify(opt));}catch(_){}};
function note(p,t,len,loud,kind){
 if(!ac||!mix)return;
 const o=ac.createOscillator(),g=ac.createGain();
 o.type=kind||'sine';o.frequency.value=440*Math.pow(2,(p-69)/12);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(loud,t+(kind==='triangle'?.12:.025));
 g.gain.exponentialRampToValueAtTime(.0001,t+len);o.connect(g);g.connect(mix);o.start(t);o.stop(t+len+.02);
}
const music=[
 {b:48,c:[60,64,67],m:[72,74,76,79]},
 {b:45,c:[57,60,64],m:[76,74,72,69]},
 {b:41,c:[53,57,60],m:[69,72,76,72]},
 {b:43,c:[55,59,62],m:[74,71,69,67]}
];
const beat=60/84;
function tick(){
 if(!ac||screen.hidden)return;
 while(next<ac.currentTime+1.1){
  const v=music[bar%4];note(v.b,next,beat*3.8,.09,'triangle');
  v.c.forEach(n=>note(n,next,beat*3.5,.034,'triangle'));
  v.m.forEach((n,i)=>note(n,next+i*beat,beat*.7,.047,'sine'));
  next+=beat*4;bar++;
 }
}
function stop(){
 if(clock!==null){clearInterval(clock);clock=null;}
 const c=ac;ac=null;mix=null;
 if(c)try{c.close().catch(()=>{});}catch(_){}
}
function play(){
 if(!opt.enabled||opt.volume<=0||screen.hidden)return;
 if(ac){ac.resume().catch(()=>{});return;}
 const Audio=window.AudioContext||window.webkitAudioContext;
 if(!Audio)return;
 try{
  ac=new Audio();mix=ac.createGain();mix.gain.value=opt.volume/100*.19;mix.connect(ac.destination);
  const now=ac.currentTime+.05;[72,76,79,84].forEach((n,i)=>note(n,now+i*.16,.6,.09,'sine'));
  next=now+1.5;bar=0;clock=setInterval(tick,140);tick();ac.resume().catch(()=>{});
 }catch(_){stop();}
}
function enter(){
 if(entered)return;entered=true;play();splash.classList.add('fw-splash-out');button.disabled=true;
 const done=()=>{splash.hidden=true;splash.setAttribute('aria-hidden','true');screen.querySelector('[data-fw-title-choice="new"]')?.focus({preventScroll:true});};
 if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)done();else setTimeout(done,650);
}
button.addEventListener('click',enter);
splash.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();button.click();}});
const watch=new MutationObserver(()=>{if(screen.hidden){stop();watch.disconnect();}});
watch.observe(screen,{attributes:true,attributeFilter:['hidden']});
window.addEventListener('pagehide',stop);
document.addEventListener('visibilitychange',()=>{if(!ac)return;if(document.hidden)ac.suspend().catch(()=>{});else if(!screen.hidden&&opt.enabled)ac.resume().catch(()=>{});});
if(settings){
 const tile=document.createElement('section');tile.id='fwIntroAudioControls';tile.className='tileCard';
 tile.innerHTML='<b>🎵 タイトルBGM</b><p class="note">最初のタップで「はじまりの灯」をイメージした仮の合成音楽を再生します。</p><label><input id="fwIntroMusicOn" type="checkbox"> タイトル音楽を流す</label><label for="fwIntroMusicVol">タイトル音量 <output id="fwIntroMusicOutput"></output></label><input id="fwIntroMusicVol" type="range" min="0" max="100" step="5">';
 const theme=document.getElementById('fwTitleThemeCard');
 if(theme&&theme.parentElement===settings)theme.insertAdjacentElement('afterend',tile);else settings.appendChild(tile);
 const on=tile.querySelector('#fwIntroMusicOn'),vol=tile.querySelector('#fwIntroMusicVol'),out=tile.querySelector('#fwIntroMusicOutput');
 on.checked=opt.enabled;vol.value=opt.volume;out.textContent=opt.volume+'%';
 on.addEventListener('change',()=>{opt.enabled=on.checked;persist();if(!opt.enabled)stop();else if(entered)play();});
 vol.addEventListener('input',()=>{opt.volume=Number(vol.value);out.textContent=opt.volume+'%';persist();if(mix&&ac)mix.gain.setTargetAtTime(opt.volume/100*.19,ac.currentTime,.1);else if(entered&&opt.enabled)play();});
}
})();
