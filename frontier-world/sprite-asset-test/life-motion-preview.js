/* Frontier World daily-life motion test panel. Independent of game inventory/save data. */
(function(){
 'use strict';
 function el(tag,className,content){
  const node=document.createElement(tag);if(className)node.className=className;
  if(content!==undefined)node.textContent=content;return node;
 }
 const dirs=['front','left','right','back'];
 const dirNames={front:'正面',left:'左',right:'右',back:'背面'};
 function boot(){
  const api=window.FWLifeMotion;
  const grid=document.querySelector('.grid'),mainChar=document.getElementById('character');
  if(!api||!grid||!mainChar||document.getElementById('fwLifePreview'))return;
  const section=el('section','pane full');section.id='fwLifePreview';
  section.innerHTML='<h2>🏠 生活モーション・プレビュー</h2>'+
   '<p class="note">既存キャラの関節リグで11種類の生活動作を再生。道具・本・紙・食器・泡は仮のCanvas描画です。生活動作と戦闘動作は同じ原画像／関節補正を使用します。</p>'+
   '<canvas id="fwLifeCanvas" width="800" height="420" role="img" aria-label="生活動作アニメーションのプレビュー"></canvas>'+
   '<div class="toolbar" id="fwLifeButtons"></div>'+
   '<div class="toolbar"><label for="fwLifeDirection">向き</label><select id="fwLifeDirection"><option value="front">正面</option><option value="left">左</option><option value="right">右</option><option value="back">背面</option></select>'+
   '<label for="fwLifeSpeed">速度</label><input type="range" min="40" max="200" value="100" step="10" id="fwLifeSpeed"><output id="fwLifeSpeedValue">1.0倍</output>'+
   '<button type="button" id="fwLifePause">一時停止</button><button type="button" id="fwLifeRestart">頭から再生</button><button type="button" id="fwLifeGuides" aria-pressed="false">関節点 OFF</button>'+
   '<button type="button" id="fwLifeExport">⬇️ 4方向×8コマ PNG</button></div>'+
   '<div class="info" aria-live="polite" id="fwLifeStatus">キャラクターの画像を読み込み中…</div>'+
   '<p class="note">四方向の左向きは右向き素材の鏡像です。椅子・風呂などはテスト背景に描画します。浴槽の演出は着衣スプライトを泡で覆う暫定表現です。実物のモーション素材は後から差し替え可能です。</p>';
  const before=Array.from(grid.children).find(function(node){return node.querySelector('h2')&&node.querySelector('h2').textContent.includes('調整モード')});
  grid.insertBefore(section,before||null);
  const style=el('style');style.textContent='#fwLifeCanvas{display:block;width:100%;height:auto;border:1px solid #52727e;border-radius:12px;background:#1d3238}#fwLifeButtons{gap:6px}#fwLifeButtons button{min-width:112px}#fwLifeButtons button.active{background:#0d807b;border-color:#92ded5}#fwLifeSpeed{max-width:125px}';document.head.append(style);
  const $=id=>document.getElementById(id),cv=$('fwLifeCanvas'),ctx=cv.getContext('2d');
  const direction=$('fwLifeDirection'),speed=$('fwLifeSpeed'),status=$('fwLifeStatus'),btns=$('fwLifeButtons');
  let selected=mainChar.value,act='chop',dir='front',elapsed=0,last=null,paused=false,guides=false;
  let manifest=null,loaded={},pending=new Map(),error='';
  const actionInfo={};
  api.actions.forEach(a=>{
   actionInfo[a.id]=a;const btn=el('button','',a.label);btn.type='button';btn.dataset.id=a.id;
   btn.addEventListener('click',()=>{act=a.id;elapsed=0;refreshButtons();draw()});btns.appendChild(btn);
  });
  function refreshButtons(){btns.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.id===act))}
  refreshButtons();
  function ready(id){
   if(loaded[id])return Promise.resolve(loaded[id]);
   if(pending.has(id))return pending.get(id);
   const data=manifest&&manifest.characters[id];if(!data)return Promise.reject(new Error('未登録キャラ'));
   const img=new Image();img.decoding='async';img.src=data.walkAtlas;
   const promise=img.decode().then(()=>{loaded[id]=img;pending.delete(id);return img}).catch(e=>{pending.delete(id);throw e});
   pending.set(id,promise);return promise;
  }
  function selectCharacter(){
   selected=mainChar.value;elapsed=0;error='';
   if(!manifest)return;
   ready(selected).then(()=>draw()).catch(e=>{error=String(e.message||e);draw()});
  }
  mainChar.addEventListener('change',selectCharacter);
  direction.addEventListener('change',()=>{dir=direction.value;draw()});
  speed.addEventListener('input',()=>{$('fwLifeSpeedValue').textContent=(Number(speed.value)/100).toFixed(1)+'倍'});
  $('fwLifePause').addEventListener('click',()=>{paused=!paused;$('fwLifePause').textContent=paused?'再生':'一時停止';draw()});
  $('fwLifeRestart').addEventListener('click',()=>{elapsed=0;paused=false;$('fwLifePause').textContent='一時停止';draw()});
  $('fwLifeGuides').addEventListener('click',()=>{guides=!guides;$('fwLifeGuides').textContent='関節点 '+(guides?'ON':'OFF');$('fwLifeGuides').setAttribute('aria-pressed',String(guides));draw()});
  function scene(){
   const g=ctx.createLinearGradient(0,0,0,420);g.addColorStop(0,'#6e9b9f');g.addColorStop(.73,'#acc6ac');g.addColorStop(.74,'#a28e72');g.addColorStop(1,'#85765d');
   ctx.fillStyle=g;ctx.fillRect(0,0,800,420);
   ctx.fillStyle='rgba(21,36,40,.23)';ctx.beginPath();ctx.ellipse(400,363,110,20,0,0,Math.PI*2);ctx.fill();
  }
  function progress(){return (elapsed%api.duration(act))/api.duration(act)}
  function draw(){
   ctx.clearRect(0,0,800,420);scene();
   const img=loaded[selected];
   if(!img){ctx.fillStyle='#fff';ctx.font='18px system-ui';ctx.fillText(error||'画像を読み込み中…',280,185);status.textContent=error||'読み込み中…';return;}
   const source=dir==='left'?'right':dir;
   const row=dirs.indexOf(source),p=progress();
   const ok=api.render(ctx,img,[0,row*324,256,324],400,366,244,309,{
    action:act,progress:p,characterId:selected,direction:dir,mirror:dir==='left',environment:true,guides:guides
   });
   const label=actionInfo[act]&&actionInfo[act].label||act;
   status.textContent=(manifest.characters[selected].displayName||selected)+'｜'+label+'｜'+dirNames[dir]+'｜'+(paused?'停止中':'繰り返し再生中')+'｜'+Math.round(p*100)+'%'+(!ok?'｜描画不可':'');
  }
  $('fwLifeExport').addEventListener('click',()=>{
   const img=loaded[selected];if(!img){status.textContent='画像を読み込んでから書き出してください';return;}
   const sheet=document.createElement('canvas');sheet.width=2048;sheet.height=1296;
   const dest=sheet.getContext('2d');
   for(let row=0;row<4;row++){
    const direction=dirs[row],src=direction==='left'?'right':direction;
    for(let col=0;col<8;col++){
     dest.save();dest.translate(col*256,row*324);
     api.render(dest,img,[0,dirs.indexOf(src)*324,256,324],128,314,256,324,{
      action:act,progress:col/8,characterId:selected,direction:direction,mirror:direction==='left',environment:false
     });
     dest.restore();
    }
   }
   sheet.toBlob(blob=>{
    if(!blob){status.textContent='PNG生成に失敗しました';return;}
    const url=URL.createObjectURL(blob),link=el('a');link.href=url;
    link.download='frontier-life-'+selected+'-'+act+'-4dir-8f.png';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),10000);
    status.textContent='PNG生成：'+selected+' / '+act+'｜2048×1296 px';
   },'image/png');
  });
  function frame(time){
   if(last===null)last=time;const delta=Math.max(0,Math.min(70,time-last));last=time;
   if(!paused)elapsed+=delta*Number(speed.value)/100;
   draw();requestAnimationFrame(frame);
  }
  fetch('manifest.json').then(r=>{if(!r.ok)throw Error('manifest HTTP '+r.status);return r.json()}).then(v=>{
   manifest=v;return ready(mainChar.value);
  }).then(()=>requestAnimationFrame(frame)).catch(e=>{error=String(e.message||e);requestAnimationFrame(frame)});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
