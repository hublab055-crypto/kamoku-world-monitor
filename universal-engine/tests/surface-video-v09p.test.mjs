import test from "node:test";
import assert from "node:assert/strict";
import {resolveVideoSource,ProviderAdapterRegistry} from "../planet-explorer/video-provider-adapters.mjs";
import {publicCommand,PublicSyncController} from "../planet-explorer/public-sync-controller.mjs";
import {cssMatrixForCorners,surfaceCorners} from "../planet-explorer/css3d-embed-renderer.mjs";
import {PrivatePlaybackController} from "../planet-explorer/private-playback-controller.mjs";

test("official provider adapters only generate safe embed URLs",()=>{
 const youtube=resolveVideoSource("https://www.youtube.com/watch?v=abcDEF123_-&t=100");
 assert.equal(youtube.id,"abcDEF123_-");
 assert.equal(youtube.kind,"embed");
 assert.equal(youtube.embedUrl,"https://www.youtube-nocookie.com/embed/abcDEF123_-?playsinline=1");
 assert.equal(resolveVideoSource("https://vimeo.com/123456789").provider,"vimeo");
 assert.equal(resolveVideoSource("https://dai.ly/x7abcde").provider,"dailymotion");
 for(const bad of ["javascript:alert(1)","http://example.com/a.mp4",
  "https://www.youtube.com.evil.org/watch?v=abcDEF123_-",
  "https://www.youtube.com/watch?v=bad",
  "https://example.com/a.mp4",
  "https://user:password@example.com/a.mp4"])assert.throws(()=>resolveVideoSource(bad));
});
test("direct video requires an explicit HTTPS host and supported extension",()=>{
 const opt={directHosts:["video.example.org"]};
 assert.equal(resolveVideoSource("https://video.example.org/a.m3u8?token=x",opt).format,"hls");
 assert.equal(resolveVideoSource("https://video.example.org/a.webm",opt).format,"webm");
 assert.throws(()=>resolveVideoSource("https://evil.example.org/a.mp4",opt));
 assert.throws(()=>resolveVideoSource("https://video.example.org/a.avi",opt));
 const registry=new ProviderAdapterRegistry(opt);
 assert.equal(registry.resolve("https://video.example.org/a.mp4").kind,"video");
});
test("PUBLIC commands cannot leak private metadata or accept unauthorized URLs",()=>{
 const policy={approvedProviders:["youtube","direct"],streamHosts:["stream.example.org"]};
 const command=publicCommand({screenId:"screen1",provider:"youtube",id:"abcDEF123_-",
  action:"play",position:9,title:"PRIVATE TITLE",history:["SECRET"],
  privateUrl:"https://private.example.org"},policy);
 assert.deepEqual(Object.keys(command).sort(),["action","id","position","provider","screenId","version"].sort());
 assert.throws(()=>publicCommand({...command,provider:"vimeo"},policy));
 assert.throws(()=>publicCommand({...command,provider:"direct",id:"https://secret.org/x.mp4"},policy));
});
test("PUBLIC transport only consumes server-verified packets",async()=>{
 const events=[],sent=[];let subscriber;
 const transport={subscribe:fn=>{subscriber=fn;return ()=>{subscriber=null;};},
  send:async data=>sent.push(data)};
 const policy={approvedProviders:["youtube"],streamHosts:[]};
 const sync=new PublicSyncController({transport,policy,authorize:async()=>true,onCommand:e=>events.push(e)});
 assert.equal(sync.connect(),true);
 subscriber({channel:"ue-public-video",provider:"youtube",id:"abcDEF123_-",
  screenId:"screen1",action:"play",position:2,serverTime:Date.now()}); // not verified
 assert.equal(events.length,0);
 subscriber({channel:"ue-public-video",verified:true,provider:"youtube",id:"abcDEF123_-",
  screenId:"screen1",action:"play",position:2,serverTime:Date.now()});
 assert.equal(events.length,1);
 await sync.publish({screenId:"screen1",provider:"youtube",id:"abcDEF123_-",
  action:"pause",position:3,privateUrl:"should-be-stripped"});
 assert.equal(sent.length,1);
 assert.equal("privateUrl" in sent[0],false);
 sync.disconnect();
 assert.equal(subscriber,null);
});
test("CSS3D homography preserves projected quadrilateral and surface yaw",()=>{
 const s=surfaceCorners({x:0,y:2,z:0,width:2,rotation:90});
 assert.ok(s[0][2]>s[1][2]);
 assert.equal(cssMatrixForCorners([[0,0],[480,0],[480,270],[0,270]]),
  "matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)");
});
test("PRIVATE sessions never include serialization, and release media",async()=>{
 const previous=globalThis.document;
 const videos=[];
 globalThis.document={createElement:tag=>{
  assert.equal(tag,"video");
  const v={src:"",paused:true,readyState:0,videoWidth:1280,videoHeight:720,
   listeners:new Map(),canPlayType:()=>"",setAttribute(){},removeAttribute(){this.src="";},
   addEventListener(n,fn){this.listeners.set(n,fn);},
   removeEventListener(n){this.listeners.delete(n);},
   async play(){this.paused=false;},pause(){this.paused=true;},load(){this.loaded=true;}};
  videos.push(v);return v;
 }};
 try{
  const controller=new PrivatePlaybackController();
  controller.open("test",{kind:"video",format:"mp4",url:"https://video.example.org/test.mp4"});
  await controller.play("test");
  assert.equal(controller.get("test").status,"playing");
  controller.setVisible("test",false);
  assert.equal(videos[0].paused,true);
  controller.close("test");
  assert.equal(controller.sessions.size,0);
  assert.equal(videos[0].src,"");
  assert.equal(videos[0].loaded,true);
  assert.equal(typeof controller.snapshot,"undefined");
 }finally{globalThis.document=previous;}
});
