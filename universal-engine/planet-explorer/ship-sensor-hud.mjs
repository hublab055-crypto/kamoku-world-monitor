import {shipCameraPose} from "./ship-view-controls.mjs?v=20261107-wide-fov";
import {shipSensorContacts,projectShipHudTarget} from "./ship-space-visuals.mjs?v=20261112-warp";

/** Transparent in-scene contact typography, never a boxed viewport/window.
 * Reads exactly the same world positions and ranges as WebGL ship meshes.
 */
export function installShipSensorHUD(root,{getRenderer=()=>null}={}){
 const layer=root.querySelector("#flight-sensors"),nodes=new Map();
 const controls=[...root.querySelectorAll(".flight-engine-lever,.flight-touch-pad,.flight-look-pad")];
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
  const placed=controls.map(control=>control.getBoundingClientRect())
   .filter(rect=>rect.width>0&&rect.height>0)
   .map(rect=>({x:rect.left-box.left,y:rect.top-box.top,width:rect.width,height:rect.height}));
  for(const contact of contacts){
   const locked=Boolean(combat?.locked?.includes(contact.id));
   if(contact.id!=="planet"&&contact.type!=="star"&&!scanned.has(contact.id)&&!locked)continue;
   present.add(contact.id);
   let node=nodes.get(contact.id);
   if(!node){
    node=document.createElement("button");node.type="button";node.className="flight-sensor";
    node.style.pointerEvents="auto";
    const choose=event=>{event.preventDefault();event.stopPropagation();getRenderer()?.selectShipNavigation?.(contact.id);};
    node.addEventListener("click",choose);
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
   const selected=v.navigationTarget?.id===contact.id||contact.type==="star"&&v.destinationId&&contact.id==="star:"+v.destinationSystemId;
   node.hidden=false;node.style.outline=selected?"1px solid #fff":"";node.dataset.category=contact.faction||contact.type;
   node.dataset.offscreen=String(!pos.visible);
   node.dataset.locked=String(locked);
   const halfWidth=62,halfHeight=16;
   const x=Math.max(halfWidth,Math.min(box.width-halfWidth,pos.x));
   const top=Math.min(116,box.height*.38),bottom=box.height-Math.min(82,box.height*.28);
   const y=Math.max(top,Math.min(bottom,pos.y));
   let point={x,y};
   const fits=(cx,cy)=>cx>=halfWidth&&cx<=box.width-halfWidth&&cy>=top&&cy<=bottom&&
    placed.every(p=>cx+halfWidth<=p.x||cx-halfWidth>=p.x+p.width||
     cy+halfHeight<=p.y||cy-halfHeight>=p.y+p.height);
   placement: for(const dx of [0,76,-76,136,-136]){
    for(const dy of [0,-34,34,-68,68,-102,102]){
     if(fits(x+dx,y+dy)){point={x:x+dx,y:y+dy};break placement;}
    }
   }
   placed.push({x:point.x-halfWidth,y:point.y-halfHeight,width:2*halfWidth,height:2*halfHeight});
   node.style.left=Math.round(point.x)+"px";
   node.style.top=Math.round(point.y)+"px";
   const icon=locked?"♦️":contact.surrendered?"🏳️":contact.icon;
   const arrowIndex=(((Math.round(fallback.angleDeg/45)%8)+8)%8);
   const pointing=["↑","↗","→","↘","↓","↙","←","↖"][arrowIndex];
   node.querySelector(".flight-sensor-arrow").textContent=icon+
    (pos.visible?"":" "+pointing+(fallback.behind?" 後方":""));
   node.querySelector(".flight-sensor-name").textContent=contact.name;
   node.querySelector(".flight-sensor-distance").textContent=
    (contact.estimate?"推定 ":"")+contact.distance+(locked?" · LOCK":selected?" · 追跡":"");
   node.setAttribute("aria-label",icon+" "+contact.name+" "+contact.distance+
    (pos.visible?" 画面内":" 画面外"));
  }
  for(const [id,node] of nodes)if(!present.has(id)){node.remove();nodes.delete(id);}
 }
 return {update,hide:()=>{if(layer)layer.hidden=true;}};
}
