import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";

const EARTH_COLOR_URL="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg";
const EARTH_HEIGHT_URL="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png";
const EARTH_WATER_URL="https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-water.png";

const EARTH_RADIUS=2;
const REAL_MAX_RELIEF_SCENE=0.00285;
const EARTH_RADIUS_METERS=6371000;
const DEM_TERRARIUM_BASE="https://elevation-tiles-prod.s3.amazonaws.com/terrarium";
const COUNTRY_GEOJSON_URL="https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";
const DEG=Math.PI/180;

let host=null,scene=null,camera=null,renderer=null,controls=null,markerGroup=null,capitalGroup=null,raycaster=null,pointer=null,tooltip=null,onSelect=null;
let resizeObserver=null,animationId=null,earth=null,atmosphere=null,latitudeGrid=null,sun=null,rim=null;
let currentLanguage="ja",terrainExaggeration=30,seabedEnabled=true,demEnabled=true,initialViewApplied=false;
let cameraRollDeg=0,simulationHour=12;
let demGroup=null,demRefreshTimer=null,demBuildToken=0,demLastKey="";
let countryOverlay=null,countryReliefGroup=null,countryGeoJsonPromise=null,countryOverlayToken=0,countryReliefToken=0;
const demCache=new Map();
let stateListener=null,stateEmitRaf=0;

