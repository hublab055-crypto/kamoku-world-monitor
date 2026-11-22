import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RailwaySystem,RAIL_SEGMENTS,RAIL_STATIONS,RAIL_SERVICES,RAILWAY_CYCLE_MINUTES,
 RAILWAY_LOOP_KM,formatClock,nextDepartures,routeSummary,trainState} from "../planet-explorer/railway.mjs";
import {railwayStationGeometry,steamTrainGeometry,trainInteriorGeometry} from "../planet-explorer/railway-geometry.mjs";
import {installRailwayUI} from "../planet-explorer/railway-ui.mjs";

const at=(day,hour,minute=0)=>day+(hour*60+minute)/1440;

test("four-station route is a deterministic seven-kilometre daily loop",()=>{
 assert.equal(RAIL_STATIONS.length,4);assert.equal(RAIL_SERVICES.length,2);
 assert.equal(new Set(RAIL_STATIONS.map(station=>station.id)).size,4);
 assert.equal(RAILWAY_CYCLE_MINUTES,480);
 assert.equal(RAILWAY_LOOP_KM,7);
 assert.ok(Math.abs(RAIL_SEGMENTS.reduce((sum,segment)=>sum+segment.distanceKm,0)-7)<1e-9);
 assert.match(routeSummary(),/ルミナス.*フロウベル.*アルディナス.*セレノート.*ルミナス/);
});

test("timetable is sorted, repeats each day, and wraps through midnight",()=>{
 const morning=nextDepartures("tower",at(0,5,45),4);
 assert.deepEqual(morning.map(row=>row.time),["06:30","10:30","14:30","18:30"]);
 assert.ok(morning.every((row,index)=>!index||row.departureMinute>=morning[index-1].departureMinute));
 const tomorrow=nextDepartures("tower",at(1,5,45),1)[0];
 assert.equal(tomorrow.departureMinute-morning[0].departureMinute,1440);
 const overnight=nextDepartures("tower",at(0,23,50),1)[0];
 assert.equal(overnight.time,"02:30");
 assert.equal(formatClock(overnight.departureMinute,{withDay:true}),"第2日 02:30");
});

test("live board reports stops, segment progress, next station and ETA",()=>{
 const departing=trainState("aurora-out",at(0,6,5));
 assert.equal(departing.mode,"stopped");assert.equal(departing.stationId,"tower");
 assert.equal(departing.nextStationId,"meadow");assert.equal(formatClock(departing.departureMinute),"06:30");
 const travelling=trainState("aurora-out",at(0,7,0));
 assert.equal(travelling.mode,"travel");assert.equal(travelling.fromStationId,"tower");
 assert.equal(travelling.nextStationId,"meadow");assert.ok(travelling.progress>.35&&travelling.progress<.38);
 assert.equal(formatClock(travelling.nextArrivalMinute),"07:52");
 const arrived=trainState("aurora-out",at(0,7,53));
 assert.equal(arrived.mode,"stopped");assert.equal(arrived.stationId,"meadow");
});

test("boarding is stop-gated, arrival survives a skipped frame, and alighting is station-gated",()=>{
 const railway=new RailwaySystem();
 assert.equal(railway.enterConcourse("tower").ok,true);
 assert.equal(railway.buyTicket("tower","meadow","aurora-out",at(0,6,0)).ok,true);
 assert.equal(railway.enterPlatform("tower","aurora-out").ok,true);
 assert.equal(railway.board("tower",at(0,6,31),"passenger","aurora-out").ok,false);
 assert.equal(railway.enterPlatform("tower","aurora-out").ok,true);
 const boarded=railway.board("tower",at(0,6,5),"passenger","aurora-out");
 assert.equal(boarded.ok,true);assert.equal(railway.status(at(0,7,0)).carriage,"passenger");
 assert.equal(railway.alight(at(0,7,0)).ok,false);
 const events=railway.advance(at(0,8,20));
 assert.equal(events.length,1);assert.equal(events[0].type,"arrival");
 assert.equal(events[0].stationId,"meadow");assert.equal(formatClock(events[0].minute),"07:52");
 const alighted=railway.alight(at(0,7,53));
 assert.equal(alighted.ok,true);assert.equal(alighted.stationId,"meadow");
});

test("onboard service and chosen carriage survive save and restore",()=>{
 const railway=new RailwaySystem();
 assert.equal(railway.enterConcourse("tower").ok,true);
 assert.equal(railway.buyTicket("tower","capital","aurora-out",at(0,6,0)).ok,true);
 assert.equal(railway.enterPlatform("tower","aurora-out").ok,true);
 assert.equal(railway.board("tower",at(0,6,5),"freight","aurora-out").ok,true);
 const restored=new RailwaySystem(railway.snapshot());
 assert.equal(restored.status(at(0,7,0)).carriage,"freight");
 assert.deepEqual(restored.advance(at(0,7,0)),[]);
 const event=restored.advance(at(0,7,53))[0];
 assert.equal(event.stationId,"meadow");
});

test("station, full steam consist, and all four interiors are indexed 3D meshes",()=>{
 const meshes=[railwayStationGeometry(),steamTrainGeometry(),
  ...["locomotive","tender","passenger","freight"].map(trainInteriorGeometry)];
 for(const mesh of meshes){
  assert.ok(mesh.indices.length>900);
  assert.equal(mesh.positions.length,mesh.normals.length);
  assert.equal(mesh.positions.length,mesh.colors.length);
  assert.ok(Math.max(...mesh.indices)<65536);
 }
 assert.ok(steamTrainGeometry().indices.length>railwayStationGeometry().indices.length);
});

test("browser wiring exposes timetable, waiting, carriage selection and onboard ETA",()=>{
 assert.equal(typeof installRailwayUI,"function");
 const base=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",base),"utf8");
 const app=readFileSync(new URL("app.mjs",base),"utf8");
 const render=readFileSync(new URL("render.mjs",base),"utf8");
 const css=readFileSync(new URL("style.css",base),"utf8");
 for(const id of ["viewport-railway","railway-panel","railway-clock","railway-live-status",
  "railway-timetable-body","railway-carriage","railway-board","railway-alight",
  "railway-onboard-hud","railway-onboard-detail","railway-onboard-progress",
  "railway-destination","railway-buy-ticket","railway-platform","railway-funds"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/railwayUI=installRailwayUI/);assert.match(app,/v0_8t:railway\.snapshot\(\)/);
 assert.match(app,/handleRailwayArrival/);assert.match(render,/steamTrainGeometry/);
 assert.match(render,/renderTrainInterior/);assert.match(css,/\.railway-timetable/);
 assert.match(html,/app\.mjs\?v=0\.9[a-z][\w-]*/);
});
