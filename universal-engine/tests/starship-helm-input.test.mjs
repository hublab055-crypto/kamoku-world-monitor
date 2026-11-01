import {test} from "node:test";
import assert from "node:assert/strict";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
import {StarshipEntity} from "../planet-explorer/starship-entity.mjs";
import {installStarshipHelmInput} from "../planet-explorer/starship-helm-input.mjs";

const journey=(data={})=>new ShipJourney({originId:"terra",destinationId:"selene",status:"orbit",seated:true,
 hatchOpen:false,heading:40,autopilot:false,...data});
function fixture(){
 const left=new EventTarget(),right=new EventTarget(),keyboard=new EventTarget(),windowTarget=new EventTarget();
 const state={v:journey({heading:0}),visible:true,editing:false};
 const input=installStarshipHelmInput({left,right,keyboard,windowTarget,get:()=>state.v,
  isVisible:()=>state.visible,isEditing:()=>state.editing});
 return {left,right,keyboard,windowTarget,state,input};
}
function emit(target,type,fields={}){
 const event=new Event(type,{cancelable:true});Object.assign(event,fields);target.dispatchEvent(event);return event;
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);

test("automatic attitude recovery at destination orbit unlocks entry without moving the pad",()=>{
 const v=journey({landingSite:{bodyId:"selene",lat:18,lon:25,yaw:.4,padElevationM:90}});
 const entity=new StarshipEntity();entity.sync({journey:v,days:5});const before=entity.snapshot();
 assert.equal(v.readyToLand,false);assert.equal(v.setAutopilot(true),true);
 for(let i=0;i<30;i++)assert.equal(v.tick(.08).days,0);
 assert.equal(v.status,"orbit");assert.equal(v.progress,0);assert.equal(v.readyToLand,true);
 entity.sync({journey:v,days:5});
 assert.deepEqual(entity.pose.positionM,before.pose.positionM);
 assert.notDeepEqual(entity.pose.axes,before.pose.axes);
 assert.deepEqual(v.landingSite,before.pose.site);
 assert.equal(v.enterAtmosphere().ok,true);
});
test("origin orbit attitude hold runs while walking but never starts a transfer",()=>{
 const v=journey({status:"origin-orbit",autopilot:true,seated:false});
 for(let i=0;i<30;i++)v.tick(.08);
 assert.ok(v.heading<1);assert.equal(v.status,"origin-orbit");
 assert.equal(v.setAutopilot(false),false);assert.equal(v.steer(8),false);
 assert.equal(v.setThrottle(0),false);assert.equal(v.throttle,.72);
});
test("manual orbit keeps heading; helm locks at touchdown and after standing",()=>{
 const v=journey();v.tick(.1);assert.equal(v.heading,40);
 for(const status of ["touchdown","landed"]){
  v.status=status;assert.equal(v.canOperateHelm,false);
  assert.equal(v.steer(-40),false);assert.equal(v.setThrottle(1),false);assert.equal(v.setAutopilot(true),false);
 }
 v.status="cruise";v.stand();assert.equal(v.steer(1),false);
 assert.throws(()=>v.setThrottle(NaN));assert.throws(()=>v.steer(Infinity));
});
test("manual steering takes priority over attitude hold until explicitly enabled again",()=>{
 const v=journey({heading:0,autopilot:true});
 assert.equal(v.steer(8),true);assert.equal(v.autopilot,false);v.tick(.1);near(v.heading,8);
 v.setAutopilot(true);v.tick(.1);assert.ok(v.heading<8);
});
test("save and resume continue the same orbital alignment and manual settings",()=>{
 const v=journey();v.setThrottle(.35);v.setAutopilot(true);v.tick(.08);
 const restored=ShipJourney.fromSnapshot(v.snapshot());
 for(let i=0;i<40;i++){v.tick(.08);restored.tick(.08);}
 assert.deepEqual(restored.snapshot(),v.snapshot());
});
test("held steering is independent of frame subdivision and does not duplicate click",()=>{
 for(const count of [10,20]){
  const f=fixture();emit(f.right,"pointerdown",{pointerId:7,button:0});
  for(let i=0;i<count;i++)f.input.advance(1/count);
  near(f.state.v.heading,30);emit(f.right,"pointerup",{pointerId:7});emit(f.right,"click",{detail:1});
  near(f.state.v.heading,30);f.input.advance(.1);near(f.state.v.heading,30);f.input.destroy();
 }
});
test("quick pointer taps and accessible activation each produce one small turn",()=>{
 const f=fixture();emit(f.left,"pointerdown",{pointerId:1});emit(f.left,"pointerup",{pointerId:1});
 emit(f.left,"click",{detail:1});near(f.state.v.heading,-8);
 emit(f.right,"click",{detail:0});near(f.state.v.heading,0);f.input.destroy();
});
test("pointer cancellation, focus loss and hidden page stop held steering",()=>{
 for(const type of ["pointercancel","lostpointercapture","blur","visibilitychange"]){
  const f=fixture();emit(f.left,"pointerdown",{pointerId:1});
  emit(type==="blur"?f.windowTarget:type==="visibilitychange"?f.keyboard:f.left,type,{pointerId:1});
  f.input.advance(.1);near(f.state.v.heading,0);f.input.destroy();
 }
});
test("opposite directions cancel and repeated input paths do not double speed",()=>{
 const f=fixture();emit(f.left,"pointerdown",{pointerId:1});emit(f.right,"pointerdown",{pointerId:2});
 f.input.advance(.1);near(f.state.v.heading,0);
 emit(f.left,"pointerup",{pointerId:1});emit(f.keyboard,"keydown",{key:"l"});
 f.input.advance(.1);near(f.state.v.heading,3);
 emit(f.right,"pointerup",{pointerId:2});emit(f.keyboard,"keyup",{key:"l"});
 f.input.advance(.1);near(f.state.v.heading,3);f.input.destroy();
});
test("seat exit, journey replacement, editing and hidden UI invalidate held input",()=>{
 for(const change of [f=>f.state.v.stand(),f=>{f.state.v=journey({heading:0});},
  f=>{f.state.editing=true;},f=>{f.state.visible=false;}]){
  const f=fixture();emit(f.right,"pointerdown",{pointerId:1});change(f);f.input.advance(.1);
  emit(f.right,"pointerup",{pointerId:1});near(f.state.v.heading,0);f.input.destroy();
 }
});
test("J/L respects text entry, modifiers, legacy journeys and teardown",()=>{
 const f=fixture();f.state.editing=true;emit(f.keyboard,"keydown",{key:"j"});f.state.editing=false;
 emit(f.keyboard,"keydown",{key:"j",ctrlKey:true});f.input.advance(.1);near(f.state.v.heading,0);
 emit(f.keyboard,"keydown",{key:"j"});f.input.advance(.1);near(f.state.v.heading,-3);
 f.input.destroy();emit(f.right,"click",{detail:0});near(f.state.v.heading,-3);
 const g=fixture();g.state.v.kind="legacy";emit(g.right,"pointerdown",{pointerId:1});g.input.advance(.1);
 near(g.state.v.heading,0);g.input.destroy();
});
