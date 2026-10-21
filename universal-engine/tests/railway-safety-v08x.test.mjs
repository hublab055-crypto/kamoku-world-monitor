import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gameDaysForRealSeconds,normalizeTimeScale,TIME_SCALES} from "../planet-explorer/game-time.mjs";
import {RailwaySystem,railwayJourney,ticketFare} from "../planet-explorer/railway.mjs";
import {RailwaySecurity,isRailRestricted,keepResidentOffRail,RAIL_BAIL_FINE}
 from "../planet-explorer/railway-security.mjs";
import {trackFenceGeometry} from "../planet-explorer/railway-animated-geometry.mjs";
import {railwayJailGeometry} from "../planet-explorer/railway-geometry.mjs";

const at=(day,hour,minute=0)=>day+(hour*60+minute)/1440;

test("default clock is exact real time and supports slow/fast multipliers",()=>{
 assert.deepEqual(TIME_SCALES,[.25,1,60,600,3600]);
 assert.equal(normalizeTimeScale("1"),1);
 assert.equal(normalizeTimeScale("bad"),1);
 assert.equal(gameDaysForRealSeconds(1,1),1/86400);
 assert.equal(gameDaysForRealSeconds(2,3600),7200/86400);
});

test("ticket purchase and platform validation are required before boarding",()=>{
 const rail=new RailwaySystem();
 assert.equal(rail.balance,Infinity);
 assert.equal(rail.fundsLabel,"∞");
 assert.equal(rail.board("tower",at(0,6,5),"passenger","aurora-out").ok,false);
 const trip=railwayJourney("aurora-out","tower","capital");
 assert.equal(trip.stops,2);assert.ok(trip.distanceKm>3);
 assert.equal(ticketFare("aurora-out","tower","capital"),Math.ceil(trip.distanceKm*8));
 assert.equal(rail.enterConcourse("tower").ok,true);
 const bought=rail.buyTicket("tower","capital","aurora-out",at(0,6));
 assert.equal(bought.ok,true);assert.equal(rail.balance,Infinity);
 assert.equal(rail.board("tower",at(0,6,5),"passenger","aurora-out").ok,false);
 assert.equal(rail.enterPlatform("tower","aurora-out",390).ok,true);
 assert.equal(rail.board("tower",at(0,6,5),"passenger","aurora-out").ok,true);
 const restored=new RailwaySystem(rail.snapshot());
 assert.equal(restored.status(at(0,7)).destination.id,"capital");
 assert.equal(restored.snapshot().schemaVersion,2);
});

test("three recent warnings start pursuit, capture leads to jail, and fine grants bail",()=>{
 const security=new RailwaySecurity(),station={id:"tower",x:0,z:-94};
 assert.equal(isRailRestricted(station.id,station.x,station.z),true);
 const first=security.advance(.1,{stationId:station.id,x:station.x,z:station.z,eligible:true});
 assert.equal(first[0].type,"warning");
 let events=[];
 for(let i=0;i<42;i++)events.push(...security.advance(.1,{stationId:station.id,x:station.x,z:station.z,eligible:true}));
 assert.equal(security.warningCount,2);
 for(let i=0;i<42;i++)events.push(...security.advance(.1,{stationId:station.id,x:station.x,z:station.z,eligible:true}));
 assert.ok(events.some(event=>event.type==="pursuit"));assert.equal(security.wanted,true);
 for(let i=0;i<80&&!security.jailed;i++)events.push(...security.advance(.1,{stationId:station.id,x:station.x,z:station.z,eligible:true}));
 assert.ok(security.jailed);assert.ok(events.some(event=>event.type==="jailed"));
 const rail=new RailwaySystem(),result=security.payFine(amount=>rail.charge(amount));
 assert.equal(result.ok,true);assert.equal(RAIL_BAIL_FINE,120);assert.equal(security.state,"clear");
});

test("residents are moved beyond fenced rail corridor while player access remains detectable",()=>{
 const safe=keepResidentOffRail("tower",0,-94);
 assert.equal(isRailRestricted("tower",safe.x,safe.z),false);
 assert.ok(Math.abs(safe.x)>4);
 const rows=Array.from({length:21},(_,i)=>({x:0,y:0,z:-100+i*10}));
 const fence=trackFenceGeometry(rows,{gateZ:-10});
 assert.ok(fence.indices.length>500);
 assert.equal(fence.positions.length,fence.normals.length);
 assert.ok(railwayJailGeometry().indices.length>300);
});

test("browser wiring includes ticket office, security HUD, real-time default, rotating pins and orbital descent",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",base),"utf8");
 const app=readFileSync(new URL("app.mjs",base),"utf8");
 const render=readFileSync(new URL("render.mjs",base),"utf8");
 const world=readFileSync(new URL("world-scenery.mjs",base),"utf8");
 for(const id of ["railway-buy-ticket","railway-platform","railway-security-hud","railway-bail"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/<option value="1" selected>実時間 ×1<\/option>/);
 assert.match(app,/gameDaysForRealSeconds/);assert.match(app,/new RailwaySecurity/);
 assert.match(app,/visitSettlement\(destinationById\(orbitSelection\.cityId\),\{fromOrbit:true\}\)/);
 assert.match(render,/spinOffsetDeg:0/);assert.match(render,/stationFenceMesh/);
 assert.match(render,/radius\*1\.35/);assert.match(world,/keepResidentOffRail/);
});
