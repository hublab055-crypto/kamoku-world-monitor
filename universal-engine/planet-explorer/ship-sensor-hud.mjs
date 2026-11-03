import {shipCameraPose} from "./ship-view-controls.mjs?v=3-chase-orbit";
import {shipSensorContacts,projectShipHudTarget} from "./ship-space-visuals.mjs?v=1";
/** Accessible, non-interactive projection overlay for celestial/ship contacts.
 * Uses the same local positions as render.mjs; no invented screen-space angles.
 */
export function installShipSensorHUD(root){
 const layer=root.querySelector("#flight-sensors"),nodes=new Map();
 function update(v,{visible=false,chase=false,wide=true,distance=52,orbitYaw=0,orbitPitch=.31}={}){
  if(!layer)return;
  layer.hidden=!visible;
  if(!visible)return;
  const box=layer.getBoundingClientRect();
  if(box.width<20||box.height<20)return;
  const camera=shipCameraPose({mode:chase?"chase":"cockpit",wide,
   distance,orbitYaw,orbitPitch,interior:{...v.interior,hatchPassable:v.hatchOpen}});
  const contacts=shipSensorContacts(v),present=new Set();
  for(const contact of contacts){
   present.add(contact.id);
   let node=nodes.get(contact.id);
   if(!node){
    node=document.createElement("div");node.className="flight-sensor";
    node.setAttribute("role","img");
    const arrow=document.createElement("span");arrow.className="flight-sensor-arrow";
    const detail=document.createElement("span");detail.className="flight-sensor-details";
    const name=document.createElement("span");name.className="flight-sensor-name";
    const range=document.createElement("span");range.className="flight-sensor-distance";
    detail.append(name,range);node.append(arrow,detail);
    nodes.set(contact.id,node);layer.append(node);
   }
   const projected=projectShipHudTarget(contact.position,camera,box.width,box.height,
    {margin:box.width<500?.22:.13});
   if(!projected){node.hidden=true;continue;}
   node.hidden=false;node.dataset.type=contact.type;
   node.dataset.offscreen=String(!projected.visible);
   node.style.left=Math.round(projected.x)+"px";
   node.style.top=Math.round(projected.y)+"px";
   node.querySelector(".flight-sensor-arrow").textContent=projected.visible?contact.icon:"▲";
   node.querySelector(".flight-sensor-arrow").style.transform=projected.visible?
    "none":"rotate("+projected.angleDeg.toFixed(0)+"deg)";
   node.querySelector(".flight-sensor-name").textContent=contact.name;
   node.querySelector(".flight-sensor-distance").textContent=
    (contact.estimate?"推定 ":"")+contact.distance;
   node.setAttribute("aria-label",contact.name+" "+contact.distance+
    (projected.visible?" 画面内":" 画面外の方向"));
  }
  for(const [id,node] of nodes)if(!present.has(id)){node.remove();nodes.delete(id);}
 }
 return {update,hide:()=>{layer.hidden=true;}};
}
