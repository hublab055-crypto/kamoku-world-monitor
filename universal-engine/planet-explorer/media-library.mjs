/**
 * Universal Engine media-item catalog. Independent from rendering and world saves.
 * Binary content is stored in IndexedDB by the browser adapter, never in JSON.
 */
export const MEDIA_FORMAT="ue/media-library";
export const MEDIA_KINDS=Object.freeze(["letter","painting","record","film"]);
const clone=value=>JSON.parse(JSON.stringify(value));
const short=(value,max=80)=>String(value??"").trim().slice(0,max);
const fail=message=>{throw new Error(message);};
export function youtubeVideoId(url){
 if(typeof url!=="string"||url.length>2048)return null;
 try{
  const u=new URL(url);
  if(u.protocol!=="https:")return null;
  const host=u.hostname.toLowerCase();
  let id=null;
  if(host==="youtu.be"||host==="www.youtu.be")id=u.pathname.split("/")[1];
  else if(["youtube.com","www.youtube.com","m.youtube.com","youtube-nocookie.com","www.youtube-nocookie.com"].includes(host)){
   if(u.pathname==="/watch")id=u.searchParams.get("v");
   else if(/^\/(embed|shorts|live)\/[^/]+\/?$/.test(u.pathname))id=u.pathname.split("/")[2];
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id||"")?id:null;
 }catch(_){return null;}
}
export function normalizeMediaSource(kind,source){
 if(!MEDIA_KINDS.includes(kind))fail("未対応の作品種別です");
 if(!source||typeof source!=="object")fail("作品データがありません");
 if(kind==="letter"){
  const text=String(source.text??"");
  if(!text.trim()||text.length>20000)fail("手紙は1〜20000文字で入力してください");
  return {type:"text",text};
 }
 if(kind==="film"&&source.type==="youtube"){
  const videoId=youtubeVideoId(source.url);
  if(!videoId)fail("正しいHTTPSのYouTube動画URLを指定してください");
  return {type:"youtube",videoId};
 }
 if(source.type!=="blob"||!/^ue-media-[a-z0-9-]{12,90}$/.test(source.key||""))
  fail("ローカルメディアファイルが必要です");
 const mime=short(source.mime,100).toLowerCase(),name=short(source.name,160);
 if(kind==="painting"&&!["image/jpeg","image/png","image/webp","image/gif"].includes(mime))fail("画像形式が未対応です");
 if(kind==="record"&&!["audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm"].includes(mime))fail("音声形式が未対応です");
 if(kind==="film"&&!["video/mp4","video/webm","video/ogg"].includes(mime))fail("動画はMP4/WebM等に変換してください。AVIは直接再生できません");
 return {type:"blob",key:source.key,mime,name};
}
function checkPosition(p){
 if(!p||![p.lat,p.lon,p.height,p.width,p.rotation].every(Number.isFinite)||
  Math.abs(p.lat)>90||Math.abs(p.lon)>180||p.height<0||p.height>200||
  p.width<.25||p.width>16||Math.abs(p.rotation)>360)return fail("設置位置が不正です");
 return {lat:p.lat,lon:p.lon,height:p.height,width:p.width,rotation:p.rotation};
}
export function programAt(schedule,minute){
 const t=((Math.floor(Number(minute)||0)%1440)+1440)%1440;
 const candidates=schedule.filter(x=>x.start<=t).sort((a,b)=>b.start-a.start);
 return candidates[0]??schedule.slice().sort((a,b)=>b.start-a.start)[0]??null;
}
export class MediaLibrary{
 constructor(snapshot=null){
  this.items=[];this.placements=[];this.channels=[];this.nextId=1;
  if(snapshot!==null)this.load(snapshot);
 }
 load(s){
  if(s?.format!==MEDIA_FORMAT||s.version!==1||
    !Array.isArray(s.items)||s.items.length>256||
    !Array.isArray(s.placements)||s.placements.length>128||
    !Array.isArray(s.channels)||s.channels.length>12)fail("メディア保存データが不正です");
  const unique=new Set();
  this.items=s.items.map(item=>{
   if(!Number.isSafeInteger(item?.id)||item.id<1||unique.has("i"+item.id))fail("重複した作品IDです");
   unique.add("i"+item.id);
   const kind=item.kind,source=normalizeMediaSource(kind,item.source?.type==="youtube"?
    {type:"youtube",url:"https://www.youtube.com/watch?v="+item.source.videoId}:item.source);
   return {id:item.id,kind,title:short(item.title),author:short(item.author),owner:short(item.owner)||"player",
    createdAt:short(item.createdAt,40),source,transferable:item.transferable!==false};
  });
  const ids=new Set(this.items.map(x=>x.id));
  this.placements=s.placements.map(p=>{
   if(!Number.isSafeInteger(p?.id)||unique.has("p"+p.id)||!ids.has(p.itemId))fail("不正な配置です");
   unique.add("p"+p.id);
   if(!["picture","screen"].includes(p.mode))fail("配置用途が未対応です");
   return {id:p.id,itemId:p.itemId,mode:p.mode,...checkPosition(p)};
  });
  this.channels=s.channels.map(c=>{
   if(typeof c?.name!=="string"||!Array.isArray(c.schedule)||c.schedule.length>24)fail("番組表が不正です");
   const schedule=c.schedule.map(entry=>{
    if(!Number.isInteger(entry.start)||entry.start<0||entry.start>=1440||!ids.has(entry.itemId))fail("番組の時刻か作品が不正です");
    return {start:entry.start,itemId:entry.itemId};
   });
   return {name:short(c.name,40),schedule};
  });
  this.nextId=Math.max(1,...this.items.map(x=>x.id+1),...this.placements.map(x=>x.id+1));
 }
 snapshot(){return {format:MEDIA_FORMAT,version:1,items:clone(this.items),placements:clone(this.placements),channels:clone(this.channels)};}
 create({kind,title,author="player",owner="player",source,transferable=true}){
  if(this.items.length>=256)fail("保存できる作品は256件までです");
  const mediaSource=normalizeMediaSource(kind,source),name=short(title);
  if(!name)fail("作品名を入力してください");
  const item={id:this.nextId++,kind,title:name,author:short(author)||"player",owner:short(owner)||"player",
   createdAt:new Date().toISOString(),source:mediaSource,transferable:Boolean(transferable)};
  this.items.push(item);return clone(item);
 }
 gift(id,to){
  const item=this.items.find(x=>x.id===Number(id));
  if(!item||!item.transferable||!short(to))fail("この作品は贈答できません");
  item.owner=short(to);return clone(item);
 }
 duplicate(id,owner="player"){
  const original=this.items.find(x=>x.id===Number(id));
  if(!original||!original.transferable)fail("この作品は複製できません");
  return this.create({...original,owner,source:original.source});
 }
 place(id,mode,point){
  const item=this.items.find(x=>x.id===Number(id));
  if(!item)fail("作品が見つかりません");
  if(mode==="picture"&&item.kind!=="painting")fail("壁に展示できるのは絵画・写真です");
  if(mode==="screen"&&!["film","painting"].includes(item.kind))fail("スクリーンに設定できるのは画像・映像です");
  if(this.placements.length>=128)fail("設置上限は128件です");
  const placement={id:this.nextId++,itemId:item.id,mode,...checkPosition(point)};
  this.placements.push(placement);return clone(placement);
 }
 unplace(id){const n=this.placements.length;this.placements=this.placements.filter(p=>p.id!==Number(id));return n!==this.placements.length;}
 remove(id){
  const n=this.items.length;this.items=this.items.filter(x=>x.id!==Number(id));
  this.placements=this.placements.filter(p=>p.itemId!==Number(id));
  this.channels=this.channels.map(c=>({...c,schedule:c.schedule.filter(s=>s.itemId!==Number(id))}));
  return n!==this.items.length;
 }
 setProgram(channel,start,itemId){
  const item=this.items.find(x=>x.id===Number(itemId));
  const minute=Number(start);
  if(!item||!["film","record"].includes(item.kind)||!Number.isInteger(minute)||minute<0||minute>=1440)fail("番組設定が不正です");
  const name=short(channel,40);if(!name)fail("チャンネル名が必要です");
  let c=this.channels.find(x=>x.name===name);
  if(!c){if(this.channels.length>=12)fail("チャンネル上限です");c={name,schedule:[]};this.channels.push(c);}
  c.schedule=c.schedule.filter(x=>x.start!==minute);
  if(c.schedule.length>=24)fail("番組数が上限です");
  c.schedule.push({start:minute,itemId:item.id});c.schedule.sort((a,b)=>a.start-b.start);
  return clone(c);
 }
 currentProgram(channel,minutes){
  const c=this.channels.find(x=>x.name===channel);
  const entry=c&&programAt(c.schedule,minutes);
  return entry?this.items.find(x=>x.id===entry.itemId)||null:null;
 }
}