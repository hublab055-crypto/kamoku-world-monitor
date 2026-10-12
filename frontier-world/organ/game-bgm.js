/* FW48.6 — user-controlled in-game BGM (melodies and recorded audio).
 * No autoplay and no network transfer. Scores: original Web Audio synth.
 * Mic recordings: on-device IndexedDB blobs played by native <audio>.
 */
(function(global){
'use strict';
function install(host){
 const INST=global.FW_INSTRUMENTS,lib=global.FW_AUDIO_LIBRARY;
 if(!INST)throw Error('楽器音源がありません。');
 const DEMO={id:'priest-demo',title:'朝の祈り',author:'司祭エリアス',bpm:88,instrument:'organ',notes:[
 {pitch:60,start:0,duration:1},{pitch:64,start:1,duration:1},{pitch:67,start:2,duration:2},
 {pitch:65,start:4,duration:1},{pitch:64,start:5,duration:1},{pitch:62,start:6,duration:2},
 {pitch:60,start:8,duration:1},{pitch:62,start:9,duration:1},{pitch:64,start:10,duration:1},
 {pitch:67,start:11,duration:1},{pitch:65,start:12,duration:2},{pitch:60,start:14,duration:2}
 ]};
 const valid=global.FW_PriestMusic49&&global.FW_PriestMusic49.safeScore;
 const el=(tag,cls,text)=>{
  const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;
 };
 const prefs=()=>{
  const state=host.getState();
  if(!state.bgm49||typeof state.bgm49!=='object'){
   let stored={};try{stored=JSON.parse(localStorage.getItem('fw_frontier_bgm_v1')||'{}')||{};}catch(e){}
   state.bgm49={trackId:stored.trackId||'priest-demo',volume:stored.volume??35,loop:stored.loop!==false};
  }
  state.bgm49.volume=Math.max(0,Math.min(100,Number(state.bgm49.volume)||0));
  return state.bgm49;
 };
 const persist=()=>{try{const p=prefs();localStorage.setItem('fw_frontier_bgm_v1',JSON.stringify({trackId:p.trackId,volume:p.volume,loop:p.loop}));}catch(e){}};
 const scores=()=>{
  const originals=[DEMO,...(Array.isArray(global.FW_ORGAN_PD)?global.FW_ORGAN_PD:[])];
  let saved=[];
  try{
   const raw=JSON.parse(localStorage.getItem('fw_frontier_organ_scores_v1')||'[]');
   if(Array.isArray(raw))saved=raw.slice(0,80);
  }catch(e){}
  const state=host.getState();
  const fromGame=state.priestOrgan49&&Array.isArray(state.priestOrgan49.scores)?state.priestOrgan49.scores:[];
  const seen=new Set();
  return [...originals,...fromGame,...saved].map(s=>valid?valid(s):s).filter(s=>{
   if(!s||!Array.isArray(s.notes)||!s.notes.length||seen.has(s.id))return false;
   seen.add(s.id);return true;
  });
 };
 let ctx=null,bus=null,generation=0,timeout=null,voices=[],playing=false,voiceList=[],audioUrl=null,preparedId=null;
 const trigger=el('button','smallBtn','🎶 BGM');
 trigger.type='button';
 trigger.style.cssText='position:absolute;bottom:9px;right:9px;z-index:18;background:#294e52;color:white;border:1px solid #b3c9b6;padding:6px 10px;border-radius:9px;font-size:13px;';
 const panel=el('div','','');
 panel.id='fwBgm49Panel';
 panel.style.cssText='position:fixed;bottom:12px;right:12px;z-index:15910;width:min(360px,calc(100vw - 24px));max-height:72vh;overflow:auto;background:#172c32;color:#f7f4e2;border:1px solid #99ada9;box-shadow:0 7px 45px #000b;padding:14px;border-radius:14px;display:none;font:14px system-ui;';
 const title=el('strong','','🎶 ゲームBGM');title.style.fontSize='17px';panel.appendChild(title);
 const close=el('button','smallBtn','✕');close.type='button';close.style.cssText='float:right;';close.onclick=()=>{panel.style.display='none';};panel.appendChild(close);
 const intro=el('p','','曲と録音データから選択できます。再生には▶を押してください。iPhoneでは自動再生しません。');intro.style.cssText='font-size:12px;line-height:1.5;';panel.appendChild(intro);
 const pick=el('select');pick.id='fwBgm49Select';pick.setAttribute('aria-label','BGMの曲を選択');
 pick.style.cssText='width:100%;padding:9px;margin:7px 0;background:#17323b;color:white;border:1px solid #a0b9bd;border-radius:8px;font:inherit;';
 panel.appendChild(pick);
 const buttons=el('div');buttons.style.cssText='display:flex;flex-wrap:wrap;gap:7px;margin:8px 0;';
 const playBtn=el('button','smallBtn','▶ 再生'),stopBtn=el('button','smallBtn','■ 停止'),reloadBtn=el('button','smallBtn','⟳ 曲更新');
 [playBtn,stopBtn,reloadBtn].forEach(b=>{b.type='button';b.style.cssText='padding:9px;';buttons.appendChild(b);});panel.appendChild(buttons);
 const volRow=el('label','','音量 ');volRow.style.cssText='display:flex;align-items:center;gap:10px;';
 const slider=el('input');slider.type='range';slider.min='0';slider.max='100';slider.step='5';slider.style.flex='1';const volText=el('span','','35%');
 volRow.appendChild(slider);volRow.appendChild(volText);panel.appendChild(volRow);
 const loopLabel=el('label');loopLabel.style.cssText='display:flex;align-items:center;gap:7px;margin-top:9px;';
 const loop=el('input');loop.type='checkbox';loopLabel.appendChild(loop);loopLabel.appendChild(document.createTextNode('🔁 繰り返し再生'));panel.appendChild(loopLabel);
 const note=el('p','','');note.style.cssText='font-size:12px;min-height:30px;color:#b9e6d6;';note.setAttribute('role','status');panel.appendChild(note);
 const audio=el('audio');audio.preload='metadata';audio.style.display='none';audio.addEventListener('ended',()=>{if(!prefs().loop){playing=false;status('再生が終了しました。');updateLabel();}});panel.appendChild(audio);
 host.root.appendChild(trigger);document.body.appendChild(panel);
 function status(t){note.textContent=t;}
 function updateLabel(){trigger.textContent=playing?'🎶 BGM ●':'🎶 BGM';}
 function updateVolume(){
  const p=prefs(),v=p.volume/100;
  volText.textContent=Math.round(p.volume)+'%';slider.value=String(p.volume);
  if(bus&&ctx)bus.gain.setTargetAtTime(v*.75,ctx.currentTime,.025);
  audio.volume=v;
 }
 function stop(){
  generation++;if(timeout)clearTimeout(timeout);timeout=null;
  if(ctx){voices.forEach(v=>INST.kill(ctx,v));}
  voices=[];audio.pause();
  try{audio.currentTime=0;}catch(e){}
  playing=false;updateLabel();
 }
 function cleanupAudioUrl(){
  audio.pause();audio.removeAttribute('src');audio.load();if(audioUrl){URL.revokeObjectURL(audioUrl);audioUrl=null;}
  preparedId=null;
 }
 async function prepareVoice(id){
  cleanupAudioUrl();
  if(!lib){status('録音ライブラリがありません。');return;}
  status('録音データを読み込んでいます…');
  try{
   const x=await lib.get(id.slice(6));
   if(pick.value!==id||!x||!x.blob)return;
   audioUrl=URL.createObjectURL(x.blob);audio.src=audioUrl;audio.loop=!!prefs().loop;audio.volume=prefs().volume/100;preparedId=id;
   status('🎙️ 「'+x.title+'」準備完了。▶ 再生でBGMを開始できます。');
  }catch(e){status('録音データを読み込めませんでした。');}
 }
 function fill(){
  const selected=prefs().trackId;
  pick.replaceChildren();
  const createOption=(id,t)=>{const o=el('option');o.value=id;o.textContent=t;pick.appendChild(o);};
  scores().forEach(s=>createOption(s.id,'🎼 '+s.title+' / '+INST.label(s.instrument)));
  voiceList.forEach(s=>createOption('voice:'+s.id,'🎙️ '+s.title));
  if([...pick.options].some(o=>o.value===selected))pick.value=selected;
  else{pick.value='priest-demo';prefs().trackId='priest-demo';persist();}
  if(pick.value.startsWith('voice:'))prepareVoice(pick.value);else{cleanupAudioUrl();status('曲を選び、▶ 再生を押してください。');}
 }
 async function refresh(){
  if(lib){try{voiceList=await lib.list();}catch(e){voiceList=[];}}
  fill();
 }
 function playScore(s){
  const Audio=global.AudioContext||global.webkitAudioContext;
  if(!Audio){status('ブラウザが音源に対応していません。');return false;}
  ctx=ctx||new Audio();bus=bus||ctx.createGain();if(!bus.__fwBgmAttached){bus.connect(ctx.destination);bus.__fwBgmAttached=true;}
  updateVolume();
  if(ctx.state==='suspended'){const p=ctx.resume();if(p&&typeof p.catch==='function')p.catch(()=>status('音声の許可が必要です。もう一度再生を押してください。'));}
  const token=generation,seconds=60/s.bpm,end=Math.max(...s.notes.map(n=>n.start+n.duration))*seconds;
  function cycle(){
   if(token!==generation)return;
   if(ctx)voices.forEach(v=>INST.kill(ctx,v));voices=[];
   const at=ctx.currentTime+.06;
   for(const n of s.notes){
    const v=INST.start(ctx,n.pitch,s.instrument,at+n.start*seconds,.55,bus);
    if(v){voices.push(v);INST.release(ctx,v,at+(n.start+n.duration)*seconds);}
   }
   timeout=setTimeout(()=>{
    if(token!==generation)return;
    if(prefs().loop)cycle();
    else{voices=[];timeout=null;playing=false;updateLabel();status('再生が終了しました。');}
   },Math.max(150,Math.ceil((end+.13)*1000)));
  }
  cycle();return true;
 }
 function play(){
  stop();
  const selected=pick.value;
  if(!selected){status('曲を選択してください。');return;}
  prefs().trackId=selected;persist();
  if(selected.startsWith('voice:')){
   if(preparedId!==selected){prepareVoice(selected);status('録音データを準備しています。準備完了後にもう一度▶を押してください。');return;}
   audio.loop=!!prefs().loop;audio.volume=prefs().volume/100;
   const result=audio.play();if(result&&typeof result.catch==='function')result.catch(()=>{status('録音の再生を開始できませんでした。もう一度▶を押してください。');playing=false;updateLabel();});
   playing=true;updateLabel();status('🎙️ 録音した音声をBGMで再生中');return;
  }
  const song=scores().find(s=>s.id===selected);
  if(!song){status('楽譜が見つかりません。曲一覧を更新してください。');return;}
  if(playScore(song)){playing=true;updateLabel();status('🎼 「'+song.title+'」をBGMとして再生中');}
 }
 pick.addEventListener('change',()=>{
  stop();prefs().trackId=pick.value;persist();
  if(pick.value.startsWith('voice:'))prepareVoice(pick.value);else{cleanupAudioUrl();status('▶ 再生でBGMを開始できます。');}
 });
 slider.addEventListener('input',()=>{prefs().volume=Number(slider.value);updateVolume();persist();});
 loop.addEventListener('change',()=>{prefs().loop=loop.checked;audio.loop=loop.checked;persist();});
 playBtn.onclick=play;stopBtn.onclick=()=>{stop();status('BGMを停止しました。');};reloadBtn.onclick=refresh;
 trigger.onclick=()=>{
  panel.style.display=panel.style.display==='none'?'block':'none';
  if(panel.style.display==='block')refresh();
 };
 function sync(){
  stop();const p=prefs();loop.checked=!!p.loop;updateVolume();refresh();
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 global.addEventListener('pagehide',()=>{stop();cleanupAudioUrl();});
 loop.checked=!!prefs().loop;updateVolume();refresh();
 return {stop,play,refresh,sync,get playing(){return playing;}};
}
global.FW_GAME_BGM49={install};
})(window);