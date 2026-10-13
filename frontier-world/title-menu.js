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
/* FRONTIER_V52_2_TITLE_THEMES */
(function installTitleThemes(){
  'use strict';
  const overlay=document.getElementById('fwTitleOverlay'),panel=document.getElementById('settingsPanel');
  if(!overlay||!panel||overlay.dataset.fwThemesInstalled)return;
  overlay.dataset.fwThemesInstalled='1';
  const KEY='frontier_world_title_theme_v1';
  const themes=[
    {id:'a',name:'A案｜王道ファンタジー',brief:'青空と城下町、家族の冒険'},
    {id:'b',name:'B案｜幻想・神秘',brief:'星空と魔法、夜の村の団らん'},
    {id:'c',name:'C案｜冒険手帳',brief:'古地図と村人、家族の暮らし'}
  ];
  function house(x,y,scale,wall,roof){
    return `<g transform="translate(${x} ${y}) scale(${scale})"><rect x="-30" y="-9" width="60" height="60" rx="3" fill="${wall}" stroke="#503b31" stroke-width="2"/><path d="M-39-8L0-41 39-8Z" fill="${roof}" stroke="#503b31" stroke-width="2"/><path d="M-9 50V22H9V50" fill="#7b5138"/><rect x="-24" y="9" width="12" height="13" fill="#f8da96"/><rect x="13" y="9" width="12" height="13" fill="#f8da96"/></g>`;
  }
  function person(x,y,scale,clothes){
    return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="38" rx="14" ry="4" fill="#2c2020" opacity=".3"/><path d="M-10 11L-15 32Q0 39 15 32L10 11Z" fill="${clothes}" stroke="#543e36" stroke-width="2"/><path d="M-7 32V40M7 32V40" stroke="#3c3031" stroke-width="4"/><circle cy="0" r="11" fill="#e6b88d" stroke="#543e36" stroke-width="1.3"/><path d="M-11 0Q-13-14 0-16Q14-16 11 0Q2-5-3-8Q-6-2-11 0Z" fill="#584033"/><path d="M-12 16L-20 23M12 16L20 23" stroke="#e6b88d" stroke-width="5" stroke-linecap="round"/></g>`;
  }
  function pine(x,y,scale,green){
    return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 0V75" stroke="#6e4b31" stroke-width="9"/><path d="M0-62L-32 0H-19L-39 32H39L19 0H32Z" fill="${green}" stroke="#3d4d38" stroke-width="2"/></g>`;
  }
  function makeArt(id){
    const a=id==='a',b=id==='b',c=id==='c';
    const sky=a?['#60b1ef','#e8dba6']:b?['#08143f','#cf746e']:['#edd2a0','#ca9e69'];
    const mountain=a?'#85b7b6':b?'#32366e':'#977b58';
    const grass=a?'#629b5d':b?'#242b4d':'#be9768';
    const wall=b?'#544872':'#e4cda4',roof=b?'#262952':'#a86243';
    const stars=b?Array.from({length:55},(_,i)=>`<circle cx="${(i*37+11)%420}" cy="${(i*i*29+9)%190}" r="${i%7===0?2:1}" fill="#dce3ff" opacity="${.5+i%3*.16}"/>`).join(''):'';
    const castle=a?`<g transform="translate(285 130)" stroke="#4d5979" stroke-width="2"><rect x="-51" y="-17" width="97" height="104" fill="#f3e8cd"/><rect x="-9" y="-52" width="36" height="139" fill="#f3e8cd"/><path d="M-18-52L9-95 36-52Z" fill="#486bad"/><path d="M-63-17L-46-57-26-17Z" fill="#486bad"/><rect x="-4" y="-29" width="14" height="22" fill="#c3ddf2"/><path d="M-17 87V49H10V87" fill="#aa8d69"/></g>`:'';
    const float=b?`<path d="M187 154L278 140 373 150 339 176 266 185 224 174Z" fill="#25285b" stroke="#a5a7ee" stroke-width="2"/><path d="M258 184L277 226 293 184" fill="#444079"/><path d="M326 141V75" stroke="#745e83" stroke-width="9"/><path d="M325 85Q296 51 324 36Q358 23 378 61Q379 97 341 98Z" fill="#8d70c9" stroke="#e9b8ff" stroke-width="4"/><path d="M304 174L313 305" stroke="#b5d9ff" stroke-width="8" opacity=".3"/>`:'';
    const map=c?`<path d="M337 0Q279 65 345 119T316 222Q299 274 378 360" fill="none" stroke="#7c9b92" stroke-width="23" opacity=".68"/><path d="M337 0Q279 65 345 119T316 222Q299 274 378 360" fill="none" stroke="#567970" stroke-width="2" stroke-dasharray="4 8"/><g transform="translate(347 72)" stroke="#4d3925" fill="none" stroke-width="2"><circle r="41"/><circle r="30"/><path d="M-44 0H44M0-44V44M-30-30L30 30M30-30L-30 30"/><path d="M0-41L8 0 0 41-8 0Z" fill="#6b4730"/></g><text x="347" y="18" font-size="16" text-anchor="middle" fill="#493724">N</text><path d="M11 265Q109 212 174 262Q238 308 298 249" stroke="#78573d" stroke-width="3" stroke-dasharray="4 9" fill="none"/>`:'';
    const clouds=a?`<g fill="#ffffff" opacity=".77"><ellipse cx="65" cy="69" rx="65" ry="19"/><ellipse cx="125" cy="85" rx="50" ry="16"/><ellipse cx="312" cy="94" rx="56" ry="17"/></g>`:'';
    const constellations=b?`<path d="M24 59L66 34 100 68 154 25 208 69" stroke="#a8a1ff" stroke-width="1.5" fill="none" opacity=".5"/><circle cx="356" cy="56" r="17" fill="#f1eaf4"/>`:'';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 360"><defs><linearGradient id="sky" x2=".1" y2="1"><stop stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient><pattern id="grain" width="19" height="23" patternUnits="userSpaceOnUse"><path d="M2 6L7 8M16 17L11 15" stroke="#8b6647" stroke-width="1" opacity=".16"/></pattern></defs>
      <rect width="420" height="360" fill="url(#sky)"/>${c?'<rect width="420" height="360" fill="url(#grain)"/>':''}${stars}${constellations}${clouds}
      ${a?'<circle cx="348" cy="48" r="33" fill="#fff1cc" opacity=".65"/>':''}
      <path d="M0 208L69 95 129 178 189 98 265 191 315 93 420 178V308H0Z" fill="${mountain}" opacity="${c?'.66':'.75'}"/>
      <path d="M0 238L79 167 154 217 221 147 294 218 373 156 420 206V313H0Z" fill="${b?'#242b60':c?'#927653':'#538fa1'}" opacity=".85"/>
      ${castle}${float}${map}
      <path d="M0 270Q89 219 198 260Q301 218 420 253V360H0Z" fill="${grass}"/>
      ${house(63,230,.9,wall,roof)}${house(150,241,.75,wall,roof)}${house(351,235,.94,wall,roof)}
      ${pine(20,239,.54,c?'#778064':b?'#273457':'#497e47')}${pine(402,223,.66,c?'#737e60':b?'#253955':'#3d7648')}
      <path d="M177 360Q213 313 221 285Q257 269 286 267" stroke="${c?'#e8c492':b?'#64527a':'#dfd09b'}" stroke-width="32" fill="none" opacity=".75"/>
      ${person(113,301,.83,c?'#886b54':b?'#627eac':'#4976a2')}
      ${person(145,305,.84,c?'#a26c4c':b?'#a56f9b':'#d49162')}
      ${person(165,329,.52,c?'#bf835d':b?'#9dbf96':'#ba5946')}
      ${person(270,293,.65,c?'#65795d':b?'#9079b4':'#5e956e')}
      ${person(320,310,.55,c?'#9b6947':b?'#6377a5':'#aa7a61')}
      <path d="M22 345Q75 328 117 341" fill="none" stroke="${c?'#80583d':'#a68a69'}" stroke-width="3"/>
      </svg>`;
  }
  // Official 800x600 rendered artwork; SVG only if AVIF fails to load.
  const urls=Object.fromEntries(themes.map(t=>[t.id,'./title-art/title-'+t.id+'.avif?v=52.3']));
  const fallbackUrls=Object.fromEntries(themes.map(t=>[t.id,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(makeArt(t.id))]));
  const main=document.getElementById('fwTitleMain'),kicker=main&&main.querySelector('.fw-title-kicker');
  const scene=document.createElement('img');
  scene.className='fw-title-scene';scene.alt='';scene.decoding='async';
  if(kicker)kicker.insertAdjacentElement('afterend',scene);else if(main)main.prepend(scene);
  const card=document.createElement('section');card.id='fwTitleThemeCard';card.className='tileCard fw-title-theme-card';
  const head=document.createElement('h2');head.textContent='🎨 タイトル画面デザイン';card.append(head);
  const explain=document.createElement('p');explain.className='note';
  explain.textContent='起動画面のデザインを選べます。変更はこの端末に保存されます。';card.append(explain);
  const group=document.createElement('div');group.className='fw-theme-options';group.setAttribute('role','radiogroup');group.setAttribute('aria-label','タイトル画面デザイン');
  const radio={};
  themes.forEach(function(t){
    const label=document.createElement('label');label.className='fw-theme-option';
    const img=document.createElement('img');img.src=urls[t.id];img.alt='';img.loading='lazy';
    img.addEventListener('error',function(){if(img.src!==fallbackUrls[t.id])img.src=fallbackUrls[t.id];});
    const inp=document.createElement('input');inp.type='radio';inp.name='fw-title-theme';inp.value=t.id;
    const name=document.createElement('strong');name.textContent=t.name;
    const detail=document.createElement('small');detail.textContent=t.brief;
    label.append(img,inp,name,detail);group.appendChild(label);
    inp.addEventListener('change',function(){if(inp.checked)apply(t.id,true);});
    radio[t.id]={label:label,input:inp};
  });
  card.append(group);
  const info=document.createElement('p');info.className='note';info.textContent='初期設定：C案（冒険手帳）';card.append(info);
  const ver=document.getElementById('fwVersionCard');
  if(ver&&ver.parentElement===panel)panel.insertBefore(card,ver);else panel.append(card);
  function apply(id,save){
    if(!Object.hasOwn(urls,id))id='c';
    overlay.dataset.fwTitleTheme=id;
    scene.onerror=function(){if(scene.src!==fallbackUrls[id])scene.src=fallbackUrls[id];};
    scene.src=urls[id];
    themes.forEach(function(t){
      const picked=t.id===id;
      radio[t.id].input.checked=picked;
      radio[t.id].label.classList.toggle('fw-theme-selected',picked);
    });
    if(save){
      try{localStorage.setItem(KEY,id);info.textContent='設定を保存しました：'+themes.find(t=>t.id===id).name;}
      catch(_){info.textContent='この端末に保存できませんでした。ブラウザー設定をご確認ください。';}
    }
  }
  let current='c';
  try{const v=localStorage.getItem(KEY);if(Object.hasOwn(urls,v))current=v;}catch(_){}
  apply(current,false);
})();
