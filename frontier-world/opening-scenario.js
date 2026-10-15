/* FRONTIER_OPENING_V1 - Scenario prologue and playable rehabilitation tutorial. */
(function(){
'use strict';
if(window.FWOpeningV1)return;
const PENDING='__fwOpeningRequested';
const storyKey='storyOpeningV1';
const SCRIPT_VERSION='1.0.0';
let stage=null,hint=null,pollTimer=null,sceneIndex=0,talkSeen=false,bagSeen=false,baseline=0,walkingStart=null;
const scenes=[
 {scene:'arrival',title:'序章　灯りのある場所',speaker:'主人公',dialog:'……灯りだ。あと、少し……。',description:'夕暮れの森。足元がおぼつかない旅人が、焚き火の灯る開拓者のキャンプへ向かっている。',button:'灯りを目指す'},
 {scene:'collapse',title:'倒れた旅人',speaker:'ミオ',dialog:'誰か！　こっちに来て！　人が倒れてる！',description:'キャンプの入口にたどり着く。救いを求めるように手を伸ばし、主人公は意識を失った。',button:'意識が遠のく'},
 {scene:'wake',title:'知らない天井',speaker:'ミオ',dialog:'あっ、目が覚めた！　よかった……三日も眠ってたんだよ。',description:'柔らかな布団。薪の匂い。テントの隙間から差し込む朝の光。',button:'体を起こす'},
 {scene:'name',title:'あなたの名前',speaker:'ミオ',dialog:'私はミオ。ここは開拓者のキャンプよ。……あなたのこと、何て呼べばいい？',description:'名前を教え、今覚えていることを伝える。',button:'名前を伝える'},
 {scene:'stand',title:'再び立つために',speaker:'ミオ',dialog:'焦らなくていいよ。まずは一歩ずつ。歩けるようになったら、みんなに紹介するね。',description:'ミオに支えられて布団から立ち上がる。体の感覚をゆっくり取り戻そう。',button:'歩く練習を始める'}
];
const lessons=[
 {title:'一歩を踏み出す',body:'画面左下の移動スティック（PCは方向キー／WASD）で、テントの中を少し歩こう。',short:'室内で少し歩く'},
 {title:'外の空気を吸う',body:'テントの画面下側、中央の出口まで移動して外に出よう。',short:'テントを出る'},
 {title:'声を取り戻す',body:'キャンプの住民のそばへ近づき、💬会話ボタンで話しかけよう。ミオが近くにいなければ、ほかの住民でも大丈夫。',short:'誰かと会話する'},
 {title:'持ち物を確かめる',body:'📦の持ち物・チェスト操作を開いて、食料と水を確認しよう。まずは暮らしの備えを知ろう。',short:'持ち物を開く'},
 {title:'自分の手で集める',body:'森や道端で木材・石などの資源に近づき、⚡行動で一つ採集しよう。',short:'資源を1つ採集する'}
];
function bridge(){return window.__fwFrontierBridge;}
function state(){const b=bridge();return b&&b.state&&b.state.player?b.state:null;}
function story(){const s=state();return s&&s[storyKey]||null;}
function note(msg){const b=bridge();if(b&&typeof b.message==='function')try{b.message(msg);}catch(_){}}
function closeUi(){
 const d=document.getElementById('dialogPanel'),p=document.getElementById('panel');
 if(d)d.classList.add('hidden');if(p)p.classList.add('hidden');
}
function buildUi(){
 if(stage)return;
 const root=document.createElement('div');root.id='fwOpeningStage';root.hidden=true;root.dataset.scene='arrival';
 root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','開拓者編　序章');
 root.innerHTML='<div class="fw-op-sky" aria-hidden="true"><div class="fw-op-hill"></div><div class="fw-op-tent"></div><div class="fw-op-fire">✦</div><div class="fw-op-traveler"><i></i></div><div class="fw-op-bed">▰</div></div>'+
 '<section class="fw-op-content"><div class="fw-op-tag">FRONTIER WORLD · 開拓者編</div><h2 id="fwOpTitle"></h2><p id="fwOpDescription"></p><div class="fw-op-dialog"><strong id="fwOpSpeaker"></strong><p id="fwOpDialog"></p></div>'+
 '<div id="fwOpIdentity" class="fw-op-identity" hidden><label for="fwOpName">主人公の名前</label><input id="fwOpName" maxlength="20" autocomplete="off" placeholder="あなたの名前"><fieldset><legend>覚えていること</legend><label><input type="radio" name="fwOpMemory" value="haze" checked> 記憶が曖昧</label><label><input type="radio" name="fwOpMemory" value="trace"> 少し覚えている</label></fieldset></div>'+
 '<div class="fw-op-actions"><button type="button" id="fwOpNext"></button><button type="button" id="fwOpSkip">導入をスキップ</button></div><p class="fw-op-counter" id="fwOpCounter"></p></section>';
 document.body.appendChild(root);
 const side=document.createElement('aside');side.id='fwStoryHint';side.hidden=true;side.setAttribute('aria-label','序章の操作ガイド');
 side.innerHTML='<div class="fw-story-top"><strong id="fwStoryCount"></strong><button id="fwStoryClose" type="button" aria-label="ガイドを閉じる">×</button></div><b id="fwStoryTask"></b><p id="fwStoryText"></p><div class="fw-story-actions"><button id="fwStoryRepeat" type="button">操作説明</button><button id="fwStorySkip" type="button">練習を終了</button></div>';
 document.body.appendChild(side);
 stage=root;hint=side;
 root.querySelector('#fwOpNext').addEventListener('click',advance);
 root.querySelector('#fwOpSkip').addEventListener('click',function(){
  if(sceneIndex<3){sceneIndex=3;renderScene();return;}
  if(sceneIndex===3){saveIdentity();sceneIndex=4;renderScene();return;}
  finishCinematic();
 });
 root.querySelector('#fwOpName').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();advance();}});
 side.querySelector('#fwStoryClose').addEventListener('click',function(){side.hidden=true;});
 side.querySelector('#fwStoryRepeat').addEventListener('click',function(){const st=story();if(!st)return;alert(lessons[st.lesson]&&lessons[st.lesson].body||'移動・会話・採集を試そう。');});
 side.querySelector('#fwStorySkip').addEventListener('click',function(){if(window.confirm('操作練習を終えて、通常の開拓生活を始めますか？'))finishTutorial(true);});
 document.addEventListener('keydown',function(e){
  if(!stage||stage.hidden||e.key!=='Escape')return;
  e.preventDefault();e.stopImmediatePropagation();
  if(sceneIndex<3){sceneIndex=3;renderScene();}
 },true);
}
function saveIdentity(){
 const s=state(),st=story();if(!s||!st)return;
 const input=stage.querySelector('#fwOpName');
 let name=input.value.normalize('NFKC').trim().replace(/[\u0000-\u001f\u007f<>]/g,'');
 name=[...name].slice(0,20).join('');
 if(!name)name='旅人';
 s.player.name=name;
 st.memory=(stage.querySelector('input[name="fwOpMemory"]:checked')||{}).value||'haze';
}
function renderScene(){
 buildUi();
 const item=scenes[sceneIndex],name=story()&&state()&&state().player&&state().player.name;
 stage.dataset.scene=item.scene;stage.hidden=false;hint.hidden=true;
 stage.querySelector('#fwOpTitle').textContent=item.title;
 stage.querySelector('#fwOpSpeaker').textContent=item.speaker;
 stage.querySelector('#fwOpDialog').textContent=item.dialog;
 stage.querySelector('#fwOpDescription').textContent=item.description;
 stage.querySelector('#fwOpNext').textContent=item.button;
 stage.querySelector('#fwOpCounter').textContent='序章 · '+(sceneIndex+1)+' / '+scenes.length;
 const id=stage.querySelector('#fwOpIdentity');id.hidden=item.scene!=='name';
 if(item.scene==='name'){stage.querySelector('#fwOpName').value=(name&&name!=='YOU'&&name!=='旅人')?name:'';stage.querySelector('#fwOpName').focus();}
 else stage.querySelector('#fwOpNext').focus();
 const st=story();if(st){st.scene=sceneIndex;st.phase='cinematic';}
}
function advance(){
 if(sceneIndex===3)saveIdentity();
 if(sceneIndex>=4){finishCinematic();return;}
 sceneIndex++;renderScene();
}
function begin(meta){
 if(!meta||meta.id!=='frontier')return;
 const s=state();if(!s)return;
 const mode=['scenario','survival'].includes(meta.mode)?meta.mode:'scenario';
 window.__fwGameMode=mode;
 s.startingChapter='frontier';s.gameMode=mode;
 if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
 if(stage)stage.hidden=true;if(hint)hint.hidden=true;
 s[storyKey]={version:1,chapter:'frontier',mode:mode,phase:mode==='scenario'?'cinematic':'free',scene:0,lesson:0,memory:null,completed:mode!=='scenario',dayStarted:s.day};
 if(mode==='survival'){note('🌲 自由なサバイバル生活を始めた。最初から行動できます。');return;}
 closeUi();
 // Keep the arrival visual separate from existing 2D rendering and preserve map resources.
 sceneIndex=0;renderScene();
}
function finishCinematic(){
 const s=state(),st=story();if(!s||!st)return;
 buildUi();stage.hidden=true;closeUi();
 st.phase='tutorial';st.scene=4;st.lesson=0;st.walked=false;
 const tent=(s.buildings||[]).find(function(b){return b.id==='player'&&b.type==='tent';});
 if(tent){
  s.player.x=tent.x+1;s.player.y=tent.y+2.6;
  s.interior={buildingId:tent.id,roomW:6,roomH:5,pos:{x:2.5,y:1.5},tap:null};
 }else{
  // If the map changed, keep the quest playable from the current outdoor position.
  s.interior=null;st.lesson=1;
 }
 walkingStart=s.interior?{x:s.interior.pos.x,y:s.interior.pos.y}:null;
 baseline=sumResources(s);
 showLesson();startPoll();
 note('🌅 '+s.player.name+'はテントで目を覚ました。まずは歩く練習をしよう。');
}
function sumResources(s){const inv=s.player&&s.player.inv||{};return (Number(inv.wood)||0)+(Number(inv.stone)||0)+(Number(inv.food)||0)+(Number(inv.water)||0)+(Number(inv.fiber)||0);}
function showLesson(){
 const st=story();if(!st||st.phase!=='tutorial')return;
 buildUi();const entry=lessons[st.lesson];
 if(!entry){finishTutorial(false);return;}
 hint.hidden=false;
 hint.querySelector('#fwStoryCount').textContent='リハビリ練習 '+(st.lesson+1)+' / '+lessons.length;
 hint.querySelector('#fwStoryTask').textContent=entry.title;
 hint.querySelector('#fwStoryText').textContent=entry.body;
}
function nextLesson(){
 const st=story();if(!st)return;
 st.lesson++;
 const s=state();
 if(st.lesson===4&&s){baseline=sumResources(s);}
 if(st.lesson>=lessons.length){finishTutorial(false);return;}
 showLesson();note('✅ よくできた！　次は「'+lessons[st.lesson].short+'」。');
}
function finishTutorial(skipped){
 const st=story();if(!st)return;
 st.phase='complete';st.completed=true;st.finishedAtDay=state()&&state().day;st.skipped=!!skipped;
 if(hint)hint.hidden=true;
 if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
 note(skipped?'🌿 練習を終了。自由に村で暮らせるようになりました。':'🏡 序章「目覚め」完了！　ここからあなたの開拓生活が始まります。');
 window.dispatchEvent(new CustomEvent('fw-frontier-prologue-completed',{detail:{skipped:!!skipped}}));
}
function startPoll(){
 if(pollTimer)clearInterval(pollTimer);
 pollTimer=setInterval(function(){
  const s=state(),st=story();if(!s||!st||st.phase!=='tutorial')return;
  if(hint&&hint.hidden)return; // Opening the guide again is supported via the button below.
  const panel=document.getElementById('dialogPanel'),bag=document.getElementById('panel');
  if(st.lesson===0){
   if(!s.interior){nextLesson();return;}
   const p=s.interior.pos;
   if(!walkingStart)walkingStart={x:p.x,y:p.y};
   if(Math.hypot(p.x-walkingStart.x,p.y-walkingStart.y)>.65)nextLesson();
  }else if(st.lesson===1){
   if(!s.interior)nextLesson();
  }else if(st.lesson===2){
   if(panel&&!panel.classList.contains('hidden')){talkSeen=true;nextLesson();}
  }else if(st.lesson===3){
   if(bag&&!bag.classList.contains('hidden')&&/インベントリ|チェスト/.test((document.getElementById('panelTitle')||{}).textContent||'')){bagSeen=true;nextLesson();}
  }else if(st.lesson===4){
   if(sumResources(s)>baseline)nextLesson();
  }
 },260);
}
function resume(){
 const s=state();if(!s)return;
 const st=s[storyKey];
 if(stage)stage.hidden=true;if(hint)hint.hidden=true;
 if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
 if(!st||st.completed||st.mode!=='scenario')return;
 if(st.phase==='cinematic'){sceneIndex=Math.max(2,Math.min(4,Number(st.scene)||2));renderScene();}
 else if(st.phase==='tutorial'){
  if(st.lesson===0&&!s.interior)st.lesson=1;
  if(st.lesson===0&&s.interior)walkingStart={x:s.interior.pos.x,y:s.interior.pos.y};
  baseline=sumResources(s);showLesson();startPoll();
 }
}
window.FWOpeningV1={version:SCRIPT_VERSION,begin:begin,resume:resume,lessons:lessons.map(function(x){return x.title;})};
window.addEventListener('fw-title-chapter-started',function(e){window[PENDING]=null;begin(e.detail);});
window.addEventListener('fw-title-save-loaded',resume);
window.addEventListener('fw-title-ready',function(){if(window[PENDING]){const req=window[PENDING];window[PENDING]=null;begin(req);}});
if(window[PENDING]&&window.__fwTitleGameReady){const req=window[PENDING];window[PENDING]=null;begin(req);}
})();