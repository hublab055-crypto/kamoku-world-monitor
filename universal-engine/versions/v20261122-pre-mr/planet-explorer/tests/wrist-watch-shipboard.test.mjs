import test from "node:test";
import assert from "node:assert/strict";
import {ShipboardWorld} from "../shipboard.mjs";

test("clock freeze allows shipboard player walk without advancing crew or world time",()=>{
 const ship=new ShipboardWorld();
 ship.init("ship-1",["scout"]);
 const before=ship.player.z,crew=ship.crew[0],old={x:crew.x,z:crew.z};
 ship.advance(.05,{forward:1},{worldDt:0});
 assert.notEqual(ship.player.z,before);
 assert.equal(ship.elapsed,0);
 assert.deepEqual({x:crew.x,z:crew.z},old);
 ship.advance(.05,{forward:0},{worldDt:.1});
 assert.equal(ship.elapsed,.1);
});
