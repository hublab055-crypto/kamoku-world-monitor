/*
 * FRONTIER 3D AVATAR BRIDGE v1
 * Optional live 3D scene linked to the existing 2D game state.
 * Original game and save system remain authoritative.
 * Copyright: original implementation for Frontier World.
 */
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';

(function(){
'use strict';
if(window.__fwAvatar3DInstalled)return;
window.__fwAvatar3DInstalled=true;
const bridge=window.__fwFrontierBridge;
const stage=document.querySelector('#app .stage');
if(!bridge||!stage){console.warn('[FW3D] Frontier bridge/stage not found');return;}
const gameCanvas=document.getElementById('world');
const joy=document.getElementById('joy');
const hud=document.getElementById('coord');
const $=s=>document.querySelector(s);
const saveKey='fw3d-v1-settings';
let config={};
try{config=JSON.parse(localStorage.getItem(saveKey)||'{}')||{};}catch(_){}
const persist=()=>{try{localStorage.setItem(saveKey,JSON.stringify({cameraMode:cameraMode}));}catch(_){}};

const style=document.createElement('style');
style.textContent=[
'.fw3d-toggle{position:absolute;left:9px;top:9px;z-index:21;background:#153d35e8;border:1px solid #96bba7;color:#fff;font-weight:700;border-radius:10px;padding:9px 13px;font-size:13px;cursor:pointer}',
'.fw3d-toggle[aria-pressed=true]{background:#547764}',
'.fw3d-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:5;display:none;touch-action:none}',
'.fw3d-tools{position:absolute;z-index:22;left:7px;right:7px;bottom:7px;display:none;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;pointer-events:none}',
'.fw3d-tools button,.fw3d-tools label{pointer-events:auto;background:#172e2ce8;color:#f2f7ee;border:1px solid #688b82;border-radius:9px;padding:7px 10px;min-height:35px;font-size:12px;font-weight:650;cursor:pointer}',
'.fw3d-tools .on{background:#62836c;color:white}',
'.fw3d-tools input{display:none}',
'.fw3d-info{position:absolute;z-index:19;right:8px;top:8px;display:none;max-width:min(54%,250px);background:#112321d9;color:white;border-radius:9px;padding:8px 10px;font-size:11px;line-height:1.5;pointer-events:none}',
'.fw3d-selected{color:#baf6c7;font-weight:bold}',
'.fw3d-hidden{display:none!important}'
].join('\n');
document.head.append(style);

const toggle=document.createElement('button');
toggle.type='button';toggle.className='fw3d-toggle';toggle.textContent='🌐 3D視点';toggle.setAttribute('aria-pressed','false');
stage.append(toggle);
const tools=document.createElement('div');
tools.className='fw3d-tools';
tools.innerHTML='<button data-do="follow" title="操作中アバターを追従">追従</button><button data-do="rts" title="上空から複数人へ指示">⚓ 上空RTS</button><button data-do="free" title="自由視点">自由視点</button><button data-do="multi" title="タップで複数選択">複数選択</button><button data-do="appearance" title="選択したアバターの男性・女性モデルを切替">♂/♀ 外見</button><button data-do="auto" title="元のNPC自動行動に戻す">🤖 自動</button><button data-do="stop" title="選択NPCの移動を止める">停止</button><label title="前回作成した男女GLBまたはZIPを読み込む">📦 GLB読込<input type="file" id="fw3d-file" accept=".glb,.zip,model/gltf-binary" multiple></label>';
stage.append(tools);
const info=document.createElement('div');info.className='fw3d-info';stage.append(info);
function say(t){try{bridge.message('🌐 '+t);}catch(_){console.log('[FW3D]',t);}}

let enabled=false,renderer=null,scene=null,camera=null,orbit=null,clock=null,ground=null;
let raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),actors=new Map(),terrainNodes=new Map();
let loader=new GLTFLoader(), prototypes=new Map(), models=new Map(), selected=new Set(), orders=new Map();
let originalNpcUpdate=null, cameraMode=['follow','rts','free'].includes(config.cameraMode)?config.cameraMode:'rts';
let multiSelect=false, refreshing=false, lastTerrain=0,lastFrame=0, prevJoyDisplay='',prevHudDisplay='';
const up=new THREE.Vector3(0,1,0);
const pos3=(x,y)=>new THREE.Vector3(Number(x)||0,0,Number(y)||0);
const canonical=id=>String(id===undefined?'':id);
function actorsInWorld(){
 const s=bridge.state;
 return [s.player,...(s.npcs||[]).filter(n=>n && Number.isFinite(n.x) && Number.isFinite(n.y))]
   .filter(Boolean).filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y));
}
function sexOf(p){
 const value=String(p.sex||p.gender||p.genderIdentity||'').toLowerCase();
 if(['female','woman','女','f'].includes(value))return 'female';
 if(['male','man','男','m'].includes(value))return 'male';
 return /mio|女性|娘|妻/i.test(String(p.id||'')+' '+String(p.name||''))?'female':'male';
}
function markerMaterial(hex){return new THREE.MeshStandardMaterial({color:hex,roughness:.93});}
const cloth=markerMaterial('#648c8b'),skin=markerMaterial('#d9a686'),hair=markerMaterial('#45322c'),skinF=markerMaterial('#dfb49a');
function placeholder(sex){
 const g=new THREE.Group(),female=sex==='female';
 function piece(parent,geom,mat,x,y,z){const m=new THREE.Mesh(geom,mat);m.position.set(x,y,z);parent.add(m);return m;}
 const sm=female?skinF:skin,upper=female?markerMaterial('#ad725d'):cloth;
 const hips=piece(g,new THREE.SphereGeometry(female?.205:.215,10,7),upper,0,.93,0);
 const body=piece(g,new THREE.CapsuleGeometry(female?.235:.26,.43,3,10),upper,0,1.28,0);
 piece(g,new THREE.SphereGeometry(.135,10,8),sm,0,1.59,.025);
 piece(g,new THREE.SphereGeometry(.152,12,9),sm,0,1.76,.035);
 piece(g,new THREE.SphereGeometry(.165,10,8,female?0:0,Math.PI*2,0,Math.PI*.49),hair,0,1.82,.028);
 for(let x of [-1,1]){
   piece(g,new THREE.SphereGeometry(.014,7,5),markerMaterial('#2d2b2b'),x*.06,1.77,.17);
   const arm=new THREE.Group();arm.position.set(x*.255,1.48,0);g.add(arm);
   piece(arm,new THREE.CapsuleGeometry(.073,.41,3,8),upper,x*.025,-.25,0);
   piece(arm,new THREE.SphereGeometry(.08,8,6),sm,x*.04,-.56,.025);
   const leg=new THREE.Group();leg.position.set(x*.112,.88,0);g.add(leg);
   piece(leg,new THREE.CapsuleGeometry(.095,.51,3,8),markerMaterial('#525b60'),0,-.34,0);
   piece(leg,new THREE.BoxGeometry(.21,.13,.34),markerMaterial('#493c32'),0,-.79,.095);
   g.userData[(x===-1?'left':'right')+'Arm']=arm;
   g.userData[(x===-1?'left':'right')+'Leg']=leg;
 }
 g.userData.placeholder=true;g.name='temporary_'+sex;return {scene:g,animations:[]};
}
async function db(){
 return new Promise((resolve,reject)=>{
   const r=indexedDB.open('frontier-3d-avatar-cache',1);
   r.onupgradeneeded=()=>r.result.createObjectStore('models');
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
 });
}
async function dbGet(key){
 try{const d=await db();return await new Promise((res,rej)=>{const tx=d.transaction('models','readonly');const r=tx.objectStore('models').get(key);r.onsuccess=()=>{res(r.result||null);d.close()};r.onerror=()=>{rej(r.error);d.close()};});}catch(_){return null;}
}
async function dbPut(key,bytes){
 try{const d=await db();await new Promise((res,rej)=>{const tx=d.transaction('models','readwrite');tx.objectStore('models').put(bytes,key);tx.oncomplete=res;tx.onerror=rej;});d.close();}catch(e){console.warn('[FW3D] Cache not saved',e);}
}
function parseGLB(bytes){return loader.parseAsync(bytes,'');}
async function ensureModel(sex){
 if(models.has(sex))return models.get(sex);
 let gltf=null;
 try{
   const saved=await dbGet(sex);
   if(saved)gltf=await parseGLB(saved);
   else gltf=await loader.loadAsync('./assets/avatars/frontier_'+sex+'_mobile.glb');
 }catch(e){console.info('[FW3D] Using temporary procedural avatar until GLB imported:',sex);}
 if(!gltf)gltf=placeholder(sex);
 models.set(sex,gltf);return gltf;
}
async function loadDefaults(){
 await Promise.all(['male','female'].map(ensureModel));
 if(enabled)refreshActors(true);
 updateInfo();
}
function makeActor(p){
 const sex=sexOf(p),gltf=models.get(sex)||placeholder(sex);
 const group=cloneSkinned(gltf.scene);
 group.name='fw3d_'+canonical(p.id);
 const m={id:canonical(p.id),actor:p,root:group,sex,mixer:null,clips:gltf.animations||[],action:null,lastPos:pos3(p.x,p.y),selectedRing:null,prevMotion:''};
 if(gltf.animations&&gltf.animations.length)m.mixer=new THREE.AnimationMixer(group);
 group.position.copy(m.lastPos);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.42,.49,40),new THREE.MeshBasicMaterial({color:'#a0ffad',side:THREE.DoubleSide,transparent:true,opacity:.90}));
 ring.rotation.x=-Math.PI/2;ring.position.y=.024;ring.visible=false;group.add(ring);m.selectedRing=ring;
 scene.add(group);actors.set(m.id,m);return m;
}
function clearActors(){
 for(const a of actors.values()){a.mixer?.stopAllAction();scene?.remove(a.root);}
 actors.clear();
}
function refreshActors(force=false){
 if(!scene)return;
 if(force)clearActors();
 const all=actorsInWorld(),ids=new Set();
 for(const p of all){
   const id=canonical(p.id);ids.add(id);
   const a=actors.get(id);
   if(!a || a.sex!==sexOf(p)){if(a){scene.remove(a.root);actors.delete(id);}makeActor(p);}
   else a.actor=p;
 }
 for(const [id,a] of actors){if(!ids.has(id)){scene.remove(a.root);actors.delete(id);orders.delete(id);selected.delete(id);}}
 updateInfo();
}
function setMotion(a,name){
 if(a.prevMotion===name)return;
 a.prevMotion=name;
 if(!a.mixer)return;
 const clip=THREE.AnimationClip.findByName(a.clips,name)||THREE.AnimationClip.findByName(a.clips,'Idle');
 if(!clip)return;
 const next=a.mixer.clipAction(clip);
 if(a.action&&a.action!==next){next.reset().fadeIn(.2).play();a.action.fadeOut(.2);}
 else if(!a.action){next.play();}
 a.action=next;
}
function animateActor(a,dt){
 const p=a.actor,next=pos3(p.x,p.y),speed=a.lastPos.distanceTo(next)/Math.max(.02,dt);
 const status=String(p.status||'');
 const motion=speed>.11?'Walk':/睡眠|休息|着席|座/.test(status)?'Sit':/木材|伐採|採集.*木/.test(status)?'Chop':/会話|話す/.test(status)?'Talk':'Idle';
 setMotion(a,motion);
 if(a.root.userData.placeholder){
   const wave=performance.now()*.006,bob=motion==='Walk'?Math.sin(wave*2)*.035:0;
   a.root.userData.leftLeg&&(a.root.userData.leftLeg.rotation.x=motion==='Walk'?Math.sin(wave)*.46:0);
   a.root.userData.rightLeg&&(a.root.userData.rightLeg.rotation.x=motion==='Walk'?-Math.sin(wave)*.46:0);
   a.root.userData.leftArm&&(a.root.userData.leftArm.rotation.x=motion==='Walk'?-Math.sin(wave)*.35:0);
   a.root.userData.rightArm&&(a.root.userData.rightArm.rotation.x=motion==='Walk'?Math.sin(wave)*.35:0);
   a.root.userData.bodyBob=bob;
 }
 a.root.position.set(next.x,a.root.userData.placeholder?(a.root.userData.bodyBob||0):0,next.z);
 a.root.rotation.y=({front:0,back:Math.PI,left:-Math.PI/2,right:Math.PI/2})[p.dir]??0;
 a.selectedRing.visible=selected.has(a.id);
 a.lastPos.copy(next);a.mixer?.update(dt);
}
function makeScene(){
 scene=new THREE.Scene();scene.background=new THREE.Color('#8fa9bb');scene.fog=new THREE.Fog('#8fa9bb',45,95);
 const s=stage.getBoundingClientRect();
 camera=new THREE.PerspectiveCamera(53,Math.max(1,s.width)/Math.max(1,s.height),.05,240);
 camera.position.set(bridge.state.player.x+12,15,bridge.state.player.y+16);
 renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
 renderer.domElement.className='fw3d-canvas';stage.append(renderer.domElement);
 renderer.setSize(Math.max(1,s.width),Math.max(1,s.height),false);
 orbit=new OrbitControls(camera,renderer.domElement);
 orbit.enableDamping=true;orbit.minDistance=3;orbit.maxDistance=54;orbit.maxPolarAngle=Math.PI*.49;
 orbit.target.set(bridge.state.player.x,1,bridge.state.player.y);orbit.update();
 scene.add(new THREE.HemisphereLight('#f1f6f5','#506453',2.1));
 const sun=new THREE.DirectionalLight('#ffefca',2.6);sun.position.set(20,45,-28);scene.add(sun);
 ground=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.MeshStandardMaterial({color:'#6c9375',roughness:1}));
 ground.rotation.x=-Math.PI/2;ground.position.y=-.075;scene.add(ground);
 const grid=new THREE.GridHelper(120,120,0x6c8771,0x85a58c);
 grid.position.y=-.068;grid.material.transparent=true;grid.material.opacity=.30;scene.add(grid);
 scene.userData.grid=grid;
 renderer.domElement.addEventListener('pointerdown',onDown);
 renderer.domElement.addEventListener('pointerup',onUp);
 window.addEventListener('resize',onResize);
 clock=new THREE.Clock();
 requestAnimationFrame(frame);
}
function onResize(){
 if(!renderer||!camera)return;
 const r=stage.getBoundingClientRect();if(r.width<1||r.height<1)return;
 camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);
}
let down=null;
function onDown(e){down={x:e.clientX,y:e.clientY,shift:e.shiftKey,t:performance.now()};}
function onUp(e){
 if(!enabled||!down)return;
 const old=down;down=null;
 if(Math.hypot(e.clientX-old.x,e.clientY-old.y)>9)return;
 const rect=renderer.domElement.getBoundingClientRect();
 pointer.set(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
 let picked=null,best=34;
 for(const a of actors.values()){
   const v=a.root.position.clone().add(new THREE.Vector3(0,1.02,0)).project(camera);
   if(v.z<-1||v.z>1)continue;
   const px=(v.x+1)*rect.width/2,py=(1-v.y)*rect.height/2;
   const d=Math.hypot(px-(e.clientX-rect.left),py-(e.clientY-rect.top));
   if(d<best){best=d;picked=a;}
 }
 if(picked){
   if(!multiSelect&&!old.shift)selected.clear();
   if(selected.has(picked.id)&&(multiSelect||old.shift))selected.delete(picked.id);else selected.add(picked.id);
   updateInfo();return;
 }
 raycaster.setFromCamera(pointer,camera);
 const hit=new THREE.Vector3();
 if(!raycaster.ray.intersectPlane(new THREE.Plane(up,0),hit))return;
 if(!selected.size)selected.add(canonical(bridge.state.player.id));
 issueMove(hit.x,hit.z);
}
function canMove(x,y){
 if(!(x>=0&&y>=0&&x<90&&y<90))return false;
 if(typeof bridge.canMove3D==='function')return bridge.canMove3D(x,y);
 return true;
}
function issueMove(x,y){
 let n=0;
 for(const id of selected){
   const a=actors.get(id);if(!a)continue;
   const sx=x+(n%3-1)*1.05,sy=y+(Math.floor(n/3)-.5)*1.05;n++;
   const tx=Math.max(.2,Math.min(89.5,sx)),ty=Math.max(.2,Math.min(89.5,sy));
   if(id===canonical(bridge.state.player.id)){
     if(typeof bridge.setPlayerMove3D==='function')bridge.setPlayerMove3D(tx,ty);
   }else orders.set(id,{x:tx,y:ty,halt:false});
 }
 say(selected.size+'人に移動指示');
 updateInfo();
}
function autoResume(){
 if(!selected.size)selected=new Set(actors.keys());
 for(const id of selected)orders.delete(id);
 say('選択キャラクターのNPC自動行動を再開しました');
 updateInfo();
}
function stopSelected(){
 for(const id of selected){if(id!==canonical(bridge.state.player.id))orders.set(id,{halt:true});}
 say('選択したNPCを停止しました');
 updateInfo();
}
function hookNpc(){
 if(originalNpcUpdate || typeof bridge.updateNPC!=='function')return;
 originalNpcUpdate=bridge.updateNPC;
 bridge.updateNPC=function(n,dt){
   if(!enabled)return originalNpcUpdate.apply(this,arguments);
   const cmd=orders.get(canonical(n&&n.id));
   if(!cmd)return originalNpcUpdate.apply(this,arguments);
   if(cmd.halt){n.status='✋ 待機指示';return;}
   const dx=cmd.x-n.x,dy=cmd.y-n.y,d=Math.hypot(dx,dy);
   if(d<.19){orders.delete(canonical(n.id));n.tx=n.x;n.ty=n.y;n.status='✅ 指示完了';return;}
   const speed=Math.max(.25,Math.min(1.8,Number(n.walkSpeed)||1.15));
   const step=Math.min(d,speed*Math.max(0,dt)),nx=n.x+dx/d*step,ny=n.y+dy/d*step;
   if(canMove(nx,ny)){n.x=nx;n.y=ny;n.tx=cmd.x;n.ty=cmd.y;n.dir=Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'back':'front');n.status='⚓ 移動指示';}
   else{n.status='🚧 障害物';orders.delete(canonical(n.id));}
 };
}
function makeTree(){
 const group=new THREE.Group();
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.13,.19,1.25,7),markerMaterial('#776046'));trunk.position.y=.63;group.add(trunk);
 const leaves=new THREE.Mesh(new THREE.ConeGeometry(.8,2.4,8),markerMaterial('#315e43'));leaves.position.y=2.2;group.add(leaves);
 return group;
}
function makeRock(){const g=new THREE.Group(),m=new THREE.Mesh(new THREE.DodecahedronGeometry(.48,0),markerMaterial('#8e9593'));m.position.y=.3;m.scale.set(1,.62,.82);g.add(m);return g;}
function makeTent(){
 const g=new THREE.Group(),tent=new THREE.Mesh(new THREE.ConeGeometry(1.4,1.9,4),markerMaterial('#a79875'));
 tent.rotation.y=Math.PI/4;tent.position.y=.96;g.add(tent);return g;
}
function makeHouse(){
 const g=new THREE.Group();
 const wall=new THREE.Mesh(new THREE.BoxGeometry(2.45,1.75,2.45),markerMaterial('#b8a080'));
 wall.position.y=.9;g.add(wall);
 const roof=new THREE.Mesh(new THREE.ConeGeometry(2.12,1.2,4),markerMaterial('#70524a'));
 roof.rotation.y=Math.PI/4;roof.position.y=2.34;g.add(roof);return g;
}
function makeObject(o){
 if(o.type==='tree'||o.type==='tree2')return makeTree();
 if(o.type==='rock'||o.type==='stone')return makeRock();
 const g=new THREE.Group();
 if(o.type==='campfire'){
   const flame=new THREE.Mesh(new THREE.ConeGeometry(.36,.74,7),markerMaterial('#e69d43'));flame.position.y=.4;g.add(flame);return g;
 }
 const mat=o.gather==='water'?markerMaterial('#65abc3'):o.gather==='food'?markerMaterial('#679f4b'):markerMaterial('#7b9870');
 const m=new THREE.Mesh(new THREE.SphereGeometry(o.gather==='food'?.22:.18,8,6),mat);
 m.position.y=.18;g.add(m);return g;
}
function updateTerrain(force=false){
 if(!enabled||!scene)return;
 const s=bridge.state,p=s.player,objects=[...(s.objects||[]),...(s.buildings||[]).map(b=>({...b,__building:true}))];
 const wanted=new Set();
 for(const o of objects){
   if(Math.abs(o.x-p.x)>27||Math.abs(o.y-p.y)>27)continue;
   const id=(o.__building?'b':'o')+'|'+(o.id||o.type)+'|'+o.x+'|'+o.y;wanted.add(id);
   if(terrainNodes.has(id))continue;
   const g=o.__building?(o.type==='house'?makeHouse():makeTent()):makeObject(o);
   g.position.set(o.x,0,o.y);g.userData.fw3dTerrain=true;scene.add(g);terrainNodes.set(id,g);
 }
 for(const [id,node] of terrainNodes){if(!wanted.has(id)){scene.remove(node);terrainNodes.delete(id);}}
 ground.position.set(p.x,-.075,p.y);
 scene.userData.grid.position.set(p.x,-.068,p.y);
}
function updateInfo(){
 if(!info)return;
 let list=[...selected].map(id=>actors.get(id)?.actor?.name||id).filter(Boolean);
 const activeOrders=[...orders.values()].length;
 const official=[...models].filter(([_,m])=>!m.scene.userData.placeholder).length;
 info.innerHTML='<div class="fw3d-selected">選択: '+(list.length?list.join('・'):'なし')+'</div>操作: アバターをタップ → 地面をタップで移動<br>選択切替: 複数選択（PCはShift）<br>GLB: '+official+'/2種 · 個別指示: '+activeOrders+'件';
 for(const b of tools.querySelectorAll('button[data-do]')){
  const name=b.dataset.do;
  b.classList.toggle('on',name===cameraMode||name==='multi'&&multiSelect);
 }
}
function setCameraMode(name){
 cameraMode=name;persist();updateInfo();
 if(!orbit)return;
 const p=bridge.state.player;
 if(name==='rts'){camera.position.set(p.x+1,32,p.y+11);orbit.target.set(p.x,.2,p.y);orbit.update();}
 if(name==='follow'){camera.position.set(p.x+4,7,p.y+9);orbit.target.set(p.x,1,p.y);orbit.update();}
}
function frame(t){
 if(!renderer)return;
 requestAnimationFrame(frame);
 if(!enabled){clock?.getDelta();return;}
 const dt=Math.min(.09,clock.getDelta());
 if(t-lastFrame>1000){lastFrame=t;refreshActors();}
 for(const a of actors.values())animateActor(a,dt);
 if(t-lastTerrain>1300){lastTerrain=t;updateTerrain();}
 const p=bridge.state.player;
 if(cameraMode!=='free'){
   const target=pos3(p.x,p.y);target.y=cameraMode==='rts'?.2:1;
   const delta=target.sub(orbit.target);camera.position.add(delta);orbit.target.add(delta);
 }
 orbit.update();renderer.render(scene,camera);
}
function startScene(){
 try{makeScene();hookNpc();refreshActors();setCameraMode(cameraMode);loadDefaults();}
 catch(e){console.error('[FW3D] init failed',e);enabled=false;say('3D初期化に失敗: '+String(e.message||e));}
}
function toggleMode(){
 if(!renderer)startScene();
 if(!renderer)return;
 enabled=!enabled;
 renderer.domElement.style.display=enabled?'block':'none';
 tools.style.display=enabled?'flex':'none';info.style.display=enabled?'block':'none';
 toggle.textContent=enabled?'🌐 2Dに戻る':'🌐 3D視点';
 toggle.setAttribute('aria-pressed',String(enabled));
 if(enabled){
   prevJoyDisplay=joy?.style.display||'';prevHudDisplay=hud?.style.display||'';
   if(joy)joy.style.display='none';if(hud)hud.style.display='none';
   clock.getDelta();refreshActors();updateTerrain(true);onResize();
   say('3D視点を開始しました。上空RTSで複数の村人を選べます。');
 }else{
   if(joy)joy.style.display=prevJoyDisplay;if(hud)hud.style.display=prevHudDisplay;
   orders.clear();selected.clear();updateInfo();
   say('2D表示に戻りました（NPCの通常行動を再開）');
 }
}
toggle.addEventListener('click',toggleMode);
tools.addEventListener('click',e=>{
 const b=e.target.closest('button[data-do]');if(!b)return;e.stopPropagation();const name=b.dataset.do;
 if(['rts','follow','free'].includes(name))setCameraMode(name);
 if(name==='multi'){multiSelect=!multiSelect;updateInfo();}
 if(name==='appearance'){
  if(!selected.size)selected.add(canonical(bridge.state.player.id));
  for(const id of selected){
   const actor=actors.get(id)?.actor;
   if(actor)actor.sex=sexOf(actor)==='female'?'male':'female';
  }
  refreshActors(true);say('アバターモデルを切り替えました');
 }
 if(name==='auto')autoResume();
 if(name==='stop')stopSelected();
});
async function importGLBs(files){
 if(!files||!files.length)return;
 const imports=[];
 for(const f of Array.from(files)){
   if(/\.zip$/i.test(f.name)){
     if(!window.JSZip){say('ZIPの展開ライブラリを取得できません。GLBを個別に読み込んでください。');continue;}
     const zip=await window.JSZip.loadAsync(f);
     for(const name of Object.keys(zip.files)){
       if(/frontier_(male|female)_(mobile|rigged)\.glb$/i.test(name)&&!zip.files[name].dir)imports.push({name,bytes:await zip.files[name].async('arraybuffer')});
     }
   }else if(/\.glb$/i.test(f.name))imports.push({name:f.name,bytes:await f.arrayBuffer()});
 }
 let loaded=0;
 for(const sex of ['male','female']){
   const chosen=imports.find(x=>new RegExp('frontier_'+sex+'_mobile\\.glb$','i').test(x.name))||imports.find(x=>new RegExp('frontier_'+sex+'_rigged\\.glb$','i').test(x.name));
   if(!chosen)continue;
   try{const gltf=await parseGLB(chosen.bytes);models.set(sex,gltf);await dbPut(sex,chosen.bytes);loaded++;}catch(e){console.warn('[FW3D] model error',e);}
 }
 if(loaded){refreshActors(true);say('男女の3Dモデル '+loaded+'種を読み込みました。端末内に保存しました。');}
 else say('読み込み可能なGLBがありませんでした。ファイル名を確認してください。');
}
$('#fw3d-file').addEventListener('change',async e=>{
 try{await importGLBs(e.target.files);}catch(err){console.error(err);say('読込失敗: '+String(err.message||err));}
 e.target.value='';
});
window.FrontierAvatar3D={get enabled(){return enabled;},get selected(){return [...selected];},get orders(){return [...orders.entries()];},setCameraMode,toggleMode};
})();
