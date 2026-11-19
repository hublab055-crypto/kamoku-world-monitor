/**
 * Browser-only 3D wall presentation via perspective-transformed official iframe.
 * It overlays the viewport; video pixels are never read or uploaded to WebGL.
 * Immersive WebXR is deliberately excluded until the runtime supports an
 * equivalent permitted surface browser, not a DOM screenshot hack.
 */
import {
 WALL_SCREEN_STORAGE_KEY,nearestBuildingWall,resolveMountedWall,
 sanitizeMountedWall,projectedWallCorners,perspectiveCssMatrix
} from "./world-tablet-wall.mjs?v=20261119-wall-iframe";

const EMBED=id=>"https://www.youtube-nocookie.com/embed/"+id+"?playsinline=1";

export function installWorldTabletWallUI({
 wrap,shell,getRenderer=()=>null,getController=()=>null,getXRActive=()=>false,
 videoInput=()=>null,extractVideoId,notify=()=>{}
}={}){
 if(!wrap||!shell||typeof document==="undefined")return null;
 let placement=null;
 try{placement=sanitizeMountedWall(localStorage.getItem(WALL_SCREEN_STORAGE_KEY));}catch(_){}
 const root=document.createElement("section");
 root.className="ue-world-wall-screen";root.id="ue-world-wall-screen";
 root.hidden=true;root.setAttribute("aria-label","建物に設置したYouTubeスクリーン");
 const video=document.createElement("iframe");
 video.title="YouTube壁スクリーン・公式埋め込みプレーヤー";
 video.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
 video.setAttribute("allowfullscreen","");
 video.referrerPolicy="strict-origin-when-cross-origin";
 const detachControl=document.createElement("button");
 detachControl.type="button";detachControl.className="ue-world-wall-detach";
 detachControl.textContent="↩ 手持ちに戻す";
 root.append(video,detachControl);
 wrap.append(root);
 const pane=shell.querySelector('[data-pane="video"]');
 const tools=document.createElement("div");tools.className="ue-wall-placement-tools";
 const placeButton=document.createElement("button");placeButton.type="button";
 placeButton.textContent="📌 近くの壁に映す";
 const detachButton=document.createElement("button");detachButton.type="button";
 detachButton.textContent="↩ 壁スクリーン解除";
 const info=document.createElement("small");info.className="ue-wall-placement-state";
 info.setAttribute("role","status");
 info.textContent="建設した壁や建物の近くで「近くの壁に映す」を選択します。";
 tools.append(placeButton,detachButton,info);
 pane?.insertBefore(tools,pane.querySelector(".ue-tablet-media"));
 let activeId=null,lastTransform="",raf=0,lastTick=0;
 const source=shell.querySelector("[data-video-frame]");
 const playerSrc=()=>activeId?EMBED(activeId):"";

 function persist(next){
  try{
   if(next)localStorage.setItem(WALL_SCREEN_STORAGE_KEY,JSON.stringify(next));
   else localStorage.removeItem(WALL_SCREEN_STORAGE_KEY);
  }catch(_){info.textContent="壁の配置情報を保存できません（今回のゲームでは使用可能）";}
 }
 function showInfo(message){info.textContent=message;notify(message);}
 function play(id){
  if(!extractVideoId?.(id))return false;
  activeId=id;
  if(!placement)return false;
  source?.removeAttribute("src");
  video.src=playerSrc();
  showInfo("建物の壁スクリーンで動画を再生します。没入型VRでは表示されません。");
  return true;
 }
 function stop(){
  activeId=null;
  video.removeAttribute("src");
 }
 function detach(){
  if(!placement)return false;
  placement=null;persist(null);
  root.hidden=true;
  lastTransform="";
  video.removeAttribute("src");
  if(activeId&&source)source.src=playerSrc();
  showInfo("壁スクリーンを解除し、手持ちタブレットへ動画を戻しました（再生位置は引き継がれません）。");
  return true;
 }
 function place(){
  const renderer=getRenderer(),controller=getController();
  if(getXRActive()){showInfo("没入型VRではWeb動画を壁に投影できません。通常のゲーム画面で設置してください。");return false;}
  const nearest=nearestBuildingWall(renderer,controller);
  if(!nearest){showInfo("24m以内に設置できる建築物がありません。石壁・施設・建物の近くで試してください。");return false;}
  placement=nearest.placement;
  persist(placement);
  if(!activeId){
   const candidate=videoInput();
   activeId=extractVideoId?.(candidate)||null;
  }
  if(activeId){
   source?.removeAttribute("src");
   video.src=playerSrc();
  }
  shell.hidden=true;
  showInfo("📌 "+nearest.facade.kind+"の"+nearest.facade.side+"面に設置しました。映像は通常画面のDOM重畳で表示します。");
  return true;
 }
 placeButton.addEventListener("click",place);
 detachButton.addEventListener("click",detach);
 detachControl.addEventListener("click",detach);

 function update(){
  if(!placement||getXRActive()){
   root.hidden=true;return;
  }
  const renderer=getRenderer(),controller=getController();
  const facade=resolveMountedWall(placement,renderer,controller);
  const vp=renderer?.pickVP;
  const cam=renderer?.wallScreenCamera;
  if(!facade||!vp||!cam||renderer?.xrView||renderer?.shipVoyage?.active){
   root.hidden=true;return;
  }
  if((cam.x-facade.x)*facade.normal[0]+(cam.z-facade.z)*facade.normal[2]<.06){
   root.hidden=true;return;
  }
  const rect=renderer.canvas?.getBoundingClientRect?.();
  const parent=wrap.getBoundingClientRect();
  if(!rect?.width||!rect?.height||!parent?.width){
   root.hidden=true;return;
  }
  const corners=projectedWallCorners(facade,vp,rect.left-parent.left,rect.top-parent.top,
   rect.width,rect.height,renderer.cx||0,renderer.cz||0);
  if(!corners){root.hidden=true;return;}
  const transform=perspectiveCssMatrix(corners);
  if(!transform){root.hidden=true;return;}
  root.hidden=false;
  if(transform!==lastTransform){
   root.style.transform=transform;lastTransform=transform;
  }
 }
 function tick(t){
  if(t-lastTick>=50){lastTick=t;update();}
  raf=requestAnimationFrame(tick);
 }
 if(typeof requestAnimationFrame==="function")raf=requestAnimationFrame(tick);
 // When the user refreshes, retain placement without auto-playing video.
 if(placement)info.textContent="保存した壁位置があります。動画を再生するとスクリーンへ表示されます。";
 return {
  place,detach,play,stop,update,
  get mounted(){return Boolean(placement);},
  dispose(){
   if(raf&&typeof cancelAnimationFrame==="function")cancelAnimationFrame(raf);
   placeButton.removeEventListener("click",place);
   detachButton.removeEventListener("click",detach);
   detachControl.removeEventListener("click",detach);
   root.remove();tools.remove();
  }
 };
}
