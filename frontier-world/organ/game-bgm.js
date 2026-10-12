/* FW48.6 — user-controlled in-game BGM (melodies and recorded audio).
 * No autoplay and no network transfer. Scores: original Web Audio synth.
 * Mic recordings: on-device IndexedDB blobs played by native <audio>.
 */
(function(global){
'use strict';
function install(host){
 const INST=global.FW_INSTRUMENTS,lib=global.FW_AUDIO_LIBRARY,importLib=global.FW_BGM_IMPORT;
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
 let onlineScores=[],importedList=[],importedScores=[],pendingImportId=null;
 let savedFileUrl=null,downloading=false;
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
  return [...originals,...fromGame,...saved,...onlineScores,...importedScores].map(s=>s&&(/^(online|import):/.test(String(s.id||'')))?s:(valid?valid(s):s)).filter(s=>{
   if(!s||!Array.isArray(s.notes)||!s.notes.length||seen.has(s.id))return false;
   seen.add(s.id);return true;
  });
 };
 let ctx=null,bus=null,busConnected=false,generation=0,timeout=null,voices=[],playing=false,voiceList=[],audioUrl=null,preparedId=null;
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
 const commerce=el('div');commerce.style.cssText='display:flex;flex-wrap:wrap;gap:5px;margin:6px 0;';
 const buyMusic=el('button','smallBtn','💿 曲を保存');
 const publishMusic=el('button','smallBtn','🌍 村のBGMに公開');
 const visitVillages=el('button','smallBtn','🏡 他の村のBGM');
 [buyMusic,publishMusic,visitVillages].forEach(b=>{b.type='button';b.style.cssText='font-size:12px;padding:8px;';commerce.append(b);});
 panel.appendChild(commerce);
 const importRow=el('div');importRow.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;';
 const importBtn=el('button','smallBtn','📂 端末から曲を追加');
 const forgetBtn=el('button','smallBtn','🗑️ 読み込んだ曲を削除');
 [importBtn,forgetBtn].forEach(b=>{b.type='button';b.style.cssText='font-size:12px;padding:8px;';importRow.appendChild(b);});
 const importInput=el('input');importInput.type='file';importInput.accept='.wav,.mid,.midi,.musicxml,.xml,.mp3,.m4a,.aac,.ogg,.webm,audio/*';importInput.style.display='none';
 panel.append(importRow,importInput);
 const importedNote=el('p','','ダウンロードしたWAV・MIDI・MusicXMLを取り込めます。端末内にのみ保存し、再課金しません。');
 importedNote.style.cssText='margin:4px 0 8px;font-size:11px;line-height:1.5;color:#b5dcd2;';panel.appendChild(importedNote);
 const dl=el('div');dl.id='fwBgm49DirectDownload';
 dl.style.cssText='display:none;margin:9px 0;padding:10px;border:1px solid #9cbab3;background:#10292c;border-radius:10px;';
 const dlHeading=el('b','','💾 この曲を保存'),dlMessage=el('p','','WAV・MIDI・楽譜を選んでください。');
 dlMessage.style.cssText='font-size:12px;line-height:1.6;overflow-wrap:anywhere;';
 const formatRow=el('div');formatRow.style.cssText='display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;';
 const wav=el('button','smallBtn','💿 WAV音声'),midi=el('button','smallBtn','🎹 MIDI'),xml=el('button','smallBtn','🎼 楽譜');
 [wav,midi,xml].forEach(b=>{b.type='button';b.style.cssText='font-size:12px;padding:8px;';formatRow.appendChild(b);});
 const saveFile=el('a','','⬇️ ファイルを端末に保存');
 saveFile.style.cssText='display:none;margin-top:8px;padding:10px;background:#206646;border:1px solid #a4c6af;border-radius:8px;color:white;text-decoration:none;font-size:13px;';
 dl.append(dlHeading,formatRow,dlMessage,saveFile);panel.appendChild(dl);
 const shareLink=el('a','','🔗 公開した村のBGMページを開く');
 shareLink.target='_blank';shareLink.rel='noopener noreferrer';shareLink.style.cssText='display:none;color:#bff4d6;font-size:12px;margin:6px 0;text-decoration:underline;';
 panel.appendChild(shareLink);
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
 function clearSavedFile(){
  if(savedFileUrl)URL.revokeObjectURL(savedFileUrl);
  savedFileUrl=null;saveFile.style.display='none';
  saveFile.removeAttribute('href');saveFile.removeAttribute('download');
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
 async function prepareImportedAudio(id){
  cleanupAudioUrl();
  if(!importLib){status('ダウンロード曲の保存機能が見つかりません。');return;}
  const expected=id;status('端末に保存したBGMを準備しています…');
  try{
   const track=await importLib.get(id.slice(7));
   if(pick.value!==expected||!track||track.kind!=='audio'||!track.blob)return;
   audioUrl=URL.createObjectURL(track.blob);audio.src=audioUrl;
   audio.loop=!!prefs().loop;audio.volume=prefs().volume/100;preparedId=expected;
   status('📂 '+track.title+' の音声を準備しました。▶ 再生してください。');
  }catch(e){status('端末のBGMを読み込めませんでした: '+String(e?.message||e));}
 }
 function fill(){
  const selected=prefs().trackId;
  pick.replaceChildren();
  const createOption=(id,t)=>{const o=el('option');o.value=id;o.textContent=t;pick.appendChild(o);};
  scores().forEach(s=>createOption(s.id,'🎼 '+s.title+' / '+INST.label(s.instrument)));
  voiceList.forEach(s=>createOption('voice:'+s.id,'🎙️ '+s.title));
  importedList.filter(x=>x.kind==='audio').forEach(x=>createOption('import:'+x.id,'📂 '+x.title+' / 保存済み音声'));
  if([...pick.options].some(o=>o.value===selected))pick.value=selected;
  else{pick.value='priest-demo';prefs().trackId='priest-demo';persist();}
  if(pick.value.startsWith('voice:')||isImportedAudio(pick.value)){
   if(preparedId!==pick.value)(pick.value.startsWith('voice:')?prepareVoice:prepareImportedAudio)(pick.value);
   else if(!playing)status('音声は準備できています。▶ 再生を押してください。');
  }else{if(audioUrl)cleanupAudioUrl();if(!playing)status('曲を選び、▶ 再生を押してください。');}
 }
 async function loadOnlineScores(){
  onlineScores=[];
  if(!host.getOnlineClient)return;
  try{
   const db=await host.getOnlineClient(),auth=await db.auth.getSession();
   const user=auth.data?.session?.user?.id;if(!user)return;
   const [works,purchases,splits]=await Promise.all([
    db.from('fw_creator_works').select('id,title,creator_id').eq('kind','music').eq('status','active').limit(120),
    db.from('fw_creator_purchases').select('work_id').eq('buyer_id',user).limit(100),
    db.from('fw_creator_splits').select('work_id,collaborator_id,accepted_at').eq('collaborator_id',user).limit(100)
   ]);
   for(const x of [works,purchases,splits])if(x.error)throw x.error;
   const owned=new Set((purchases.data||[]).map(p=>p.work_id));
   const collabs=new Set((splits.data||[]).filter(p=>p.accepted_at).map(p=>p.work_id));
   const list=(works.data||[]).filter(w=>w.creator_id===user||owned.has(w.id)||collabs.has(w.id)).slice(0,40);
   const items=await Promise.all(list.map(async w=>{
    const r=await db.from('fw_creator_payloads').select('content').eq('work_id',w.id).maybeSingle();
    if(r.error||!Array.isArray(r.data?.content?.notes))return null;
    const notes=r.data.content.notes.slice(0,400).map((n,i)=>({pitch:Number(n.pitch),start:i,duration:1}))
     .filter(n=>Number.isInteger(n.pitch)&&n.pitch>=24&&n.pitch<=108);
    if(!notes.length)return null;
    return {id:'online:'+w.id,title:'🌐 '+w.title,author:'共用マーケット',instrument:'organ',bpm:188,notes};
   }));
   onlineScores=items.filter(Boolean);
  }catch(err){status('オンライン曲の取得に失敗: '+String(err?.message||err||'通信状態を確認してください').slice(0,150));}
 }
 function isImportedAudio(id){return id.startsWith('import:')&&importedList.some(x=>x.id===id.slice(7)&&x.kind==='audio');}
 async function loadImported(){
  importedList=[];importedScores=[];
  if(!importLib)return;
  try{
   importedList=await importLib.list();
   const tracks=await Promise.all(importedList.filter(x=>x.kind==='score').map(x=>importLib.get(x.id)));
   importedScores=tracks.filter(x=>x&&x.score&&Array.isArray(x.score.notes)).map(x=>({
    ...x.score,id:'import:'+x.id,title:'📂 '+x.title,
    instrument:'organ'
   }));
  }catch(e){status('端末BGMの読み込みに失敗しました: '+String(e?.message||e));}
 }
 async function refresh(){
  if(lib){try{voiceList=await lib.list();}catch(e){voiceList=[];}}
  await loadImported();
  await loadOnlineScores();
  fill();
 }
 function playScore(s){
  const Audio=global.AudioContext||global.webkitAudioContext;
  if(!Audio){status('ブラウザが音源に対応していません。');return false;}
  ctx=ctx||new Audio();bus=bus||ctx.createGain();if(!busConnected){bus.connect(ctx.destination);busConnected=true;}
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
  if(selected.startsWith('voice:')||isImportedAudio(selected)){
   if(preparedId!==selected){
    (selected.startsWith('voice:')?prepareVoice:prepareImportedAudio)(selected);
    status('音声を準備中です。完了後にもう一度▶を押してください。');return;
   }
   audio.loop=!!prefs().loop;audio.volume=prefs().volume/100;
   const result=audio.play();if(result&&typeof result.catch==='function')result.catch(()=>{status('録音の再生を開始できませんでした。もう一度▶を押してください。');playing=false;updateLabel();});
   playing=true;updateLabel();status('🎵 音声をBGMで再生中');return;
  }
  const song=scores().find(s=>s.id===selected);
  if(!song){status('楽譜が見つかりません。曲一覧を更新してください。');return;}
  if(playScore(song)){playing=true;updateLabel();status('🎼 「'+song.title+'」をBGMとして再生中');}
 }
 pick.addEventListener('change',()=>{
  clearSavedFile();dl.style.display='none';
  stop();pendingImportId=null;prefs().trackId=pick.value;persist();
  if(pick.value.startsWith('voice:')||isImportedAudio(pick.value))(pick.value.startsWith('voice:')?prepareVoice:prepareImportedAudio)(pick.value);else{cleanupAudioUrl();status('▶ 再生でBGMを開始できます。');}
 });
 importBtn.onclick=()=>{if(!importLib){status('この環境では曲の取り込み機能が利用できません。');return;}importInput.click();};
 importInput.addEventListener('change',async()=>{
  const file=importInput.files&&importInput.files[0];if(!file||!importLib)return;
  importBtn.disabled=true;status('📂 '+file.name+' を端末のBGMライブラリに保存しています…');
  try{
   const info=await importLib.putFile(file);
   pendingImportId=null;prefs().trackId='import:'+info.id;persist();
   stop();await refresh();
   status('✅ 「'+info.title+'」をBGMに設定しました。▶ 再生を押してください。'+(info.licenseId?' ライセンスIDを保持しています。':''));
  }catch(e){status('⚠️ 曲を読み込めません: '+String(e?.message||e));}
  finally{importBtn.disabled=false;importInput.value='';}
 });
 forgetBtn.onclick=async()=>{
  const id=pick.value;if(!id.startsWith('import:')){status('端末から読み込んだ曲を選んでから削除してください。');return;}
  if(!global.confirm('この端末のBGM一覧から削除しますか？ダウンロードフォルダの元ファイルは消えません。'))return;
  try{stop();cleanupAudioUrl();await importLib.remove(id.slice(7));prefs().trackId='priest-demo';persist();await refresh();status('端末のBGM一覧から削除しました。');}
  catch(e){status('削除できません: '+String(e?.message||e));}
 };
 slider.addEventListener('input',()=>{prefs().volume=Number(slider.value);updateVolume();persist();});
 loop.addEventListener('change',()=>{prefs().loop=loop.checked;audio.loop=loop.checked;persist();});
 function selectedMusicId(){return pick.value.startsWith('online:')?pick.value.slice(7):null;}
 async function prepareDirectFile(format){
  if(downloading)return;
  downloading=true;[wav,midi,xml].forEach(b=>b.disabled=true);
  clearSavedFile();dlMessage.textContent='保存ファイルを準備しています…';
  try{
   const selected=pick.value;
   if(!selected)throw Error('先にBGMを選択してください。');
   let file;
   if(selected.startsWith('voice:')){
    if(format!=='wav')throw Error('録音音声はMIDI・楽譜に変換できません。WAV音声を選んでください。');
    const recorded=lib&&await lib.get(selected.slice(6));
    if(!recorded?.blob)throw Error('録音データが見つかりません。');
    const mime=String(recorded.blob.type||'').toLowerCase();
    const ext=mime.includes('wav')?'wav':mime.includes('mp4')?'m4a':mime.includes('ogg')?'ogg':mime.includes('mpeg')?'mp3':'webm';
    file={blob:recorded.blob,filename:'BGM_録音.'+ext};
    dlMessage.textContent='自分の録音データを無料で保存します。ファイル形式: '+ext.toUpperCase();
   }else{
    const converter=await import(new URL('creator-market/music-export.js',document.baseURI).href);
    if(selected.startsWith('online:')){
     if(!host.getOnlineClient)throw Error('オンラインマーケットへの接続が未設定です。');
     const db=await host.getOnlineClient();
     const ss=await db.auth.getSession();
     if(ss.error)throw ss.error;
     if(!ss.data?.session)throw Error('マーケットからGitHubログインしてください。');
     const id=selected.slice(7);
     const work=await db.from('fw_creator_works').select('id,title,kind,status').eq('id',id).single();
     if(work.error)throw work.error;
     const issued=await db.rpc('fw_creator_issue_music_download',{p_work_id:id,p_format:format});
     if(issued.error)throw issued.error;
     const payload=await db.from('fw_creator_payloads').select('content').eq('work_id',id).single();
     if(payload.error)throw payload.error;
     file=converter.buildLicensedMusicFile(work.data,payload.data.content,issued.data);
     const digest=await converter.sha256Hex(file.bytes);
     const recorded=await db.rpc('fw_creator_prepare_music_download',{
      p_receipt_id:issued.data.receipt_id,p_sha256_hex:digest,p_file_size:file.bytes.length
     });
     if(recorded.error)throw recorded.error;
     dlMessage.textContent='✅ 購入・制作権利を確認しました。再保存0G／発行ID: '+issued.data.receipt_id;
    }else{
     const score=scores().find(x=>x.id===selected);
     if(!score)throw Error('選択曲の楽譜データを読み込めませんでした。');
     file=converter.buildLocalBgmFile(score,format);
     dlMessage.textContent='✅ 端末内の曲を保存できます。追加料金0G（オンライン印税決済の対象外）。';
    }
   }
   if(pick.value!==selected)throw Error('保存中に曲の選択が変わりました。もう一度選んでください。');
   savedFileUrl=URL.createObjectURL(file.blob);
   saveFile.href=savedFileUrl;saveFile.download=file.filename;saveFile.style.display='inline-block';
   dlMessage.append(document.createTextNode(' 下の「端末に保存」を押してください。'));
  }catch(e){dlMessage.textContent='⚠️ 保存できませんでした: '+(e?.message||String(e));}
  finally{downloading=false;[wav,midi,xml].forEach(b=>b.disabled=false);}
 }
 buyMusic.onclick=()=>{
  const opening=dl.style.display==='none';
  dl.style.display=opening?'block':'none';
  clearSavedFile();
  if(opening){
   dlHeading.textContent='💾 '+(pick.selectedOptions[0]?.textContent||'選択中のBGM')+'を保存';
   dlMessage.textContent=pick.value.startsWith('online:')?'購入・制作権利を確認して保存します（再保存0G）。':
    pick.value.startsWith('voice:')?'自分の録音音声は無料で保存できます。':'選択中のBGMをWAV、MIDI、MusicXMLで無料保存できます。';
  }
 };
 wav.onclick=()=>prepareDirectFile('wav');
 midi.onclick=()=>prepareDirectFile('midi');
 xml.onclick=()=>prepareDirectFile('musicxml');
 publishMusic.onclick=async()=>{
  const id=selectedMusicId();
  if(!id){status('🌍 共用マーケットの購入済み/自作楽曲をBGMに選んでください。');return;}
  try{
   if(!host.getOnlineClient)throw Error('オンライン市場に接続できません。');
   const db=await host.getOnlineClient();
   const auth=await db.auth.getSession();
   if(!auth.data?.session)throw Error('先に共用マーケットからGitHubログインしてください。');
   const name=global.prompt('公開する村の名前を入力してください（最大60文字）','音楽のある村');
   if(name==null)return;
   if(!name.trim()||name.trim().length>60)throw Error('村名は1〜60文字で入力してください。');
   const r=await db.rpc('fw_creator_set_village_bgm',{p_work_id:id,p_village_name:name.trim()});
   if(r.error)throw r.error;
   const share='creator-market/village-bgm.html?village='+encodeURIComponent(auth.data.session.user.id);
   status('🌍 BGMを村に公開しました。訪問者は村の音楽を試聴・購入できます。');
   shareLink.href=share;shareLink.style.display='inline-block';
  }catch(e){status('BGM公開に失敗: '+(e.message||e));}
 };
 visitVillages.onclick=()=>global.open('creator-market/village-bgm.html','_blank','noopener');
 playBtn.onclick=play;stopBtn.onclick=()=>{stop();status('BGMを停止しました。');};reloadBtn.onclick=refresh;
 trigger.onclick=()=>{
  panel.style.display=panel.style.display==='none'?'block':'none';
  if(panel.style.display==='block')refresh();
 };
 function applyPendingImport(){
  if(!importLib)return false;
  try{
   const raw=localStorage.getItem(importLib.latestKey);
   if(!raw)return false;
   const incoming=JSON.parse(raw);localStorage.removeItem(importLib.latestKey);
   if(!incoming.id||!/^[a-zA-Z0-9_-]+$/.test(incoming.id))return false;
   pendingImportId='import:'+incoming.id;prefs().trackId=pendingImportId;persist();return true;
  }catch(e){return false;}
 }
 function sync(){
  stop();const p=prefs();applyPendingImport();
  if(pendingImportId){p.trackId=pendingImportId;persist();pendingImportId=null;}
  loop.checked=!!p.loop;updateVolume();refresh();
 }
 global.addEventListener('storage',e=>{
  if(importLib&&e.key===importLib.latestKey&&e.newValue){
   stop();applyPendingImport();refresh().then(()=>status('📂 端末に保存した曲をBGMに設定しました。▶ 再生で開始してください。'));
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 global.addEventListener('pagehide',()=>{stop();cleanupAudioUrl();clearSavedFile();});
 applyPendingImport();loop.checked=!!prefs().loop;updateVolume();refresh();
 return {stop,play,refresh,sync,get playing(){return playing;}};
}
global.FW_GAME_BGM49={install};
})(window);