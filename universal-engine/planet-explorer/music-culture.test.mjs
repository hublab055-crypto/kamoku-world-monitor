import {test} from "node:test";
import assert from "node:assert/strict";
import {MusicCulture,MUSIC_VENUES,musicVenue,musicNow,cultureHour} from "./music-culture.mjs";

const evening=5+19/24;
const afternoon=8+14/24;
const classTime=8+10/24;
test("venue roster uses stable existing settlement residents and stage coordinates",()=>{
 const tavern=musicVenue("capital","tavern"),theater=musicVenue("capital","theater");
 assert.ok(tavern?.musicianId.startsWith("resident-"));
 assert.ok(Number.isFinite(tavern.site.x)&&Number.isFinite(tavern.site.z));
 assert.equal(theater.site.x,0);
 assert.equal(musicVenue("pioneer","tavern"),null);
 assert.equal(MUSIC_VENUES.length,3);
});
test("planet time opens real scheduled performances",()=>{
 const v=musicVenue("capital","tavern");
 assert.equal(musicNow(v,evening).performing,true);
 assert.equal(musicNow(v,5+12/24).performing,false);
 assert.ok(Math.abs(cultureHour(evening)-19)<1e-8);
});
test("tickets transfer real coins to venue and block repeated admissions",()=>{
 const c=new MusicCulture(),wallet={coins:40},before=c.balance("capital","tavern");
 const r=c.attend("capital","tavern",evening,wallet,{near:true});
 assert.equal(r.ok,true);assert.equal(wallet.coins,35);
 assert.equal(c.balance("capital","tavern"),before+5);
 assert.equal(c.attend("capital","tavern",evening,wallet,{near:true}).ok,false);
 assert.equal(wallet.coins,35);
});
test("paid player performance requires crafted instrument and spends venue budget",()=>{
 const c=new MusicCulture(),wallet={coins:40};
 assert.equal(c.perform("capital","tavern",evening,wallet,{near:true}).ok,false);
 const before=c.balance("capital","tavern");
 const result=c.perform("capital","tavern",evening,wallet,{near:true,hasInstrument:true});
 assert.equal(result.ok,true);assert.equal(wallet.coins,40+result.salary);
 assert.equal(c.balance("capital","tavern"),before-result.salary);
 assert.equal(c.perform("capital","tavern",evening,wallet,{near:true,hasInstrument:true}).ok,false);
 assert.equal(c.skill,2);assert.equal(c.reputation,2);
});
test("NPC professional salary is funded and once per planetary day",()=>{
 const c=new MusicCulture(),start=c.balance("capital","theater");
 assert.equal(c.payNPC("capital","theater",afternoon).salary,10);
 assert.equal(c.payNPC("capital","theater",afternoon).ok,false);
 assert.equal(c.balance("capital","theater"),start-10);
 assert.equal(c.payNPC("capital","theater",afternoon+1).ok,true);
});
test("music school charges tuition and awards skill once per planetary day",()=>{
 const c=new MusicCulture(),wallet={coins:28};
 assert.equal(c.lesson("capital",classTime,wallet,{near:true}).ok,true);
 assert.equal(wallet.coins,16);assert.equal(c.skill,5);
 assert.equal(c.lesson("capital",classTime,wallet,{near:true}).ok,false);
 assert.equal(wallet.coins,16);
});
test("remote participation, closed venues and insufficient money fail atomically",()=>{
 const c=new MusicCulture(),wallet={coins:0};
 assert.equal(c.attend("capital","tavern",evening,wallet,{near:false}).ok,false);
 assert.equal(c.attend("capital","tavern",evening,wallet,{near:true}).ok,false);
 assert.equal(c.lesson("capital",classTime,wallet,{near:true}).ok,false);
 assert.equal(c.perform("capital","theater",evening,wallet,{near:true,hasInstrument:true}).ok,false);
 assert.equal(c.skill,0);assert.equal(c.reputation,0);
});
test("culture journal and accounting survive save/restore",()=>{
 const c=new MusicCulture(),wallet={coins:70};
 c.perform("capital","theater",afternoon,wallet,{near:true,hasInstrument:true});
 const restored=new MusicCulture(c.snapshot());
 assert.deepEqual(restored.snapshot(),c.snapshot());
 assert.equal(restored.perform("capital","theater",afternoon,wallet,{near:true,hasInstrument:true}).ok,false);
});
