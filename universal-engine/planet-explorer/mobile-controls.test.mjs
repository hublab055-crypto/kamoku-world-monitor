import test from "node:test";
import assert from "node:assert/strict";
import {defaultMobileConfig,normalizeMobileConfig,resolveMobileFacing} from "./mobile-controls.mjs";

test("4 button profiles and default-hidden legacy HUD",()=>{
 const defaults=defaultMobileConfig();
 assert.equal(defaults.profiles.walk.length,4);
 assert.equal(defaults.profiles.rts.length,4);
 assert.equal(defaults.profiles.walk[0].tap,"interact");
 assert.ok(Object.values(defaults.layers).every(value=>value===false));
});
test("invalid saved actions and optional layers are sanitized",()=>{
 const restored=normalizeMobileConfig({version:1,profiles:{walk:[
  {tap:"attack",hold:"__proto__"},{tap:"unknown",hold:"map"}]},layers:{decks:true,legacy:"true"}});
 assert.equal(restored.profiles.walk[0].tap,"attack");
 assert.equal(restored.profiles.walk[0].hold,"talk");
 assert.equal(restored.profiles.walk[1].tap,"attack");
 assert.equal(restored.profiles.walk[1].hold,"map");
 assert.equal(restored.layers.decks,true);
 assert.equal(restored.layers.legacy,false);
});
test("stick points to north, east, west and diagonals",()=>{
 const up=resolveMobileFacing({x:0,y:-1},0,0,.1);
 assert.ok(up.forward>.99);
 const right=resolveMobileFacing({x:1,y:0},Math.PI/2,0,.016);
 assert.ok(right.forward>.99);
 const left=resolveMobileFacing({x:-1,y:0},-Math.PI/2,0,.016);
 assert.ok(left.forward>.99);
 const diagonal=resolveMobileFacing({x:1,y:-1},Math.PI/4,0,.016);
 assert.ok(diagonal.forward>.99);
});
test("movement remains in desired direction while turning, with deadzone",()=>{
 const r=resolveMobileFacing({x:1,y:0},0,0,.02);
 assert.ok(r.turn>0&&r.turn<Math.PI/2);
 assert.ok(Math.abs(r.forward*Math.sin(r.turn)+r.strafe*Math.cos(r.turn)-1)<1e-10);
 assert.equal(resolveMobileFacing({x:.01,y:.02},0,0,.1).active,false);
});
test("yaw wrapping takes the shortest turn",()=>{
 const r=resolveMobileFacing({x:0,y:-1},Math.PI-.05,-Math.PI+.05,.016);
 assert.ok(r.turn>0&&r.turn<.2);
});

test("previous default cockpit binding migrates to fire and drop without overwriting custom slots",()=>{
 const old={version:1,profiles:{
  shipCockpit:[{tap:"launchLand",hold:"landingGear"},{tap:"autopilot",hold:"attitudeMode"},
   {tap:"navigation",hold:"transfer"},{tap:"stand",hold:"saveVoyage"}]}};
 const migrated=normalizeMobileConfig(old);
 assert.equal(migrated.profiles.shipCockpit[2].hold,"fireWeapon");
 assert.equal(migrated.profiles.shipCockpit[3].hold,"cargoDrop");
 old.profiles.shipCockpit[2].hold="throttleUp";
 const preserved=normalizeMobileConfig(old);
 assert.equal(preserved.profiles.shipCockpit[2].hold,"throttleUp");
 assert.equal(preserved.profiles.shipCockpit[3].hold,"saveVoyage");
});
