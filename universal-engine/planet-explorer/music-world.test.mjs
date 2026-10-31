import {test} from "node:test";
import assert from "node:assert/strict";
import {musicStageGeometry,musicStageRayHit,newMusicStage,normalizeMusicStage} from "./music-world.mjs";

const ray=(x,y,z)=>{const m=new Array(16).fill(0);m[0]=m[5]=m[15]=1;m[9]=1;
 m[12]=x;m[13]=y;m[14]=z;return m;};
const identity=()=>[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
test("instrument geometry uses valid indexed vertices and colours",()=>{
 const g=musicStageGeometry(),n=g.positions.length/3;
 assert.ok(n>1000&&n<65535);
 assert.equal(g.normals.length,g.positions.length);
 assert.equal(g.colors.length,g.positions.length);
 assert.ok(g.indices.length>0);
 assert.ok(g.indices.every(x=>x>=0&&x<n));
 assert.ok(g.positions.every(Number.isFinite));
});
test("georeferenced stages validate planet, latitude and elevation",()=>{
 const stage=newMusicStage({planetId:"terra",lat:29,lon:42,yaw:.2,heightM:332});
 assert.deepEqual(normalizeMusicStage(stage),stage);
 assert.throws(()=>normalizeMusicStage({...stage,lat:100}),/不正/);
 assert.throws(()=>normalizeMusicStage({...stage,heightM:Infinity}),/不正/);
});
test("Quest controller ray touches visible keys or guitar but no empty space",()=>{
 const stage=identity(),offset=[0,0,0];
 const hit=musicStageRayHit(ray(-.75,1.7,-.1),stage,offset,0);
 assert.equal(hit.track,"keys");assert.equal(hit.pitch,60);
 const guitar=musicStageRayHit(ray(1.24,1.8,.12),stage,offset,0);
 assert.equal(guitar.track,"guitar");assert.equal(guitar.pitch,40);
 assert.equal(musicStageRayHit(ray(3,1.8,0),stage,offset,0),null);
 assert.equal(musicStageRayHit(ray(-.75,8,-.1),stage,offset,0),null);
});
test("XR stage rotation and translation leave musical pitch unchanged",()=>{
 // Yaw +90deg: XR+X points to world -Z, so the key moves to XR+Z.
 const rot=[0,0,-1,0, 0,1,0,0, 1,0,0,0, 4,2,2,1];
 const hit=musicStageRayHit(ray(4,3.6,2.75),rot,[0,0,0],0);
 assert.equal(hit?.track,"keys");assert.equal(hit?.pitch,60);
});
test("no false hit when pointing horizontally",()=>{
 const m=ray(-.75,1.7,-.1);m[8]=0;m[9]=0;m[10]=-1;
 assert.equal(musicStageRayHit(m,identity(),[0,0,0],0),null);
});