function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
function wrap(v,min,max){
  const span=max-min;
  return ((v-min)%span+span)%span+min;
}
function terrainMaxOutward(){
  return Math.min(.32,REAL_MAX_RELIEF_SCENE*Math.max(1,terrainExaggeration));
}
function markerRadius(){
  return EARTH_RADIUS+.045+terrainMaxOutward();
}
function latLonToVector3(lat,lon,r=markerRadius()){
  const phi=(90-lat)*DEG;
  const theta=(lon+180)*DEG;
  return new THREE.Vector3(
    -r*Math.sin(phi)*Math.cos(theta),
    r*Math.cos(phi),
    r*Math.sin(phi)*Math.sin(theta)
  );
}
function vectorToLatLon(v){
  const n=v.clone().normalize();
  return {
    lat:THREE.MathUtils.radToDeg(Math.asin(clamp(n.y,-1,1))),
    lon:wrap(THREE.MathUtils.radToDeg(Math.atan2(-n.z,n.x)),-180,180)
  };
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
  const targets=[
    ...(capitalGroup?.visible?capitalGroup.children:[]),
    ...(markerGroup?.visible?markerGroup.children:[]),
    ...(countryReliefGroup?.visible?countryReliefGroup.children:[])
  ];
  return raycaster.intersectObjects(targets,false)[0]?.object||null;
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
  tooltip.innerHTML=d.kind==="capital"
    ?"<b>"+d.name+"</b><br>"+(currentLanguage==="en"?"Capital":"首都")+": "+d.capital
    :"<b>"+d.name+"</b><br>"+d.metric+": "+d.valueText+"<br><span style='opacity:.7'>"+yearWord+" "+d.year+"</span>";
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
  const ex=clamp(+terrainExaggeration||1,1,100);
  const relief=REAL_MAX_RELIEF_SCENE*ex;
  earth.material.bumpScale=Math.max(.008,relief*.7);
  if(seabedEnabled){
    earth.material.displacementScale=relief*2;
    earth.material.displacementBias=-relief;
  }else{
    earth.material.displacementScale=relief;
    earth.material.displacementBias=0;
  }
  earth.material.needsUpdate=true;
  const outer=EARTH_RADIUS+Math.min(.34,relief)+.10;
  if(atmosphere)atmosphere.scale.setScalar(outer/2.115);
  if(latitudeGrid)latitudeGrid.scale.setScalar((EARTH_RADIUS+.04+Math.min(.18,relief*.25))/2.105);
}
function updateSun(){
  if(!sun)return;
  const angle=((simulationHour-12)/24)*Math.PI*2;
  sun.position.set(6*Math.cos(angle),1.4,6*Math.sin(angle));
  if(rim)rim.position.set(-sun.position.x*.65,-.8,-sun.position.z*.65);
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
  camera.lookAt(controls.target);
  controls.update();
  scheduleStateEmit();
}
function getOffset(){
  if(!camera||!controls)return new THREE.Vector3(0,0,6);
  return camera.position.clone().sub(controls.target);
}
function getViewAngles(){
  const o=getOffset(),d=Math.max(.0001,o.length());
  return {
    rx:THREE.MathUtils.radToDeg(Math.asin(clamp(o.y/d,-1,1))),
    ry:wrap(THREE.MathUtils.radToDeg(Math.atan2(o.x,o.z)),-180,180)
  };
}
export function getViewState(){
  if(!camera||!controls)return {
    x:0,y:0,z:0,rx:0,ry:0,rz:cameraRollDeg,zoom:6,lat:0,lon:-90,time:simulationHour
  };
  const offset=getOffset(),ll=vectorToLatLon(offset),ang=getViewAngles();
  return {
    x:+controls.target.x.toFixed(4),
    y:+controls.target.y.toFixed(4),
    z:+controls.target.z.toFixed(4),
    rx:+ang.rx.toFixed(3),
    ry:+ang.ry.toFixed(3),
    rz:+cameraRollDeg.toFixed(3),
    zoom:+offset.length().toFixed(4),
    lat:+ll.lat.toFixed(3),
    lon:+ll.lon.toFixed(3),
    time:+simulationHour.toFixed(3)
  };
}
function scheduleStateEmit(){
  if(!stateListener||stateEmitRaf)return;
  stateEmitRaf=requestAnimationFrame(()=>{
    stateEmitRaf=0;
    try{stateListener(getViewState());}catch{}
  });
}
function setOrbitAngles(rx,ry,zoom=null){
  if(!camera||!controls)return;
  const d=zoom==null?getOffset().length():clamp(+zoom||6,controls.minDistance,controls.maxDistance);
  const elev=clamp(+rx||0,-89.5,89.5)*DEG;
  const az=(+ry||0)*DEG;
  const ce=Math.cos(elev);
  const offset=new THREE.Vector3(
    d*ce*Math.sin(az),
    d*Math.sin(elev),
    d*ce*Math.cos(az)
  );
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
}
function setLatLon(lat,lon,zoom=null){
  if(!camera||!controls)return;
  const d=zoom==null?getOffset().length():clamp(+zoom||6,controls.minDistance,controls.maxDistance);
  const dir=latLonToVector3(clamp(+lat||0,-90,90),wrap(+lon||0,-180,180),1).normalize();
  camera.position.copy(controls.target).addScaledVector(dir,d);
  camera.lookAt(controls.target);
}
export function setViewState(patch={},options={}){
  if(!camera||!controls)return;
  const before=getViewState();
  const target=controls.target.clone();
  if(Number.isFinite(+patch.x))target.x=clamp(+patch.x,-6,6);
  if(Number.isFinite(+patch.y))target.y=clamp(+patch.y,-6,6);
  if(Number.isFinite(+patch.z))target.z=clamp(+patch.z,-6,6);
  controls.target.copy(target);

  const requestedZoom=Number.isFinite(+patch.zoom)?clamp(+patch.zoom,controls.minDistance,controls.maxDistance):before.zoom;
  const hasLat=Number.isFinite(+patch.lat),hasLon=Number.isFinite(+patch.lon);
  const hasRx=Number.isFinite(+patch.rx),hasRy=Number.isFinite(+patch.ry);

  if(hasLat||hasLon){
    setLatLon(hasLat?+patch.lat:before.lat,hasLon?+patch.lon:before.lon,requestedZoom);
  }else if(hasRx||hasRy||Number.isFinite(+patch.zoom)){
    setOrbitAngles(hasRx?+patch.rx:before.rx,hasRy?+patch.ry:before.ry,requestedZoom);
  }else{
    const dir=getOffset().normalize();
    camera.position.copy(controls.target).addScaledVector(dir,requestedZoom);
    camera.lookAt(controls.target);
  }

  if(Number.isFinite(+patch.rz)){
    cameraRollDeg=wrap(+patch.rz,-180,180);
    const viewDir=controls.target.clone().sub(camera.position).normalize();
    const q=new THREE.Quaternion().setFromAxisAngle(viewDir,cameraRollDeg*DEG);
    const up=new THREE.Vector3(0,1,0).applyQuaternion(q);
    camera.up.copy(up);
    camera.lookAt(controls.target);
  }
  if(Number.isFinite(+patch.time)){
    simulationHour=wrap(+patch.time,0,24);
    updateSun();
  }

  controls.update();
  if(options.emit!==false)scheduleStateEmit();
}
export function nudgeView(key,delta){
  const s=getViewState();
  const ranges={
    x:[-6,6],y:[-6,6],z:[-6,6],rx:[-89.5,89.5],ry:[-180,180],
    rz:[-180,180],zoom:[3.15,14],lat:[-90,90],lon:[-180,180],time:[0,24]
  };
  let v=(+s[key]||0)+(+delta||0);
  if(key==="ry"||key==="rz"||key==="lon")v=wrap(v,-180,180);
  else if(key==="time")v=wrap(v,0,24);
  else if(ranges[key])v=clamp(v,ranges[key][0],ranges[key][1]);
  setViewState({[key]:v});
}
export function subscribeViewState(fn){
  stateListener=typeof fn==="function"?fn:null;
  scheduleStateEmit();
  return ()=>{if(stateListener===fn)stateListener=null;};
}
export function setTerrain({exaggeration=terrainExaggeration,seabed=seabedEnabled,fit=true}={}){
  terrainExaggeration=clamp(+exaggeration||1,1,100);
  seabedEnabled=!!seabed;
  applyTerrainSettings();
  demLastKey="";
  scheduleDemRefresh(0);
  if(fit)fitGlobeToViewport({preserveDirection:true});
}
export function centerGlobe(){
  if(!camera||!controls)return;
  cameraRollDeg=0;
  controls.target.set(0,0,0);
  camera.position.set(0,0,6);
  fitGlobeToViewport({preserveDirection:false});
  scheduleStateEmit();
}

