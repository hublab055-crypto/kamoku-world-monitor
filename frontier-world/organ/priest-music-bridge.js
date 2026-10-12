/* Frontier World FW48.3 — Priest organ repertoire and ceremony music.
 * Loaded after public-domain-catalog.js, before the game's second inline IIFE.
 * install() accepts live game callbacks, retaining original game save and UI flows.
 */
(function(global){
'use strict';
const KEY='fw_frontier_priest_scores_v1';
const DEMO={id:'priest-demo',title:'朝の祈り',author:'司祭エリアス',bpm:88,notes:[
 {pitch:60,start:0,duration:1},{pitch:64,start:1,duration:1},{pitch:67,start:2,duration:2},
 {pitch:65,start:4,duration:1},{pitch:64,start:5,duration:1},{pitch:62,start:6,duration:2},
 {pitch:60,start:8,duration:1},{pitch:62,start:9,duration:1},{pitch:64,start:10,duration:1},
 {pitch:67,start:11,duration:1},{pitch:65,start:12,duration:2},{pitch:60,start:14,duration:2}
]};
const PD=Array.isArray(global.FW_ORGAN_PD)?global.FW_ORGAN_PD:[];
function safeScore(s){
 if(!s||typeof s!=='object')return null;
 const title=String(s.title||'').trim().slice(0,60),id=String(s.id||'').slice(0,90);
 if(!title||!id||!Array.isArray(s.notes))return null;
 const notes=s.notes.slice(0,512).filter(n=>n&&Number.isFinite(n.pitch)&&n.pitch>=60&&n.pitch<=84&&Number.isFinite(n.start)&&n.start>=0&&n.start<2000&&Number.isFinite(n.duration)&&n.duration>0&&n.duration<=100).map(n=>({pitch:Math.round(n.pitch),start:n.start,duration:n.duration}));
 if(!notes.length)return null;
 return {id,title,author:String(s.author||'プレイヤー').slice(0,50),bpm:Math.max(40,Math.min(220,Math.round(Number(s.bpm)||100))),notes};
}
function savedLocal(){
 try{
  const list=JSON.parse(localStorage.getItem(KEY)||'[]');
  return Array.isArray(list)?list.slice(0,24).map(safeScore).filter(Boolean):[];
 }catch(e){return [];}
}
function writeLocal(scores){
 try{localStorage.setItem(KEY,JSON.stringify(scores.slice(0,24)));}catch(e){}
}
function install(host){
 const getState=host.getState,notify=host.notify;
 let audio=null,playTimers=[],activeVoices=[];
 let lastValidatedStore=null; // Avoid revalidating a full song library every NPC frame.
 const getStore=()=>{
  const state=getState();
  if(!state.priestOrgan49||typeof state.priestOrgan49!=='object')
   state.priestOrgan49={learned:['priest-demo'],scores:[],weddingId:'priest-demo',festivalId:'priest-demo',lastCollectionDay:null};
  const x=state.priestOrgan49;
  if(x===lastValidatedStore)return x;
  lastValidatedStore=x;
  if(!Array.isArray(x.learned))x.learned=['priest-demo'];
  if(!Array.isArray(x.scores))x.scores=[];
  x.learned=x.learned.filter(id=>typeof id==='string'&&id.length<100).slice(0,25);
  if(!x.learned.includes('priest-demo'))x.learned.unshift('priest-demo');
  x.scores=x.scores.slice(0,24).map(safeScore).filter(Boolean);
  return x;
 };
 const sourceScores=()=>[DEMO,...PD];
 const available=()=>{
  const store=getStore(),pool=[...sourceScores(),...store.scores];
  return store.learned.map(id=>pool.find(s=>s.id===id)).filter(Boolean);
 };
 function remember(raw,quiet){
  const s=safeScore(raw);if(!s)return false;
  const store=getStore();
  const builtIn=sourceScores().some(x=>x.id===s.id);
  if(!builtIn){
   store.scores=[s,...store.scores.filter(x=>x.id!==s.id)].slice(0,24);
  }
  if(!store.learned.includes(s.id))store.learned.push(s.id);
  store.learned=store.learned.slice(0,25);
  if(!quiet)notify('🎼 司祭エリアスが「'+s.title+'」を覚えた。');
  writeLocal(available().filter(x=>x.id!=='priest-demo'));
  return true;
 }
 function mergeFromLocal(){
  const st=getStore();
  savedLocal().forEach(s=>{
   if(st.learned.includes(s.id)&&sourceScores().some(x=>x.id===s.id))return;
   remember(s,true);
  });
 }
 function choose(day){
  const list=available();return list.length?list[(Math.max(0,Math.floor(Number(day)||0)))%list.length]:DEMO;
 }
 function teachNpc(npc,s){
  const song=safeScore(s);
  if(!npc||!song||npc.alive===false||npc.id==='priest43')return;
  if(!available().some(v=>v.id===song.id)){notify('まず司祭に曲を教えてください。');return;}
  npc.music49=npc.music49||{learned:[],skill:0};
  if(!Array.isArray(npc.music49.learned))npc.music49.learned=[];
  if(!npc.music49.learned.includes(song.id)){
   npc.music49.learned.push(song.id);
   npc.music49.learned=npc.music49.learned.slice(-24);
   npc.music49.skill=Math.min(100,(Number(npc.music49.skill)||0)+5);
  }
  npc.status='🎼 「'+song.title+'」を習得';
  notify('🎓 '+npc.name+'が「'+song.title+'」を覚えた。');
 }
 function scheduled(n){
  if(!n||n.alive===false)return;
  if(n.id==='priest43'&&n.organPlaying48){
   const song=choose(getState().day);
   n.organPiece49=song.title;
   n.status='🎼 「'+song.title+'」をオルガンで練習中';
  }
  const scene=getState().ceremony;
  if(scene&&scene.timer>0&&getState().ceremonyMusic49&&
     getState().ceremonyMusic49.day===getState().day&&
     getState().ceremonyMusic49.performerId===n.id){
   n.status='🎶 「'+getState().ceremonyMusic49.title+'」を演奏中';
  }
 }
 function collect(){
  const state=getState(),st=getStore();
  if(st.lastCollectionDay===state.day){notify('📚 今日の楽譜探しは済んでいます。また明日。');return;}
  const unlearned=PD.filter(s=>!st.learned.includes(s.id));
  if(!unlearned.length){notify('📚 公開練習譜はすべて集めました。自作曲も教えられます。');return;}
  const picked=unlearned[(Math.max(0,Math.floor(state.day||0)))%unlearned.length];
  st.lastCollectionDay=state.day;
  remember(picked);
  if(typeof host.recordChronicle==='function')host.recordChronicle('music','司祭が楽譜「'+picked.title+'」を収集');
 }
 function stop(){
  playTimers.forEach(t=>clearTimeout(t));playTimers=[];
  const now=audio?audio.currentTime:0;
  activeVoices.forEach(v=>{
   try{v.g.gain.cancelScheduledValues(now);v.g.gain.setTargetAtTime(.0001,now,.03);v.os.forEach(o=>o.stop(now+.15));}catch(e){}
  });
  activeVoices=[];
 }
 function play(score,announce){
  const s=safeScore(score);
  if(!s)return false;
  stop();
  try{
   const Audio=global.AudioContext||global.webkitAudioContext;
   if(!Audio){notify('🔇 このブラウザは音楽再生に対応していません。');return false;}
   audio=audio||new Audio();
   if(audio.state==='suspended')audio.resume().catch(()=>{});
   // Schedule audio with the AudioContext clock rather than numerous note-on
   // timeouts; important for Safari background throttle and polyphony.
   const origin=audio.currentTime+.05,seconds=60/s.bpm;
   s.notes.forEach(n=>{
    const st=origin+n.start*seconds,et=origin+(n.start+n.duration)*seconds;
    const g=audio.createGain();
    const amplitude=.095/Math.max(1,Math.sqrt(s.notes.length/20));
    g.gain.setValueAtTime(.0001,st);
    g.gain.exponentialRampToValueAtTime(Math.max(.001,amplitude),st+.024);
    g.gain.setTargetAtTime(.0001,et,.035);
    g.connect(audio.destination);
    const os=[1,2,4].map((mul,i)=>{
     const o=audio.createOscillator(),level=audio.createGain();
     o.type=i===0?'triangle':'sine';
     o.frequency.value=440*Math.pow(2,(n.pitch-69)/12)*mul;
     level.gain.value=[.67,.23,.10][i];
     o.connect(level);level.connect(g);
     o.start(st);o.stop(et+.24);return o;
    });
    activeVoices.push({g,os});
   });
   const end=Math.max(...s.notes.map(n=>n.start+n.duration))*seconds;
   playTimers.push(setTimeout(()=>{activeVoices=[];playTimers=[];},(end+.5)*1000));
   if(announce)notify('🎹 司祭エリアスが「'+s.title+'」を演奏中');
   return true;
  }catch(e){stop();notify('🔇 音声の再生に失敗しました。もう一度「▶ 演奏」を押してください。');return false;}
 }
 function onCeremony(type){
  if(type!=='wedding'&&type!=='festival')return;
  const st=getStore(),songs=available();
  const requested=type==='wedding'?st.weddingId:st.festivalId;
  const s=songs.find(x=>x.id===requested)||songs[0]||DEMO;
  const players=getState().npcs.filter(n=>n.alive!==false&&n.id!=='priest43'&&n.music49&&Array.isArray(n.music49.learned)&&n.music49.learned.includes(s.id));
  const performer=players.length?players[Math.floor((Number(getState().day)||0)%players.length)]:null;
  const record=getState().ceremonies;
  if(Array.isArray(record)&&record.length){
   const entry=record[record.length-1];
   if(entry&&entry.type===type){entry.musicTitle49=s.title;entry.musicId49=s.id;entry.musician49=performer?performer.id:'priest43';}
  }
  getState().ceremonyMusic49={type,title:s.title,day:getState().day,performerId:performer?performer.id:'priest43'};
  play(s,false); // User-initiated ceremonies may unlock audio; simulation cannot force mobile autoplay.
  notify('🎶 '+(type==='wedding'?'結婚式':'村祭り')+'：'+(performer?performer.name:'司祭エリアス')+'が「'+s.title+'」を演奏（音が出ない場合は演奏ボタンを押してください）');
 }
 function render(){
  const st=getStore(),songs=available();
  const panel=document.getElementById('panel'),title=document.getElementById('panelTitle'),root=document.getElementById('panelBody');
  if(!panel||!title||!root)return;
  panel.classList.remove('hidden');title.textContent='⛪ 司祭エリアスの音楽室';root.replaceChildren();
  const lead=document.createElement('div');lead.className='tileCard';
  lead.textContent='覚えた曲 '+songs.length+'曲。昼12:35〜13:45はコモンハウスで練習します。行事の曲は曲ごとに設定できます。';root.appendChild(lead);
  function button(parent,label,fn){const b=document.createElement('button');b.className='smallBtn';b.type='button';b.textContent=label;b.addEventListener('click',fn);parent.appendChild(b);parent.appendChild(document.createTextNode(' '));}
  const tools=document.createElement('div');tools.className='tileCard';
  button(tools,'🔎 楽譜を探してもらう（1日1回）',()=>{collect();render();});
  button(tools,'🎹 オルガン・作曲・楽譜庫',()=>host.openOrgan(true));
  button(tools,'■ 演奏を停止',stop);
  root.appendChild(tools);
  const learners=getState().npcs.filter(n=>n.alive!==false&&n.id!=='priest43');
  let chosen=null;
  if(learners.length){
   const box=document.createElement('div');box.className='tileCard';
   const note=document.createElement('div');note.textContent='🎓 村人に演奏を教える（司祭が覚えた曲のみ）';box.appendChild(note);
   const select=document.createElement('select');select.setAttribute('aria-label','楽曲を教えるNPC');
   learners.forEach(n=>{
    const o=document.createElement('option');o.value=n.id;o.textContent=n.name+'（'+(n.music49&&Array.isArray(n.music49.learned)?n.music49.learned.length:0)+'曲習得）';select.appendChild(o);
   });
   select.value=getStore().studentId&&learners.some(n=>n.id===getStore().studentId)?getStore().studentId:learners[0].id;
   chosen=select;
   select.addEventListener('change',()=>getStore().studentId=select.value);
   box.appendChild(select);root.appendChild(box);
  }
  songs.forEach(s=>{
   const row=document.createElement('div');row.className='tileCard';
   const name=document.createElement('b');name.textContent='🎼 '+s.title;row.appendChild(name);row.appendChild(document.createElement('br'));
   const meta=document.createElement('span');meta.className='note';meta.textContent=s.author+' / '+s.notes.length+'音';
   row.appendChild(meta);row.appendChild(document.createElement('br'));
   button(row,'▶ 演奏',()=>play(s,true));
   if(chosen)button(row,'🎓 選択した村人に教える',()=>{const npc=getState().npcs.find(n=>n.id===chosen.value);teachNpc(npc,s);render();});
   button(row,'💒 婚礼曲に指定',()=>{st.weddingId=s.id;notify('💒 結婚式の曲を「'+s.title+'」に指定した。');render();});
   button(row,'🎉 祭り曲に指定',()=>{st.festivalId=s.id;notify('🎉 村祭りの曲を「'+s.title+'」に指定した。');render();});
   const badge=document.createElement('div');badge.className='note';
   badge.textContent=(st.weddingId===s.id?'💒 婚礼曲　':'')+(st.festivalId===s.id?'🎉 祭り曲':'');row.appendChild(badge);
   root.appendChild(row);
  });
  const remaining=PD.filter(s=>!st.learned.includes(s.id));
  if(remaining.length){
   const label=document.createElement('h3');label.textContent='まだ覚えていない楽譜';root.appendChild(label);
   remaining.forEach(s=>{
    const row=document.createElement('div');row.className='tileCard';
    const name=document.createElement('span');name.textContent=s.title+' ';row.appendChild(name);
    button(row,'📖 司祭に教える',()=>{remember(s);render();});
    root.appendChild(row);
   });
  }
 }
 // Only accept messages sent by the current game-owned same-origin iframe.
 global.addEventListener('message',e=>{
  if(e.origin!==global.location.origin||!e.data||e.data.type!=='frontier:organ:teach')return;
  const overlay=host.getOverlay(),iframe=overlay&&overlay.querySelector('iframe');
  if(!iframe||iframe.contentWindow!==e.source)return;
  if(remember(e.data.score))renderIfOpen();
 });
 function renderIfOpen(){const title=document.getElementById('panelTitle');if(title&&title.textContent==='⛪ 司祭エリアスの音楽室')render();}
 function sendToOrgan(){
  const overlay=host.getOverlay(),frame=overlay&&overlay.querySelector('iframe');
  if(!frame||!frame.contentWindow)return;
  frame.contentWindow.postMessage({type:'frontier:organ:learned',scores:available()},global.location.origin);
 }
 function attachFrameSync(){
  const overlay=host.getOverlay(),frame=overlay&&overlay.querySelector('iframe');
  if(frame&&!frame.dataset.fw49MusicSync){
   frame.dataset.fw49MusicSync='1';
   frame.addEventListener('load',sendToOrgan);
  }
 }
 mergeFromLocal();
 return {getStore,remember,mergeFromLocal,teachNpc,collect,choose,scheduled,play,stop,onCeremony,render,sendToOrgan,attachFrameSync};
}
global.FW_PriestMusic49={install,safeScore};
})(window);
