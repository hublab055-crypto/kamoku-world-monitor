/* FW48.6 — microphone recorder for Frontier World, entirely local.
 * Microphone access only after explicit user gesture.
 * Does not transmit, autosave or convert audio to MIDI.
 */
(function(global){
'use strict';
const $=id=>document.getElementById(id);
const status=$('micStatus'),audio=$('micPreview'),btnStart=$('micStart'),btnStop=$('micStop'),btnSave=$('micSave'),btnDownload=$('micDownload');
if(!status||!audio)return;
let stream=null,recorder=null,chunks=[],blob=null,previewUrl=null,limitTimer=null,recordStarted=0;
const maxDuration=180000;
function say(t){status.textContent=t;}
function releaseMic(){
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
 if(limitTimer){clearTimeout(limitTimer);limitTimer=null;}
 btnStart.disabled=false;btnStop.disabled=true;
}
function clearPreview(){
 if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}
 blob=null;audio.removeAttribute('src');audio.load();
 btnSave.disabled=true;btnDownload.disabled=true;
}
function preferredMime(){
 if(!global.MediaRecorder)return '';
 const candidates=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
 return candidates.find(t=>global.MediaRecorder.isTypeSupported&&global.MediaRecorder.isTypeSupported(t))||'';
}
async function start(){
 if(recorder&&recorder.state!=='inactive')return;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!global.MediaRecorder){
  say('このブラウザではマイク録音ができません。HTTPSでSafari/Chromeを利用してください。');return;
 }
 btnStart.disabled=true;clearPreview();chunks=[];
 try{
  // getUserMedia() is invoked directly from the click path.
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
  const mime=preferredMime(),opts=mime?{mimeType:mime}:undefined;
  recorder=new MediaRecorder(stream,opts);
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
  recorder.onerror=()=>{say('録音中にエラーが起きました。');releaseMic();};
  recorder.onstop=()=>{
   const type=recorder.mimeType||mime||chunks[0]?.type||'audio/webm';
   const candidate=new Blob(chunks,{type});chunks=[];
   releaseMic();recorder=null;
   if(!candidate.size){say('録音データがありません。');return;}
   blob=candidate;previewUrl=URL.createObjectURL(blob);audio.src=previewUrl;
   btnSave.disabled=false;btnDownload.disabled=false;
   say('録音完了。再生・端末内の楽曲庫へ保存・ファイル保存ができます。');
  };
  recorder.start(1000);recordStarted=Date.now();btnStop.disabled=false;
  limitTimer=setTimeout(()=>stop(),maxDuration);
  say('🔴 マイク録音中。最長3分です。終了を押すとマイクを切ります。');
 }catch(e){
  releaseMic();recorder=null;
  say(e&&e.name==='NotAllowedError'?'マイクの使用が許可されませんでした。設定から許可できます。':
   '録音を開始できません: '+(e&&e.message?e.message:String(e)));
 }
}
function stop(){
 if(!recorder||recorder.state==='inactive'){releaseMic();return;}
 try{recorder.requestData();}catch(e){}
 try{recorder.stop();}catch(e){releaseMic();}
 // Release hardware access immediately, even while onstop is pending.
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
}
async function save(){
 if(!blob)return;
 const lib=global.FW_AUDIO_LIBRARY;if(!lib){say('音声保存モジュールを読み込めません。');return;}
 btnSave.disabled=true;
 try{
  const result=await lib.put(($('micTitle').value||'マイク録音'),blob);
  say('💾 「'+result.title+'」を端末内の音声ライブラリに保存しました。ゲームのBGM選択にも表示されます。');
 }catch(e){say('保存に失敗しました: '+(e&&e.message||String(e)));}
 btnSave.disabled=false;
}
function download(){
 if(!blob)return;
 const type=blob.type.toLowerCase(),ext=type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':type.includes('webm')?'webm':'audio';
 const safe=String($('micTitle').value||'mic_recording').replace(/[\\/:*?"<>|]/g,'_').slice(0,48)||'mic_recording';
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=safe+'.'+ext;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10000);
}
global.FW_STOP_MIC=function(){if(recorder&&recorder.state!=='inactive')stop();else releaseMic();};
btnStart.addEventListener('click',start);
btnStop.addEventListener('click',stop);
btnSave.addEventListener('click',save);
btnDownload.addEventListener('click',download);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&recorder&&recorder.state==='recording')stop();});
global.addEventListener('pagehide',()=>{
 if(recorder&&recorder.state!=='inactive')stop();
 else releaseMic();
 if(previewUrl)URL.revokeObjectURL(previewUrl);
});
btnStop.disabled=true;btnSave.disabled=true;btnDownload.disabled=true;
say('マイクは録音開始を押すまで使用しません。録音データは送信されません。');
})(window);