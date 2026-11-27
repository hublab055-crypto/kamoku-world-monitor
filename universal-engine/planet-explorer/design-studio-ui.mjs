import {prefabPlacementParts,cadCarryMetrics,CAD_CARRY_LIMITS} from "./owner-world.mjs";
import {cadAssemblyToAssetDocument} from "./cad-assembly-bridge.mjs?v=20261124";
import {AssetStudioModel} from "./asset-studio-model.mjs?v=0.9c-asset-v2";
import {validateMechanism} from "../model-lab/cad/mechanism-core.mjs";
import {packCadMesh} from "./cad-mesh-geometry.mjs";
export function prepareDesignOutput(payload){
 const name=String(payload?.name||"CAD制作物").trim().slice(0,32)||"CAD制作物";
 if(payload?.kind==="part"){
  const m=packCadMesh(payload.faces);
  return {name,parts:[{shape:"cube",cadMesh:m.mesh,x:0,z:0,width:m.width,height:m.height,depth:m.depth,offsetY:0,rotation:0,rx:0,ry:0,rz:0,color:[.48,.68,.79]}],note:"CAD近似メッシュ・mm→m換算"};
 }
 if(payload?.kind==="assembly"){
  const source=payload.source;
  const converted=cadAssemblyToAssetDocument(source),model=new AssetStudioModel(converted.document);
  if(source.mechanism?.joints?.length){validateMechanism(source.mechanism,source.objects);model.cadMotion={source:structuredClone(source),scale:converted.scale};}
  const parts=model.prefabParts(),bottom=Math.min(...parts.map(p=>p.offsetY));
  for(const p of parts)p.offsetY-=bottom;
  return {name,parts,assetDocument:model.prefabDocument(name),note:"組立のゲーム用近似形状（穴・B-repは非対応）"};
 }
 throw Error("CAD出力形式が不正です");
}
export function designPlacementPreview(data,point,getSurface){
 if(!data||!point||![point.lat,point.lon].every(Number.isFinite)||Math.abs(point.lat)>90||Math.abs(point.lon)>180)return null;
 const parts=prefabPlacementParts(data.parts,point);
 const land=p=>{if(Math.abs(p.lat)>90||Math.abs(p.lon)>180)return false;const surface=getSurface(p.lat,p.lon);return Boolean(surface&&!surface.water&&!surface.river);};
 return {point,parts,valid:land(point)&&parts.every(land)};
}
export function installDesignStudio({getWorld,getGround,getDefaultGround,getSurface,canPlace,onCommit,log}){
 const $=id=>document.getElementById(id),overlay=$("design-studio"),frame=$("design-frame"),bar=$("design-placement"),status=$("design-placement-status");
 let pending=null,candidate=null,carriedId=null,inventoryKey="";
 const confirm=$("design-confirm"),store=$("design-store"),list=$("design-inventory-list");
 const say=msg=>{status.textContent=msg;log(msg);};
 function open(){if(!frame.getAttribute("src"))frame.src="../model-lab/cad/?embedded=1";overlay.hidden=false;$("viewport-quick-panel").hidden=true;$("viewport-quick-toggle").setAttribute("aria-expanded","false");$("viewport-quick-toggle").textContent="☰ 操作";$("viewport-quick-toggle").setAttribute("aria-label","操作メニューを開く");$("design-close").focus();}
 function close(){overlay.hidden=true;$("viewport-quick-toggle").focus({preventScroll:true});}
 function cancel(){pending=null;candidate=null;carriedId=null;bar.hidden=true;confirm.disabled=true;store.hidden=true;}
 function refreshInventory(){const world=getWorld();if(!world)return;const key=JSON.stringify(world.cadInventory.map(x=>[x.id,x.name]));if(key===inventoryKey)return;inventoryKey=key;list.replaceChildren();const u=world.cadCarryUsage(),summary=document.createElement("p");summary.textContent="CAD制作物 "+u.count+"/"+CAD_CARRY_LIMITS.maxItems+" / "+u.kg.toFixed(2)+"kg / "+u.litres.toFixed(2)+"L";list.append(summary);for(const item of world.cadInventory){const b=document.createElement("button");b.type="button";b.textContent=item.name+" ("+cadCarryMetrics(item.parts).kg.toFixed(2)+"kg) を取り出す";b.addEventListener("click",()=>{if(pending){say("先の配置を完了または中止してください");return;}if(!canPlace()){log("地上で取り出してください");return;}const current=getWorld().cadInventory.find(x=>x.id===item.id);if(!current){refreshInventory();return;}pending=current;carriedId=current.id;bar.hidden=false;store.hidden=true;select(getDefaultGround(current.parts));});list.append(b);}}
 function select(point){candidate=designPlacementPreview(pending,point,getSurface);const valid=Boolean(candidate?.valid&&canPlace());confirm.disabled=!valid;status.textContent=valid?"配置ゴースト（青）：地面をタップして移動、確定で実体化。":"配置不可：陸上の地点を選択してください。";return valid;}
 function place(){
  if(!pending||!candidate)return false;
  const p=candidate.point;if(!select(p)){say("陸上の配置地点を指定してください");return false;}
  const world=getWorld(),data=pending;
  if(carriedId!==null){const result=world.placeCarriedCAD(carriedId,p);if(!result.ok){say(result.message);return false;}cancel();onCommit();refreshInventory();say("📐 "+result.name+" を取り出して配置しました");return true;}
  let name=data.name,i=2;while(world.prefabs.some(x=>x.name===name)){name=data.name.slice(0,30)+" #"+i++;}
  const saved=world.savePrefabParts(name,data.parts,{assetDocument:data.assetDocument||null});
  if(!saved.ok){say(saved.message);return false;}
  const placed=world.placePrefab(name,p);
  if(!placed.ok){world.undo();say(placed.message);return false;}
  cancel();onCommit();say("📐 "+name+" をゲームに出力しました。"+data.note);return true;
 }
 $("viewport-design").addEventListener("click",open);
 $("design-close").addEventListener("click",close);
 $("design-cancel").addEventListener("click",cancel);
 $("design-nearby").addEventListener("click",()=>{if(pending)select(getDefaultGround(pending.parts));});
 confirm.addEventListener("click",place);
 store.addEventListener("click",()=>{if(!pending||carriedId!==null||!canPlace())return;const result=getWorld().storeCAD(pending);if(!result.ok){say(result.message);return;}const name=result.item.name;cancel();onCommit();refreshInventory();log("🎒 "+name+" を持ち物に収納しました");});
 window.addEventListener("keydown",e=>{if(e.key==="Escape"&&pending)cancel();});
 overlay.addEventListener("keydown",e=>{if(e.key==="Escape")close();});
 window.addEventListener("message",e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=="ue-cad-output"||overlay.hidden)return;
  const reply=(ok,message)=>e.source.postMessage({type:"ue-cad-output-result",ok,message},e.origin);
  try{
   if(!canPlace())throw Error("地上に降りてからCADを出力してください");
   if(pending)throw Error("先の配置を完了またはキャンセルしてください");
   pending=prepareDesignOutput(e.data.payload);bar.hidden=false;close();
   const check=getWorld().canCarryCAD(pending);store.hidden=!check.ok;store.textContent=check.ok?"🎒 持ち物に収納 ("+check.metrics.kg.toFixed(2)+"kg)":"収納不可";
   select(getDefaultGround(pending.parts));
   log("CAD出力：ゴースト配置待ち。"+pending.note);reply(true,"ゲーム画面で配置を確定してください");
  }catch(err){reply(false,err.message);log("CAD出力失敗: "+err.message);}
 });
 return {get active(){return !overlay.hidden;},get pending(){return Boolean(pending);},get preview(){return canPlace()?candidate:null;},tap(x,y){if(!pending)return false;select(getGround(x,y));return true;},cancel,refreshInventory};
}
