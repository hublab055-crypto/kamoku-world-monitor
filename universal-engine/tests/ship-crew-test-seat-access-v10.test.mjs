import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ShipInterior,PILOT_ACCESS_Z,PILOT_SEAT_Z} from "../planet-explorer/ship-interior.mjs";

const source=path=>readFileSync(new URL("../planet-explorer/"+path,import.meta.url),"utf8");
test("Crew-test spawn starts within reach of helm, and sitting snaps to the correct chair",()=>{
 const interior=new ShipInterior({x:-1.32,z:-9.85,yaw:-Math.PI/4});
 assert.equal(interior.nearHelm,true);
 assert.equal(interior.seated,false);
 const seated=interior.sit();
 assert.equal(seated.ok,true);
 assert.equal(interior.x,0);
 assert.equal(interior.z,PILOT_SEAT_Z);
 assert.equal(interior.seated,true);
 const stood=interior.stand();
 assert.equal(stood.ok,true);
 assert.equal(interior.z,PILOT_ACCESS_Z);
 assert.equal(interior.seated,false);
});
test("Ship crew test does not suppress interaction UI, and F and phone control seating",()=>{
 const app=source("app.mjs");
 assert.ok(app.includes("shipInteractionUI=installShipInteractionUI({get:()=>voyage,"));
 assert.ok(!app.includes("shipInteractionUI=installShipInteractionUI({get:()=>crewTestState?null:voyage,"));
 assert.ok(app.includes('if(k==="f"){'));
 assert.ok(app.includes('voyage.seated?shipStand():voyage.isNearSeat()?shipSit()'));
 assert.ok(app.includes('if(crewTestState)return {ship:true,vr:Boolean(xrUI?.active),actions:['));
 assert.ok(app.includes('label:voyage.seated?"🚶 起立":"🪑 着席"'));
});
test("Proximity seat button is mounted on game canvas and can be used independently of HUD",()=>{
 const ui=source("ship-interaction-ui.mjs");
 assert.ok(ui.includes('seatQuick.id="ship-seat-quick"'));
 assert.ok(ui.includes('canvasHost.append(seatQuick)'));
 assert.ok(ui.includes('seatQuick.addEventListener("click"'));
 assert.ok(ui.includes('seatQuick.hidden=!show||(!v.seated&&!v.isNearSeat())'));
});
test("Avatar editor links to original user's modifier, without claiming unsupported sync",()=>{
 const ui=source("avatar-v10-ui.mjs");
 assert.ok(ui.includes("https://universal-engine-avatar-review.papatomfoundation.chatgpt.site"));
 assert.ok(ui.includes("まだ自動同期されません"));
});
