import {AssetStudioModel,partAnchor,snapCandidates} from "./asset-studio-model.mjs?v=0.9a-assets";

const DRAFT_KEY="universal-engine:asset-studio:v0.9a";
const $=id=>document.getElementById(id);
const hexToRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const rgbToHex=rgb=>"#"+rgb.map(v=>Math.round(v*255).toString(16).padStart(2,"0")).join("");
const rad=degrees=>Number(degrees)*Math.PI/180;
const deg=radians=>Math.round(radians*180/Math.PI*10)/10;

export function installAssetStudio({getWorld,onCommit,log}){
 const overlay=$("asset-studio"),canvas=$("asset-canvas"),ctx=canvas.getContext("2d"),status=$("asset-status");
 let studio;try{studio=new AssetStudioModel(JSON.parse(localStorage.getItem(DRAFT_KEY)||"null"));}catch(_){studio=new AssetStudioModel();}
 let mode="place",cursor={x:0,y:0},scale=14,pixelRatio=Math.min(2,window.devicePixelRatio||1),dialAngles={x:0,y:0,z:0};
 const template=()=>({shape:$("asset-shape").value,width:Number($("asset-width").value),height:Number($("asset-height").value),
  depth:Number($("asset-depth").value),rotation:rad($("asset-rotation").value),color:hexToRgb($("asset-color").value),group:$("asset-group").value});
 const say=message=>{status.value=message;status.textContent=message;log(message);};
 const persist=()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify(studio.snapshot()));}catch(_){say("Asset下書きの保存に失敗しました");}};
 function resize(){const box=canvas.getBoundingClientRect();pixelRatio=Math.min(2,window.devicePixelRatio||1);const w=Math.max(300,Math.round(box.width*pixelRatio)),h=Math.max(260,Math.round(box.height*pixelRatio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}draw();}
 const screen=(x,y)=>({x:canvas.width/2+x*scale*pixelRatio,y:canvas.height/2+y*scale*pixelRatio});
 const world=(clientX,clientY)=>{const r=canvas.getBoundingClientRect();return {x:((clientX-r.left)*pixelRatio-canvas.width/2)/(scale*pixelRatio),y:((clientY-r.top)*pixelRatio-canvas.height/2)/(scale*pixelRatio)};};
 function shapePath(part){const p=screen(part.x,part.y),dpr=pixelRatio;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(part.rotation);
  ctx.beginPath();if(part.shape==="cube")ctx.rect(-part.width*scale*dpr/2,-part.depth*scale*dpr/2,part.width*scale*dpr,part.depth*scale*dpr);
  else ctx.ellipse(0,0,part.width*scale*dpr/2,part.depth*scale*dpr/2,0,0,Math.PI*2);return ctx;}
 function draw(){
  const dpr=pixelRatio,w=canvas.width,h=canvas.height,step=scale*dpr;ctx.clearRect(0,0,w,h);ctx.fillStyle="#0b1c25";ctx.fillRect(0,0,w,h);
  ctx.lineWidth=1;for(let x=w/2%step;x<w;x+=step){ctx.strokeStyle=Math.abs(x-w/2)<1?"#568399":"#193843";ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let y=h/2%step;y<h;y+=step){ctx.strokeStyle=Math.abs(y-h/2)<1?"#568399":"#193843";ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  for(const part of studio.parts){const same=Math.abs(part.z-studio.planeZ)<.001,selected=studio.selected.has(part.id),path=shapePath(part);
   const c=part.color.map(v=>Math.round(v*255));ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${same?.78:.22})`;ctx.fill();ctx.strokeStyle=selected?"#ffe278":same?"#b7e0e8":"#637984";ctx.lineWidth=(selected?3:1.2)*dpr;ctx.setLineDash(same?[]:[5*dpr,4*dpr]);ctx.stroke();ctx.restore();
   if(selected){for(const a of ["top-left","top","top-right","right","bottom-right","bottom","bottom-left","left","center"]){const anchor=partAnchor(part,a),q=screen(anchor.x,anchor.y);ctx.fillStyle="#ffe278";ctx.fillRect(q.x-2*dpr,q.y-2*dpr,4*dpr,4*dpr);}}
  }ctx.setLineDash([]);
  for(const point of snapCandidates(studio.parts,$("asset-snap-mode").value)){const p=screen(point.x,point.y);ctx.strokeStyle=point.kind==="centroid"?"#ff9fd7":"#79e7ff";ctx.lineWidth=1*dpr;ctx.beginPath();ctx.moveTo(p.x-3*dpr,p.y);ctx.lineTo(p.x+3*dpr,p.y);ctx.moveTo(p.x,p.y-3*dpr);ctx.lineTo(p.x,p.y+3*dpr);ctx.stroke();}
  const c=screen(cursor.x,cursor.y);ctx.strokeStyle="#ff9a68";ctx.lineWidth=2*dpr;ctx.beginPath();ctx.arc(c.x,c.y,6*dpr,0,Math.PI*2);ctx.moveTo(c.x-9*dpr,c.y);ctx.lineTo(c.x+9*dpr,c.y);ctx.moveTo(c.x,c.y-9*dpr);ctx.lineTo(c.x,c.y+9*dpr);ctx.stroke();
  $("asset-plane-label").textContent="XY制作面 / Z = "+studio.planeZ.toFixed(1)+"m / "+studio.parts.length+"パーツ";syncValues();
 }
 function syncValues(){const chosen=studio.selection(),p=chosen[0];$("asset-value-x").textContent=(p?.x??cursor.x).toFixed(1)+"m";$("asset-value-y").textContent=(p?.y??cursor.y).toFixed(1)+"m";$("asset-value-z").textContent=(p?.z??studio.planeZ).toFixed(1)+"m";
  for(const axis of ["x","y","z"]){const dial=$("asset-dial-"+axis),value=axis==="x"?(p?.x??cursor.x):axis==="y"?(p?.y??cursor.y):(p?.z??studio.planeZ);dial.setAttribute("aria-valuenow",value.toFixed(1));dial.style.setProperty("--dial-angle",dialAngles[axis]+"deg");}}
 function loadFields(part){if(!part)return;$("asset-shape").value=part.shape;$("asset-width").value=part.width;$("asset-height").value=part.height;$("asset-depth").value=part.depth;$("asset-rotation").value=deg(part.rotation);$("asset-color").value=rgbToHex(part.color);$("asset-group").value=part.group||"";}
 function setMode(next){mode=next;document.querySelectorAll("[data-asset-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.assetMode===mode)));say(mode==="place"?"配置：XY面をタップ。ダイヤルでカーソルとZ面を調整":"select"===mode?"選択：パーツをタップ。複数選択も可能":"移動：パーツ選択後、移動先をタップまたはXYZダイヤルを回す");draw();}
 function dialStep(axis,direction){const step=Number($("asset-step").value)*direction,selected=studio.selection().length;
  if(selected)studio.move(axis==="x"?step:0,axis==="y"?step:0,axis==="z"?step:0);
  else if(axis==="z")studio.setPlane(studio.planeZ+step);else cursor[axis]+=step;
  persist();draw();}
 function installDial(axis){const dial=$("asset-dial-"+axis);let active=false,last=0,remainder=0;const angle=e=>{const r=dial.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2);};
  dial.addEventListener("pointerdown",e=>{active=true;last=angle(e);try{dial.setPointerCapture(e.pointerId);}catch(_){}});
  dial.addEventListener("pointermove",e=>{if(!active)return;let d=angle(e)-last;if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;last=angle(e);remainder+=d;dialAngles[axis]+=d*180/Math.PI;
   while(Math.abs(remainder)>=Math.PI/12){const direction=Math.sign(remainder);dialStep(axis,direction);remainder-=direction*Math.PI/12;}syncValues();});
  for(const event of ["pointerup","pointercancel","lostpointercapture"])dial.addEventListener(event,()=>{active=false;remainder=0;});
  dial.addEventListener("keydown",e=>{if(!["ArrowUp","ArrowRight","ArrowDown","ArrowLeft"].includes(e.key))return;e.preventDefault();dialStep(axis,["ArrowUp","ArrowRight"].includes(e.key)?1:-1);});
 }
 function refreshLoadList(preferred=""){const list=$("asset-load-list"),items=getWorld()?.prefabs||[],previous=preferred||list.value;list.replaceChildren(new Option("保存Assetを選択",""),...items.map(p=>new Option(p.name+"（"+p.parts.length+"）",p.name)));if(items.some(p=>p.name===previous))list.value=previous;}
 canvas.addEventListener("pointerdown",e=>{const p=world(e.clientX,e.clientY);cursor=p;
  if(mode==="place"){const made=studio.add(template(),p.x,p.y,{snapMode:$("asset-snap-mode").value,sourceAnchor:$("asset-source-anchor").value,snapDistance:Math.max(.75,Number($("asset-step").value)*2)});if(!made){say("寸法を確認してください（最大96パーツ）");return;}loadFields(made);say("🧱 パーツを配置しました");if(!$("asset-continuous").checked)setMode("select");}
  else{const hit=studio.hit(p.x,p.y);if(hit){studio.select(hit.id,{add:$("asset-multi").checked});loadFields(hit);say(studio.selection().length+"パーツ選択中");}
   else if(mode==="move"&&studio.selection().length){const chosen=studio.selection(),cx=chosen.reduce((s,q)=>s+q.x,0)/chosen.length,cy=chosen.reduce((s,q)=>s+q.y,0)/chosen.length,
    target=studio.nearestSnap(p.x,p.y,$("asset-snap-mode").value,1.25,new Set(chosen.map(q=>q.id)))||p,
    source=target===p?{x:cx,y:cy}:partAnchor(chosen[0],$("asset-source-anchor").value);studio.move(target.x-source.x,target.y-source.y,0);say("📍 選択パーツを移動しました");}else studio.select(null);}
  persist();draw();});
 canvas.addEventListener("wheel",e=>{e.preventDefault();scale=Math.max(5,Math.min(40,scale*(e.deltaY>0?.9:1.1)));draw();},{passive:false});
 document.querySelectorAll("[data-asset-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.assetMode)));
 $("owner-asset-open").addEventListener("click",()=>{overlay.hidden=false;refreshLoadList();requestAnimationFrame(resize);say("Asset制作空間を開きました。街の直接配置データは変更しません");});
 $("asset-close").addEventListener("click",()=>{persist();overlay.hidden=true;});
 $("asset-apply").addEventListener("click",()=>{if(studio.update(template())){persist();draw();say("選択パーツを編集しました");}else say("編集するパーツを選択し、寸法を確認してください");});
 $("asset-copy").addEventListener("click",()=>{const copies=studio.copy(Number($("asset-step").value));if(copies.length){persist();draw();say(copies.length+"パーツをコピーしました");}else say("コピーするパーツを選択してください");});
 $("asset-delete").addEventListener("click",()=>{if(studio.remove()){persist();draw();say("選択パーツを削除しました");}else say("削除するパーツを選択してください");});
 $("asset-group-apply").addEventListener("click",()=>{if(studio.group($("asset-group").value)){persist();draw();say("選択パーツをグループ化しました");}else say("パーツを選択し、グループ名を入力してください");});
 $("asset-undo").addEventListener("click",()=>{say(studio.undo()?"直前の操作を戻しました":"戻せる操作はありません");persist();draw();});
 $("asset-redo").addEventListener("click",()=>{say(studio.redo()?"操作をやり直しました":"やり直せる操作はありません");persist();draw();});
 $("asset-save").addEventListener("click",()=>{const name=$("asset-name").value.trim(),exists=getWorld().prefabs.some(p=>p.name===name);if(exists&&!window.confirm("Asset「"+name+"」を上書きしますか？"))return;const result=getWorld().savePrefabParts(name,studio.prefabParts(),{replace:exists});say(result.message);if(result.ok){onCommit();refreshLoadList(result.name);}});
 $("asset-load").addEventListener("click",()=>{const name=$("asset-load-list").value,prefab=getWorld().prefabs.find(p=>p.name===name);if(!prefab){say("読み込むAssetを選択してください");return;}if(studio.parts.length&&!window.confirm("現在の制作面を置き換えて「"+name+"」を読み込みますか？"))return;studio.loadPrefab(prefab);$("asset-name").value=name;persist();draw();say("Asset「"+name+"」を制作面へ読み込みました");});
 $("asset-clear").addEventListener("click",()=>{if(studio.parts.length&&!window.confirm("制作中のAssetを空にしますか？\n保存建築物は削除されません。"))return;studio=new AssetStudioModel();cursor={x:0,y:0};persist();draw();say("新しい制作面を用意しました");});
 overlay.addEventListener("keydown",e=>{if(e.key==="Escape"){$("asset-close").click();return;}if((e.key==="Delete"||e.key==="Backspace")&&e.target===canvas){e.preventDefault();$("asset-delete").click();}});
 for(const axis of ["x","y","z"])installDial(axis);window.addEventListener("resize",()=>{if(!overlay.hidden)resize();});draw();
 return {open(){$("owner-asset-open").click();},close(){overlay.hidden=true;},refresh:refreshLoadList};
}