export function flyToLatLon(lat,lon,{zoom=4.1,duration=850}={}){
  if(!camera||!controls)return;
  const safeLat=clamp(+lat||0,-90,90),safeLon=wrap(+lon||0,-180,180);
  const endDir=latLonToVector3(safeLat,safeLon,1).normalize();
  const endTarget=new THREE.Vector3(0,0,0);
  const endPos=endDir.multiplyScalar(clamp(+zoom||4.1,controls.minDistance,controls.maxDistance));
  const startPos=camera.position.clone(),startTarget=controls.target.clone(),startUp=camera.up.clone();
  const start=performance.now(),dur=Math.max(120,+duration||850);
  controls.enabled=false;
  const ease=t=>1-Math.pow(1-t,3);
  function step(now){
    const t=clamp((now-start)/dur,0,1),e=ease(t);
    camera.position.lerpVectors(startPos,endPos,e);
    controls.target.lerpVectors(startTarget,endTarget,e);
    camera.up.lerpVectors(startUp,new THREE.Vector3(0,1,0),e).normalize();
    camera.lookAt(controls.target);
    scheduleStateEmit();
    if(t<1)requestAnimationFrame(step);
    else{
      controls.enabled=true;
      controls.update();
      scheduleDemRefresh(0);
    }
  }
  requestAnimationFrame(step);
}


