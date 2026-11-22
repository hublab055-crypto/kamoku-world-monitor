/** Browser-local binary media store; JSON saves contain only media IDs. */
const DB_NAME="universal-engine-media-v1";
const STORE="files";
let currentDb=null;
export function openMediaDb(){
 if(currentDb)return currentDb;
 if(typeof indexedDB==="undefined")return Promise.reject(new Error("この環境ではIndexedDBが使用できません"));
 currentDb=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
  req.onerror=()=>reject(req.error||new Error("メディア保存領域を開けません"));
  req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
 }).catch(err=>{currentDb=null;throw err;});
 return currentDb;
}
async function transaction(mode,action){
 const db=await openMediaDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
  let value,request;
  try{request=action(store);}catch(e){reject(e);return;}
  if(request){request.onsuccess=()=>{value=request.result;};}
  tx.oncomplete=()=>resolve(value);
  tx.onerror=()=>reject(tx.error||new Error("メディア保存処理に失敗しました"));
  tx.onabort=()=>reject(tx.error||new Error("メディア保存が中断されました"));
 });
}
export function createMediaBlobKey(){
 const bytes=new Uint8Array(16);
 if(typeof crypto!=="undefined"&&crypto.getRandomValues)crypto.getRandomValues(bytes);
 else throw new Error("安全なファイルIDを生成できません");
 return "ue-media-"+Array.from(bytes,x=>x.toString(16).padStart(2,"0")).join("");
}
export async function storeMediaFile(file,key){
 if(!(file instanceof Blob))throw new TypeError("ファイルを選択してください");
 if(file.size<1||file.size>75*1024*1024)throw new RangeError("アップロードは1件75MB以下です");
 await transaction("readwrite",store=>store.put(file,key));
 return {key,mime:file.type,name:file.name||"media"};
}
export const readMediaFile=key=>transaction("readonly",store=>store.get(key));
export const deleteMediaFile=key=>transaction("readwrite",store=>store.delete(key));
