/**
 * Compact, touch-first music studio. The world simulation and XR input are untouched.
 * Browser-local scores; rendered songs become normal audio records in MediaLibrary.
 */
import {MUSIC_STEPS,MUSIC_TRACKS,GUITAR_OPEN_NOTES,newScore,normalizeScore,
 addNote,toggleStep,noteName,renderScoreWav} from "./music-core.mjs";
import {readMediaFile} from "./media-storage.mjs";
import {geoOffset,geoLocal,terrainSurface} from "./geo.mjs";
import {newMusicStage,normalizeMusicStage,musicStageRayHit,musicStageHandHit} from "./music-world.mjs";
import {MUSIC_RECIPES,normalizeMusicInventory,craftMusicInstrument,takeMusicInstrument,
 returnMusicInstrument,extractAssetMusicControls,recipeById} from "./music-crafting.mjs";
const SAVE_KEY="universal-engine:music:scores:v1";
const WORLD_KEY="universal-engine:music:instruments:v1";
const INVENTORY_KEY="universal-engine:music:crafted:v1";
const CREATIVE_KEY="universal-engine:music:creator:v1";
const TRACK_LABEL={keys:"🎹 キーボード",guitar:"🎸 ギター",bass:"🎼 ベース",drums:"🥁 ドラム"};
const $=(root,q)=>root.querySelector(q);
const create=(tag,className,text)=>{
 const el=document.createElement(tag);if(className)el.className=className;
 if(text!==undefined)el.textContent=text;return el;
};
const button=(text,fn)=>{const b=create("button","",text);b.type="button";b.addEventListener("click",fn);return b;};
const notePadLabel=n=>({36:"キック",38:"スネア",42:"ハイハット",39:"クラップ"})[n]||noteName(n);
export function installMusicUI({getMediaUI,getRenderer=()=>null,getController=()=>null,
 getTerrain=()=>null,getPlanet=()=>null,getOwnerWorld=()=>null,getResources=()=>({}),
 onCraftCommit=()=>{},canPlayWorld=()=>true,notify=()=>{}}){
 const toolbar=document.getElementById("viewport-toolbar"),quick=document.getElementById("viewport-quick-panel");
 if(!toolbar||!quick)throw Error("Music Studioを設置するためのツールバーがありません");
 const toggle=button("🎵 音楽スタジオ",open);toggle.id="toolbar-music";
 const quickToggle=button("🎵 演奏・作曲",open);quickToggle.id="viewport-music";
 toolbar.insertBefore(toggle,document.getElementById("toolbar-media"));
 quick.insertBefore(quickToggle,document.getElementById("viewport-media"));
 const panel=create("section","ue-music-panel");panel.hidden=true;panel.id="ue-music-panel";
 panel.setAttribute("role","dialog");panel.setAttribute("aria-label","音楽スタジオ");
 panel.innerHTML=`
 <header class="ue-music-header"><strong>🎵 Music Studio</strong><button data-close type="button">× 閉じる</button></header>
 <div class="ue-music-scroll">
 <section class="ue-music-section"><h3>🎧 音楽プレイヤー（ゲーム中も再生）</h3>
 <audio data-player controls playsinline preload="none"></audio>
 <div class="ue-music-row"><label>レコード <select data-record></select></label>
 <button type="button" data-play-record>▶ 再生</button>
 <label class="ue-music-check"><input data-loop type="checkbox">繰返し</label></div>
 <div class="ue-music-row"><label>音声ファイルを作品に登録
 <input data-upload type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm"></label>
 <button type="button" data-refresh>作品一覧を更新</button></div></section>
 <section class="ue-music-section"><h3>🎼 作曲（2小節・32ステップ）</h3>
 <div class="ue-music-row"><label>曲名<input data-title maxlength="80" value="新しい曲"></label>
 <label>BPM<input data-bpm type="number" min="40" max="240" step="1" value="110"></label>
 <label>選択する曲<select data-songs></select></label></div>
 <div class="ue-music-row"><button data-new type="button">＋ 新しい曲</button>
 <button data-save type="button">💾 楽譜を保存</button>
 <button data-play-score type="button">▶ 曲を再生</button>
 <button data-stop type="button">■ 停止</button>
 <button data-record-toggle type="button">● 演奏を録音</button></div>
 <small>鍵盤・弦をタップして演奏。録音中の演奏は16分音符に量子化されます。楽譜はこの端末に保存します。</small></section>
 <section class="ue-music-section"><h3>🌍 3D楽器・VR演奏</h3>
 <div class="ue-music-row"><label>レシピ
 <select data-recipe></select></label>
 <label class="ue-music-check"><input type="checkbox" data-creative>クリエイターモード（材料無制限）</label></div>
 <small data-cost></small>
 <div class="ue-music-row"><button type="button" data-craft>🔨 レシピで製作</button>
 <strong data-stock></strong></div>
 <div class="ue-music-row"><label>自作Asset楽器<select data-asset><option value="">保存Assetを選択</option></select></label>
 <button type="button" data-assets-refresh>Asset一覧更新</button></div>
 <div class="ue-music-row">
 <button type="button" data-world-place>🎹🎸 所持楽器を設置</button>
 <button type="button" data-world-remove>3D楽器を回収</button></div>
 <small>通常モードは木材・金属・繊維などの手持ち資源を消費。クリエイターモードでは消費せず自由に製作・設置できます。
 Asset制作で音付きパーツを置いた作品は「自作Asset楽器」レシピで製作して使用できます。
 VRでは鍵盤・ボタン・弦を狙ってトリガーで演奏します。各惑星1セットまで。</small>
 <output data-world-status role="status"></output></section>
 <section class="ue-music-section"><h3>🎹 キーボード・ギター・ドラム</h3>
 <div class="ue-music-row"><label>選択中の音 <output data-pitch>C4</output></label>
 <label>ステップに入力する楽器 <select data-track>
 <option value="keys">🎹 キーボード</option><option value="guitar">🎸 ギター</option>
 <option value="bass">🎼 ベース</option><option value="drums">🥁 ドラム</option></select></label></div>
 <div class="ue-music-keys" data-keys aria-label="キーボード"></div>
 <details><summary>🎸 6弦ギター（開放弦〜7フレット）</summary><div class="ue-music-guitar" data-guitar></div></details>
 <details><summary>🥁 ドラムパッド</summary><div class="ue-music-drums" data-drums></div></details></section>
 <section class="ue-music-section"><h3>🎛️ ステップシーケンサー</h3>
 <small>鍵盤で音程を選び、下のマスをタップして配置・削除。各列は16分音符。横にスクロールできます。</small>
 <div class="ue-music-grid-scroll"><div class="ue-music-grid" data-grid></div></div>
 <div class="ue-music-row"><button data-clear type="button">現在の楽譜を消去</button>
 <button data-wav type="button">⬇ WAV保存</button>
 <button data-publish type="button">💿 レコード作品に登録</button></div></section>
 <output data-status role="status" aria-live="polite"></output>
 </div>`;
 document.body.append(panel);
 const el=q=>$(panel,q);
 const player=el("[data-player]");
 let scores=[],score=newScore(),selected=-1,pitch=60,recordingAt=null;
 let audioUrl=null,audioCtx=null;const presses=new Map(),touching=new Map();
 let inventory;
 try{inventory=normalizeMusicInventory(JSON.parse(localStorage.getItem(INVENTORY_KEY)||"null"));}
 catch(_){inventory=normalizeMusicInventory();}
 let creative=false;
 try{creative=localStorage.getItem(CREATIVE_KEY)==="true";}catch(_){}
 const stages={};
 try{const data=JSON.parse(localStorage.getItem(WORLD_KEY)||"{}");
  if(data&&typeof data==="object"&&!Array.isArray(data))
   for(const [key,raw] of Object.entries(data).slice(0,24)){
    const normalized=normalizeMusicStage(raw);
    if(key===normalized.planetId)stages[key]=normalized;
   }
 }catch(_){notify("3D楽器の設置情報を読み込めませんでした");}
 const planetId=()=>String(getPlanet()?.id||"");
 const currentStage=()=>stages[planetId()]||null;
 function syncWorldStage(){
  const renderer=getRenderer();if(renderer)renderer.musicStage=currentStage();
 }
 function stageMessage(message){el("[data-world-status]").textContent=message;report(message);}
 function persistWorld(){
  localStorage.setItem(WORLD_KEY,JSON.stringify(stages));
  syncWorldStage();
 }
 function persistCraft(){
  localStorage.setItem(INVENTORY_KEY,JSON.stringify(inventory));
  localStorage.setItem(CREATIVE_KEY,String(creative));
  onCraftCommit();
 }
 function selectedRecipe(){return recipeById(el("[data-recipe]").value);}
 function refreshAssetChoices(){
  const list=el("[data-asset]"),old=list.value;
  list.replaceChildren(new Option("自作楽器Assetを選択",""));
  for(const prefab of getOwnerWorld()?.prefabs||[]){
   if(prefab?.assetDocument?.meta?.assetType!=="instrument")continue;
   try{extractAssetMusicControls(prefab.assetDocument);}
   catch(_){continue;}
   list.add(new Option(prefab.name,prefab.name));
  }
  if([...list.options].some(x=>x.value===old))list.value=old;
 }
 function updateCraftInfo(){
  const recipe=selectedRecipe();if(!recipe)return;
  el("[data-cost]").textContent=creative?"素材無制限・所持品消費なし":
   "必要資源："+Object.entries(recipe.cost).map(([k,v])=>k+" "+v+"個（手持ち "+(getResources()?.[k]??0)+"）").join(" / ");
  el("[data-stock]").textContent="所持 "+(inventory.items[recipe.item]||0)+"個";
 }
 
 try{
  const data=JSON.parse(localStorage.getItem(SAVE_KEY)||"[]");
  if(Array.isArray(data))scores=data.slice(0,30).map(normalizeScore);
 }catch(_){notify("保存済みの楽譜が読み込めませんでした");}
 function report(message){el("[data-status]").textContent=message;notify(message);}
 function store(){
  localStorage.setItem(SAVE_KEY,JSON.stringify(scores));
 }
 function open(){
  refreshAssetChoices();updateCraftInfo();
  syncWorldStage();
  el("[data-world-status]").textContent=currentStage()?"🎹 楽器を設置済みです":"この惑星には楽器がありません";
  getMediaUI()?.close();
  panel.hidden=false;quick.hidden=true;
  document.getElementById("viewport-quick-toggle")?.setAttribute("aria-expanded","false");
  refreshRecords();refreshScores();refreshGrid();
 }
 function close(){panel.hidden=true;stopRecording();}
 el("[data-close]").addEventListener("click",close);
 const craftSelect=el("[data-recipe]");
 for(const recipe of MUSIC_RECIPES)craftSelect.add(new Option(recipe.name,recipe.id));
 craftSelect.value=MUSIC_RECIPES[0].id;
 el("[data-creative]").checked=creative;
 craftSelect.addEventListener("change",updateCraftInfo);
 el("[data-creative]").addEventListener("change",()=>{
  creative=el("[data-creative]").checked;
  try{persistCraft();}catch(e){report("制作モードの保存に失敗: "+e.message);}
  updateCraftInfo();
 });
 el("[data-assets-refresh]").addEventListener("click",refreshAssetChoices);
 el("[data-craft]").addEventListener("click",()=>{
  const old=inventory;
  try{
   if(!canPlayWorld())throw Error("現在は楽器を製作できません");
   const recipe=selectedRecipe(),resources=getResources();
   if(recipe.id==="music-custom"&&!el("[data-asset]").value)
    throw Error("先にAsset制作で保存した楽器を選んでください");
   inventory=craftMusicInstrument(inventory,resources,recipe.id,{creative});
   try{persistCraft();}catch(e){
    if(!creative)for(const [k,v]of Object.entries(recipe.cost))resources[k]+=v;
    inventory=old;throw e;
   }
   updateCraftInfo();report("🔨 "+recipe.name+" を製作しました");
  }catch(e){report("製作できません："+e.message);}
 });
 el("[data-world-place]").addEventListener("click",()=>{
  try{
   if(!canPlayWorld())throw Error("拘束・移動中・室内では3D楽器を設置できません");
   const c=getController(),planet=getPlanet(),terrain=getTerrain();
   if(!c||!planet||!terrain||!Number.isFinite(c.lat)||!Number.isFinite(c.lon)
      ||!Number.isFinite(c.yaw)||c.altitudeM>12)
    throw Error("惑星の地表に降りてから設置してください");
   const yaw=((c.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
   const point=geoOffset(c.lat,c.lon,Math.sin(yaw)*2.5,Math.cos(yaw)*2.5,planet.radiusM);
   const heightM=Math.max(0,terrainSurface(terrain,point.lat,point.lon).elevationM);
   const recipe=selectedRecipe(),item=recipe.item;
   let controls=[];
   if(item==="music-custom"){
    const assetName=el("[data-asset]").value;
    const prefab=getOwnerWorld()?.prefabs?.find(p=>p.name===assetName);
    if(!prefab)throw Error("自作Asset楽器を選択してください");
    controls=extractAssetMusicControls(prefab.assetDocument);
   }
   if(stages[planet.id])throw Error("すでにこの惑星に楽器があります。回収してから交換してください");
   const old=inventory;
   inventory=takeMusicInstrument(inventory,item,{creative});
   const placement=newMusicStage({planetId:planet.id,lat:point.lat,lon:point.lon,yaw,heightM,item,controls});
   placement.owned=!creative;
   try{
    stages[planet.id]=placement;
    persistWorld();persistCraft();
   }catch(e){
    delete stages[planet.id];inventory=old;throw e;
   }
   updateCraftInfo();stageMessage("🎹🎸 楽器を設置しました。VRで演奏できます");
  }catch(e){stageMessage(e.message);}
 });
 el("[data-world-remove]").addEventListener("click",()=>{
  const id=planetId();if(!stages[id])return stageMessage("設置されていません");
  const original=stages[id],previous=inventory;
  try{
   if(original.owned)inventory=returnMusicInstrument(inventory,original.item);
   delete stages[id];persistWorld();persistCraft();updateCraftInfo();stageMessage("楽器を回収しました");
  }catch(e){
   stages[id]=original;inventory=previous;stageMessage("回収に失敗: "+e.message);
  }
 });
 document.getElementById("toolbar-media")?.addEventListener("click",close);
 document.getElementById("viewport-media")?.addEventListener("click",close);
 panel.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();close();}});
 function stopRecording(){
  if(recordingAt===null)return;
  for(const key of Array.from(presses.keys()))finishNote(key);
  recordingAt=null;el("[data-record-toggle]").textContent="● 演奏を録音";
  report("録音を終了しました。楽譜を保存できます。");
 }
 function setPitch(p,track){
  pitch=p;el("[data-pitch]").textContent=notePadLabel(p);
  if(track)el("[data-track]").value=track;
 }
 function liveVoice(track,p,spatial=null){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtx){report("このブラウザはWeb Audioに対応していません");return ()=>{};}
  try{
   if(!audioCtx)audioCtx=new AudioCtx();
   if(audioCtx.state==="suspended")audioCtx.resume().catch(()=>{});
   const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
   const hz=440*2**((p-69)/12);
   osc.type=track==="guitar"?"triangle":track==="bass"?"sawtooth":track==="drums"?"square":"sine";
   osc.frequency.setValueAtTime(track==="drums"?p===36?110:250:hz,now);
   gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(track==="drums"?.08:.14,now+.012);
   if(track==="guitar"||track==="drums")gain.gain.exponentialRampToValueAtTime(.0001,now+(track==="drums"?.18:1.2));
   osc.connect(gain);
   if(spatial&&typeof audioCtx.createPanner==="function"){
    const panner=audioCtx.createPanner();panner.panningModel="HRTF";
    panner.distanceModel="inverse";panner.refDistance=1;panner.maxDistance=18;
    panner.rolloffFactor=1.1;
    panner.positionX.value=spatial[0];
    panner.positionY.value=spatial[1];
    panner.positionZ.value=-spatial[2];
    gain.connect(panner).connect(audioCtx.destination);
   }else gain.connect(audioCtx.destination);
   osc.start(now);
   const end=()=>{const t=audioCtx.currentTime;gain.gain.cancelScheduledValues(t);
     gain.gain.setTargetAtTime(.0001,t,.065);
     try{osc.stop(t+.4);}catch(_){}};
   if(track==="drums")setTimeout(end,200);
   return end;
  }catch(err){report("演奏できません: "+err.message);return ()=>{};}
 }
 function beginNote(key,track,p,spatial=null){
  if(presses.has(key))return;
  setPitch(p,track);
  presses.set(key,{track,p,start:performance.now(),end:liveVoice(track,p,spatial)});
 }
 function finishNote(key){
  const current=presses.get(key);if(!current)return;
  presses.delete(key);current.end();
  if(recordingAt===null||current.start<recordingAt)return;
  const stepMs=60000/Number(el("[data-bpm]").value||110)/4;
  const start=Math.round((current.start-recordingAt)/stepMs);
  if(start<0||start>=MUSIC_STEPS)return;
  const length=Math.max(1,Math.min(MUSIC_STEPS-start,16,Math.round((performance.now()-current.start)/stepMs)));
  try{readFields();score=addNote(score,{track:current.track,step:start,pitch:current.p,length});refreshGrid();}
  catch(e){report(e.message);}
 }
 function attachPad(container,label,track,p){
  const key=container.childElementCount+"-"+track+"-"+p;
  const b=create("button","ue-music-pad "+(track==="keys"&&[1,3,6,8,10].includes(p%12)?"is-black":""),label);
  b.type="button";b.dataset.pitch=p;b.setAttribute("aria-label",TRACK_LABEL[track]+" "+label);
  b.addEventListener("pointerdown",e=>{
   if(e.button!==0&&e.pointerType==="mouse")return;
   e.preventDefault();b.setPointerCapture?.(e.pointerId);beginNote(key,track,p);
  });
  for(const ev of ["pointerup","pointercancel","lostpointercapture"])b.addEventListener(ev,()=>finishNote(key));
  // Fallback for keyboard/assistive-tech activation.
  b.addEventListener("click",e=>{if(e.detail===0){beginNote(key,track,p);setTimeout(()=>finishNote(key),180);}});
  container.append(b);
 }
 for(let n=60;n<=72;n++)attachPad(el("[data-keys]"),noteName(n),"keys",n);
 const guitar=el("[data-guitar]");
 for(let s=0;s<GUITAR_OPEN_NOTES.length;s++){
  const row=create("div","ue-music-string");row.append(create("span","",["1弦","2弦","3弦","4弦","5弦","6弦"][s]));
  for(let fret=0;fret<=7;fret++)attachPad(row,String(fret), "guitar",GUITAR_OPEN_NOTES[s]+fret);
  guitar.append(row);
 }
 for(const [n,label] of [[36,"Kick"],[38,"Snare"],[42,"Hi-hat"],[39,"Clap"]])
  attachPad(el("[data-drums]"),label,"drums",n);
 document.addEventListener("keydown",e=>{
  if(panel.hidden||e.repeat||e.metaKey||e.ctrlKey||e.altKey||
   ["INPUT","SELECT","TEXTAREA"].includes(document.activeElement?.tagName))return;
  const idx="asdfghjkl".indexOf(e.key.toLowerCase());
  if(idx===-1)return;
  e.preventDefault();e.stopPropagation();const key="kbd-"+e.key.toLowerCase();
  beginNote(key,el("[data-track]").value==="bass"?"bass":"keys",60+idx);
 },true);
 document.addEventListener("keyup",e=>{
  const key="kbd-"+e.key.toLowerCase();
  if(presses.has(key)){e.preventDefault();e.stopPropagation();finishNote(key);}
 },true);
 function readFields(){
  score.title=el("[data-title]").value.trim();
  score.bpm=Number(el("[data-bpm]").value);
  score=normalizeScore(score);
 }
 function refreshGrid(){
  const grid=el("[data-grid]");grid.replaceChildren();
  const header=create("div","ue-music-step-row");
  header.append(create("strong","ue-music-track-name","STEP"));
  for(let i=0;i<MUSIC_STEPS;i++)header.append(create("span","ue-music-step-number",String(i+1)));
  grid.append(header);
  for(const track of MUSIC_TRACKS){
   const row=create("div","ue-music-step-row");
   row.append(create("strong","ue-music-track-name",TRACK_LABEL[track]));
   for(let step=0;step<MUSIC_STEPS;step++){
    const notes=score.notes.filter(n=>n.track===track&&n.step===step);
    const cell=button(notes.length?notes.map(n=>notePadLabel(n.pitch)).join("+"):"·",()=>{
     try{
      readFields();
      const p=track==="drums"?(el("[data-track]").value==="drums"?pitch:36):pitch;
      score=toggleStep(score,{track,step,pitch:p});
      refreshGrid();
     }catch(e){report(e.message);}
    });
    cell.className="ue-music-step"+(notes.length?" is-active":"")+(step%4===0?" is-beat":"");
    cell.title=TRACK_LABEL[track]+" "+(step+1)+" / "+(notes.map(n=>notePadLabel(n.pitch)).join(",")||"空");
    row.append(cell);
   }
   grid.append(row);
  }
 }
 function refreshScores(){
  const select=el("[data-songs]");select.replaceChildren();
  select.add(new Option("編集中の曲", "-1"));
  scores.forEach((s,i)=>select.add(new Option(s.title,String(i))));
  select.value=String(selected);
 }
 el("[data-songs]").addEventListener("change",()=>{
  selected=Number(el("[data-songs]").value);
  if(selected>=0){score=normalizeScore(scores[selected]);el("[data-title]").value=score.title;el("[data-bpm]").value=String(score.bpm);}
  refreshGrid();
 });
 el("[data-new]").addEventListener("click",()=>{
  selected=-1;score=newScore();el("[data-title]").value=score.title;el("[data-bpm]").value=String(score.bpm);
  refreshScores();refreshGrid();report("新しい曲を作成しました");
 });
 el("[data-save]").addEventListener("click",()=>{
  try{
   readFields();
   if(selected===-1){if(scores.length>=30)throw Error("楽譜は30曲まで保存できます");selected=scores.length;scores.push(score);}
   else scores[selected]=score;
   store();refreshScores();report("「"+score.title+"」の楽譜を保存しました");
  }catch(e){report("保存できません: "+e.message);}
 });
 el("[data-clear]").addEventListener("click",()=>{
  if(!confirm("編集中のすべての音符を消しますか？"))return;
  score.notes=[];refreshGrid();
 });
 function setAudioBlob(blob){
  player.pause();
  if(audioUrl)URL.revokeObjectURL(audioUrl);
  audioUrl=URL.createObjectURL(blob);player.src=audioUrl;
 }
 async function playBlob(blob,label){
  setAudioBlob(blob);
  try{await player.play();report("再生中: "+label);}catch(e){report("再生ボタンを押してください: "+e.message);}
 }
 el("[data-play-score]").addEventListener("click",async()=>{
  try{readFields();await playBlob(renderScoreWav(score),score.title);}
  catch(e){report(e.message);}
 });
 el("[data-stop]").addEventListener("click",()=>{player.pause();player.currentTime=0;report("停止しました");});
 el("[data-loop]").addEventListener("change",e=>{player.loop=e.target.checked;});
 el("[data-record-toggle]").addEventListener("click",()=>{
  if(recordingAt!==null){stopRecording();return;}
  try{readFields();recordingAt=performance.now();
   el("[data-record-toggle]").textContent="■ 録音終了";
   report("録音中: 2小節以内で演奏してください（音声録音ではなく音符の記録です）");
  }catch(e){report(e.message);}
 });
 function refreshRecords(){
  const select=el("[data-record]");select.replaceChildren();
  const records=getMediaUI()?.library?.items?.filter(item=>item.kind==="record")||[];
  if(!records.length){select.add(new Option("保存済みレコードはありません",""));return;}
  records.slice().reverse().forEach(item=>select.add(new Option(item.title+" / "+item.author,String(item.id))));
 }
 el("[data-refresh]").addEventListener("click",refreshRecords);
 el("[data-play-record]").addEventListener("click",async()=>{
  const item=getMediaUI()?.library?.items?.find(x=>String(x.id)===el("[data-record]").value&&x.kind==="record");
  if(!item)return report("再生するレコードを選んでください");
  try{const file=await readMediaFile(item.source.key);
   if(!file)throw Error("この端末に音声ファイルがありません");
   await playBlob(file,item.title);
  }catch(e){report(e.message);}
 });
 el("[data-upload]").addEventListener("change",async e=>{
  const input=e.target,file=input.files?.[0];if(!file)return;
  try{
   const item=await getMediaUI().registerAudioRecord(file,{title:file.name.replace(/\.[^.]+$/,"")});
   refreshRecords();report("💿 "+item.title+" をメディア作品に保存しました");
  }catch(err){report(err.message);}finally{input.value="";}
 });
 function download(blob,fileName){
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=fileName.replace(/[\\/:*?"<>|]/g,"_");document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 el("[data-wav]").addEventListener("click",()=>{
  try{readFields();download(renderScoreWav(score),score.title+".wav");report("WAVを書き出しました");}
  catch(e){report(e.message);}
 });
 el("[data-publish]").addEventListener("click",async()=>{
  try{
   readFields();
   const file=new File([renderScoreWav(score)],score.title+".wav",{type:"audio/wav"});
   const item=await getMediaUI().registerAudioRecord(file,{title:score.title,author:"player"});
   refreshRecords();report("💿 「"+item.title+"」をメディア・文化作品に登録しました");
  }catch(e){report(e.message);}
 });
 refreshScores();refreshGrid();refreshRecords();
 window.addEventListener("pagehide",()=>{
  for(const key of Array.from(presses.keys()))finishNote(key);
  if(audioUrl)URL.revokeObjectURL(audioUrl);
 });
 function handleXR({phase,rayMatrix,handMatrix,stageMatrix,hand="right"}={}){
  if(phase==="reset"){
   for(const h of ["left","right"]){
    finishNote("xr-music-"+h);finishNote("xr-touch-"+h);touching.delete(h);
   }
   return {handled:false};
  }
  if(phase==="end"){
   const key="xr-music-"+hand;
   if(presses.has(key)){finishNote(key);return {handled:true};}
   return {handled:false};
  }
  if(!canPlayWorld()||!stageMatrix)return {handled:false};
  const id=planetId(),placement=stages[id],controller=getController();
  if(!placement||!controller||controller.altitudeM>12)return {handled:false};
  const key="xr-music-"+hand;
  if(phase!=="start"&&phase!=="touch")return {handled:false};
  if(phase==="start"&&presses.has("xr-touch-"+hand))
   return {handled:true,track:touching.get(hand)?.track||"keys"};
  const delta=geoLocal(controller.lat,controller.lon,placement.lat,placement.lon,getPlanet().radiusM);
  const here=Math.max(0,terrainSurface(getTerrain(),controller.lat,controller.lon).elevationM);
  const offset=[delta.eastM,placement.heightM-here,delta.northM];
  if(phase==="touch"){
   const contact=Math.hypot(offset[0],offset[2])<=4?
    musicStageHandHit(handMatrix,stageMatrix,offset,placement.yaw,{controls:placement.controls}):null;
   const old=touching.get(hand),contactKey="xr-touch-"+hand;
   if(!contact||old?.track!==contact.track||old?.pitch!==contact.pitch){
    finishNote(contactKey);touching.delete(hand);
    if(contact){
     beginNote(contactKey,contact.track,contact.pitch,[offset[0],offset[1]+1,offset[2]]);
     touching.set(hand,contact);
    }
   }
   return {handled:Boolean(contact),track:contact?.track,pitch:contact?.pitch};
  }
  if(!rayMatrix)return {handled:false};
  if(Math.hypot(offset[0],offset[2])>4)return {handled:false};
  const hit=musicStageRayHit(rayMatrix,stageMatrix,offset,placement.yaw,{controls:placement.controls});
  if(!hit)return {handled:false};
  beginNote(key,hit.track,hit.pitch,[offset[0],offset[1]+1,offset[2]]);
  return {handled:true,track:hit.track,pitch:hit.pitch};
 }
 syncWorldStage();
 return {open,close,refreshRecords,syncWorldStage,handleXR,
  snapshot:()=>({version:1,inventory:normalizeMusicInventory(inventory),
   stages:JSON.parse(JSON.stringify(stages)),creative}),
  loadSnapshot:data=>{
   if(data?.version!==1)throw Error("楽器のセーブデータが不正です");
   const loaded={};for(const [id,item] of Object.entries(data.stages||{})){
    const p=normalizeMusicStage(item);
    if(id!==p.planetId)throw Error("設置惑星が一致しません");
    loaded[id]={...p,owned:item.owned===true};
   }
   inventory=normalizeMusicInventory(data.inventory);
   for(const k of Object.keys(stages))delete stages[k];Object.assign(stages,loaded);
   creative=data.creative===true;
   persistWorld();persistCraft();syncWorldStage();updateCraftInfo();
  },
  get score(){return normalizeScore(score);}};
}