function demTileX(lon,z){
  const n=2**z;
  return Math.floor(((lon+180)/360)*n);
}
function demTileY(lat,z){
  const n=2**z;
  const clamped=clamp(lat,-85.05112878,85.05112878)*DEG;
  return Math.floor((1-Math.asinh(Math.tan(clamped))/Math.PI)/2*n);
}
function tileLon(x,z){return x/(2**z)*360-180;}
function tileLat(y,z){
  const n=Math.PI-2*Math.PI*y/(2**z);
  return THREE.MathUtils.radToDeg(Math.atan(Math.sinh(n)));
}
function terrainColor(height){
  const col=new THREE.Color();
  if(height<0){
    const t=clamp((-height)/8000,0,1);
    col.setRGB(.04+.02*(1-t),.18+.22*(1-t),.34+.36*(1-t));
  }else if(height<800){
    const t=height/800;
    col.setRGB(.12+.18*t,.42-.05*t,.22-.04*t);
  }else if(height<2800){
    const t=(height-800)/2000;
    col.setRGB(.30+.25*t,.36-.13*t,.20-.05*t);
  }else{
    const t=clamp((height-2800)/5000,0,1);
    col.setRGB(.55+.40*t,.50+.45*t,.45+.50*t);
  }
  return col;
}
async function fetchDemTile(z,x,y){
  const n=2**z,xx=((x%n)+n)%n;
  if(y<0||y>=n)return null;
  const key=z+"/"+xx+"/"+y;
  if(demCache.has(key))return demCache.get(key);
  const promise=(async()=>{
    const res=await fetch(DEM_TERRARIUM_BASE+"/"+z+"/"+xx+"/"+y+".png",{mode:"cors",cache:"force-cache"});
    if(!res.ok)throw new Error("DEM HTTP "+res.status);
    const bmp=await createImageBitmap(await res.blob());
    const canvas=("OffscreenCanvas" in window)?new OffscreenCanvas(bmp.width,bmp.height):document.createElement("canvas");
    canvas.width=bmp.width;canvas.height=bmp.height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    ctx.drawImage(bmp,0,0);
    const img=ctx.getImageData(0,0,bmp.width,bmp.height);
    bmp.close?.();
    return {width:img.width,height:img.height,data:img.data};
  })();
  demCache.set(key,promise);
  if(demCache.size>36){
    const first=demCache.keys().next().value;
    if(first!==key)demCache.delete(first);
  }
  try{return await promise}catch(e){demCache.delete(key);throw e}
}
function demElevation(tile,u,v){
  const x=clamp(Math.round(u*(tile.width-1)),0,tile.width-1);
  const y=clamp(Math.round(v*(tile.height-1)),0,tile.height-1);
  const i=(y*tile.width+x)*4,d=tile.data;
  return d[i]*256+d[i+1]+d[i+2]/256-32768;
}
function disposeGroup(group){
  if(!group)return;
  while(group.children.length){
    const o=group.children.pop();
    o.geometry?.dispose();o.material?.dispose();
  }
}
async function buildDemMesh(z,x,y,token){
  const tile=await fetchDemTile(z,x,y);
  if(!tile||token!==demBuildToken)return null;
  const seg=32,verts=(seg+1)*(seg+1);
  const positions=new Float32Array(verts*3),colors=new Float32Array(verts*3);
  let p=0;
  for(let gy=0;gy<=seg;gy++){
    const v=gy/seg;
    const lat=tileLat(y+v,z);
    for(let gx=0;gx<=seg;gx++){
      const u=gx/seg,lon=tileLon(x+u,z);
      let h=demElevation(tile,u,v);
      if(!seabedEnabled&&h<0)h=0;
      const dh=(h/EARTH_RADIUS_METERS)*EARTH_RADIUS*terrainExaggeration;
      const r=EARTH_RADIUS+dh+.003;
      const pos=latLonToVector3(lat,lon,r);
      positions[p*3]=pos.x;positions[p*3+1]=pos.y;positions[p*3+2]=pos.z;
      const col=terrainColor(h);
      colors[p*3]=col.r;colors[p*3+1]=col.g;colors[p*3+2]=col.b;
      p++;
    }
  }
  const indices=[];
  for(let gy=0;gy<seg;gy++){
    for(let gx=0;gx<seg;gx++){
      const a=gy*(seg+1)+gx,b=a+1,c=a+(seg+1),d=c+1;
      indices.push(a,c,b,b,c,d);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.BufferAttribute(positions,3));
  g.setAttribute("color",new THREE.BufferAttribute(colors,3));
  g.setIndex(indices);g.computeVertexNormals();
  const m=new THREE.MeshPhongMaterial({
    vertexColors:true,transparent:true,opacity:.78,shininess:4,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1
  });
  const mesh=new THREE.Mesh(g,m);
  mesh.userData={z,x,y,source:"Mapzen/Tilezen Terrarium"};
  return mesh;
}
function screenCenterLatLon(){
  if(!camera)return null;
  const dir=new THREE.Vector3();camera.getWorldDirection(dir).normalize();
  const o=camera.position.clone();
  const b=2*o.dot(dir),cc=o.lengthSq()-EARTH_RADIUS*EARTH_RADIUS;
  const disc=b*b-4*cc;
  if(disc<0)return null;
  const root=Math.sqrt(disc),t1=(-b-root)/2,t2=(-b+root)/2;
  const t=t1>0?t1:(t2>0?t2:null);
  if(t==null)return null;
  return vectorToLatLon(o.addScaledVector(dir,t));
}
async function refreshDemLod(){
  if(!scene||!camera)return;
  if(!demEnabled){
    if(demGroup){disposeGroup(demGroup);demGroup.visible=false;}
    demLastKey="";return;
  }
  const distance=getOffset().length();
  if(distance>6.2){
    if(demGroup){disposeGroup(demGroup);demGroup.visible=false;}
    demLastKey="";return;
  }
  const focus=screenCenterLatLon();if(!focus)return;
  const z=distance<3.7?7:distance<4.35?6:distance<5.1?5:4;
  const cx=demTileX(focus.lon,z),cy=demTileY(focus.lat,z);
  const radius=z>=5?1:0;
  const key=[z,cx,cy,radius,terrainExaggeration,seabedEnabled].join(":");
  if(key===demLastKey&&demGroup?.visible)return;
  demLastKey=key;
  const token=++demBuildToken;
  if(!demGroup){demGroup=new THREE.Group();demGroup.renderOrder=3;scene.add(demGroup);}
  demGroup.visible=true;disposeGroup(demGroup);
  const tasks=[];
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)tasks.push(buildDemMesh(z,cx+dx,cy+dy,token));
  const meshes=await Promise.allSettled(tasks);
  if(token!==demBuildToken)return;
  for(const r of meshes)if(r.status==="fulfilled"&&r.value)demGroup.add(r.value);
}
function scheduleDemRefresh(delay=420){
  if(demRefreshTimer)clearTimeout(demRefreshTimer);
  demRefreshTimer=setTimeout(()=>{demRefreshTimer=null;refreshDemLod().catch(()=>{});},delay);
}
export function setDemEnabled(enabled){
  demEnabled=!!enabled;
  demLastKey="";
  scheduleDemRefresh(0);
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
  renderer.domElement.style.touchAction="none";
  host.appendChild(renderer.domElement);

  controls=new TrackballControls(camera,renderer.domElement);
  controls.target.set(0,0,0);
  controls.rotateSpeed=2.2;
  controls.zoomSpeed=1.15;
  controls.panSpeed=.75;
  controls.noRotate=false;
  controls.noZoom=false;
  controls.noPan=false;
  controls.staticMoving=false;
  controls.dynamicDampingFactor=.16;
  controls.minDistance=3.15;
  controls.maxDistance=14;
  controls.addEventListener("change",()=>{
    scheduleStateEmit();
    scheduleDemRefresh();
  });

  scene.add(new THREE.HemisphereLight(0xbfdcff,0x07111d,1.45));
  sun=new THREE.DirectionalLight(0xffffff,2.1);scene.add(sun);
  rim=new THREE.DirectionalLight(0x4f8cff,.7);scene.add(rim);
  updateSun();

  const material=new THREE.MeshPhongMaterial({
    color:0x17476d,emissive:0x020b15,shininess:8
  });
  earth=new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS,128,96),material);
  scene.add(earth);
  loadEarthTextures(material);
  applyTerrainSettings();
  ensureCountryOverlay();

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
  capitalGroup=new THREE.Group();capitalGroup.renderOrder=6;scene.add(capitalGroup);
  countryReliefGroup=new THREE.Group();countryReliefGroup.renderOrder=4;scene.add(countryReliefGroup);
  demGroup=new THREE.Group();demGroup.renderOrder=3;scene.add(demGroup);
  raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  addStars();

  tooltip=document.createElement("div");
  tooltip.style.cssText="display:none;position:absolute;z-index:4;pointer-events:none;max-width:220px;background:rgba(5,12,24,.95);border:1px solid #36506e;border-radius:9px;padding:7px 9px;font:12px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans JP',sans-serif;color:#e8eef7;box-shadow:0 8px 24px rgba(0,0,0,.35)";
  host.appendChild(tooltip);

  renderer.domElement.addEventListener("pointermove",e=>showTooltip(e,hit(e)));
  renderer.domElement.addEventListener("pointerleave",()=>showTooltip(null,null));
  renderer.domElement.addEventListener("click",e=>{
    const o=hit(e);
    if(!o)return;
    if(o.userData?.kind==="capital"){
      flyToLatLon(o.userData.lat,o.userData.lon,{zoom:4.05,duration:700});
      return;
    }
    if(onSelect&&o.userData?.iso3)onSelect(o.userData.iso3);
  });

  const resize=()=>{
    const w=Math.max(280,host.clientWidth),h=Math.max(360,host.clientHeight||480);
    renderer.setSize(w,h,false);
    controls.handleResize?.();
    fitGlobeToViewport({preserveDirection:true});
  };
  resizeObserver?.disconnect();
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();

  const clock=new THREE.Clock();
  function animate(){
    animationId=requestAnimationFrame(animate);
    clock.getDelta();
    controls.update();
    renderer.render(scene,camera);
  }
  animate();
}
function markerColor(t){
  const c=new THREE.Color();
  c.setHSL(.62*(1-t),.78,.56);
  return c;
}
function loadCountryGeoJson(){
  if(!countryGeoJsonPromise){
    countryGeoJsonPromise=fetch(COUNTRY_GEOJSON_URL,{mode:"cors",cache:"force-cache"})
      .then(r=>{if(!r.ok)throw new Error("country GeoJSON HTTP "+r.status);return r.json();})
      .catch(e=>{countryGeoJsonPromise=null;throw e;});
  }
  return countryGeoJsonPromise;
}
function countryIso3(feature){
  const p=feature?.properties||{};
  const candidates=[p.ISO_A3,p.ADM0_A3,p.SOV_A3,p.BRK_A3,p.GU_A3,p.iso_a3];
  return candidates.find(x=>x&&x!=="-99")||null;
}
function ensureCountryOverlay(){
  if(countryOverlay)return;
  const material=new THREE.MeshBasicMaterial({
    transparent:true,opacity:1,depthWrite:false,depthTest:true,
    side:THREE.FrontSide,toneMapped:false
  });
  countryOverlay=new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS+.012,128,96),material);
  countryOverlay.renderOrder=2;
  scene.add(countryOverlay);
}
function rgbaFromColor(col,a=.62){
  return "rgba("+Math.round(col.r*255)+","+Math.round(col.g*255)+","+Math.round(col.b*255)+","+a+")";
}
function projectRing(ring,w,h){
  const pts=[];
  let prev=null;
  for(const coord of ring||[]){
    let lon=+coord[0],lat=+coord[1];
    if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
    let x=(lon+180)/360*w;
    const y=(90-lat)/180*h;
    if(prev!=null){
      while(x-prev>w/2)x-=w;
      while(x-prev<-w/2)x+=w;
    }
    pts.push([x,y]);prev=x;
  }
  return pts;
}
function traceRing(ctx,pts,shift){
  if(!pts.length)return;
  ctx.moveTo(pts[0][0]+shift,pts[0][1]);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0]+shift,pts[i][1]);
  ctx.closePath();
}
function drawCountryGeometry(ctx,geometry,fillStyle,w,h){
  if(!geometry)return;
  const polys=geometry.type==="Polygon"?[geometry.coordinates]:
    geometry.type==="MultiPolygon"?geometry.coordinates:[];
  for(const poly of polys){
    const rings=(poly||[]).map(r=>projectRing(r,w,h)).filter(r=>r.length>=3);
    if(!rings.length)continue;
    for(const shift of [-w,0,w]){
      ctx.beginPath();
      for(const ring of rings)traceRing(ctx,ring,shift);
      ctx.fillStyle=fillStyle;
      ctx.fill("evenodd");
      ctx.strokeStyle="rgba(151,198,232,.78)";
      ctx.lineWidth=1.05;
      for(const ring of rings){
        ctx.beginPath();traceRing(ctx,ring,shift);ctx.stroke();
      }
    }
  }
}
async function updateCountryOverlay(countries,metric,enabled){
  ensureCountryOverlay();
  countryOverlay.visible=!!enabled;
  if(!enabled)return;
  const token=++countryOverlayToken;
  const geo=await loadCountryGeoJson();
  if(token!==countryOverlayToken)return;

  const width=1536,height=768;
  const canvas=document.createElement("canvas");
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,width,height);

  const valueByIso=new Map();
  const vals=[];
  for(const c of countries||[]){
    const v=c.latest?.[metric]?.value;
    if(v==null||!Number.isFinite(+v))continue;
    valueByIso.set(c.iso3,+v);vals.push(+v);
  }
  vals.sort((a,b)=>a-b);
  const lo=vals[Math.floor(Math.max(0,vals.length-1)*.05)]??0;
  const hi=vals[Math.floor(Math.max(0,vals.length-1)*.95)]??1;
  const span=(hi-lo)||1;

  for(const feature of geo.features||[]){
    const iso=countryIso3(feature);
    const value=iso?valueByIso.get(iso):null;
    const has=Number.isFinite(value);
    const t=has?clamp((value-lo)/span,0,1):0;
    const col=has?markerColor(t):new THREE.Color(0x496077);
    drawCountryGeometry(ctx,feature.geometry,rgbaFromColor(col,has ? .64 : .14),width,height);
  }

  if(token!==countryOverlayToken)return;
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate=true;
  const old=countryOverlay.material.map;
  countryOverlay.material.map=texture;
  countryOverlay.material.needsUpdate=true;
  old?.dispose?.();
}


