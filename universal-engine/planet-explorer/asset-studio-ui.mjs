import {AssetStudioModel,partAnchor,snapCandidates} from "./asset-studio-model.mjs?v=0.9c-asset-v2";
import {AssetCamera} from "./asset-camera.mjs?v=0.9c-asset-v2";

const DRAFT_KEY="universal-engine:asset-studio:v0.9c";
const LEGACY_DRAFT_KEY="universal-engine:asset-studio:v0.9a";
const UI_PREFS_KEY="universal-engine:asset-studio-ui:v1";
const $=id=>document.getElementById(id);
const hexToRgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const rgbToHex=rgb=>"#"+rgb.map(v=>Math.round(v*255).toString(16).padStart(2,"0")).join("");
const rad=degrees=>Number(degrees)*Math.PI/180;
const deg=radians=>Math.round(radians*180/Math.PI*10)/10;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm=a=>{const d=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/d,y:a.y/d,z:a.z/d};};
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const rotateEuler=(point,part)=>{
 const pivot=part.pivot||{x:0,y:0,z:0},rx=part.rx||0,ry=part.ry||0,rz=part.rz??part.rotation??0;
 let x=point.x-pivot.x,y=point.y-pivot.y,z=point.z-pivot.z,c=Math.cos(rx),s=Math.sin(rx);
 [y,z]=[y*c-z*s,y*s+z*c];c=Math.cos(ry);s=Math.sin(ry);[x,z]=[x*c+z*s,-x*s+z*c];
 c=Math.cos(rz);s=Math.sin(rz);[x,y]=[x*c-y*s,x*s+y*c];
 return {x:x+pivot.x,y:y+pivot.y,z:z+pivot.z};
};

function partMesh(part){
 const vertices=[],faces=[],point=(x,y,z)=>{const q=rotateEuler({x,y,z},part);vertices.push({x:part.x+q.x,y:part.y+q.y,z:part.z+q.z});return vertices.length-1;};
 if(part.shape==="cube"){
  for(const z of [0,part.height])for(const y of [-part.depth/2,part.depth/2])for(const x of [-part.width/2,part.width/2])point(x,y,z);
  faces.push([0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]);
 }else if(part.shape==="sphere"){
  const rings=6,sides=12;for(let j=0;j<=rings;j++){const latitude=-Math.PI/2+j*Math.PI/rings;
   for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides;point(Math.cos(latitude)*Math.cos(a)*part.width/2,Math.cos(latitude)*Math.sin(a)*part.depth/2,(Math.sin(latitude)+1)*part.height/2);}}
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){const n=(i+1)%sides,a=j*sides+i,b=j*sides+n,c=(j+1)*sides+n,d=(j+1)*sides+i;faces.push([a,b,c,d]);}
 }else{
  const sides=14,bottom=[],top=[];for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides;bottom.push(point(Math.cos(a)*part.width/2,Math.sin(a)*part.depth/2,0));if(part.shape==="cylinder")top.push(point(Math.cos(a)*part.width/2,Math.sin(a)*part.depth/2,part.height));}
  if(part.shape==="cone"){const apex=point(0,0,part.height);faces.push([...bottom].reverse());for(let i=0;i<sides;i++)faces.push([bottom[i],bottom[(i+1)%sides],apex]);}
  else{faces.push([...bottom].reverse(),top);for(let i=0;i<sides;i++)faces.push([bottom[i],bottom[(i+1)%sides],top[(i+1)%sides],top[i]]);}
 }
 return {vertices,faces};
}
function insidePolygon(x,y,points){let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){
 const a=points[i],b=points[j],crossing=(a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x;if(crossing)inside=!inside;}return inside;}

