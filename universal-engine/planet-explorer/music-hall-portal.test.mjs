import {test} from "node:test";
import assert from "node:assert/strict";
import {hallDoor,hallDoorNear,hallExteriorStep,hallAudiencePose} from "./music-hall-portal.mjs";
import {settlementLayout} from "./settlements.mjs";
import {TownLife} from "./town-life.mjs";
import {MusicCulture,musicNow} from "./music-culture.mjs";
const town="capital",layout=settlementLayout(town);
const idx=layout.buildings.findIndex(s=>s.type==="theater");
const schoolIdx=layout.buildings.findIndex(s=>s.type==="school");
const site={...layout.buildings[idx],id:"village-"+idx};
const school={...layout.buildings[schoolIdx],id:"village-"+schoolIdx};
const actor=(x=0,z=site.z+9.8)=>({x,z,nearGround:true,travelMode:"walk",
 lat:28,lon:42,locationAt(x,z){return {lat:28+z/100000,lon:42+x/100000}},
 clearMoveTarget(){}});
test("doors locate the actual facade, and cannot open from far away",()=>{
 const p=hallDoor(site),npc=new TownLife();
 assert.ok(p.z>site.z+9);
 assert.equal(hallDoorNear(site,{x:p.x,z:p.z}),true);
 assert.equal(npc.toggleHallDoor(town,site.id,actor(0,site.z+20)).ok,false);
 assert.equal(npc.hallDoorOpen(town,site.id),false);
});
test("a closed facade and side walls stop walking without teleportation",()=>{
 const near=hallDoor(site);
 const blocked=hallExteriorStep({x:0,z:near.front+.46},{x:0,z:near.front+.20},[site],()=>false);
 assert.equal(blocked.blocked,true);assert.equal(blocked.portal,null);
 const sideways=hallExteriorStep({x:site.x+9,z:site.z},
   {x:site.x+8,z:site.z},[site],()=>true);
 assert.equal(sideways.blocked,true);
});
test("open front door crossing enters hall; walking back out restores geo location",()=>{
 const npc=new TownLife(),a=actor(0,hallDoor(site).front+.48);
 assert.equal(npc.toggleHallDoor(town,site.id,a).ok,true);
 assert.equal(npc.hallDoorOpen(town,site.id),true);
 const from={x:a.x,z:a.z};a.z=hallDoor(site).front+.20;
 const through=npc.hallStep(town,from,a);
 assert.equal(through.entered,true);
 assert.equal(npc.inside.buildingId,site.id);
 npc.inside.pose.x=0;npc.inside.pose.z=9.34;
 assert.equal(npc.walk(.1,{forward:1}),true);
 assert.equal(npc.portalExitRequested,true);
 const exiting=npc.portalExit(a);
 assert.equal(exiting.ok,true);assert.equal(npc.inside,null);
 assert.ok(a.z>hallDoor(site).front);
 assert.equal(a.lat,28+a.z/100000);
});
test("doors are local to a venue and protect occupied seats",()=>{
 const npc=new TownLife(),a=actor(0,hallDoor(site).front+.6);
 assert.equal(npc.toggleHallDoor(town,site.id,a).ok,true);
 assert.equal(npc.hallDoorOpen(town,school.id),false);
 assert.equal(npc.enter(town,site.id,a).ok,true);
 npc.inside.seat="seat-test";
 assert.equal(npc.toggleHallDoor(town,site.id,a).ok,false);
 assert.equal(npc.hallDoorOpen(town,site.id),true);
});
test("seated player is blocked by ticket gate during active show",()=>{
 const npc=new TownLife(),a=actor(0,hallDoor(site).front+.4),culture=new MusicCulture();
 npc.toggleHallDoor(town,site.id,a);npc.enter(town,site.id,a);
 npc.inside.pose.x=3.4;npc.inside.pose.z=4.15;
 const start=7+14/24;
 assert.equal(musicNow(culture.venue(town,"theater"),start).performing,true);
 assert.equal(culture.hasTicket(town,"theater",start),false);
 assert.equal(npc.sitMusicSeat({admitted:culture.hasTicket(town,"theater",start)}).ok,false);
 const wallet={coins:40};
 assert.equal(culture.attend(town,"theater",start,wallet,{near:true}).ok,true);
 assert.equal(culture.hasTicket(town,"theater",start),true);
 assert.equal(npc.sitMusicSeat({admitted:culture.hasTicket(town,"theater",start)}).ok,true);
 assert.equal(wallet.coins,32);
});
test("existing non-hall buildings do not acquire doors or collision shells",()=>{
 const lodge={type:"lodge",x:5,z:9};
 assert.equal(hallDoor(lodge),null);
 assert.equal(hallExteriorStep({x:5,z:10},{x:5,z:9},[lodge],()=>false).blocked,false);
});
test("audience walks down aisle, turns into row, and leaves afterward",()=>{
 const show=14,base=11;
 const entering=hallAudiencePose("theater",0,base+(show*60-13)/1440,[show]);
 assert.ok(entering&&!entering.seated);
 assert.ok(Math.abs(entering.x)<1);
 const crossing=hallAudiencePose("theater",0,base+(show*60-7)/1440,[show]);
 assert.ok(crossing&&crossing.x!==0);
 const seated=hallAudiencePose("theater",0,base+(show*60+5)/1440,[show]);
 assert.ok(seated?.seated);
 const exiting=hallAudiencePose("theater",0,base+(show*60+48)/1440,[show]);
 assert.ok(exiting&&!exiting.seated);
 assert.equal(hallAudiencePose("theater",0,base+(show*60+55)/1440,[show]),null);
});
test("room stage and chairs block walking while the aisle stays usable",()=>{
 const npc=new TownLife(),a=actor(0,hallDoor(site).front+.4);
 npc.toggleHallDoor(town,site.id,a);npc.enter(town,site.id,a);
 npc.inside.pose.x=3.4;npc.inside.pose.z=4.9;npc.inside.pose.yaw=Math.PI;
 const before=npc.inside.pose.z;
 assert.equal(npc.walk(.1,{forward:1}),false); // chair row ahead
 assert.equal(npc.inside.pose.z,before);
 npc.inside.pose.x=0;npc.inside.pose.z=5;npc.inside.pose.yaw=Math.PI;
 assert.equal(npc.walk(.1,{forward:1}),true);
 npc.inside.pose.x=0;npc.inside.pose.z=-5.9;
 assert.equal(npc.walk(.1,{forward:1}),false); // raised theater stage
});
