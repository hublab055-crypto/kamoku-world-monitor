import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const EARTH_COLOR_URL="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_HEIGHT_URL="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png";
const EARTH_WATER_URL="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png";

let host=null,scene=null,camera=null,renderer=null,controls=null,markerGroup=null,raycaster=null,pointer=null,tooltip=null,onSelect=null;
let resizeObserver=null,animationId=null,earth=null,atmosphere=null,latitudeGrid=null;
let currentLanguage="ja",terrainExaggeration=30,seabedEnabled=true;
const EARTH_RADIUS=2;
const REAL_MAX_RELIEF_SCENE=0.00285;

function terrainMaxOutward(){
  return Math.min(.32,REAL_MAX_RELIEF_SCENE*Math.max(1,terrainExaggeration));
}
function markerRadius(){
  return EARTH_RADIUS+.045+terrainMaxOutward();
}
function latLonToVector3(lat,lon,r=markerRadius()){
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
  const yearWord=currentLanguage==="en"?"Year":"年";
  tooltip.style.display="block";
  const x=Math.min((event.offsetX||0)+14,Math.max(10,host.clientWidth-230));
  const y=Math.min((event.offsetY||0)+14,Math.max(10,host.clientHeight-92));
  tooltip.style.left=x+"px";
  tooltip.style.top=y+"px";
  tooltip.innerHTML="<b>"+d.name+"</b><br>"+d.metric+": "+d.valueText+"<br><span style='opacity:.7'>"+yearWord+" "+d.year+"</span>";
}
function addStars(){
  const n=900,positions=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const r=10+Math.random()*16;
    const u=Math.random()*2-1,theta=Math.random()*Math.PI*2;
    const s=Math.sqrt(1-u*u);
    positions[i*3]=r*s*Math.cos(theta);
    positions[i*3+1]=r*u;
    positions[i*3+2]=r*s*Math.sin(theta);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(positions,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({
    size:.024,color:0xb9d8ff,transparent:true,opacity:.65,depthWrite:false
  })));
}
function loadEarthTextures(material){
  const loader=new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(EARTH_COLOR_URL,texture=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    material.map=texture;material.needsUpdate=true;
  },undefined,()=>{});
  loader.load(EARTH_HEIGHT_URL,texture=>{
    texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    material.bumpMap=texture;
    material.displacementMap=texture;
    applyTerrainSettings();
  },undefined,()=>{});
  loader.load(EARTH_WATER_URL,texture=>{
    material.specularMap=texture;
    material.specular=new THREE.Color(0x6f859c);
    material.shininess=14;
    material.needsUpdate=true;
  },undefined,()=>{});
}
function applyTerrainSettings(){
  if(!earth?.material)return;
  const ex=Math.max(1,Math.min(100,+terrainExaggeration||1));
  const relief=REAL_MAX_RELIEF_SCENE*ex;
  earth.material.bumpScale=Math.max(.008,relief*.7);
  if(seabedEnabled){
    // The topology texture is interpreted around its midpoint so ocean relief
    // can fall below the reference sphere while land rises above it.
    earth.material.displacementScale=relief*2;
    earth.material.displacementBias=-relief;
  }else{
    // With seabed disabled, dark ocean pixels stay close to the reference sphere
    // while brighter land relief is displaced outward.
    earth.material.displacementScale=relief;
    earth.material.displacementBias=0;
  }
  earth.material.needsUpdate=true;
  const outer=EARTH_RADIUS+Math.min(.34,relief)+.10;
  if(atmosphere)atmosphere.scale.setScalar(outer/2.115);
  if(latitudeGrid)latitudeGrid.scale.setScalar((EARTH_RADIUS+.04+Math.min(.18,relief*.25))/2.105);
}
function fitGlobeToViewport({preserveDirection=true}={}){
  if(!host||!camera||!controls)return;
  const w=Math.max(280,host.clientWidth),h=Math.max(360,host.clientHeight||480);
  const aspect=w/h;
  camera.aspect=aspect;camera.updateProjectionMatrix();

  const halfY=THREE.MathUtils.degToRad(camera.fov*.5);
  const halfX=Math.atan(Math.tan(halfY)*aspect);
  const limiting=Math.max(.08,Math.min(halfY,halfX));
  const radius=EARTH_RADIUS+terrainMaxOutward()+.13;
  const distance=radius/Math.sin(limiting)*1.06;

  const dir=preserveDirection
    ?camera.position.clone().sub(controls.target).normalize()
    :new THREE.Vector3(0,0,1);
  controls.target.set(0,0,0);
  camera.position.copy(dir.multiplyScalar(distance));
  camera.lookAt(0,0,0);
  controls.update();
}
export function setTerrain({exaggeration=terrainExaggeration,seabed=seabedEnabled,fit=true}={}){
  terrainExaggeration=Math.max(1,Math.min(100,+exaggeration||1));
  seabedEnabled=!!seabed;
  applyTerrainSettings();
  if(fit)fitGlobeToViewport({preserveDirection:true});
}
export function centerGlobe(){
  if(!camera||!controls)return;
  controls.target.set(0,0,0);
  camera.position.set(0,0,6);
  fitGlobeToViewport({preserveDirection:false});
}

