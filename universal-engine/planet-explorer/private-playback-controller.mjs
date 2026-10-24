/**
 * PRIVATE playback: no persistence, transport, analytics or URLs in diagnostic logs.
 * The caller owns any user-facing status strings. No service restrictions are bypassed.
 */
export class PrivatePlaybackController {
  constructor({hlsFactory=null}={}) {
    this.sessions=new Map();
    this.hlsFactory=hlsFactory;
  }
  open(id, source, {onStatus=()=>{},muted=true}={}) {
    this.close(id);
    if (!source || !["video","embed"].includes(source.kind)) throw Error("再生ソースが不正です");
    const state={id,source,visibility:true,status:"ready",media:null,hls:null,
      gestureRequired:true,onStatus,iframe:null};
    this.sessions.set(id,state);
    if (source.kind==="embed") return state; // external origin loads only on user gesture
    const video=document.createElement("video");
    video.preload="metadata";video.playsInline=true;
    video.setAttribute("playsinline","");
    video.setAttribute("webkit-playsinline","");
    video.crossOrigin="anonymous"; // only CORS-authorized video can enter WebGL
    video.muted=muted;video.loop=false;video.controls=false;
    const fail=()=>{state.status="error";onStatus("映像が再生できません。配信元のCORS、形式、認証、配信制限を確認してください。");};
    const playable=()=>{state.status="ready";onStatus("再生準備ができました。画面をタップして再生してください。");};
    video.addEventListener("error",fail);
    video.addEventListener("loadedmetadata",playable);
    state.cleanup=()=>{video.removeEventListener("error",fail);video.removeEventListener("loadedmetadata",playable);};
    state.media=video;
    if(source.format==="hls" && !video.canPlayType("application/vnd.apple.mpegurl")) {
      const Hls=this.hlsFactory;
      if (!Hls || !Hls.isSupported?.()) {
        state.status="error";onStatus("HLS非対応です。SafariのネイティブHLSまたはhls.js対応環境が必要です。");
      } else {
        state.hls=new Hls({enableWorker:true});
        state.hls.loadSource(source.url);
        state.hls.attachMedia(video);
      }
    } else video.src=source.url;
    return state;
  }
  get(id){return this.sessions.get(id)||null;}
  async play(id){
    const state=this.get(id);
    if(!state)throw Error("再生画面がありません");
    if(state.source.kind==="embed") {
      state.gestureRequired=false;state.status="ready";return state;
    }
    if(state.status==="error")throw Error("配信形式か配信元の制限により再生できません");
    if(!state.media?.src&&!state.hls)throw Error("有効なストリームがありません");
    try{
      await state.media.play();
      state.status="playing";state.gestureRequired=false;
      return state;
    }catch(_){
      state.gestureRequired=true;state.status="gesture";
      throw Error("ブラウザが自動再生を制限しています。テレビをもう一度タップして再生してください。");
    }
  }
  pause(id){const s=this.get(id);if(s?.media){s.media.pause();s.status="paused";}}
  setVisible(id,visible){
    const s=this.get(id);if(!s)return;
    s.visibility=!!visible;
    if(!visible&&s.media&&!s.media.paused)this.pause(id);
    // Returning to view must NOT autoplay a private video without a user gesture.
  }
  close(id){
    const s=this.get(id);if(!s)return;
    this.sessions.delete(id);
    s.cleanup?.();
    if(s.media){
      s.media.pause();
      s.media.removeAttribute("src");
      s.media.load(); // tear down decoder / fetch resources on iOS
    }
    s.hls?.destroy?.();
    if(s.iframe){s.iframe.removeAttribute("src");s.iframe.remove();}
    s.media=null;s.iframe=null;s.hls=null;
  }
  closeAll(){for(const id of Array.from(this.sessions.keys()))this.close(id);}
}
/** Official embeds remain DOM elements. Never draw/inspect their video frames. */
export function createOfficialEmbed(state,{title="動画プレイヤー"}={}){
  if(state?.source?.kind!=="embed")throw Error("埋め込みプレイヤーの指定が不正です");
  const iframe=document.createElement("iframe");
  iframe.title=title;
  iframe.src=state.source.embedUrl;
  iframe.allow="autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.allowFullscreen=true;
  iframe.referrerPolicy="strict-origin-when-cross-origin";
  iframe.loading="lazy";
  state.iframe=iframe;
  return iframe;
}
