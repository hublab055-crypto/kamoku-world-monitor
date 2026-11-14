import test from "node:test";
import assert from "node:assert/strict";
import {snapHologramLever,hologramTelemetry} from "./ship-cockpit-hologram.mjs";

test("main throttle and VOL snap to zero and mechanical end stops",()=>{
 assert.equal(snapHologramLever(3),0);
 assert.equal(snapHologramLever(-4),0);
 assert.equal(snapHologramLever(97),100);
 assert.equal(snapHologramLever(125),125);
 assert.equal(snapHologramLever(120),125);
 assert.equal(snapHologramLever(-98),-100);
 assert.equal(snapHologramLever(-99,{vol:true}),-100);
 assert.equal(snapHologramLever(99,{vol:true}),100);
 assert.equal(snapHologramLever(125,{vol:true}),100);
 assert.equal(snapHologramLever(0.2,{vol:true}),0);
 assert.equal(snapHologramLever(Number.NaN),0);
 assert.equal(snapHologramLever(Infinity,{vol:true}),0);
 assert.equal(snapHologramLever(42),42);
});

test("atmosphere gauges show speed, altitude, gravity and fuel",()=>{
 const t=hologramTelemetry({status:"atmosphere",airSpeed:123.45,airAltitude:1234,gravityMps2:9.80665,fuel:74.8,gearMode:"auto",gearDown:false});
 assert.equal(t.speed,"123.5 m/s");
 assert.equal(t.altitude,"1,234 m");
 assert.equal(t.gravity,"9.81 m/s²");
 assert.equal(t.fuel,"75%");
 assert.equal(t.gear,"AUTO / UP");
});
test("landed altitude is zero and cruise route speed uses normalized units",()=>{
 assert.equal(hologramTelemetry({status:"landed",airAltitude:700,gravityMps2:10,gearDown:true}).altitude,"0 m");
 const t=hologramTelemetry({status:"cruise",routeVelocity:{along:.05,cross:0},verticalVelocity:0,fuel:40});
 assert.equal(t.speedLabel,"航路速度");
 assert.equal(t.speed,"5.00 %/s");
 assert.equal(t.altitude,"—");
 assert.equal(t.gravity,"—");
});
