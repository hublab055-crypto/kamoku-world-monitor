/* FRONTIER_V52_1_TITLE */
(function(){
'use strict';
const root=document.getElementById('app'),overlay=document.getElementById('fwTitleOverlay');
if(!root||!overlay)return;
const main=document.getElementById('fwTitleMain'),saves=document.getElementById('fwTitleSaves');
const list=document.getElementById('fwTitleSaveList'),notice=document.getElementById('fwTitleNotice');
const buttons=Array.from(main.querySelectorAll('[data-fw-title-choice]'));
const settingsPanel=document.getElementById('settingsPanel'),settingsClose=document.getElementById('closeSettings');
let selected=0,pending=null;
function read(key){try{return localStorage.getItem(key);}catch(_){return null;}}
function saved(slot){
 const key=slot==='autosave'?'frontier_world_save_v19_autosave':'frontier_world_save_v19_slot_'+slot;
 const raw=read(key)||(slot===1?read('frontier_world_save_v10'):null);
 if(!raw)return null;
 try{
  const env=JSON.parse(raw),data=env&&typeof env.body==='string'?JSON.parse(env.body):env;
  if(!data||!data.state)throw Error('invalid');
  return {slot:slot,at:Number(data.savedAt)||0,day:data.state.day,who:data.state.player&&data.state.player.name||'YOU'};
 }catch(_){return {slot:slot,at:0,broken:true};}
}
function allSaves(){return ['autosave',1,2,3,4,5].map(saved).filter(Boolean).sort(function(a,b){return b.at-a.at;});}
function status(t){notice.textContent=t||'';}
function select(i){selected=(i+buttons.length)%buttons.length;buttons.forEach(function(b,j){b.setAttribute('aria-current',j===selected?'true':'false');});}
function showMain(){
 pending=null;main.hidden=false;saves.hidden=true;root.classList.remove('fw-title-settings-open');
 status('');select(selected);buttons[selected].focus({preventScroll:true});
}
function showSaves(){
 const entries=allSaves();
 if(!entries.length){status('セーブデータがありません。「はじめから」を選んでください。');return;}
 list.replaceChildren();
 entries.forEach(function(entry){
  const b=document.createElement('button');b.type='button';b.className='fw-title-save';
  const name=document.createElement('strong'),detail=document.createElement('small');
  name.textContent=entry.slot==='autosave'?'オートセーブ':'スロット '+entry.slot;
  const date=entry.at?new Date(entry.at).toLocaleString('ja-JP'):'日時不明';
  detail.textContent=entry.broken?'⚠️ 保存形式を確認できません':
    'Day '+String(entry.day==null?'?':entry.day)+' / '+String(entry.who)+' / '+date;
  b.append(name,detail);b.addEventListener('click',function(){activate(entry.slot);});list.appendChild(b);
 });
 status('');main.hidden=true;saves.hidden=false;
 const first=list.querySelector('button');if(first)first.focus({preventScroll:true});
}
function activate(slot){
 if(!window.__fwTitleGameReady){pending=slot===null?'new':slot;status('ゲームを読み込んでいます…');return;}
 if(slot===null){
  if(allSaves().length&&!window.confirm('新しい冒険を始めますか？\n既存の手動セーブは残りますが、オートセーブは新しい冒険で更新されます。'))return;
 }else{
  const bridge=window.__fwFrontierBridge;
  if(!bridge||typeof bridge.fw10LoadGame!=='function'||bridge.fw10LoadGame(slot)!==true){
   status('この保存データを読み込めませんでした。別のセーブを選んでください。');return;
  }
 }
 pending=null;root.classList.remove('fw-title-settings-open');
 if(settingsPanel)settingsPanel.classList.add('hidden');
 overlay.hidden=true;status('');root.focus({preventScroll:true});
}
function showSettings(){
 if(!settingsPanel)return;
 root.classList.add('fw-title-settings-open');
 const opener=document.getElementById('settings');if(opener)opener.click();
 if(settingsClose)settingsClose.focus({preventScroll:true});
}
buttons.forEach(function(b,i){
 b.addEventListener('focus',function(){select(i);});
 b.addEventListener('click',function(){
  select(i);
  const choice=b.dataset.fwTitleChoice;
  if(choice==='new')activate(null);
  if(choice==='continue')showSaves();
  if(choice==='settings')showSettings();
 });
});
document.getElementById('fwTitleBack').addEventListener('click',showMain);
if(settingsClose)settingsClose.addEventListener('click',function(){
 if(!overlay.hidden){root.classList.remove('fw-title-settings-open');buttons[selected].focus({preventScroll:true});}
});
document.addEventListener('keydown',function(e){
 if(overlay.hidden)return;
 if(root.classList.contains('fw-title-settings-open')){
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(settingsClose)settingsClose.click();}
  return;
 }
 if(e.key==='Escape'&&!saves.hidden){e.preventDefault();e.stopImmediatePropagation();showMain();return;}
 if(!saves.hidden)return;
 if(e.key==='ArrowUp'||e.key==='ArrowDown'){
  e.preventDefault();e.stopImmediatePropagation();select(selected+(e.key==='ArrowDown'?1:-1));buttons[selected].focus({preventScroll:true});
 }else if((e.key==='Enter'||e.key===' ')&&e.target.tagName!=='BUTTON'){
  e.preventDefault();e.stopImmediatePropagation();buttons[selected].click();
 }
},true);
window.addEventListener('fw-title-ready',function(){
 if(pending!==null&&!overlay.hidden){const choice=pending;pending=null;activate(choice==='new'?null:choice);}
});
select(0);
})();