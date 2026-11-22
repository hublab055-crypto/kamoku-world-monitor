import test from "node:test";
import assert from "node:assert/strict";
import {MediaLibrary,youtubeVideoId,normalizeMediaSource,programAt} from "../planet-explorer/media-library.mjs";
const SAMPLE="https://youtu.be/dQw4w9WgXcQ";
const placement={lat:35.45,lon:136.2,height:2.2,width:2.4,rotation:10};
test("only recognized HTTPS YouTube hosts and exact IDs work",()=>{
 assert.equal(youtubeVideoId(SAMPLE),"dQw4w9WgXcQ");
 assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),"dQw4w9WgXcQ");
 assert.equal(youtubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),"dQw4w9WgXcQ");
 assert.equal(youtubeVideoId("http://youtu.be/dQw4w9WgXcQ"),null);
 assert.equal(youtubeVideoId("https://youtu.be.attacker.test/dQw4w9WgXcQ"),null);
 assert.equal(youtubeVideoId("javascript:alert(1)"),null);
 assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=x"),null);
});
test("create, gift, duplicate and snapshot survive reload",()=>{
 const lib=new MediaLibrary();
 const letter=lib.create({kind:"letter",title:"祖父の手紙",author:"grandpa",source:{type:"text",text:"家族へ"}});
 assert.equal(lib.gift(letter.id,"grandchild").owner,"grandchild");
 const copy=lib.duplicate(letter.id,"player");
 assert.equal(copy.author,"grandpa");
 assert.equal(copy.source.text,"家族へ");
 const saved=JSON.parse(JSON.stringify(lib.snapshot()));
 const restored=new MediaLibrary(saved);
 assert.deepEqual(restored.snapshot(),saved);
 assert.notEqual(restored.items[0].id,restored.items[1].id);
});
test("YouTube film duplicates retain exact safe ID",()=>{
 const lib=new MediaLibrary();
 const f=lib.create({kind:"film",title:"動画",source:{type:"youtube",url:SAMPLE}});
 const copy=lib.duplicate(f.id);
 assert.deepEqual(copy.source,f.source);
 assert.deepEqual(new MediaLibrary(lib.snapshot()).items[1].source,copy.source);
});
test("painting and film can be placed and unplaced",()=>{
 const lib=new MediaLibrary();
 const image=lib.create({kind:"painting",title:"風景",source:{type:"blob",key:"ue-media-123456789abc",mime:"image/png"}});
 const film=lib.create({kind:"film",title:"ニュース",source:{type:"youtube",url:SAMPLE}});
 assert.equal(lib.place(image.id,"picture",placement).mode,"picture");
 assert.equal(lib.place(film.id,"screen",placement).mode,"screen");
 assert.throws(()=>lib.place(film.id,"picture",placement));
 const saved=new MediaLibrary(lib.snapshot());
 assert.equal(saved.placements.length,2);
 assert.equal(saved.unplace(saved.placements[0].id),true);
 assert.equal(saved.placements.length,1);
});
test("schedule always chooses last program, wrapping midnight",()=>{
 const lib=new MediaLibrary();
 const evening=lib.create({kind:"film",title:"晩",source:{type:"youtube",url:SAMPLE}});
 const morning=lib.create({kind:"record",title:"朝",source:{type:"blob",key:"ue-media-abc123abc123",mime:"audio/mpeg"}});
 lib.setProgram("王都放送",1200,evening.id);
 lib.setProgram("王都放送",480,morning.id);
 assert.equal(lib.currentProgram("王都放送",1300).title,"晩");
 assert.equal(lib.currentProgram("王都放送",240).title,"晩");
 assert.equal(lib.currentProgram("王都放送",490).title,"朝");
 assert.equal(programAt([],12),null);
 assert.equal(new MediaLibrary(lib.snapshot()).currentProgram("王都放送",490).title,"朝");
});
test("reject unsafe formats and corrupted saves",()=>{
 assert.throws(()=>normalizeMediaSource("film",{type:"blob",key:"ue-media-123456789abc",mime:"video/x-msvideo"}),/MP4/);
 assert.throws(()=>normalizeMediaSource("painting",{type:"blob",key:"ue-media-123456789abc",mime:"text/html"}));
 assert.throws(()=>new MediaLibrary({format:"ue/media-library",version:2,items:[],placements:[],channels:[]}));
 const lib=new MediaLibrary();
 const bad=lib.snapshot();bad.items=[{id:1,kind:"letter",title:"x",source:{type:"text",text:"a"}},
 {id:1,kind:"letter",title:"y",source:{type:"text",text:"b"}}];
 assert.throws(()=>new MediaLibrary(bad));
});
test("deleting media removes placements and schedule entries",()=>{
 const lib=new MediaLibrary();
 const film=lib.create({kind:"film",title:"特集",source:{type:"youtube",url:SAMPLE}});
 lib.place(film.id,"screen",placement);lib.setProgram("放送",100,film.id);
 assert.equal(lib.remove(film.id),true);
 assert.equal(lib.placements.length,0);
 assert.equal(lib.currentProgram("放送",123),null);
});
