import {shipCameraPose} from "./ship-view-controls.mjs?v=20261107-wide-fov";
import {shipSensorContacts,projectShipHudTarget} from "./ship-space-visuals.mjs?v=20261108-edge-destination";

/** Transparent in-scene contact typography, never a boxed viewport/window.
 * Reads exactly the same world positions and ranges as WebGL ship meshes.
 */
export function installShipSensorHUD(root,{getRenderer=()=>null}={}){
 const layer=root.querySelector("#flight-sensors"),nodes=new Map();
 function update(v,{visible=false,chase=false,wide=true,fovDeg=108,distance=52,
  orbitYaw=0,orbitPitch=.31}={}){
  if(!layer)return;
  layer.hidden=!visible;
  if(!visible)return;
  const box=layer.getBoundingClientRect();
  if(box.width<20||box.height<20)return;
  const renderer=getRenderer();
  const combat=renderer?.shipCombat;
  const camera=shipCameraPose({mode:chase?"chase":"cockpit",wide,fovDeg,
   distance,orbitYaw,orbitPitch,interior:{...v.interior,hatchPassable:v.hatchOpen}});
  const contacts=shipSensorContacts(v,combat),present=new Set();
  const projections=new Map((renderer?.shipTargets||[]).map(p=>[p.id,p]));
  const scanned=renderer?.shipScannedIds||new Set();
  for(const contact of contacts){
   if(contact.id!=="planet"&&!scanned.has(contact.id)&&!combat?.locked?.includes(contact.id)&&contact.faction==="hostile")continue;
   present.add(contact.id);
   let node=nodes.get(contact.id);
   if(!node){
    node=document.createElement("div");node.className="flight-sensor";
    node.setAttribute("role","img");
    const symbol=document.createElement("span");symbol.className="flight-sensor-arrow";
    const detail=document.createElement("span");detail.className="flight-sensor-details";
    const name=document.createElement("span");name.className="flight-sensor-name";
    const range=document.createElement("span");range.className="flight-sensor-distance";
    detail.append(name,range);node.append(symbol,detail);
    nodes.set(contact.id,node);layer.append(node);
   }
   const fallback=projectShipHudTarget(contact.position,camera,box.width,box.height,
    {margin:box.width<500?.08:.05});
   if(!fallback){node.hidden=true;continue;}
   const renderPoint=projections.get(contact.id);
   const accurate=renderPoint?.onScreen&&Number.isFinite(renderPoint.u)&&Number.isFinite(renderPoint.v);
   const centerMargin=box.width<500?.11:.07;
   const inside=Boolean(accurate&&renderPoint.u>centerMargin&&renderPoint.u<1-centerMargin&&
    renderPoint.v>centerMargin&&renderPoint.v<1-centerMargin);
   const pos=inside?{x:renderPoint.u*box.width,y:renderPoint.v*box.height,visible:true}:fallback;
   node.hidden=false;node.dataset.category=contact.faction||contact.type;
   node.dataset.offscreen=String(!pos.visible);
   node.dataset.locked=String(Boolean(combat?.locked?.includes(contact.id)));
   node.style.left=Math.round(pos.x)+"px";
   node.style.top=Math.round(pos.y)+"px";
   const icon=combat?.locked?.includes(contact.id)?"♦️":
    contact.surrendered?"🏳️":contact.icon;
   const arrowIndex=(((Math.round(fallback.angleDeg/45)%8)+8)%8);
   const pointing=["↑","↗","→","↘","↓","↙","←","↖"][arrowIndex];
   node.querySelector(".flight-sensor-arrow").textContent=icon+
    (pos.visible?"":" "+pointing+(fallback.behind?" 後方":""));
   node.querySelector(".flight-sensor-name").textContent=contact.name;
   node.querySelector(".flight-sensor-distance").textContent=
    (contact.estimate?"推定 ":"")+contact.distance;
   node.setAttribute("aria-label",icon+" "+contact.name+" "+contact.distance+
    (pos.visible?" 画面内":" 画面外"));
  }
  for(const [id,node] of nodes)if(!present.has(id)){node.remove();nodes.delete(id);}
 }
 return {update,hide:()=>{if(layer)layer.hidden=true;}};
}
