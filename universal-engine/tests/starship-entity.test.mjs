import test from "node:test";
import assert from "node:assert/strict";
import {StarshipEntity,journeyLift,FLIGHT_MODEL_HEIGHT_M,needsStarshipArrival} from "../planet-explorer/starship-entity.mjs";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
import {SurfaceStarship} from "../planet-explorer/surface-starship.mjs";
import {createCelestialPlanet,bodyById,STAR,orbitalPosition,AU_M} from "../planet-explorer/solar-system.mjs";
import {rigidFrame,toParent} from "../planet-explorer/reference-frames.mjs";
import {CABIN_FLOOR_M} from "../planet-explorer/starship-layout.mjs";
const near=(a,b,e=.001)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b} within ${e}`);
const vector=(a,b,e=.001)=>a.forEach((v,i)=>near(v,b[i],e));
const copy=v=>JSON.parse(JSON.stringify(v));
const launch={bodyId:"terra",lat:28,lon:42,yaw:.4,padElevationM:410};
const landing={bodyId:"selene",lat:22,lon:-75,yaw:-.7,padElevationM:320};
function journey(){return new ShipJourney({originId:"terra",destinationId:"selene",launchSite:launch,
 landingSite:landing,launchDay:.24,flightDays:1,status:"docked",hatchOpen:false,seated:true});}
const sync=(e,v)=>e.sync({journey:v,planet:createCelestialPlanet("terra",.24),
 arrivalPlanet:createCelestialPlanet("selene",.24),days:.24+v.progress*v.flightDays});
const matching=(a,b)=>{vector(a.stellarPositionM,b.stellarPositionM);a.stellarAxes.forEach((v,i)=>vector(v,b.stellarAxes[i],1e-9));};

test("one entity keeps its identity from parked craft through flight and back to a parked craft",()=>{
 const e=new StarshipEntity(),v=journey(),s=new SurfaceStarship();
 s.place("terra",launch.lat,launch.lon,launch.yaw,launch.padElevationM);
 const parked=e.sync({surfaceShip:s,planet:createCelestialPlanet("terra",.24),days:.24});
 matching(parked,sync(e,v));const id=e.id;
 v.status="ascent";v.stageProgress=.6;sync(e,v);assert.equal(e.id,id);
 v.status="landed";v.progress=1;
 const landed=sync(e,v);s.landedOn("selene",landing.lat,landing.lon,landing.yaw,landing.padElevationM);
 matching(landed,e.sync({surfaceShip:s,planet:createCelestialPlanet("selene",1.24),days:1.24}));
 assert.equal(e.id,id);
});
test("all adjacent phase endpoints have the same stellar position and orientation",()=>{
 const e=new StarshipEntity(),v=journey();v.heading=8;
 const phases=[
  [{status:"docked",stageProgress:0},{status:"ascent",stageProgress:0}],
  [{status:"ascent",stageProgress:1},{status:"origin-orbit",stageProgress:0}],
  [{status:"origin-orbit",progress:0},{status:"cruise",progress:0}],
  [{status:"approach",progress:1},{status:"orbit",progress:1}],
  [{status:"orbit",stageProgress:0},{status:"entry",stageProgress:0}],
  [{status:"entry",stageProgress:1},{status:"touchdown",stageProgress:1}],
  [{status:"touchdown",stageProgress:1},{status:"landed",stageProgress:1}]
 ];
 for(const [a,b] of phases){Object.assign(v,a);const before=copy(sync(e,v));Object.assign(v,b);matching(before,sync(e,v));}
});
test("model altitude is monotonic and has zero endpoint slope",()=>{
 const h=FLIGHT_MODEL_HEIGHT_M;
 let last=-1;
 for(let i=0;i<=100;i++){
  const a=journeyLift({status:"ascent",stageProgress:i/100});assert.ok(a>=last);last=a;
  near(a+journeyLift({status:"entry",stageProgress:i/100}),h);
 }
 near(journeyLift({status:"ascent",stageProgress:1e-4})/1e-4,0,.01);
 near((h-journeyLift({status:"ascent",stageProgress:1-1e-4}))/1e-4,0,.01);
});
test("terrain-to-cabin matrix shares the pad and floor instead of translating a separate world",()=>{
 const e=new StarshipEntity(),v=journey();sync(e,v);
 const m=e.groundToCabinMatrix(launch,"terra");
 const transform=p=>[0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);
 vector(transform([0,launch.padElevationM,0]),[0,-CABIN_FLOOR_M,0]);
 v.status="ascent";v.stageProgress=.5;sync(e,v);
 const moved=e.groundToCabinMatrix(launch,"terra");
 near(moved[13]-m[13],-FLIGHT_MODEL_HEIGHT_M*.5);
 assert.equal(e.groundToCabinMatrix(landing,"selene"),null);
});
test("manual heading rotates outside terrain while the cabin remains in ship-local coordinates",()=>{
 const e=new StarshipEntity(),v=journey();v.status="origin-orbit";v.heading=0;
 const first=copy(sync(e,v));v.heading=20;const turned=sync(e,v);
 vector(first.positionM,turned.positionM);assert.notDeepEqual(first.axes,turned.axes);
 const frame=e.cabinFrame();rigidFrame(frame);
 const x=toParent(frame,[0,1.25,-10]).position;
 assert.ok(x.every(Number.isFinite));
});
test("every flight phase survives a checkpoint without losing pad elevation or position",()=>{
 const e=new StarshipEntity(),v=journey();
 for(const status of ["docked","ascent","origin-orbit","cruise","approach","orbit","entry","touchdown","landed"]){
  Object.assign(v,{status,stageProgress:.45,progress:.4});const pose=copy(sync(e,v));
  const snapshot=e.snapshot(),restored=StarshipEntity.fromSnapshot(copy(snapshot));
  assert.deepEqual(restored.snapshot(),snapshot);
  const loaded=ShipJourney.fromSnapshot(copy(v.snapshot()));
  near(loaded.launchSite.padElevationM,launch.padElevationM);
  matching(pose,sync(restored,loaded));
 }
});
test("old saves derive a marked pose once; unsupported coordinate models fail instead of resetting",()=>{
 const e=StarshipEntity.fromSnapshot(null),v=new ShipJourney({originId:"terra",status:"ascent",stageProgress:.3});
 assert.equal(sync(e,v).legacyDerived,true);
 assert.equal(StarshipEntity.fromSnapshot(e.snapshot()).id,e.id);
 assert.throws(()=>StarshipEntity.fromSnapshot({...e.snapshot(),motionModelVersion:99}),/Unsupported/);
 assert.throws(()=>StarshipEntity.fromSnapshot({...e.snapshot(),pose:{...e.pose,positionM:[NaN,0,0]}}));
 assert.throws(()=>StarshipEntity.fromSnapshot({...e.snapshot(),pose:{...e.pose,axes:undefined}}));
});
test("camera-relative celestial directions retain angular size and observer offset",()=>{
 const e=new StarshipEntity(),v=journey();v.status="origin-orbit";sync(e,v);
 const body=bodyById("terra"),eye=[.4,1.25,-10],view=e.celestialView(body,eye);
 assert.ok(view.distanceM>body.radiusM);
 near(view.radiusM/Math.hypot(...view.position.map((n,i)=>n-eye[i])),body.radiusM/view.distanceM,1e-12);
 assert.ok(view.position.every(Number.isFinite));assert.ok(view.distanceM>6e6);
 const sun=e.celestialView(STAR,eye);assert.ok(sun.distanceM>1e11&&sun.radiusM<500);
 assert.equal(e.celestialView({id:"belt",radiusM:0}),null);
});
test("parametric routes retain orthonormal axes and remain outside both endpoint bodies in sampled journeys",()=>{
 const e=new StarshipEntity(),v=journey();
 for(const id of ["selene","cinder","nix"]){
  v.destinationId=id;v.landingSite={...landing,bodyId:id};v.status="cruise";
  for(let i=0;i<=100;i++){
   v.progress=i/100;const pose=sync(e,v);rigidFrame({id:"validated",origin:pose.positionM,axes:pose.axes});
   for(const bodyId of ["terra",id]){
    const body=bodyById(bodyId),at=orbitalPosition(bodyId,pose.epochDays);
    const distance=Math.hypot(...pose.stellarPositionM.map((n,k)=>n-[at.x,at.y,at.z][k]*AU_M));
    assert.ok(distance>body.radiusM,`${bodyId} route p=${v.progress}`);
   }
  }
 }
});
test("arrival is committed exactly when a landed journey still belongs to its source world",()=>{
 const v=journey();v.status="touchdown";
 assert.equal(needsStarshipArrival(v,"terra"),false);
 v.status="landed";assert.equal(needsStarshipArrival(v,"terra"),true);
 assert.equal(needsStarshipArrival(ShipJourney.fromSnapshot(v.snapshot()),"terra"),true,"saved handoff resumes");
 assert.equal(needsStarshipArrival(v,"selene"),false,"already committed arrival is not repeated");
});
test("selecting a route can pin its landing pad before cruise and changing the destination clears it",()=>{
 const v=journey();v.status="origin-orbit";
 assert.equal(v.chooseDestination("selene",1).ok,true);assert.equal(v.landingSite,null);
 assert.equal(v.setLandingSite(landing),true);
 assert.equal(v.startTransfer().ok,true);assert.equal(v.setLandingSite({...landing,lat:0}),false);
 v.status="origin-orbit";assert.equal(v.chooseDestination("cinder",2).ok,true);
 assert.equal(v.landingSite,null);
});
