/* FW48.6 — on-device microphone recording library.
 * IndexedDB only. Audio never leaves the user's browser or gets uploaded.
 */
(function(global){
'use strict';
const DB='fw_frontier_recorded_audio_v1',STORE='tracks',LIMIT=12*1024*1024;
let pending=null;
function open(){
 if(!('indexedDB' in global))return Promise.reject(new Error('この端末では録音保存が使えません。'));
 if(pending)return pending;
 pending=new Promise((resolve,reject)=>{
  const req=global.indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error('録音保存領域を開けません。'));
 }).catch(e=>{pending=null;throw e;});
 return pending;
}
async function put(title,blob){
 if(!(blob instanceof Blob)||blob.size<1||blob.size>LIMIT)throw Error('録音データは1件12MB以内にしてください。');
 const db=await open(),id='voice_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
 const entry={id,title:String(title||'マイク録音').trim().slice(0,60)||'マイク録音',created:new Date().toISOString(),mime:blob.type,size:blob.size,blob};
 await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');
  tx.objectStore(STORE).put(entry);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('録音を保存できません。'));
 });
 return {id:entry.id,title:entry.title,created:entry.created,mime:entry.mime,size:entry.size};
}
async function list(){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const results=[];
  const tx=db.transaction(STORE,'readonly'),req=tx.objectStore(STORE).openCursor();
  req.onsuccess=()=>{
   const cursor=req.result;if(!cursor){resolve(results.sort((a,b)=>b.created.localeCompare(a.created)));return;}
   const {id,title,created,mime,size}=cursor.value;
   results.push({id,title,created,mime,size});cursor.continue();
  };
  req.onerror=()=>reject(req.error||new Error('一覧を取得できません。'));
 });
}
async function get(id){
 const db=await open();return new Promise((resolve,reject)=>{
  const req=db.transaction(STORE,'readonly').objectStore(STORE).get(String(id));
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error||new Error('録音が見つかりません。'));
 });
}
async function remove(id){
 const db=await open();await new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(String(id));
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('録音を削除できません。'));
 });
}
global.FW_AUDIO_LIBRARY={put,list,get,remove,maxBytes:LIMIT};
})(window);