export function installAssetStudio({getWorld,onCommit,log}){
 const overlay=$("asset-studio"),canvas=$("asset-canvas"),ctx=canvas.getContext("2d"),status=$("asset-status"),camera=new AssetCamera();
 let studio;try{const raw=localStorage.getItem(DRAFT_KEY)||localStorage.getItem(LEGACY_DRAFT_KEY);studio=new AssetStudioModel(raw?JSON.parse(raw):null);}catch(_){studio=new AssetStudioModel();}
 let uiPrefs={axisDials:true,commonDial:true};try{uiPrefs={...uiPrefs,...JSON.parse(localStorage.getItem(UI_PREFS_KEY)||"null")};}catch(_){}
 let mode="place",cursor={x:0,y:0},pixelRatio=Math.min(2,window.devicePixelRatio||1),dialAngles={x:0,y:0,z:0,common:0},faceHits=[];
 let activeNumberId="asset-pos-x",numberBuffer="0",numberReturnFocus=null;
 const pointers=new Map();let viewGesture=null;
 const numericTargets={
  "asset-pos-x":{label:"X位置",unit:"m",min:-500,max:500,kind:"position",axis:"x"},
  "asset-pos-y":{label:"Y位置",unit:"m",min:-500,max:500,kind:"position",axis:"y"},
  "asset-pos-z":{label:"Z位置／床",unit:"m",min:-500,max:500,kind:"position",axis:"z"},
  "asset-rx":{label:"RX回転",unit:"°",min:-36000,max:36000,kind:"rotation",axis:"rx"},
  "asset-ry":{label:"RY回転",unit:"°",min:-36000,max:36000,kind:"rotation",axis:"ry"},
  "asset-rz":{label:"RZ回転",unit:"°",min:-36000,max:36000,kind:"rotation",axis:"rz"},
  "asset-width":{label:"幅X",unit:"m",min:.1,max:200,kind:"size",axis:"width"},
  "asset-depth":{label:"奥行Y",unit:"m",min:.1,max:200,kind:"size",axis:"depth"},
  "asset-height":{label:"高さZ",unit:"m",min:.1,max:200,kind:"size",axis:"height"}
 };
 const template=()=>({shape:$("asset-shape").value,width:Number($("asset-width").value),height:Number($("asset-height").value),
  depth:Number($("asset-depth").value),rx:rad($("asset-rx").value),ry:rad($("asset-ry").value),rz:rad($("asset-rz").value),
  color:hexToRgb($("asset-color").value),group:$("asset-group").value});
 const say=message=>{status.value=message;status.textContent=message;log(message);};
 const persist=()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify(studio.snapshot()));}catch(_){say("Asset下書きの保存に失敗しました");}};
 const persistUi=()=>{try{localStorage.setItem(UI_PREFS_KEY,JSON.stringify(uiPrefs));}catch(_){}};
 const selected=()=>studio.selected;
 function resize(){const box=canvas.getBoundingClientRect();pixelRatio=Math.min(2,window.devicePixelRatio||1);const w=Math.max(300,Math.round(box.width*pixelRatio)),h=Math.max(260,Math.round(box.height*pixelRatio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}draw();}
 const canvasPoint=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*pixelRatio,y:(e.clientY-r.top)*pixelRatio};};
 const project=p=>camera.project(p,canvas.width,canvas.height,studio.parts,selected());
 function line3(a,b,color,width=1,dash=[]){const p=project(a),q=project(b);if(!p||!q)return;ctx.strokeStyle=color;ctx.lineWidth=width*pixelRatio;ctx.setLineDash(dash.map(v=>v*pixelRatio));ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
 function drawGrid(){
  const target=camera.target(studio.parts,selected()),range=Math.max(12,Math.min(160,camera.distance*1.8)),step=camera.distance>90?10:camera.distance>45?5:1,minX=Math.floor((target.x-range)/step)*step,maxX=Math.ceil((target.x+range)/step)*step,minY=Math.floor((target.y-range)/step)*step,maxY=Math.ceil((target.y+range)/step)*step;
  for(let x=minX;x<=maxX;x+=step)line3({x,y:minY,z:studio.planeZ},{x,y:maxY,z:studio.planeZ},Math.abs(x)<1e-6?"#4f869c":"#173b48",Math.abs(x)<1e-6?1.5:.7);
  for(let y=minY;y<=maxY;y+=step)line3({x:minX,y,z:studio.planeZ},{x:maxX,y,z:studio.planeZ},Math.abs(y)<1e-6?"#4f869c":"#173b48",Math.abs(y)<1e-6?1.5:.7);
  ctx.setLineDash([]);line3({x:0,y:0,z:0},{x:4,y:0,z:0},"#ff7777",2);line3({x:0,y:0,z:0},{x:0,y:4,z:0},"#72e39b",2);line3({x:0,y:0,z:0},{x:0,y:0,z:4},"#77bfff",2);
 }
 function draw(){
  const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,"#102d3a");gradient.addColorStop(1,"#07151c");ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);drawGrid();
  const rendered=[],light=norm({x:-.4,y:-.5,z:1});for(const part of studio.parts){const mesh=partMesh(part),same=Math.abs(part.z-studio.planeZ)<.001;
   for(const face of mesh.faces){const points=face.map(i=>project(mesh.vertices[i]));if(points.some(p=>!p))continue;const worldPoints=face.map(i=>mesh.vertices[i]),normal=norm(cross(sub(worldPoints[1],worldPoints[0]),sub(worldPoints[2],worldPoints[0]))),shade=.5+.45*Math.abs(dot(normal,light));rendered.push({part,points,depth:points.reduce((s,p)=>s+p.depth,0)/points.length,shade,alpha:same?.9:.38});}}
  rendered.sort((a,b)=>b.depth-a.depth);faceHits=[];for(const face of rendered){const c=face.part.color.map(v=>Math.round(v*255*face.shade));ctx.beginPath();ctx.moveTo(face.points[0].x,face.points[0].y);for(const p of face.points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${face.alpha})`;ctx.fill();ctx.strokeStyle=studio.selected.has(face.part.id)?"#ffe278":"#668d99";ctx.lineWidth=(studio.selected.has(face.part.id)?1.8:.65)*pixelRatio;ctx.stroke();faceHits.push({partId:face.part.id,points:face.points});}
  for(const part of studio.selection())for(const anchorName of ["top-left","top","top-right","right","bottom-right","bottom","bottom-left","left","center"]){const a=partAnchor(part,anchorName),p=project({x:a.x,y:a.y,z:part.z});if(!p)continue;ctx.fillStyle="#ffe278";ctx.fillRect(p.x-2*pixelRatio,p.y-2*pixelRatio,4*pixelRatio,4*pixelRatio);}
  for(const point of snapCandidates(studio.parts,$("asset-snap-mode").value)){const p=project({x:point.x,y:point.y,z:studio.planeZ});if(!p)continue;ctx.strokeStyle=point.kind==="centroid"?"#ff9fd7":"#79e7ff";ctx.lineWidth=pixelRatio;ctx.beginPath();ctx.moveTo(p.x-3*pixelRatio,p.y);ctx.lineTo(p.x+3*pixelRatio,p.y);ctx.moveTo(p.x,p.y-3*pixelRatio);ctx.lineTo(p.x,p.y+3*pixelRatio);ctx.stroke();}
  const cp=project({x:cursor.x,y:cursor.y,z:studio.planeZ});if(cp){ctx.strokeStyle="#ff9a68";ctx.lineWidth=2*pixelRatio;ctx.beginPath();ctx.arc(cp.x,cp.y,6*pixelRatio,0,Math.PI*2);ctx.moveTo(cp.x-9*pixelRatio,cp.y);ctx.lineTo(cp.x+9*pixelRatio,cp.y);ctx.moveTo(cp.x,cp.y-9*pixelRatio);ctx.lineTo(cp.x,cp.y+9*pixelRatio);ctx.stroke();}
  const focus=studio.selection().length?"選択中心":"モデル原点";$("asset-plane-label").textContent="床 Z="+studio.planeZ.toFixed(1)+"m / "+studio.parts.length+"パーツ / 注視: "+focus+" / 距離 "+camera.distance.toFixed(1);syncValues();
 }
 const cleanNumber=value=>Math.round(value*1000)/1000;
 function positionValue(axis){const part=studio.selection()[0],floorMode=$("asset-z-target").value==="floor";
  if(axis==="x")return part?.x??cursor.x;if(axis==="y")return part?.y??cursor.y;
  return floorMode?studio.planeZ:(part?.z??studio.planeZ);}
 function currentNumberValue(id){const target=numericTargets[id];return target?.kind==="position"?positionValue(target.axis):Number($(id)?.value);}
 function syncCommon(){const select=$("asset-common-target");if(!select)return;activeNumberId=select.value||activeNumberId;
  const target=numericTargets[activeNumberId],value=currentNumberValue(activeNumberId);if(!target)return;
  $("asset-common-value").textContent=(Number.isFinite(value)?cleanNumber(value):"—")+target.unit;
  const dial=$("asset-dial-common");dial.setAttribute("aria-label",target.label+"を調整");dial.setAttribute("aria-valuenow",String(value));dial.style.setProperty("--dial-angle",dialAngles.common+"deg");}
 function syncValues(){const p=studio.selection()[0],floorMode=$("asset-z-target").value==="floor",values={x:p?.x??cursor.x,y:p?.y??cursor.y,z:floorMode?studio.planeZ:(p?.z??studio.planeZ)};
  for(const axis of ["x","y","z"]){$("asset-value-"+axis).textContent=values[axis].toFixed(1)+"m";$("asset-pos-"+axis).value=cleanNumber(values[axis]);
   const dial=$("asset-dial-"+axis);dial.setAttribute("aria-valuenow",values[axis].toFixed(1));dial.style.setProperty("--dial-angle",dialAngles[axis]+"deg");}
  if(p){$("asset-rx").value=cleanNumber(deg(p.rx));$("asset-ry").value=cleanNumber(deg(p.ry));$("asset-rz").value=cleanNumber(deg(p.rz));}
  syncCommon();
 }
 function loadFields(part){if(!part)return;$("asset-shape").value=part.shape;$("asset-width").value=cleanNumber(part.width);$("asset-height").value=cleanNumber(part.height);$("asset-depth").value=cleanNumber(part.depth);
  $("asset-rx").value=cleanNumber(deg(part.rx));$("asset-ry").value=cleanNumber(deg(part.ry));$("asset-rz").value=cleanNumber(deg(part.rz));$("asset-color").value=rgbToHex(part.color);$("asset-group").value=part.group||"";syncValues();}
 function setMode(next){mode=next;document.querySelectorAll("[data-asset-mode]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.assetMode===mode)));canvas.style.cursor=mode==="view"?($("asset-camera-tool").value==="pan"?"move":"grab"):"crosshair";
  say(mode==="place"?"配置：表示中の床面をタップ。Zダイヤルで床レベルを変更":mode==="select"?"選択：パーツをタップ。カメラは選択中心を注視":mode==="move"?"移動：移動先の床面をタップまたはXYZダイヤルを回す":"視点：ドラッグで"+($("asset-camera-tool").value==="pan"?"パン":"回転")+"、ホイール／ピンチでズーム");draw();}
 function applyNumericValue(id,value,{announce=false}={}){
  const target=numericTargets[id];value=Number(value);if(!target||!Number.isFinite(value)||value<target.min||value>target.max){if(announce)say("入力範囲を確認してください："+(target?.min??"")+"〜"+(target?.max??""));return false;}
  if(target.kind==="position"){
   const axis=target.axis,current=positionValue(axis),chosen=studio.selection().length,floorMode=$("asset-z-target").value==="floor";
   if(axis==="z"&&(floorMode||!chosen))studio.setPlane(value);
   else if(chosen)studio.move(axis==="x"?value-current:0,axis==="y"?value-current:0,axis==="z"?value-current:0);
   else cursor[axis]=value;
  }else{
   $(id).value=cleanNumber(value);const chosen=studio.selection().length;
   if(chosen&&target.kind==="rotation")studio.update({[target.axis]:rad(value)});
   else if(chosen&&target.kind==="size")studio.update({[target.axis]:value});
  }
  persist();draw();if(announce)say(target.label+"を "+cleanNumber(value)+target.unit+" に設定しました");return true;
 }
 function nudgeNumeric(id,direction){const target=numericTargets[id],current=currentNumberValue(id);if(!target||!Number.isFinite(current))return;
  const step=target.kind==="rotation"?Number($("asset-angle-step").value):Number($("asset-step").value);applyNumericValue(id,current+step*direction);}
 function chooseNumeric(id){if(!numericTargets[id])return;activeNumberId=id;$("asset-common-target").value=id;syncCommon();}
 function installDial(dial,key,onStep){let active=false,last=0,remainder=0;const angle=e=>{const r=dial.getBoundingClientRect();return Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2);};
  dial.addEventListener("pointerdown",e=>{e.preventDefault();active=true;last=angle(e);try{dial.setPointerCapture(e.pointerId);}catch(_){}});
  dial.addEventListener("pointermove",e=>{if(!active)return;let delta=angle(e)-last;if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;last=angle(e);remainder+=delta;dialAngles[key]+=delta*180/Math.PI;
   while(Math.abs(remainder)>=Math.PI/12){const direction=Math.sign(remainder);onStep(direction);remainder-=direction*Math.PI/12;}syncValues();});
  for(const event of ["pointerup","pointercancel","lostpointercapture"])dial.addEventListener(event,()=>{active=false;remainder=0;});
  dial.addEventListener("keydown",e=>{if(!["ArrowUp","ArrowRight","ArrowDown","ArrowLeft"].includes(e.key))return;e.preventDefault();onStep(["ArrowUp","ArrowRight"].includes(e.key)?1:-1);});
 }
 function applyUiPrefs(){uiPrefs.axisDials=Boolean(uiPrefs.axisDials);uiPrefs.commonDial=Boolean(uiPrefs.commonDial);$("asset-show-axis-dials").checked=uiPrefs.axisDials;$("asset-show-common-dial").checked=uiPrefs.commonDial;
  $("asset-axis-controls").hidden=!uiPrefs.axisDials;$("asset-common-control").hidden=!uiPrefs.commonDial;}
 function refreshLoadList(preferred=""){const list=$("asset-load-list"),items=getWorld()?.prefabs||[],previous=preferred||list.value;list.replaceChildren(new Option("保存Assetを選択",""),...items.map(p=>new Option(p.name+"（"+p.parts.length+"）",p.name)));if(items.some(p=>p.name===previous))list.value=previous;}
 function hitAt(point){for(let i=faceHits.length-1;i>=0;i--)if(insidePolygon(point.x,point.y,faceHits[i].points))return studio.parts.find(p=>p.id===faceHits[i].partId)||null;return null;}
 function editTap(point){const hit=hitAt(point);
  if(mode==="select"||(mode==="move"&&hit)){if(hit){studio.select(hit.id,{add:$("asset-multi").checked});camera.resetPan();loadFields(hit);say(studio.selection().length+"パーツ選択中・選択中心を注視");}else{studio.select(null);camera.resetPan();say("選択を解除し、モデル原点を注視します");}persist();draw();return;}
  const floor=camera.rayToPlane(point.x,point.y,canvas.width,canvas.height,studio.planeZ,studio.parts,selected());if(!floor){say("現在のカメラから配置床を指定できません。上面または3D視点にしてください");return;}cursor={x:floor.x,y:floor.y};
  if(mode==="place"){const made=studio.add(template(),floor.x,floor.y,{snapMode:$("asset-snap-mode").value,sourceAnchor:$("asset-source-anchor").value,snapDistance:Math.max(.75,Number($("asset-step").value)*2)});if(!made){say("寸法を確認してください（最大96パーツ）");return;}camera.resetPan();loadFields(made);say("🧱 床レベルZ="+studio.planeZ.toFixed(1)+"mへ配置しました");if(!$("asset-continuous").checked)setMode("select");}
  else if(mode==="move"&&studio.selection().length){const chosen=studio.selection(),cx=chosen.reduce((s,q)=>s+q.x,0)/chosen.length,cy=chosen.reduce((s,q)=>s+q.y,0)/chosen.length,target=studio.nearestSnap(floor.x,floor.y,$("asset-snap-mode").value,1.25,new Set(chosen.map(q=>q.id)))||floor,source=target===floor?{x:cx,y:cy}:partAnchor(chosen[0],$("asset-source-anchor").value);studio.move(target.x-source.x,target.y-source.y,0);say("📍 選択パーツを移動しました");}persist();draw();}
 function pointerDistance(){const values=[...pointers.values()];return values.length<2?0:Math.hypot(values[1].x-values[0].x,values[1].y-values[0].y);}
 function pointerMid(){const values=[...pointers.values()];return values.length<2?values[0]:{x:(values[0].x+values[1].x)/2,y:(values[0].y+values[1].y)/2};}
 canvas.addEventListener("pointerdown",e=>{const p=canvasPoint(e);pointers.set(e.pointerId,p);try{canvas.setPointerCapture(e.pointerId);}catch(_){}if(mode!=="view"){editTap(p);return;}if(pointers.size===1)viewGesture={last:p};else if(pointers.size===2)viewGesture={distance:pointerDistance(),mid:pointerMid()};});
 canvas.addEventListener("pointermove",e=>{if(mode!=="view"||!pointers.has(e.pointerId))return;const previous=pointers.get(e.pointerId),current=canvasPoint(e);pointers.set(e.pointerId,current);if(pointers.size===1){const dx=(current.x-previous.x)/pixelRatio,dy=(current.y-previous.y)/pixelRatio;if($("asset-camera-tool").value==="pan")camera.panPixels(dx,dy,studio.parts,selected(),canvas.height/pixelRatio);else camera.orbit(dx,dy);viewGesture={last:current};draw();}else if(pointers.size===2){const distance=pointerDistance(),mid=pointerMid(),last=viewGesture||{distance,mid};camera.zoom((last.distance-distance)*2/pixelRatio);camera.panPixels((mid.x-last.mid.x)/pixelRatio,(mid.y-last.mid.y)/pixelRatio,studio.parts,selected(),canvas.height/pixelRatio);viewGesture={distance,mid};draw();}});
 for(const event of ["pointerup","pointercancel","lostpointercapture"])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);viewGesture=pointers.size===1?{last:[...pointers.values()][0]}:null;});canvas.addEventListener("wheel",e=>{e.preventDefault();camera.zoom(e.deltaY);draw();},{passive:false});
 document.querySelectorAll("[data-asset-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.assetMode)));$("asset-camera-tool").addEventListener("change",()=>setMode("view"));$("asset-camera-preset").addEventListener("change",e=>{camera.preset(e.target.value);setMode("view");});
 $("asset-camera-focus").addEventListener("click",()=>{camera.resetPan();const chosen=studio.selection(),parts=chosen.length?chosen:studio.parts;if(parts.length){const cx=chosen.length?chosen.reduce((s,p)=>s+p.x,0)/chosen.length:0,cy=chosen.length?chosen.reduce((s,p)=>s+p.y,0)/chosen.length:0,radius=Math.max(...parts.map(p=>Math.hypot(p.x-cx,p.y-cy,p.height)));camera.distance=Math.max(8,Math.min(300,radius*3));}draw();say("注視中心とズームをリセットしました");});
 $("asset-z-target").addEventListener("change",()=>{syncValues();say($("asset-z-target").value==="floor"?"Zダイヤル：配置床レベルを上下":"Zダイヤル：選択物のZ位置を上下");draw();});
 const numberPad=$("asset-number-pad"),numberDisplay=$("asset-number-display");
 function renderNumberPad(){numberDisplay.textContent=numberBuffer;const target=numericTargets[activeNumberId];$("asset-number-title").textContent=(target?.label||"数値")+"を入力";}
 function openNumberPad(id=activeNumberId){if(!numericTargets[id])return;chooseNumeric(id);numberReturnFocus=$(id);const value=currentNumberValue(id);numberBuffer=Number.isFinite(value)?String(cleanNumber(value)):"0";numberPad.hidden=false;renderNumberPad();
  requestAnimationFrame(()=>numberPad.querySelector('[data-asset-key="7"]')?.focus());}
 function closeNumberPad(commit=false){if(commit&&!applyNumericValue(activeNumberId,Number(numberBuffer),{announce:true}))return;numberPad.hidden=true;numberReturnFocus?.focus({preventScroll:true});}
 function numberKey(key){if(key==="apply"){closeNumberPad(true);return;}if(key==="clear")numberBuffer="0";else if(key==="back")numberBuffer=numberBuffer.length>1?numberBuffer.slice(0,-1):"0";
  else if(key==="minus")numberBuffer=numberBuffer.startsWith("-")?numberBuffer.slice(1):"-"+numberBuffer;
  else if(key==="dot"){if(!numberBuffer.includes("."))numberBuffer+=".";}else if(/^\d{1,2}$/.test(key)){numberBuffer=numberBuffer==="0"?key:numberBuffer+key;if(numberBuffer.length>14)numberBuffer=numberBuffer.slice(0,14);}
  renderNumberPad();
 }
 document.querySelectorAll("[data-asset-number]").forEach(input=>{input.addEventListener("click",e=>{e.preventDefault();openNumberPad(input.id);});input.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openNumberPad(input.id);}});});
 numberPad.addEventListener("click",e=>{const key=e.target.closest("[data-asset-key]")?.dataset.assetKey;if(key)numberKey(key);else if(e.target===numberPad)closeNumberPad(false);});
 numberPad.addEventListener("keydown",e=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeNumberPad(false);}else if(e.key==="Enter"){e.preventDefault();numberKey("apply");}});
 $("asset-number-cancel").addEventListener("click",()=>closeNumberPad(false));$("asset-number-open").addEventListener("click",()=>openNumberPad());
 $("asset-common-target").addEventListener("change",e=>{chooseNumeric(e.target.value);});
 for(const id of Object.keys(numericTargets))$(id).addEventListener("pointerdown",()=>chooseNumeric(id));
 for(const id of ["asset-show-axis-dials","asset-show-common-dial"])$(id).addEventListener("change",()=>{uiPrefs={axisDials:$("asset-show-axis-dials").checked,commonDial:$("asset-show-common-dial").checked};applyUiPrefs();persistUi();requestAnimationFrame(resize);});
 $("asset-type").addEventListener("change",e=>{studio.setMeta({assetType:e.target.value});persist();});
 $("owner-asset-open").addEventListener("click",()=>{overlay.hidden=false;refreshLoadList();$("asset-type").value=studio.meta.assetType;$("asset-name").value=studio.meta.name||$("asset-name").value;applyUiPrefs();requestAnimationFrame(resize);say("3D Asset制作空間を開きました。数値欄は専用テンキーで入力できます");});$("asset-close").addEventListener("click",()=>{persist();numberPad.hidden=true;overlay.hidden=true;});
 $("asset-apply").addEventListener("click",()=>{if(studio.update(template())){persist();draw();say("選択パーツを編集しました");}else say("編集するパーツを選択し、寸法を確認してください");});$("asset-copy").addEventListener("click",()=>{const copies=studio.copy(Number($("asset-step").value));if(copies.length){camera.resetPan();persist();draw();say(copies.length+"パーツをコピーしました");}else say("コピーするパーツを選択してください");});$("asset-delete").addEventListener("click",()=>{if(studio.remove()){camera.resetPan();persist();draw();say("選択パーツを削除し、モデル原点を注視します");}else say("削除するパーツを選択してください");});
 $("asset-group-apply").addEventListener("click",()=>{if(studio.group($("asset-group").value)){persist();draw();say("選択パーツをグループ化しました");}else say("パーツを選択し、グループ名を入力してください");});$("asset-undo").addEventListener("click",()=>{say(studio.undo()?"直前の操作を戻しました":"戻せる操作はありません");camera.resetPan();persist();draw();});$("asset-redo").addEventListener("click",()=>{say(studio.redo()?"操作をやり直しました":"やり直せる操作はありません");camera.resetPan();persist();draw();});
 $("asset-save").addEventListener("click",()=>{const name=$("asset-name").value.trim(),exists=getWorld().prefabs.some(p=>p.name===name);if(exists&&!window.confirm("Asset「"+name+"」を上書きしますか？"))return;studio.setMeta({name,assetType:$("asset-type").value});const result=getWorld().savePrefabParts(name,studio.prefabParts(),{replace:exists,assetDocument:studio.prefabDocument(name)});say(result.message);if(result.ok){persist();onCommit();refreshLoadList(result.name);}});$("asset-load").addEventListener("click",()=>{const name=$("asset-load-list").value,prefab=getWorld().prefabs.find(p=>p.name===name);if(!prefab){say("読み込むAssetを選択してください");return;}if(studio.parts.length&&!window.confirm("現在の制作面を置き換えて「"+name+"」を読み込みますか？"))return;if(!studio.loadPrefab(prefab)){say("Assetの読込に失敗しました");return;}camera.preset("orbit");$("asset-name").value=name;$("asset-type").value=studio.meta.assetType;persist();draw();say("Asset「"+name+"」を制作面へ読み込みました");});
 $("asset-clear").addEventListener("click",()=>{if(studio.parts.length&&!window.confirm("制作中のAssetを空にしますか？\n保存建築物は削除されません。"))return;studio=new AssetStudioModel();cursor={x:0,y:0};camera.preset("orbit");$("asset-name").value="";$("asset-type").value="building";persist();draw();say("新しい制作面を用意しました");});overlay.addEventListener("keydown",e=>{if(e.key==="Escape"){$("asset-close").click();return;}if((e.key==="Delete"||e.key==="Backspace")&&e.target===canvas){e.preventDefault();$("asset-delete").click();}});
 for(const axis of ["x","y","z"])installDial($("asset-dial-"+axis),axis,direction=>nudgeNumeric("asset-pos-"+axis,direction));
 installDial($("asset-dial-common"),"common",direction=>nudgeNumeric($("asset-common-target").value,direction));
 $("asset-type").value=studio.meta.assetType;$("asset-name").value=studio.meta.name;applyUiPrefs();
 window.addEventListener("resize",()=>{if(!overlay.hidden)resize();});draw();return {open(){$("owner-asset-open").click();},close(){overlay.hidden=true;},refresh:refreshLoadList};
}
