/* Frontier World — imported BGM library. Files and melodies remain on this device.
 * Native audio is played through HTMLAudio; MIDI/MusicXML becomes synthesizer notes.
 * Local file import never invokes market purchases and never changes game coins.
 */
(function(global){
'use strict';
const DB='fw_frontier_bgm_import_v1',STORE='songs',LIMIT=16*1024*1024,MAX=40;
const LATEST_KEY='fw_frontier_bgm_import_latest_v1';
let pending=null;
function open(){
 if(!global.indexedDB)return Promise.reject(Error('この端末では楽曲の保存領域を使えません。'));
 if(pending)return pending;
 pending=new Promise((resolve,reject)=>{
  const req=global.indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error('端末のBGMライブラリを開けません。'));
 }).catch(err=>{pending=null;throw err;});
 return pending;
}
function wait(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||Error('保存に失敗しました。'));tx.onabort=()=>reject(tx.error||Error('保存できませんでした。'));});}
function read(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error||Error('ファイルを読めませんでした。'));fr.readAsArrayBuffer(file);});}
function midiScore(bytes,title){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<22||String.fromCharCode(...bytes.slice(0,4))!=='MThd')throw Error('MIDIのヘッダーが見つかりません。');
 const size=dv.getUint32(4),format=dv.getUint16(8),tracks=dv.getUint16(10),division=dv.getUint16(12);
 if(size<6||size>64||format>1||tracks<1||tracks>32||!division||(division&0x8000))throw Error('対応していないMIDIファイルです。');
 let p=8+size,tempo=500000,events=[],seq=0;
 function varlen(limit){let v=0;for(let j=0;j<4;j++){if(p>=limit)throw Error('MIDIの途中でデータが途切れています。');const b=bytes[p++];v=(v<<7)|(b&127);if(!(b&128))return v;}throw Error('不正なMIDI可変長です。');}
 for(let track=0;track<tracks;track++){
  if(p+8>bytes.length||String.fromCharCode(...bytes.slice(p,p+4))!=='MTrk')throw Error('MIDIトラックが不正です。');
  const len=dv.getUint32(p+4);p+=8;const limit=p+len;if(limit>bytes.length)throw Error('MIDIトラックが途中で切れています。');
  let tick=0,running=0,active=new Map();
  while(p<limit){
   tick+=varlen(limit);
   if(tick>10000000)throw Error('MIDIが長すぎます。');
   const peek=bytes[p],status=peek>=128?bytes[p++]:running;
   if(status===0xFF){if(p>=limit)throw Error('メタイベントが壊れています。');
    const type=bytes[p++],n=varlen(limit);if(p+n>limit)throw Error('メタイベントの長さが不正です。');
    if(type===0x51&&n===3&&tick===0)tempo=(bytes[p]<<16)|(bytes[p+1]<<8)|bytes[p+2];
    p+=n;running=0;if(type===0x2F)break;continue;
   }
   if(status===0xF0||status===0xF7){const n=varlen(limit);p+=n;if(p>limit)throw Error('SysExの長さが不正です。');running=0;continue;}
   if(status<0x80||status>=0xF0)throw Error('未対応のMIDIイベントです。');
   running=status;const kind=status&0xF0,channel=status&0x0F,n=kind===0xC0||kind===0xD0?1:2;
   if(p+n>limit)throw Error('MIDI音符データが壊れています。');
   const a=bytes[p++],b=n===2?bytes[p++]:0;
   if(kind!==0x80&&kind!==0x90)continue;
   const key=channel+':'+a;
   if(kind===0x90&&b>0){
    if(!active.has(key))active.set(key,[]);
    active.get(key).push(tick);
   }else{
    const stack=active.get(key);
    if(stack&&stack.length){const at=stack.shift();events.push({pitch:a,start:at/ division,duration:Math.max(.125,(tick-at)/division),seq:seq++});}
   }
  }
  p=limit;
 }
 if(!events.length)throw Error('MIDIに再生できる音符がありません。');
 events.sort((a,b)=>a.start-b.start||a.seq-b.seq);
 if(events.length>400||events.some(e=>e.start+e.duration>1000))throw Error('MIDIは音符400個・1000拍まで対応しています。');
 return {title,bpm:Math.max(35,Math.min(240,Math.round(60000000/Math.max(1,tempo)))),instrument:'organ',
 notes:events.map(({pitch,start,duration})=>({pitch,start,duration}))};
}
function child(elem,name){return Array.from(elem.children||[]).find(e=>e.localName===name)||null;}
function str(elem,name){return child(elem,name)?.textContent?.trim()||'';}
function xmlScore(bytes,title){
 const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(/<!ENTITY/i.test(xml))throw Error('外部エンティティを含む楽譜は読み込めません。');
 const parsed=new DOMParser().parseFromString(xml,'application/xml');
 if(parsed.querySelector('parsererror')||parsed.documentElement?.localName!=='score-partwise')throw Error('MusicXML形式の楽譜を選んでください。');
 const part=Array.from(parsed.documentElement.children).find(e=>e.localName==='part');
 if(!part)throw Error('楽譜にパートがありません。');
 const semitone={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
 let divisions=480,beats=0,notes=[],measureStart=0;
 for(const measure of Array.from(part.children).filter(e=>e.localName==='measure')){
  measureStart=beats;let cursor=measureStart,measureMax=measureStart,priorStart=cursor;
  for(const item of Array.from(measure.children)){
   if(item.localName==='attributes'){const d=Number(str(item,'divisions'));if(d>0&&d<=100000)divisions=d;}
   else if(item.localName==='backup'||item.localName==='forward'){
    const d=Number(str(item,'duration'))/divisions;
    if(Number.isFinite(d)&&d>0)cursor+=(item.localName==='backup'?-d:d);
   }else if(item.localName==='note'){
    const dur=Math.max(.125,Number(str(item,'duration'))/divisions||1);
    const chord=!!child(item,'chord'),at=chord?priorStart:cursor;
    if(!child(item,'rest')){
     const pt=child(item,'pitch'),step=pt&&str(pt,'step').toUpperCase(),oct=pt&&Number(str(pt,'octave')),
      alter=pt&&Number(str(pt,'alter')||0);
     const pitch=(oct+1)*12+semitone[step]+alter;
     if(Number.isInteger(pitch)&&pitch>=24&&pitch<=108)notes.push({pitch,start:at,duration:dur});
    }
    if(!chord){priorStart=cursor;cursor+=dur;}
    measureMax=Math.max(measureMax,at+dur,cursor);
   }
  }
  beats=Math.max(beats,measureMax);
 }
 if(!notes.length)throw Error('楽譜に再生可能な音符がありません。');
 if(notes.length>400||notes.some(n=>n.start+n.duration>1000))throw Error('楽譜は音符400個・1000拍まで対応しています。');
 const importedTitle=str(child(parsed.documentElement,'work')||parsed.documentElement,'work-title')||
   str(parsed.documentElement,'movement-title')||title;
 return {title:importedTitle.slice(0,90),bpm:120,instrument:'organ',notes};
}
function nameFrom(file,title){return String(title||file.name||'ダウンロード曲').replace(/\.[^.]+$/,'').trim().slice(0,90)||'ダウンロード曲';}
function licenseInfo(bytes){
 const view=bytes.length<30000?bytes:new Uint8Array([...bytes.slice(0,5000),...bytes.slice(-18000)]);
 const text=new TextDecoder('latin1').decode(view);
 const id=(text.match(/FW-DL:([0-9a-f-]{36})/i)||[])[1]||null;
 const workId=id?(text.match(/WORK:([0-9a-f-]{36})/i)||[])[1]||null:null;
 return {licenseId:id,workId};
}
function makeRecord(file,bytes,title){
 const magic=String.fromCharCode(...bytes.slice(0,4)),ext=String(file.name||'').split('.').pop().toLowerCase();
 let score=null,kind='',mime='';
 const label=nameFrom(file,title),license=licenseInfo(bytes);
 if(magic==='MThd'){score=midiScore(bytes,label);kind='score';mime='audio/midi';}
 else if(ext==='musicxml'||ext==='xml'){score=xmlScore(bytes,label);kind='score';mime='application/vnd.recordare.musicxml+xml';}
 else if(magic==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WAVE'){kind='audio';mime='audio/wav';}
 else if(['mp3','m4a','aac','ogg','webm'].includes(ext)){
  kind='audio';mime=({mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',webm:'audio/webm'})[ext];
 }else throw Error('対応形式はWAV・MIDI・MusicXML・MP3・M4A・OGG・WebMです。');
 return {id:'bgmf_'+(global.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)),title:score?.title||label,
  kind,mime,blob:new Blob([bytes],{type:mime}),score,licenseId:license.licenseId,workId:license.workId,created:new Date().toISOString(),size:bytes.length};
}
async function putFile(file,title){
 if(!(file instanceof Blob)||file.size<1||file.size>LIMIT)throw Error('楽曲は1件16MB以内にしてください。');
 const bytes=new Uint8Array(await read(file)),entry=makeRecord(file,bytes,title);
 const previous=await list();if(previous.length>=MAX)throw Error('端末のBGM保存数は40曲までです。不要な曲を削除してください。');
 const db=await open();const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(entry);await wait(tx);
 return {id:entry.id,title:entry.title,kind:entry.kind,licenseId:entry.licenseId,workId:entry.workId,size:entry.size};
}
async function putBlob(blob,filename,title){
 const f=new File([blob],filename,{type:blob.type||'application/octet-stream'});
 return putFile(f,title);
}
async function list(){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).getAll();
  req.onsuccess=()=>resolve((req.result||[]).map(({id,title,kind,mime,licenseId,workId,size,created})=>({id,title,kind,mime,licenseId,size,created})).sort((a,b)=>b.created.localeCompare(a.created)));
  req.onerror=()=>reject(req.error||Error('BGM曲一覧を読み込めませんでした。'));
 });
}
async function get(id){
 const db=await open();return new Promise((resolve,reject)=>{
  const req=db.transaction(STORE,'readonly').objectStore(STORE).get(String(id));
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error||Error('保存済み曲を読み込めませんでした。'));
 });
}
async function remove(id){
 const db=await open();const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(String(id));await wait(tx);
}
function activate(id){
 // Notify other tabs without disclosing or uploading the audio bytes.
 localStorage.setItem(LATEST_KEY,JSON.stringify({id:String(id),at:Date.now()}));
}
global.FW_BGM_IMPORT={putFile,putBlob,list,get,remove,activate,latestKey:LATEST_KEY,maxBytes:LIMIT};
})(window);