function unwrapGeoRing(ring,anchor=null){
  const pts=[];let prev=anchor;
  for(const coord of ring||[]){
    let lon=+coord[0],lat=+coord[1];
    if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
    if(prev!=null){
      while(lon-prev>180)lon-=360;
      while(lon-prev<-180)lon+=360;
    }
    pts.push(new THREE.Vector2(lon,lat));prev=lon;
  }
  if(pts.length>1&&pts[0].distanceToSquared(pts[pts.length-1])<1e-12)pts.pop();
  return pts;
}
function pushVertex(arr,colArr,v,col){
  arr.push(v.x,v.y,v.z);colArr.push(col.r,col.g,col.b);
}
function buildRaisedCountryMesh(feature,valueT,height,iso){
  const geometry=feature?.geometry;if(!geometry)return null;
  const polygons=geometry.type==="Polygon"?[geometry.coordinates]:
    geometry.type==="MultiPolygon"?geometry.coordinates:[];
  if(!polygons.length)return null;

  const positions=[],colors=[];
  const topColor=markerColor(valueT);
  const sideColor=topColor.clone().multiplyScalar(.52);
  const baseR=EARTH_RADIUS+terrainMaxOutward()+.014;
  const topR=baseR+height;

  for(const poly of polygons){
    if(!poly?.length)continue;
    const outer=unwrapGeoRing(poly[0]);
    if(outer.length<3)continue;
    const anchor=outer[0].x;
    const holes=(poly.slice(1)||[]).map(r=>unwrapGeoRing(r,anchor)).filter(r=>r.length>=3);
    let tris=[];
    try{tris=THREE.ShapeUtils.triangulateShape(outer,holes)}catch{tris=[]}
    const allPoints=[...outer,...holes.flat()];
    for(const tri of tris){
      for(const idx of tri){
        const p=allPoints[idx];
        if(!p)continue;
        const v=latLonToVector3(p.y,p.x,topR);
        pushVertex(positions,colors,v,topColor);
      }
    }
    for(let i=0;i<outer.length;i++){
      const a=outer[i],b=outer[(i+1)%outer.length];
      const a0=latLonToVector3(a.y,a.x,baseR),b0=latLonToVector3(b.y,b.x,baseR);
      const a1=latLonToVector3(a.y,a.x,topR),b1=latLonToVector3(b.y,b.x,topR);
      pushVertex(positions,colors,a0,sideColor);pushVertex(positions,colors,b0,sideColor);pushVertex(positions,colors,b1,sideColor);
      pushVertex(positions,colors,a0,sideColor);pushVertex(positions,colors,b1,sideColor);pushVertex(positions,colors,a1,sideColor);
    }
  }
  if(!positions.length)return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  g.computeVertexNormals();
  const m=new THREE.MeshPhongMaterial({
    vertexColors:true,transparent:true,opacity:.88,shininess:10,
    side:THREE.DoubleSide,depthWrite:true
  });
  const mesh=new THREE.Mesh(g,m);
  mesh.userData={iso3:iso,kind:"country-relief"};
  return mesh;
}
function clearCountryRelief(){
  if(!countryReliefGroup)return;
  while(countryReliefGroup.children.length){
    const o=countryReliefGroup.children.pop();
    o.geometry?.dispose();o.material?.dispose();
  }
}
async function updateCountryRelief(countries,metric,enabled,heightScale=55){
  if(!countryReliefGroup)return;
  countryReliefGroup.visible=!!enabled;
  if(!enabled){clearCountryRelief();return;}
  const token=++countryReliefToken;
  const geo=await loadCountryGeoJson();
  if(token!==countryReliefToken)return;
  clearCountryRelief();

  const valueByIso=new Map(),vals=[];
  for(const c of countries||[]){
    const v=c.latest?.[metric]?.value;
    if(v==null||!Number.isFinite(+v))continue;
    valueByIso.set(c.iso3,+v);vals.push(+v);
  }
  vals.sort((a,b)=>a-b);
  const lo=vals[Math.floor(Math.max(0,vals.length-1)*.05)]??0;
  const hi=vals[Math.floor(Math.max(0,vals.length-1)*.95)]??1;
  const span=(hi-lo)||1;
  const maxHeight=.0035*clamp(+heightScale||55,0,100);

  for(const feature of geo.features||[]){
    if(token!==countryReliefToken)return;
    const iso=countryIso3(feature),value=iso?valueByIso.get(iso):null;
    if(!Number.isFinite(value))continue;
    const t=clamp((value-lo)/span,0,1);
    const height=.004+maxHeight*t;
    const mesh=buildRaisedCountryMesh(feature,t,height,iso);
    if(mesh)countryReliefGroup.add(mesh);
  }
}

