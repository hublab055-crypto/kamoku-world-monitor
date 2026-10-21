import test from "node:test";
import assert from "node:assert/strict";
import {OwnerWorld,OWNER_BUILDING_KINDS} from "../planet-explorer/owner-world.mjs";
const a={lat:28,lon:42},b={lat:28.0005,lon:42.0005};
test("owner edits include homes, public buildings and station",()=>{
 for(const kind of ["house","inn","school","station","watchtower","barn","market","warehouse"])
  assert.ok(OWNER_BUILDING_KINDS.includes(kind));
 const w=new OwnerWorld();
 const placed=w.place("house",a);assert.equal(placed.ok,true);
 assert.equal(w.place("house",a).ok,false);
 assert.equal(w.rotate(placed.id).ok,true);
 assert.ok(w.buildings[0].rotation>0);
 assert.equal(w.move(placed.id,b).ok,true);
 assert.deepEqual({lat:w.buildings[0].lat,lon:w.buildings[0].lon},b);
 assert.equal(w.undo().ok,true);assert.deepEqual({lat:w.buildings[0].lat,lon:w.buildings[0].lon},a);
 assert.equal(w.redo().ok,true);assert.equal(w.buildings[0].lat,b.lat);
 assert.equal(w.remove(placed.id).ok,true);
 assert.equal(w.buildings.length,0);
 assert.equal(w.undo().ok,true);assert.equal(w.buildings.length,1);
});
test("roads validate length, persist and restore without local frame drift",()=>{
 const w=new OwnerWorld();
 assert.equal(w.road(a,a,5).ok,false);
 assert.equal(w.road(a,b,7).ok,false);
 assert.equal(w.road(a,b,5).ok,true);
 assert.equal(w.roads.length,1);
 const save=JSON.parse(JSON.stringify(w.snapshot()));
 assert.deepEqual(new OwnerWorld(save).snapshot(),save);
 assert.equal(w.undo().ok,true);assert.equal(w.roads.length,0);
 assert.equal(w.redo().ok,true);assert.equal(w.roads.length,1);
});
test("terrain brush raises, lowers and flattens shared altitude",()=>{
 const w=new OwnerWorld();
 const start=w.heightAt(a.lat,a.lon,100);
 assert.equal(start,100);
 assert.equal(w.sculpt(a,"raise",50,3,100).ok,true);
 assert.equal(w.heightAt(a.lat,a.lon,100),103);
 assert.equal(w.sculpt(a,"lower",50,3,103).ok,true);
 assert.equal(w.heightAt(a.lat,a.lon,100),100);
 assert.equal(w.sculpt(a,"flatten",50,1,96).ok,true);
 assert.equal(w.heightAt(a.lat,a.lon,100),96);
 assert.equal(w.heightAt(40,60,100),100);
 assert.equal(w.undo().ok,true);assert.equal(w.heightAt(a.lat,a.lon,100),100);
});
test("invalid data is rejected and clear only affects owner layer",()=>{
 const w=new OwnerWorld();
 assert.equal(w.place("unknown",a).ok,false);
 assert.equal(w.sculpt(a,"raise",250,3,100).ok,false);
 assert.equal(w.road(a,{lat:28.2,lon:42},5).ok,false);
 assert.equal(w.place("house",a).ok,true);
 assert.equal(w.clear().ok,true);
 assert.equal(w.buildings.length,0);
 assert.equal(w.undo().ok,true);assert.equal(w.buildings.length,1);
 assert.throws(()=>new OwnerWorld({version:1,buildings:[{id:1,kind:"house",lat:100,lon:42,rotation:0}],roads:[],stamps:[]}));
});
