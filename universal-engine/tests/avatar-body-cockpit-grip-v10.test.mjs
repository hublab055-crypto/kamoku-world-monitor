import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAvatarV10,normalizeAvatarRoster,AVATAR_V10_OUTFITS} from "../planet-explorer/avatar-v10.mjs";
import {BODY_KEYS,AVATAR_V10_BODY,shaderBodyParams,shaderSwimParams,isBodySurface} from "../planet-explorer/avatar-v10-body.mjs";
import {COCKPIT_LEVER,COCKPIT_STICK} from "../planet-explorer/ship-control-hit.mjs";
import {beginCockpitGrip,endCockpitGrip,updateCockpitGrip,canGrabCockpitControl} from "../planet-explorer/ship-cockpit-grip.mjs";

const stage=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function pose(x,y,z){return [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];}
function vessel(){return {active:true,seated:true,throttle:.2,autopilot:true,yaw:0,pitchDeg:0,
 setThrottle(v){this.throttle=v;},setAutopilot(v){this.autopilot=v;},
 steer(v){this.yaw+=v;},pitch(v){this.pitchDeg+=v;}};}
test("V10 full-body fields normalize to saved canonical ranges",()=>{
 const fit=normalizeAvatarV10("player",{model:"ren",outfit:"swim",
  body:{height:300,shoulders:-240,waist:23.8},
  swim:{style:"twopiece",color:"coral"}});
 assert.equal(BODY_KEYS.length,9);
 assert.equal(AVATAR_V10_BODY.length,2);
 assert.equal(fit.body.height,100);
 assert.equal(fit.body.shoulders,-100);
 assert.equal(fit.body.waist,24);
 assert.equal(fit.swim.style,"twopiece");
 assert.equal(fit.swim.color,"coral");
 assert.equal(shaderSwimParams(fit).style,2);
 assert.equal(shaderBodyParams(fit.body)[0],1);
});
test("All six adult V10 models support base and swim wardrobe without casual substitution",()=>{
 for(const model of ["lyra","mina","sera","ren","noah","elio"]){
  for(const outfit of ["swim","base"]){
   const fit=normalizeAvatarV10("player",{model,outfit});
   assert.equal(fit.model,model);assert.equal(fit.outfit,outfit);
  }
 }
 assert.equal(Object.hasOwn(AVATAR_V10_OUTFITS,"swim"),true);
 assert.equal(isBodySurface("Torso and skin",null),true);
 assert.equal(isBodySurface("Face and skull",null),false);
 assert.equal(isBodySurface("Fabric uniform",["work"]),false);
 assert.equal(isBodySurface("Upper torso",["base"]),true);
});
test("Swim settings are sanitized and persist through roster normalization",()=>{
 const roster=normalizeAvatarRoster({player:{model:"lyra",outfit:"swim",body:{hips:-50},
  swim:{style:"trunks",color:"teal"}}});
 assert.equal(roster.player.body.hips,-50);
 assert.equal(roster.player.swim.style,"trunks");
 assert.equal(roster.player.swim.color,"teal");
 assert.equal(normalizeAvatarV10("player",{swim:{style:"javascript:invalid",color:"bad"}}).swim.style,"original");
});
test("VR right-hand yoke grip activates only inside seated cockpit reach",()=>{
 const v=vessel(),near=pose(...COCKPIT_STICK),far=pose(4,1.1,-12);
 assert.equal(canGrabCockpitControl({voyage:v,hand:"right",grip:near,stage}),true);
 assert.equal(canGrabCockpitControl({voyage:v,hand:"right",grip:far,stage}),false);
 v.seated=false;
 assert.equal(canGrabCockpitControl({voyage:v,hand:"right",grip:near,stage}),false);
});
test("VR right hand steers/pitches, left lever changes throttle and releasing ends motion",()=>{
 const v=vessel();
 let held=beginCockpitGrip({},{voyage:v,hand:"right",grip:pose(...COCKPIT_STICK),stage});
 held=beginCockpitGrip(held,{voyage:v,hand:"left",grip:pose(...COCKPIT_LEVER),stage});
 assert.equal(Object.keys(held).length,2);
 let result=updateCockpitGrip(held,{voyage:v,poses:{
  right:pose(COCKPIT_STICK[0]+.13,COCKPIT_STICK[1],COCKPIT_STICK[2]+.10),
  left:pose(COCKPIT_LEVER[0],COCKPIT_LEVER[1],COCKPIT_LEVER[2]-.18)
 },dt:.1});
 assert.ok(v.yaw>0);assert.ok(v.pitchDeg>0);
 assert.ok(v.throttle>.2);assert.equal(v.autopilot,false);
 const yaw=v.yaw;held=endCockpitGrip(result.held,"right");
 result=updateCockpitGrip(held,{voyage:v,poses:{left:pose(...COCKPIT_LEVER)},dt:.1});
 assert.equal(v.yaw,yaw);
 assert.equal(result.deflection.yaw,0);
});
test("Tracking loss releases hand grips without ghost input",()=>{
 const v=vessel(),held=beginCockpitGrip({},{voyage:v,hand:"right",grip:pose(...COCKPIT_STICK),stage});
 const result=updateCockpitGrip(held,{voyage:v,poses:{right:null},dt:.2});
 assert.equal(Object.keys(result.held).length,0);
 assert.equal(result.deflection.yaw,0);
 assert.equal(v.yaw,0);
});