function clearGroup(group){
  if(!group)return;
  while(group.children.length){
    const o=group.children.pop();
    o.geometry?.dispose();o.material?.dispose();
  }
}
function updateCapitalMarkers(countries){
  if(!capitalGroup)return;
  clearGroup(capitalGroup);
  capitalGroup.visible=true;
  const r=markerRadius()+.012;
  for(const c of countries||[]){
    const lat=+c.lat,lon=+c.lon;
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||!c.capital)continue;
    const marker=new THREE.Mesh(
      new THREE.SphereGeometry(.018,10,8),
      new THREE.MeshPhongMaterial({
        color:0xf5fbff,emissive:0x66cfff,emissiveIntensity:.65,
        shininess:30,depthTest:true,depthWrite:false
      })
    );
    marker.position.copy(latLonToVector3(lat,lon,r));
    marker.userData={
      kind:"capital",iso3:c.iso3,name:c.displayName||c.name,
      capital:c.capital,lat,lon
    };
    capitalGroup.add(marker);
  }
}

export function updateGlobe({element,countries,metric,metricLabel,unit,language="ja",terrainScale=terrainExaggeration,seabed=seabedEnabled,dem=demEnabled,countryFill=true,markers=false,countryRelief=true,countryReliefScale=55,onCountrySelect}){
  initGlobe(element);
  onSelect=onCountrySelect||null;
  currentLanguage=language==="en"?"en":"ja";
  terrainExaggeration=clamp(+terrainScale||30,1,100);
  seabedEnabled=!!seabed;
  demEnabled=!!dem;
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
  const loc=currentLanguage==="en"?"en-US":"ja-JP";

  markerGroup.visible=!!markers;
  if(markers){
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
        valueText:Number(n).toLocaleString(loc,{maximumFractionDigits:3})+
          (unit==="percent"?"%":unit?(" "+unit):""),
        year:v.year||"—"
      };
      markerGroup.add(marker);
    }
  }
  updateCapitalMarkers(countries);
  updateCountryOverlay(countries,metric,!!countryFill).catch(()=>{if(countryOverlay)countryOverlay.visible=false;});
  updateCountryRelief(countries,metric,!!countryRelief,countryReliefScale).catch(()=>{if(countryReliefGroup)countryReliefGroup.visible=false;});
  if(!initialViewApplied){
    initialViewApplied=true;
    requestAnimationFrame(()=>centerGlobe());
  }
  scheduleStateEmit();
  scheduleDemRefresh(0);
}
window.KamokuGlobe={
  init:initGlobe,update:updateGlobe,setTerrain,setDem:setDemEnabled,center:centerGlobe,flyTo:flyToLatLon,
  getState:getViewState,setState:setViewState,nudge:nudgeView,subscribe:subscribeViewState
};
window.dispatchEvent(new Event("kamoku-globe-ready"));