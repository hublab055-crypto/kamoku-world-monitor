import test from "node:test";
import assert from "node:assert/strict";
import {MRAvatarPresence,MR_AVATAR_IDS,MR_AVATAR_SOURCE_IDS} from "./mr-avatar-presence.mjs";
import {MRRoomLayout,mrDetectedSurfaces,mrNearPortal,mrPortalRayHit} from "./mr-room-layout.mjs";
const head=[1,0,0,0,0,1,0,0,0,0,1,0,0,1.65,0,1];
test("MR has eight independent slots with four reuse-safe V10 appearances",()=>{
 const world=new MRAvatarPresence();
 assert.equal(MR_AVATAR_IDS.length,8);
 assert.equal(MR_AVATAR_SOURCE_IDS.guest4,"player");
 for(const id of MR_AVATAR_IDS)assert.equal(world.place(id,head).ok,true,id);
 assert.equal(world.actors.length,8);
 assert.equal(new Set(world.actors.map(a=>a.id)).size,8);
 assert.equal(world.place("guest4",head).ok,true);
 assert.equal(world.place("unknown",head).ok,false);
});
test("room local/world mapping roundtrips through changing visual-anchor yaw",()=>{
 const room=new MRRoomLayout({version:1,width:8,depth:8});
 room.setOrigin(5,-4,.63);
 const p=room.world({x:.82,z:-1.25,yaw:.1});
 const q=room.local(p);
 assert.ok(Math.abs(q.x-.82)<1e-8);
 assert.ok(Math.abs(q.z+1.25)<1e-8);
 assert.ok(Math.abs(q.yaw-.1)<1e-8);
});
test("manual furniture survives serialization but tracking origin does not",()=>{
 const room=new MRRoomLayout();
 room.setOrigin(0,0);
 room.add("chair",{x:.2,z:-2},{width:.7,depth:.7,seatY:.46});
 room.setPortal({x:0,z:2,yaw:0});
 room.anchorHandle="sample-persistent-anchor";
 const copy=new MRRoomLayout(room.snapshot());
 assert.equal(copy.ready,false);
 assert.equal(copy.anchorHandle,"sample-persistent-anchor");
 copy.setOrigin(0,0);
 assert.equal(copy.seatWorld().length,1);
 assert.ok(copy.worldPortal());
});
test("registered wall and table keep wandering avatar away from obstacles and room edge",()=>{
 const room=new MRRoomLayout({version:1,width:8,depth:8});
 room.setOrigin(0,0);
 room.add("table",{x:.3,z:-1.05},{width:1.1,depth:.7});
 const world=new MRAvatarPresence();
 world.place("companion",head);
 assert.equal(world.action("companion","wander",{room}).ok,true);
 for(let i=0;i<800;i++){
  world.tick(head,.05,room);
  const a=world.get("companion");
  assert.equal(room.free(a.x,a.z,.30),true,"avatar overlaps room obstacle or wall");
 }
});
test("seat action requires registered seating then walks to a real seat marker",()=>{
 const room=new MRRoomLayout({version:1,width:7,depth:7});
 room.setOrigin(0,0);
 const w=new MRAvatarPresence();
 w.place("navigator",head);
 assert.equal(w.action("navigator","sit",{room}).ok,false);
 room.add("chair",{x:0,z:-2.6},{width:.6,depth:.6,seatY:.48});
 assert.equal(w.action("navigator","sit",{room}).ok,true);
 for(let i=0;i<100;i++)w.tick(head,.05,room);
 assert.equal(w.get("navigator").motion,"Seated");
 assert.equal(w.action("navigator","stand",{room}).ok,true);
 assert.equal(w.get("navigator").motion,"idle");
});
test("plane metadata can register wall and tabletop without claiming all horizontal faces are chairs",()=>{
 const make=(orientation,y)=>({orientation,planeSpace:{orientation,y},
  polygon:[{x:-.6,z:-.4},{x:.6,z:-.4},{x:.6,z:.4},{x:-.6,z:.4}]});
 const planes=[make("vertical",1),make("horizontal",.7),make("horizontal",0)];
 const surfaces=mrDetectedSurfaces({detectedPlanes:planes,
  getPose(space){return {transform:{matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,space.y,-1,1]}};}},{});
 assert.equal(surfaces.length,2);
 assert.equal(surfaces[0].type,"wall");
 assert.equal(surfaces[1].type,"table");
});
test("portal proximity asks for a gesture but does not switch XR itself",()=>{
 assert.equal(mrNearPortal(head,{x:0,z:.3}),true);
 assert.equal(mrNearPortal(head,{x:4,z:3}),false);
 const w=new MRAvatarPresence();
 w.place("engineer",head);
 assert.equal(w.action("engineer","invite").ok,true);
 assert.equal(w.get("engineer").invited,true);
});

test("right trigger ray intersects a nearby portal",()=>{
 const ray=[1,0,0,0,0,1,0,0,0,0,1,0,0,1.12,2,1];
 assert.equal(mrPortalRayHit(ray,{x:0,y:0,z:0}),true);
 assert.equal(mrPortalRayHit(ray,{x:2,y:0,z:0}),false);
 assert.equal(mrPortalRayHit(null,{x:0,y:0,z:0}),false);
});
