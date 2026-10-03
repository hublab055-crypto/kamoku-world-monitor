(() => {
"use strict";

const DB_NAME = "frontier-world-creator-assets";
const DB_VERSION = 1;
const STORE = "images";
const HISTORY_LIMIT = 24;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

let dbPromise = null;
let current = null;
let libraryMode = "active";
let tool = "brush";
let painting = false;
let lastPoint = null;
let lineStart = null;
let lineBase = null;
let history = [];
let historyIndex = -1;
let objectUrls = [];

const canvas = $("#imagePaintCanvas");
const ctx = canvas.getContext("2d", {willReadFrequently:true});
ctx.imageSmoothingEnabled = false;

function openDb(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if(!db.objectStoreNames.contains(STORE)){
        const st = db.createObjectStore(STORE,{keyPath:"id"});
        st.createIndex("deletedAt","deletedAt",{unique:false});
        st.createIndex("updatedAt","updatedAt",{unique:false});
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}

async function dbAll(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const req=tx.objectStore(STORE).getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>reject(req.error);
  });
}
async function dbPut(record){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete=()=>resolve(record);
    tx.onerror=()=>reject(tx.error);
  });
}
async function dbDelete(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

function uid(){ return "img_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7); }
function toast(msg){
  const el=$("#toast"); if(!el) return;
  el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),1800);
}
function safeName(s){ return (s||"image").replace(/[\\/:*?"<>|]+/g,"_").trim() || "image"; }
function canvasBlob(type="image/png",quality){
  return new Promise(resolve=>canvas.toBlob(resolve,type,quality));
}
function clearUrls(){ objectUrls.forEach(URL.revokeObjectURL); objectUrls=[]; }

function createNewDialog(){
  if($("#imageNewDialog")) return;
  const dialog=document.createElement("dialog");
  dialog.id="imageNewDialog";
  dialog.className="image-dialog";
  dialog.innerHTML=`
    <form method="dialog" class="panel image-new-form">
      <div class="panel-head"><div><h3>新しい画像</h3><p>透明なキャンバスを作成します。</p></div></div>
      <label class="field"><span>画像名</span><input id="newImageName" value="new_image"></label>
      <div class="form-row">
        <label class="field"><span>幅 px</span><input id="newImageWidth" type="number" min="1" max="4096" value="256"></label>
        <label class="field"><span>高さ px</span><input id="newImageHeight" type="number" min="1" max="4096" value="256"></label>
      </div>
      <div class="image-bottom-actions">
        <button value="cancel" class="ghost">キャンセル</button>
        <button id="confirmNewImage" value="default" class="primary">作成</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  dialog.addEventListener("close",async()=>{
    if(dialog.returnValue!=="default") return;
    const w=Math.max(1,Math.min(4096,Number($("#newImageWidth").value)||256));
    const h=Math.max(1,Math.min(4096,Number($("#newImageHeight").value)||256));
    const name=$("#newImageName").value.trim()||"new_image";
    await newBlankImage(name,w,h);
  });
}

async function newBlankImage(name,w,h){
  canvas.width=w; canvas.height=h; ctx.clearRect(0,0,w,h);
  const blob=await canvasBlob();
  const now=Date.now();
  const rec={id:uid(),name,tags:"",notes:"",width:w,height:h,blob,createdAt:now,updatedAt:now,deletedAt:null};
  await dbPut(rec);
  current=rec;
  resetHistory();
  syncMeta();
  updateCanvasScale();
  await renderLibrary();
  toast("新しい画像を作成しました");
}

async function importFile(file){
  if(!file) return;
  const img=await blobToImage(file);
  canvas.width=img.naturalWidth||img.width;
  canvas.height=img.naturalHeight||img.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0);
  const blob=await canvasBlob("image/png");
  const now=Date.now();
  const name=file.name.replace(/\.[^.]+$/,"");
  const rec={id:uid(),name,tags:"",notes:"",width:canvas.width,height:canvas.height,blob,sourceName:file.name,createdAt:now,updatedAt:now,deletedAt:null};
  await dbPut(rec);
  current=rec;
  resetHistory();
  syncMeta();
  updateCanvasScale();
  libraryMode="active";
  updateModeButtons();
  await renderLibrary();
  toast("画像を取り込みました");
}

function blobToImage(blob){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(blob);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("画像を読み込めませんでした"));};
    img.src=url;
  });
}

async function loadRecord(rec){
  current=rec;
  const img=await blobToImage(rec.blob);
  canvas.width=rec.width||img.naturalWidth||img.width;
  canvas.height=rec.height||img.naturalHeight||img.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  resetHistory();
  syncMeta();
  updateCanvasScale();
  updateModeButtons();
  $$("#imageLibrary .image-card").forEach(el=>el.classList.toggle("active",el.dataset.id===rec.id));
}

function syncMeta(){
  const has=!!current;
  $("#imageName").value=has?(current.name||""):"";
  $("#imageTags").value=has?(current.tags||""):"";
  $("#imageNotes").value=has?(current.notes||""):"";
  $("#imageDimensions").textContent=has?(canvas.width+" × "+canvas.height+" px"):"—";
  $("#btnImageDelete").hidden=!has || !!current.deletedAt;
  $("#btnImageRestore").hidden=!has || !current.deletedAt;
  $("#btnImageDeleteForever").hidden=!has || !current.deletedAt;
  const editable=has && !current.deletedAt;
  ["imageName","imageTags","imageNotes","btnImageSave","btnImageDuplicate","btnImageClear","btnImageUndo","btnImageRedo"].forEach(id=>{
    const el=$("#"+id); if(el) el.disabled=!editable;
  });
  $("#btnImageExportPng").disabled=!has;
  $(".image-tool").forEach(el=>el.disabled=!editable);
  $("#imageColor").disabled=!editable;
  $("#imageBrushSize").disabled=!editable;
}

async function saveCurrent(silent=false){
  if(!current || current.deletedAt) return;
  const target=current;
  const meta={
    name:$("#imageName").value.trim()||target.name||"image",
    tags:$("#imageTags").value.trim(),
    notes:$("#imageNotes").value,
    width:canvas.width,
    height:canvas.height
  };
  const blob=await canvasBlob("image/png");
  Object.assign(target,meta,{blob,updatedAt:Date.now()});
  await dbPut(target);
  await renderLibrary();
  if(!silent && current && current.id===target.id) toast("画像を保存しました");
}

async function renderLibrary(){
  clearUrls();
  const all=await dbAll();
  const q=($("#imageSearch").value||"").trim().toLowerCase();
  const list=all
    .filter(r=>libraryMode==="trash" ? !!r.deletedAt : !r.deletedAt)
    .filter(r=>(String(r.name||"")+" "+String(r.tags||"")).toLowerCase().includes(q))
    .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  const box=$("#imageLibrary");
  if(!list.length){
    box.innerHTML='<div class="image-empty">'+(libraryMode==="trash"?"ゴミ箱は空です。":"画像がありません。")+'</div>';
    return;
  }
  box.innerHTML="";
  for(const rec of list){
    const url=URL.createObjectURL(rec.blob); objectUrls.push(url);
    const card=document.createElement("button");
    card.className="image-card"+(current&&current.id===rec.id?" active":"");
    card.dataset.id=rec.id;
    card.innerHTML='<div class="image-thumb checker"><img alt=""></div><div class="image-card-meta"><b></b><small></small></div>';
    card.querySelector("img").src=url;
    card.querySelector("b").textContent=rec.name||rec.id;
    card.querySelector("small").textContent=(rec.width||"?")+"×"+(rec.height||"?")+(rec.tags?" • "+rec.tags:"");
    card.onclick=()=>loadRecord(rec);
    box.appendChild(card);
  }
}

function updateModeButtons(){
  $("#btnImageLibraryTab").classList.toggle("active",libraryMode==="active");
  $("#btnImageTrashTab").classList.toggle("active",libraryMode==="trash");
  $("#btnImageTrashView").classList.toggle("active",libraryMode==="trash");
  if(current) syncMeta();
}

function resetHistory(){
  history=[ctx.getImageData(0,0,canvas.width,canvas.height)];
  historyIndex=0;
  updateUndoButtons();
}
function pushHistory(){
  history=history.slice(0,historyIndex+1);
  history.push(ctx.getImageData(0,0,canvas.width,canvas.height));
  if(history.length>HISTORY_LIMIT) history.shift();
  historyIndex=history.length-1;
  updateUndoButtons();
}
function updateUndoButtons(){
  $("#btnImageUndo").disabled=!current||historyIndex<=0;
  $("#btnImageRedo").disabled=!current||historyIndex>=history.length-1;
}
function undo(){
  if(historyIndex<=0) return;
  historyIndex--; ctx.putImageData(history[historyIndex],0,0); updateUndoButtons();
}
function redo(){
  if(historyIndex>=history.length-1) return;
  historyIndex++; ctx.putImageData(history[historyIndex],0,0); updateUndoButtons();
}

function pointerPoint(e){
  const r=canvas.getBoundingClientRect();
  return {
    x:Math.max(0,Math.min(canvas.width-1,(e.clientX-r.left)*canvas.width/r.width)),
    y:Math.max(0,Math.min(canvas.height-1,(e.clientY-r.top)*canvas.height/r.height))
  };
}
function configureStroke(){
  ctx.lineCap="round";ctx.lineJoin="round";
  ctx.lineWidth=Number($("#imageBrushSize").value)||1;
  ctx.strokeStyle=$("#imageColor").value;
}
function drawSegment(a,b,erase=false){
  ctx.save(); configureStroke();
  if(erase) ctx.globalCompositeOperation="destination-out";
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.restore();
}
function colorHexAt(x,y){
  const d=ctx.getImageData(Math.floor(x),Math.floor(y),1,1).data;
  return "#"+[d[0],d[1],d[2]].map(v=>v.toString(16).padStart(2,"0")).join("");
}
function hexRgb(hex){
  const n=parseInt(hex.replace("#",""),16);
  return [(n>>16)&255,(n>>8)&255,n&255,255];
}
function floodFill(x,y,hex){
  x=Math.floor(x);y=Math.floor(y);
  const img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data,w=canvas.width,h=canvas.height;
  const start=(y*w+x)*4;
  const target=[d[start],d[start+1],d[start+2],d[start+3]], repl=hexRgb(hex);
  if(target.every((v,i)=>v===repl[i])) return;
  const same=i=>d[i]===target[0]&&d[i+1]===target[1]&&d[i+2]===target[2]&&d[i+3]===target[3];
  const stack=[[x,y]], seen=new Uint8Array(w*h);
  while(stack.length){
    const [cx,cy]=stack.pop(), pi=cy*w+cx;
    if(cx<0||cy<0||cx>=w||cy>=h||seen[pi]) continue;
    seen[pi]=1; const i=pi*4; if(!same(i)) continue;
    d[i]=repl[0];d[i+1]=repl[1];d[i+2]=repl[2];d[i+3]=repl[3];
    stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
  }
  ctx.putImageData(img,0,0);
}

canvas.addEventListener("pointerdown",e=>{
  if(!current || current.deletedAt) return;
  e.preventDefault(); canvas.setPointerCapture?.(e.pointerId);
  const p=pointerPoint(e);
  if(tool==="eyedropper"){ $("#imageColor").value=colorHexAt(p.x,p.y); return; }
  if(tool==="fill"){ floodFill(p.x,p.y,$("#imageColor").value);pushHistory();saveCurrent(true);return; }
  painting=true;lastPoint=p;
  if(tool==="line"){lineStart=p;lineBase=ctx.getImageData(0,0,canvas.width,canvas.height);}
  else if(tool==="brush"||tool==="eraser"){drawSegment(p,{x:p.x+.01,y:p.y+.01},tool==="eraser");}
});
canvas.addEventListener("pointermove",e=>{
  if(!painting||!current) return;
  e.preventDefault(); const p=pointerPoint(e);
  if(tool==="line"&&lineBase){ctx.putImageData(lineBase,0,0);drawSegment(lineStart,p,false);}
  else if(tool==="brush"||tool==="eraser"){drawSegment(lastPoint,p,tool==="eraser");lastPoint=p;}
});
function endPaint(e){
  if(!painting) return;
  if(tool==="line"&&lineBase){const p=pointerPoint(e);ctx.putImageData(lineBase,0,0);drawSegment(lineStart,p,false);}
  painting=false;lastPoint=null;lineStart=null;lineBase=null;pushHistory();saveCurrent(true);
}
canvas.addEventListener("pointerup",endPaint);
canvas.addEventListener("pointercancel",endPaint);

$$(".image-tool").forEach(btn=>btn.onclick=()=>{
  tool=btn.dataset.imageTool;
  $$(".image-tool").forEach(b=>b.classList.toggle("active",b===btn));
  canvas.dataset.tool=tool;
});
$("#imageBrushSize").oninput=e=>$("#imageBrushSizeValue").textContent=e.target.value;
$("#imageZoom").onchange=updateCanvasScale;
function updateCanvasScale(){
  const zoom=Number($("#imageZoom").value)||1;
  canvas.style.width=(canvas.width*zoom)+"px";
  canvas.style.height=(canvas.height*zoom)+"px";
  $("#imageDimensions").textContent=current?(canvas.width+" × "+canvas.height+" px"):"—";
}

$("#btnImageNew").onclick=()=>{createNewDialog();const d=$("#imageNewDialog");d.returnValue="";d.showModal();};
$("#btnImageImport").onclick=()=>$("#imageImportInput").click();
$("#imageImportInput").onchange=async e=>{const f=e.target.files[0];if(f)await importFile(f);e.target.value="";};
$("#imageSearch").oninput=renderLibrary;
$("#btnImageLibraryTab").onclick=()=>{libraryMode="active";updateModeButtons();renderLibrary();};
$("#btnImageTrashTab").onclick=()=>{libraryMode="trash";updateModeButtons();renderLibrary();};
$("#btnImageTrashView").onclick=()=>{libraryMode=libraryMode==="trash"?"active":"trash";updateModeButtons();renderLibrary();};

$("#btnImageSave").onclick=()=>saveCurrent(false);
$("#btnImageUndo").onclick=undo;
$("#btnImageRedo").onclick=redo;
$("#btnImageClear").onclick=()=>{
  if(!current||current.deletedAt) return;
  if(!confirm("キャンバスを透明にしますか？")) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);pushHistory();saveCurrent(true);toast("キャンバスを消去しました");
};
$("#btnImageExportPng").onclick=async()=>{
  if(!current) return;
  const blob=await canvasBlob("image/png");
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=safeName(current.name)+".png";
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
};
$("#btnImageDuplicate").onclick=async()=>{
  if(!current) return;
  await saveCurrent(true);
  const now=Date.now(),copy={...current,id:uid(),name:(current.name||"image")+" copy",createdAt:now,updatedAt:now,deletedAt:null};
  await dbPut(copy);current=copy;libraryMode="active";updateModeButtons();await renderLibrary();await loadRecord(copy);toast("画像を複製しました");
};
$("#btnImageDelete").onclick=async()=>{
  if(!current||current.deletedAt) return;
  await saveCurrent(true);current.deletedAt=Date.now();current.updatedAt=Date.now();await dbPut(current);
  libraryMode="trash";updateModeButtons();await renderLibrary();syncMeta();toast("ゴミ箱へ移動しました");
};
$("#btnImageRestore").onclick=async()=>{
  if(!current||!current.deletedAt) return;
  current.deletedAt=null;current.updatedAt=Date.now();await dbPut(current);
  libraryMode="active";updateModeButtons();await renderLibrary();syncMeta();toast("画像を復元しました");
};
$("#btnImageDeleteForever").onclick=async()=>{
  if(!current||!current.deletedAt) return;
  if(!confirm("この画像を完全に削除しますか？ この操作は取り消せません。")) return;
  const id=current.id;await dbDelete(id);current=null;
  canvas.width=256;canvas.height=256;ctx.clearRect(0,0,256,256);history=[];historyIndex=-1;syncMeta();updateCanvasScale();await renderLibrary();toast("完全に削除しました");
};

["imageName","imageTags","imageNotes"].forEach(id=>$("#"+id).addEventListener("change",()=>saveCurrent(true)));

const imageNav=$('.nav[data-view="images"]');
if(imageNav) imageNav.addEventListener("click",async()=>{await renderLibrary();if(current)syncMeta();else syncMeta();});

window.addEventListener("beforeunload",()=>clearUrls());
createNewDialog();
syncMeta();
updateCanvasScale();
openDb().then(renderLibrary).catch(e=>toast("画像DBエラー: "+e.message));
})();