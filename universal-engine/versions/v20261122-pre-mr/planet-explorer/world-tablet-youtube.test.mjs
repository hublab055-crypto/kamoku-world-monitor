import test from "node:test";
import assert from "node:assert/strict";
import {
 YOUTUBE_URL_LIBRARY_KEY,normalizeYoutubeSaved,registerYoutubeUrl,unregisterYoutubeUrl,
 youtubeSearchHref,parseYoutubeSearchResults
} from "./world-tablet-youtube.mjs";

const A="dQw4w9WgXcQ",B="M7lc1UVf-VE";

test("Saved YouTube URLs round trip through a localStorage JSON value",()=>{
 const list=registerYoutubeUrl([],A,"お気に入り",12345);
 assert.deepEqual(list,[{id:A,title:"お気に入り",addedAt:12345}]);
 assert.equal(YOUTUBE_URL_LIBRARY_KEY,"universal-engine:youtube-urls:v1");
 assert.deepEqual(normalizeYoutubeSaved(JSON.stringify(list)),list);
 assert.deepEqual(normalizeYoutubeSaved("invalid"),[]);
});

test("Duplicate URL registration updates the title without duplicating the video",()=>{
 let list=registerYoutubeUrl([],A,"First",100);
 list=registerYoutubeUrl(list,B,"Second",200);
 list=registerYoutubeUrl(list,A,"Updated",300);
 assert.deepEqual(list.map(x=>x.id),[A,B]);
 assert.equal(list[0].title,"Updated");
 assert.equal(list[0].addedAt,100);
 list=unregisterYoutubeUrl(list,A);
 assert.deepEqual(list.map(x=>x.id),[B]);
});

test("URL library drops corrupt IDs, duplicate entries, bad titles and excessive entries",()=>{
 const rows=[null,{id:"invalid",title:"wrong"},{id:A,title:"Original",addedAt:1},
  {id:A,title:"Duplicate",addedAt:2},{id:B,title:1234,addedAt:-10}];
 assert.deepEqual(normalizeYoutubeSaved(rows),[
  {id:A,title:"Original",addedAt:1},
  {id:B,title:"YouTube "+B,addedAt:0}
 ]);
 assert.equal(registerYoutubeUrl([], "not-a-id","Oops"),null);
 const flood=Array.from({length:140},(_,i)=>({
  id:"X"+String(i).padStart(10,"0"),title:"x".repeat(200),addedAt:0
 }));
 const limited=normalizeYoutubeSaved(flood);
 assert.equal(limited.length,100);
 assert.equal(limited[0].title.length,120);
});

test("YouTube keyword search builds an encoded URL without other schemes",()=>{
 assert.equal(youtubeSearchHref("  猫 宇宙  "),
  "https://www.youtube.com/results?search_query=%E7%8C%AB+%E5%AE%87%E5%AE%99");
 assert.equal(youtubeSearchHref("  "),null);
 assert.match(youtubeSearchHref("cats & dogs"),/cats\+%26\+dogs/);
});

test("Internal search results accept YouTube Data API and app response safely",()=>{
 const results=parseYoutubeSearchResults({results:[
  {videoId:A,title:"A",channelTitle:"One"},
  {videoId:A,title:"Duplicate",channelTitle:"Bad"},
  {videoId:"invalid",title:"Invalid"},
  {videoId:B,title:"  B  ",channelTitle:"Two"}
 ]});
 assert.deepEqual(results,[
  {id:A,title:"A",channel:"One"},
  {id:B,title:"B",channel:"Two"}
 ]);
 assert.deepEqual(parseYoutubeSearchResults({items:[
  {id:{videoId:A},snippet:{title:"API",channelTitle:"Channel"}}
 ]}),[{id:A,title:"API",channel:"Channel"}]);
 assert.deepEqual(parseYoutubeSearchResults({results:[{videoId:A,title:""}]}),[]);
 assert.deepEqual(parseYoutubeSearchResults(null),[]);
});
