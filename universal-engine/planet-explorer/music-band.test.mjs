import {test} from "node:test";
import assert from "node:assert/strict";
import {musicianCandidates,hireBandContract,releaseBandContract,
 restoreBandContracts,currentBand,bandAppearance,MUSIC_BAND_ROLES} from "./music-band.mjs";
import {MusicCulture,musicVenue} from "./music-culture.mjs";
import {bandFigureGeometry,MUSIC_BAND_RENDER_ROLES,MUSIC_POSE_FRAMES} from "./music-band-geometry.mjs";
const day=12+19/24;
test("candidate musicians are existing city residents but not the venue lead",()=>{
 const list=musicianCandidates("capital","tavern");
 assert.ok(list.length>=4);
 assert.equal(list.some(p=>p.id===musicVenue("capital","tavern").musicianId),false);
 assert.equal(musicianCandidates("pioneer","tavern").length,0);
});
test("player wallet is debited exactly once on a valid three-day hiring contract",()=>{
 const first=musicianCandidates("capital","tavern")[0],wallet={coins:100},def=MUSIC_BAND_ROLES[0];
 const hired=hireBandContract({},"capital","tavern",first.id,def.id,day,wallet,{near:true});
 assert.equal(hired.ok,true);assert.equal(wallet.coins,100-def.fee);
 assert.equal(hired.contract.endsDay-hired.contract.startsDay,3);
 assert.equal(hireBandContract(hired.bands,"capital","tavern",first.id,def.id,day,wallet,{near:true}).ok,false);
 assert.equal(wallet.coins,100-def.fee);
 assert.equal(currentBand(hired.bands,"capital",day+3).length,0);
});
test("invalid money, far away NPC and duplicate band roles leave state unchanged",()=>{
 const a=musicianCandidates("capital","tavern"),wallet={coins:150},def=MUSIC_BAND_ROLES[1];
 assert.equal(hireBandContract({},"capital","tavern",a[0].id,def.id,day,wallet,{near:false}).ok,false);
 assert.equal(wallet.coins,150);
 const first=hireBandContract({},"capital","tavern",a[0].id,def.id,day,wallet,{near:true});
 assert.equal(hireBandContract(first.bands,"capital","tavern",a[1].id,def.id,day,wallet,{near:true}).ok,false);
 assert.equal(wallet.coins,150-def.fee);
 assert.equal(hireBandContract(first.bands,"capital","tavern","resident-900","drums",day,wallet,{near:true}).ok,false);
});
test("contract termination returns no fee, expired contracts can be replaced",()=>{
 const first=musicianCandidates("capital","theater")[0],wallet={coins:100};
 const hired=hireBandContract({},"capital","theater",first.id,"bass",day,wallet,{near:true});
 const coins=wallet.coins;
 const ended=releaseBandContract(hired.bands,"capital",first.id,day);
 assert.equal(ended.ok,true);assert.equal(wallet.coins,coins);
 assert.equal(currentBand(ended.bands,"capital",day).length,0);
 const renewed=hireBandContract(hired.bands,"capital","theater",first.id,"bass",day+3,wallet,{near:true});
 assert.equal(renewed.ok,true);
});
test("saved contracts survive culture snapshot and keep consistent band lineup",()=>{
 const c=new MusicCulture(),wallet={coins:100};
 const singer=musicianCandidates("capital","tavern")[0];
 assert.equal(c.hireArtist("capital","tavern",singer.id,"guitar",day,wallet,{near:true}).ok,true);
 const restored=new MusicCulture(c.snapshot());
 assert.deepEqual(restored.snapshot(),c.snapshot());
 const lineup=bandAppearance(musicVenue("capital","tavern"),restored.bandContracts,day);
 assert.equal(lineup.length,2);assert.equal(lineup[1].residentId,singer.id);
 assert.equal(restored.activeBand("capital",day+3).length,0);
});
test("musician conversations improve the existing TownLife friendship once daily",()=>{
 const c=new MusicCulture(),town={friendship:{}};
 assert.equal(c.talkArtist("capital","tavern",day,town,{near:false}).ok,false);
 const first=c.talkArtist("capital","tavern",day,town,{near:true});
 assert.equal(first.ok,true);
 const key="capital:"+musicVenue("capital","tavern").musicianId;
 assert.equal(town.friendship[key],2);
 assert.equal(c.talkArtist("capital","tavern",day,town,{near:true}).ok,false);
 assert.equal(town.friendship[key],2);
 assert.equal(c.talkArtist("capital","tavern",day+1,town,{near:true}).ok,true);
 assert.equal(town.friendship[key],4);
});
test("rehearsed band increases skill not free money from venue",()=>{
 const c=new MusicCulture(),wallet={coins:160};
 const candidate=musicianCandidates("capital","tavern")[0];
 assert.equal(c.hireArtist("capital","tavern",candidate.id,"keys",day,wallet,{near:true}).ok,true);
 const before=c.balance("capital","tavern"),coins=wallet.coins;
 const show=c.perform("capital","tavern",day,wallet,{near:true,hasInstrument:true});
 assert.equal(show.ok,true);assert.equal(c.skill,3);
 assert.equal(wallet.coins,coins+show.salary);
 assert.equal(c.balance("capital","tavern"),before-show.salary);
 assert.equal(c.perform("capital","tavern",day,wallet,{near:true,hasInstrument:true}).ok,false);
});
test("static frame geometry has valid indices, different poses and roles",()=>{
 const a=bandFigureGeometry("guitar",0),b=bandFigureGeometry("guitar",1);
 assert.notDeepEqual(a.positions,b.positions);
 for(const role of MUSIC_BAND_RENDER_ROLES){
  for(let frame=0;frame<MUSIC_POSE_FRAMES;frame++){
   const g=bandFigureGeometry(role,frame);
   assert.ok(g.positions.length>0&&g.indices.length>0);
   assert.equal(g.positions.length,g.colors.length);
   assert.equal(g.normals.length,g.positions.length);
   assert.ok(g.indices.every(index=>index<g.positions.length/3));
  }
 }
});
test("tampered contract data is rejected on restore",()=>{
 assert.throws(()=>restoreBandContracts({capital:[{townId:"capital",residentId:"resident-888",
  role:"drums",startsDay:0,endsDay:3,fee:26}]}),/不正/);
 assert.throws(()=>restoreBandContracts({capital:[{townId:"capital",residentId:"resident-0",
  role:"drums",startsDay:0,endsDay:3,fee:0}]}),/不正/);
});