export function initGlobe(element){
  if(host===element&&renderer)return;
  host=element;host.innerHTML="";host.style.position="relative";
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(42,1,.1,100);
  camera.position.set(0,0,6.35);

  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000,0);
  host.appendChild(renderer.domElement);

  controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.06;
  controls.enablePan=false;controls.minDistance=3.15;controls.maxDistance=14;
  controls.target.set(0,0,0);
  camera.lookAt(0,0,0);
  controls.autoRotate=true;controls.autoRotateSpeed=.28;
  controls.rotateSpeed=.72;controls.zoomSpeed=.85;

  scene.add(new THREE.HemisphereLight(0xbfdcff,0x07111d,1.45));
  const sun=new THREE.DirectionalLight(0xffffff,2.1);sun.position.set(5,3,5);scene.add(sun);
  const rim=new THREE.DirectionalLight(0x4f8cff,.7);rim.position.set(-5,-1,-4);scene.add(rim);

  const material=new THREE.MeshPhongMaterial({
    color:0x17476d,
    emissive:0x020b15,
    shininess:8
  });
  earth=new THREE.Mesh(new THREE.SphereGeometry(2,128,96),material);
  scene.add(earth);
  loadEarthTextures(material);
  applyTerrainSettings();

  atmosphere=new THREE.Mesh(
    new THREE.SphereGeometry(2.115,64,48),
    new THREE.MeshBasicMaterial({
      color:0x68b6ff,transparent:true,opacity:.045,
      side:THREE.BackSide,depthWrite:false
    })
  );
  scene.add(atmosphere);

  latitudeGrid=new THREE.Mesh(
    new THREE.SphereGeometry(2.105,36,24),
    new THREE.MeshBasicMaterial({
      color:0x8bb9dd,wireframe:true,transparent:true,
      opacity:.035,depthWrite:false
    })
  );
  scene.add(latitudeGrid);

  markerGroup=new THREE.Group();scene.add(markerGroup);
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  addStars();

  tooltip=document.createElement("div");
  tooltip.style.cssText="display:none;position:absolute;z-index:4;pointer-events:none;max-width:220px;background:rgba(5,12,24,.95);border:1px solid #36506e;border-radius:9px;padding:7px 9px;font:12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;color:#e8eef7;box-shadow:0 8px 24px rgba(0,0,0,.35)";
  host.appendChild(tooltip);

  renderer.domElement.addEventListener("pointermove",e=>showTooltip(e,hit(e)));
  renderer.domElement.addEventListener("pointerleave",()=>showTooltip(null,null));
  renderer.domElement.addEventListener("pointerdown",()=>{controls.autoRotate=false;});
  renderer.domElement.addEventListener("click",e=>{
    const o=hit(e);if(o&&onSelect)onSelect(o.userData.iso3);
  });

  const resize=()=>{
    const w=Math.max(280,host.clientWidth),h=Math.max(360,host.clientHeight||480);
    renderer.setSize(w,h,false);
    fitGlobeToViewport({preserveDirection:true});
  };
  resizeObserver?.disconnect();
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();

  const clock=new THREE.Clock();
  function animate(){
    animationId=requestAnimationFrame(animate);
    const dt=Math.min(clock.getDelta(),.05);
    controls.update(dt);
    renderer.render(scene,camera);
  }
  animate();
}
function markerColor(t){
  const c=new THREE.Color();
  c.setHSL(.62*(1-t),.78,.56);
  return c;
}
export function updateGlobe({element,countries,metric,metricLabel,unit,language="ja",terrainScale=terrainExaggeration,seabed=seabedEnabled,onCountrySelect}){
  initGlobe(element);
  onSelect=onCountrySelect||null;
  currentLanguage=language==="en"?"en":"ja";
  terrainExaggeration=Math.max(1,Math.min(100,+terrainScale||30));
  seabedEnabled=!!seabed;
  applyTerrainSettings();
  while(markerGroup.children.length){
    const o=markerGroup.children.pop();
    o.geometry?.dispose();o.material?.dispose();
  }
  const rows=(countries||[]).map(c=>({c,v:c.latest?.[metric]}))
    .filter(x=>x.v&&x.v.value!=null&&Number.isFinite(+x.c.lat)&&Number.isFinite(+x.c.lon));
  const vals=rows.map(x=>+x.v.value).sort((a,b)=>a-b);
  const lo=vals[Math.floor((vals.length-1)*.05)]??0;
  const hi=vals[Math.floor((vals.length-1)*.95)]??1;
  const span=(hi-lo)||1;
  const locale=currentLanguage==="en"?"en-US":"ja-JP";

  for(const {c,v} of rows){
    const n=+v.value,t=Math.max(0,Math.min(1,(n-lo)/span));
    const col=markerColor(t);
    const marker=new THREE.Mesh(
      new THREE.SphereGeometry(.031+.027*Math.sqrt(t),12,9),
      new THREE.MeshPhongMaterial({
        color:col,emissive:col.clone().multiplyScalar(.18),shininess:18
      })
    );
    marker.position.copy(latLonToVector3(+c.lat,+c.lon));
    marker.userData={
      iso3:c.iso3,
      name:c.displayName||c.name,
      metric:metricLabel||metric,
      value:n,
      valueText:Number(n).toLocaleString(locale,{maximumFractionDigits:3})+
        (unit==="percent"?"%":unit?(" "+unit):""),
      year:v.year||"—"
    };
    markerGroup.add(marker);
  }
}
window.KamokuGlobe={init:initGlobe,update:updateGlobe,setTerrain,center:centerGlobe};
window.dispatchEvent(new Event("kamoku-globe-ready"));