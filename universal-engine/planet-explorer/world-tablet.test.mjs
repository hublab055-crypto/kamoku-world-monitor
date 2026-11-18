import test from "node:test";
import assert from "node:assert/strict";
import {youtubeVideoId,safeWebAddress,sameOriginChatEndpoint,installWorldTablet} from "./world-tablet.mjs";

test("YouTube player accepts only standard HTTPS video links and 11-character IDs",()=>{
 const id="dQw4w9WgXcQ";
 for(const v of [
  id,"https://youtu.be/"+id+"?t=3",
  "https://www.youtube.com/watch?v="+id,
  "https://m.youtube.com/shorts/"+id,
  "https://youtube.com/embed/"+id,
  "https://youtube.com/live/"+id
 ])assert.equal(youtubeVideoId(v),id,v);
 for(const v of [
  "https://evil.youtube.com/watch?v="+id,
  "http://www.youtube.com/watch?v="+id,
  "https://youtube.com/watch?v=short",
  "javascript:alert(1)","https://youtu.be/"+id+"/extra"
 ])assert.equal(youtubeVideoId(v),null,v);
});

test("Embedded browsing rejects script protocols and URL credentials",()=>{
 assert.equal(safeWebAddress("example.org/docs"),"https://example.org/docs");
 assert.equal(safeWebAddress("https://example.org/path"),"https://example.org/path");
 for(const v of ["javascript:alert(1)","data:text/html,x","http://example.org","not a url",
  "https://user:pass@example.org/","file:///etc/passwd"])
  assert.equal(safeWebAddress(v),null,v);
});

test("Chat endpoint must be a local HTTPS /api/ server route",()=>{
 const origin="https://universal.example";
 assert.equal(sameOriginChatEndpoint("/api/chat",origin),"/api/chat");
 assert.equal(sameOriginChatEndpoint("/api/chat?mode=world",origin),"/api/chat?mode=world");
 for(const v of ["https://evil.example/api/chat","/chat","javascript:alert(1)","", "//other.example/api/chat"])
  assert.equal(sameOriginChatEndpoint(v,origin),null,v);
});

test("World tablet does not touch the DOM in Node diagnostic environment",()=>{
 assert.equal(installWorldTablet(),null);
});
