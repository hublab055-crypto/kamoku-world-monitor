/**
 * Universal Engine — user-local YouTube URL library and optional search-result
 * validation. Never stores remote HTML, an API key, or video content.
 */
export const YOUTUBE_URL_LIBRARY_KEY="universal-engine:youtube-urls:v1";
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;
const MAX_SAVED=100;
const MAX_TITLE=120;
const MAX_SEARCH=20;

export function normalizeYoutubeSaved(raw){
 let parsed=raw;
 try{if(typeof raw==="string")parsed=JSON.parse(raw);}
 catch(_){return [];}
 if(!Array.isArray(parsed))return [];
 const seen=new Set(),list=[];
 for(const row of parsed){
  if(!row||typeof row!=="object"||!VIDEO_ID.test(row.id||"")||seen.has(row.id))continue;
  seen.add(row.id);
  const label=typeof row.title==="string"?row.title.trim().slice(0,MAX_TITLE):"";
  list.push({
   id:row.id,
   title:label||"YouTube "+row.id,
   addedAt:Number.isFinite(row.addedAt)&&row.addedAt>=0?
    Math.floor(row.addedAt):0
  });
  if(list.length>=MAX_SAVED)break;
 }
 return list;
}

export function registerYoutubeUrl(current,id,title="",now=Date.now()){
 if(!VIDEO_ID.test(id||""))return null;
 const normalized=normalizeYoutubeSaved(current);
 const old=normalized.find(entry=>entry.id===id);
 const name=String(title??"").trim().slice(0,MAX_TITLE);
 const item={
  id,
  title:name||old?.title||"YouTube "+id,
  addedAt:old?.addedAt||Math.max(0,Math.floor(Number(now)||0))
 };
 return [item,...normalized.filter(row=>row.id!==id)].slice(0,MAX_SAVED);
}

export function unregisterYoutubeUrl(current,id){
 return normalizeYoutubeSaved(current).filter(row=>row.id!==id);
}

export function youtubeSearchHref(value){
 const q=String(value??"").trim().slice(0,180);
 if(!q)return null;
 return "https://www.youtube.com/results?"+new URLSearchParams({search_query:q});
}

/**
 * Server expected: {results:[{videoId,title,channelTitle}]}
 * Also tolerates YouTube Data API's documented {items:[{id:{videoId},snippet:...}]}
 * after server-side filtering. All values are rendered as textContent.
 */
export function parseYoutubeSearchResults(payload){
 const rows=payload?.results||payload?.items;
 if(!Array.isArray(rows))return [];
 const seen=new Set(),result=[];
 for(const row of rows){
  const id=row?.videoId??row?.id?.videoId??row?.id;
  if(typeof id!=="string"||!VIDEO_ID.test(id)||seen.has(id))continue;
  const title=typeof row.title==="string"?row.title:row.snippet?.title;
  if(typeof title!=="string"||!title.trim())continue;
  seen.add(id);
  const channel=typeof row.channelTitle==="string"?row.channelTitle:row.snippet?.channelTitle;
  result.push({
   id,
   title:title.trim().slice(0,160),
   channel:typeof channel==="string"?channel.trim().slice(0,80):""
  });
  if(result.length>=MAX_SEARCH)break;
 }
 return result;
}
