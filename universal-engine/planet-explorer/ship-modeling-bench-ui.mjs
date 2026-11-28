import {ShipModelingBench,nearModelingBench} from "./ship-modeling-bench.mjs?v=20261128-datum";
import {shipRay,paletteHit,planeHit,validSpatialState} from "./ship-spatial-cad.mjs?v=20261128-spatial";
const key="ue-ship-modeling-bench-v1";
export function installShipModelingBench({getVoyage,getWorld,onCommit,log}){
 const $=id=>document.getElementById(id),open=$("ship-modeling-open"),panel=$("ship-modeling-panel"),status=$("ship-modeling-status"),select=$("ship-modeling-parts");
 let model;try{model=new ShipModelingBench(JSON.parse(localStorage.getItem(key)||"null"));}catch{model=new ShipModelingBench();}
 const near=()=>{const v=getVoyage();return Boolean(v?.active&&!v.seated&&nearModelingBench(v.interior));};
 const close=()=>{panel.hidden=true;};
 const dock=document.createElement("section");dock.id="ship-cad-dock";dock.hidden=true;dock.setAttribute("aria-label","船内CAD");
 dock.innerHTML=`<header><strong>船内 CAD · 2D／3D</strong><button type="button" data-cad-tab="2d">2D</button><button type="button" data-cad-tab="3d">3D</button><button type="button" id="bench-cad-new">新規部品へ</button><button type="button" id="bench-cad-register">パーツ登録</button><button type="button" id="bench-cad-controls">作業台操作</button><button type="button" id="bench-cad-close">閉じる</button></header><small id="bench-cad-status" role="status">スケッチを作成し、作業台に反映してください。</small><iframe title="船内CAD 2D／3D編集" id="bench-cad-frame"></iframe>`;
 document.querySelector(".canvas-wrap").append(dock);const frame=$("bench-cad-frame"),dockStatus=$("bench-cad-status");
 let ready=false,queued=[],wasNear=false,spatialActive=false;
 function loadFrame(){if(!frame.getAttribute("src"))frame.src="../model-lab/cad/?embedded=1&bench=1&v=20261128-spatial";}
 function post(data){if(ready)frame.contentWindow?.postMessage(data,location.origin);else if(queued.length<16)queued.push(data);}
 function openCAD(){if(!near()||model.grip)return;loadFrame();close();dock.hidden=false;spatialActive=true;post({type:"ue-spatial-cad-resume"});}
 function spatialTrigger(matrix,stage){
  if(!near()||model.grip)return false;const ray=shipRay(matrix,stage),button=paletteHit(ray);
  if(button){loadFrame();spatialActive=true;post({type:"ue-spatial-cad-command",id:button.id});if(button.id==="datum")openCAD();return true;}
  if(!spatialActive||!model.spatial)return false;
  const point=planeHit(ray,model.spatial.plane);if(!point)return false;
  post({type:"ue-spatial-cad-point",...point});return true;
 }
 function closeCAD(){dock.hidden=true;}
 $("bench-cad-close").addEventListener("click",closeCAD);
 $("bench-cad-register").addEventListener("click",()=>{if(!near()||model.grip)return;const index=model.parts.findIndex(p=>p.id===model.selected&&p.cadMesh);if(index<0){dockStatus.textContent="先にCAD形状を作業台に反映してください";return;}const name=window.prompt("パーツ名",$("ship-modeling-name").value.trim()||"CADパーツ")?.trim();if(!name)return;const world=getWorld();if(!world)return;const result=world.savePrefabParts(name,[model.prefabParts()[index]]);dockStatus.textContent=result.message;if(result.ok)onCommit();});
 $("bench-cad-controls").addEventListener("click",()=>{closeCAD();if(near()){panel.hidden=false;refresh(true);}});
 $("bench-cad-new").addEventListener("click",()=>{if(!near()||model.grip)return;model.select(null);refresh();dockStatus.textContent="次の反映は新規部品として追加します。";});
 dock.querySelectorAll("[data-cad-tab]").forEach(button=>button.addEventListener("click",()=>frame.contentWindow?.postMessage({type:"ue-bench-cad-tab",tab:button.dataset.cadTab},location.origin)));
 dock.addEventListener("keydown",e=>{e.stopPropagation();if(e.key==="Escape")closeCAD();});
 window.addEventListener("message",e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
  if(e.data?.type==="ue-spatial-cad-ready"){ready=true;if(near())for(const data of queued)post(data);queued=[];return;}
  if(e.data?.type==="ue-spatial-cad-state"){if(validSpatialState(e.data.state))model.spatial=e.data.state;return;}
  if(e.data?.type!=="ue-cad-output"||(dock.hidden&&!spatialActive))return;
  const reply=(ok,message)=>{dockStatus.textContent=message;e.source.postMessage({type:"ue-cad-output-result",ok,message},e.origin);};
  if(!near()||e.data.payload?.kind!=="part"){reply(false,"作業台の近くで単品CADを作成してください");return;}
  const result=model.importCAD(e.data.payload.faces,{datum:e.data.payload.benchDatum===true});if(!result.ok){reply(false,result.message);return;}
  persist();refresh(true);reply(true,"作業台に3D形状を反映しました。再反映すると選択中のCAD部品を更新します。");
 });
 function update(){const allowed=near();model.showDatums=allowed&&(!panel.hidden||!dock.hidden||spatialActive);model.showSpatialPalette=allowed;open.hidden=!allowed;
  if(wasNear&&!allowed){if(ready)post({type:"ue-spatial-cad-suspend"});queued=[];close();closeCAD();if(model.grip)releaseAll();}
  if(!wasNear&&allowed&&spatialActive&&ready)post({type:"ue-spatial-cad-resume"});
  wasNear=allowed;
 }
 function say(msg){status.textContent=msg;log(msg);}
 function persist(){try{localStorage.setItem(key,JSON.stringify(model.snapshot()));}catch{say("端末への保存に失敗しました");}}
 const mode=document.createElement("select");mode.innerHTML='<option value="transform">移動・回転・両手拡縮</option><option value="face">上面押出／引き込み（直方体・円柱）</option>';const label=document.createElement("label");label.textContent="VRグリップ操作";label.append(mode);panel.insertBefore(label,panel.querySelector("label"));
 const shortcuts=document.createElement("div");
 for(const [title,id] of [["2D／3D CAD（同じ画面）","inline-cad"],["機構試験・組立JSON取込","owner-asset-open"]]){
  const button=document.createElement("button");button.type="button";button.textContent=title;
  button.addEventListener("click",()=>{if(!near())return;if(model.grip){say("グリップを離してから操作してください");return;}if(id==="inline-cad"){openCAD();return;}close();closeCAD();$(id)?.click();});shortcuts.append(button);
 }
 const note=document.createElement("small");note.textContent="CADは同じゲーム画面内。機構試験は別画面、精密B-repはローカル演算サーバーが必要です。";shortcuts.append(note);panel.insertBefore(shortcuts,label.nextSibling);
 const fields=["x","y","z","width","height","depth","rotation"];
 function values(){return {shape:$("ship-modeling-shape").value,...Object.fromEntries(fields.map(k=>[k,$("ship-modeling-"+k).value.trim()===""?NaN:Number($("ship-modeling-"+k).value)*(k==="rotation"?Math.PI/180:.001)]))};}
 function refresh(fill=false){select.replaceChildren();const option=(v,t)=>{const o=document.createElement("option");o.value=v;o.textContent=t;select.append(o);};option("","新規部品");for(const p of model.parts)option(String(p.id),"#"+p.id+" "+(p.cadMesh?"CAD形状":p.shape));select.value=model.selected===null?"":String(model.selected);const p=model.parts.find(p=>p.id===model.selected);if(fill&&p){$("ship-modeling-shape").value=p.shape;for(const k of fields)$("ship-modeling-"+k).value=String(Math.round(p[k]*(k==="rotation"?180/Math.PI:1000)*1000)/1000);}}
 open.addEventListener("click",()=>{if(!near())return;closeCAD();panel.hidden=false;refresh();});
 $("ship-modeling-close").addEventListener("click",close);
 select.addEventListener("change",()=>{model.select(Number(select.value));refresh(true);});
 panel.addEventListener("click",e=>{const act=e.target.closest("button[data-bench]")?.dataset.bench;if(!act||!near())return;
  if(model.grip){say("グリップを離してから操作してください");return;}
  if(act==="store"){const world=getWorld(),name=$("ship-modeling-name").value.trim();if(!world||!name){say("名前を入力してください");return;}const result=model.storeOutput(world,name);say(result.ok?"🎒 "+result.item.name+" を持ち物に収納しました（設計モデルは作業台に保持）":result.message);if(result.ok)onCommit();return;}
  if(act==="save"){const name=$("ship-modeling-name").value.trim(),world=getWorld();if(!world||!name||!model.parts.length){say("名前を入力して部品を作成してください");return;}const result=world.savePrefabParts(name,model.prefabParts());say(result.message);if(result.ok)onCommit();return;}
  const result=act==="add"?model.add(values()):act==="edit"?model.update(values()):model.remove();if(!result.ok){say(result.message);return;}persist();refresh(true);say("作業台に反映・端末に保存しました");
 });
 panel.addEventListener("keydown",e=>{e.stopPropagation();if(e.key==="Escape")close();});
 function grab(hand,point){return near()&&model.grab(hand,point,mode.value);}
 function move(hand,point){return near()&&model.moveGrip(hand,point);}
 function release(hand){if(!model.releaseGrip(hand))return false;persist();if(!panel.hidden)refresh(true);return true;}
 function releaseAll(){if(!model.releaseAll())return false;persist();if(!panel.hidden)refresh(true);return true;}
 function moveGrips(points){return near()&&model.moveGrips(points);}
 return {model,update,close,grab,move,moveGrips,release,releaseAll,spatialTrigger};
}
