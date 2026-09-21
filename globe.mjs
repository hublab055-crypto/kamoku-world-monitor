import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let host=null,scene=null,camera=null,renderer=null,controls=null,markerGroup=null,raycaster=null,pointer=null,tooltip=null,onSelect=null;
let resizeObserver=null,animationId=null;

function latLonToVector3(lat,lon,r=2.035){
  const phi=(90-lat)*Math.PI/180;
  const theta=(lon+180)*Math.PI/180;
  return new THREE.Vector3(
    -r*Math.sin(phi)*Math.cos(theta),
    r*Math.cos(phi),
    r*Math.sin(phi)*Math.sin(theta)
  );
}
function setPointer(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
}
function hit(event){
  if(!renderer||!camera||!markerGroup)return null;
  setPointer(event);
  raycaster.setFromCamera(pointer,camera);
  return raycaster.intersectObjects(markerGroup.children,false)[0]?.object||null;
}
function showTooltip(event,obj){
  if(!tooltip)return;
  if(!obj){tooltip.style.display="none";return;}
  const d=obj.userData;
  tooltip.style.display="block";
  tooltip.style.left=(event.offsetX+14)+"px";
  tooltip.style.top=(event.offsetY+14)+"px";
  tooltip.innerHTML="<b>"+d.name+"</b><br>"+d.metric+": "+d.valueText+"<br><span style='opacity:.7'>"+d.year+"</span>";
}
function addStars(){
  const n=1200,positions=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const r=10+Math.random()*16;
    const u=Math.random()*2-1,theta=Math.random()*Math.PI*2;
    const s=Math.sqrt(1-u*u);
    positions[i*3]=r*s*Math.cos(theta);positions[i*3+1]=r*u;positions[i*3+2]=r*s*Math.sin(theta);
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(positions,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({size:.025,color:0xb9d8ff,transparent:true,opacity:.7})));
}
export function initGlobe(element){
  if(host===element&&renderer)return;
  host=element;host.innerHTML="";host.style.position="relative";
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(42,1,.1,100);
  camera.position.set(0,0,6.2);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000,0);
  host.appendChild(renderer.domElement);

  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.06;
  controls.enablePan=false;controls.minDistance=3.2;controls.maxDistance=10;
  controls.autoRotate=true;controls.autoRotateSpeed=.35;

  scene.add(new THREE.AmbientLight(0xaacfff,1.1));
  const sun=new THREE.DirectionalLight(0xffffff,2.0);sun.position.set(5,3,5);scene.add(sun);
  const rim=new THREE.DirectionalLight(0x4f8cff,.9);rim.position.set(-5,-1,-4);scene.add(rim);

  const earth=new THREE.Mesh(
    new THREE.SphereGeometry(2,64,48),
    new THREE.MeshPhongMaterial({color:0x0c3155,emissive:0x06152b,shininess:18,transparent:true,opacity:.97})
  );
  scene.add(earth);
  const grid=new THREE.Mesh(
    new THREE.SphereGeometry(2.006,36,24),
    new THREE.MeshBasicMaterial({color:0x4b7398,wireframe:true,transparent:true,opacity:.11})
  );
  scene.add(grid);
  const atmosphere=new THREE.Mesh(
    new THREE.SphereGeometry(2.08,48,32),
    new THREE.MeshBasicMaterial({color:0x5aa7ff,transparent:true,opacity:.055,side:THREE.BackSide})
  );
  scene.add(atmosphere);

  markerGroup=new THREE.Group();scene.add(markerGroup);
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  raycaster.params.Points.threshold=.08;
  addStars();

  tooltip=document.createElement("div");
  tooltip.style.cssText="display:none;position:absolute;z-index:4;pointer-events:none;background:rgba(5,12,24,.94);border:1px solid #36506e;border-radius:9px;padding:7px 9px;font:12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;color:#e8eef7;box-shadow:0 8px 24px rgba(0,0,0,.35)";
  host.appendChild(tooltip);

  renderer.domElement.addEventListener("pointermove",e=>showTooltip(e,hit(e)));
  renderer.domElement.addEventListener("pointerleave",()=>showTooltip(null,null));
  renderer.domElement.addEventListener("click",e=>{const o=hit(e);if(o&&onSelect)onSelect(o.userData.iso3)});

  const resize=()=>{
    const w=Math.max(280,host.clientWidth),h=Math.max(360,host.clientHeight||480);
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  };
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();

  const clock=new THREE.Clock();
  function animate(){
    animationId=requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.05);controls.update(dt);renderer.render(scene,camera);
  }
  animate();
}
function markerColor(t){
  const c=new THREE.Color();
  c.setHSL(.62*(1-t),.78,.55);
  return c;
}
export function updateGlobe({element,countries,metric,unit,onCountrySelect}){
  initGlobe(element);onSelect=onCountrySelect||null;
  while(markerGroup.children.length){
    const o=markerGroup.children.pop();
    o.geometry?.dispose();o.material?.dispose();
  }
  const rows=(countries||[]).map(c=>({c,v:c.latest?.[metric]}))
    .filter(x=>x.v&&x.v.value!=null&&Number.isFinite(+x.c.lat)&&Number.isFinite(+x.c.lon));
  const vals=rows.map(x=>+x.v.value).sort((a,b)=>a-b);
  const lo=vals[Math.floor((vals.length-1)*.05)]??0,hi=vals[Math.floor((vals.length-1)*.95)]??1;
  const span=(hi-lo)||1;
  for(const {c,v} of rows){
    const n=+v.value,t=Math.max(0,Math.min(1,(n-lo)/span));
    const marker=new THREE.Mesh(
      new THREE.SphereGeometry(.035+.032*Math.sqrt(t),12,9),
      new THREE.MeshPhongMaterial({color:markerColor(t),emissive:markerColor(t).multiplyScalar(.18)})
    );
    marker.position.copy(latLonToVector3(+c.lat,+c.lon));
    marker.userData={
      iso3:c.iso3,name:c.name,metric:metric,value:n,
      valueText:Number(n).toLocaleString("ja-JP",{maximumFractionDigits:3})+(unit==="percent"?"%":unit?(" "+unit):""),
      year:v.year||"—"
    };
    markerGroup.add(marker);
  }
}
window.KamokuGlobe={init:initGlobe,update:updateGlobe};
window.dispatchEvent(new Event("kamoku-globe-ready"));
