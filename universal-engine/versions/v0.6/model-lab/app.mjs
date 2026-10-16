import {ORIGINAL_MODELS,buildOriginalModel} from "../original-assets/original-models.mjs";
import {exportOriginalGLB,exportOriginalOBJ} from "../original-assets/export.mjs";
import {OriginalModelViewer} from "./viewer.mjs";

const $=id=>document.getElementById(id);
const CATEGORIES={avatar:"人物",nature:"自然",building:"建物",equipment:"装備"};
let viewer=null,selected="pioneer",last=0,drag=null;
function setError(msg){$("viewer-error").hidden=!msg;$("viewer-error").textContent=msg||"";}
function load(id){
 const info=ORIGINAL_MODELS.find(x=>x.id===id);
 if(!info)return;
 try{
   const model=viewer.load(id);
   selected=id;
   $("model-select").value=id;
   $("selected-name").textContent=info.name;
   $("model-description").textContent=info.description;
   $("model-id").textContent=model.id;
   $("vertices").textContent=model.parts.reduce((s,p)=>s+p.geometry.positions.length/3,0).toLocaleString("ja-JP");
   $("triangles").textContent=model.parts.reduce((s,p)=>s+p.geometry.indices.length/3,0).toLocaleString("ja-JP");
   $("animation-count").textContent=model.kind==="avatar"?"5種類（GLB）":"静止モデル";
   $("animation-select").disabled=model.kind!=="avatar";
   if(model.kind!=="avatar")viewer.setClip("idle");else viewer.setClip($("animation-select").value);
   for(const item of document.querySelectorAll("[data-model-id]"))
     item.setAttribute("aria-pressed",String(item.dataset.modelId===id));
   setError("");
 }catch(e){setError("モデル読み込みエラー: "+e.message);}
}
function triggerDownload(filename,bytes,mime){
 const blob=new Blob([bytes],{type:mime});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=filename;
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),3500);
}
$("download-glb").addEventListener("click",()=>{
 try{
  const bytes=exportOriginalGLB(buildOriginalModel(selected));
  triggerDownload("universal-engine-"+selected+".glb",bytes,"model/gltf-binary");
 }catch(e){setError("GLB保存失敗: "+e.message);}
});
$("download-obj").addEventListener("click",()=>{
 try{
  triggerDownload("universal-engine-"+selected+".obj",
    exportOriginalOBJ(buildOriginalModel(selected)),"text/plain;charset=utf-8");
 }catch(e){setError("OBJ保存失敗: "+e.message);}
});
$("model-select").addEventListener("change",()=>load($("model-select").value));
$("animation-select").addEventListener("change",()=>viewer?.setClip($("animation-select").value));
$("auto-rotate").addEventListener("click",()=>{
 viewer.autoRotate=!viewer.autoRotate;
 $("auto-rotate").setAttribute("aria-pressed",String(viewer.autoRotate));
 $("auto-rotate").textContent="↻ 自動回転 "+(viewer.autoRotate?"ON":"OFF");
});
$("home-camera").addEventListener("click",()=>load(selected));
const canvas=$("preview");
canvas.addEventListener("pointerdown",e=>{
 drag={id:e.pointerId,x:e.clientX,y:e.clientY};
 canvas.setPointerCapture?.(e.pointerId);
});
canvas.addEventListener("pointermove",e=>{
 if(!drag||drag.id!==e.pointerId)return;
 viewer.setOrientation(e.clientX-drag.x,e.clientY-drag.y);
 drag.x=e.clientX;drag.y=e.clientY;
});
for(const event of ["pointerup","pointercancel","lostpointercapture"]){
 canvas.addEventListener(event,()=>drag=null);
}
canvas.addEventListener("wheel",e=>{e.preventDefault();viewer.zoom(e.deltaY);},{passive:false});
function tick(t){
 const dt=last?Math.min(.06,(t-last)/1000):0;last=t;
 if(viewer){
  try{viewer.render(dt);}
  catch(e){setError("描画エラー: "+e.message);viewer.destroy();viewer=null;}
 }
 requestAnimationFrame(tick);
}
for(const entry of ORIGINAL_MODELS){
 const option=document.createElement("option");
 option.value=entry.id;option.textContent=entry.name;
 $("model-select").appendChild(option);
 const button=document.createElement("button");
 button.type="button";button.className="model-item";button.dataset.modelId=entry.id;
 button.setAttribute("aria-pressed","false");
 const type=document.createElement("span");type.className="type";type.textContent=CATEGORIES[entry.kind];
 const name=document.createElement("strong");name.textContent=entry.name;
 const desc=document.createElement("span");desc.className="desc";desc.textContent=entry.description;
 button.append(type,name,desc);
 button.addEventListener("click",()=>load(entry.id));
 $("model-cards").appendChild(button);
}
try{
 viewer=new OriginalModelViewer(canvas);
 load("pioneer");
 requestAnimationFrame(tick);
}catch(e){
 setError("このブラウザでは3Dプレビューを利用できません: "+e.message);
 // Download functions still work and require no GPU.
 $("selected-name").textContent="モデルのダウンロードは利用できます";
 selected="pioneer";
}
