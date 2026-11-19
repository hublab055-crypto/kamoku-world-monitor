import test from "node:test";
import assert from "node:assert/strict";
import {
 WALL_SCREEN_STORAGE_KEY,candidateWallSites,facadeForSite,
 nearestBuildingWall,sanitizeMountedWall,resolveMountedWall,
 projectedWallCorners,perspectiveCssMatrix
} from "./world-tablet-wall.mjs";

const controller={
 x:0,z:5,origin:{lat:35.5,lon:136.2},altitudeM:2.5
};
const renderer=(structures=[])=>({
 planet:{id:"terra",radiusM:6371000},
 constructionSystem:{structures},
 ownerWorld:{buildings:[]},
 terrain:null,cx:0,cz:0
});
const stone={id:17,kind:"stone-wall",x:0,z:0,height:5,rotation:0,progress:1};

test("Wall mount accepts a real nearby construction facade, matching geometry",()=>{
 const r=renderer([stone]);
 const sites=candidateWallSites(r,controller);
 assert.equal(sites.length,1);
 assert.equal(sites[0].halfX,1.05);
 assert.equal(sites[0].halfZ,.40);
 const selected=nearestBuildingWall(r,controller);
 assert.ok(selected);
 assert.equal(selected.placement.id,17);
 assert.equal(selected.placement.scope,"construction");
 assert.equal(selected.placement.side,"front");
 assert.equal(selected.placement.planetId,"terra");
 assert.ok(Math.abs(selected.facade.y-6.02)<1e-6);
 assert.ok(Math.abs(selected.facade.z-.445)<1e-6);
 assert.equal(nearestBuildingWall(r,{...controller,z:60}),null);
});

test("Rotated building facade tracks wall rotation and player-facing side",()=>{
 const site={scope:"construction",id:2,planetId:"terra",kind:"warehouse",
  x:0,z:0,y:0,rotation:Math.PI/2,halfX:3.36,halfZ:2.66};
 const f=facadeForSite(site,{x:8,z:0});
 assert.equal(f.side,"front");
 assert.ok(Math.abs(f.normal[0]-1)<1e-9);
 assert.ok(Math.abs(f.normal[2])<1e-9);
 assert.ok(f.width>2);
 const b=facadeForSite(site,{x:-8,z:0});
 assert.equal(b.side,"back");
 assert.ok(Math.abs(b.normal[0]+1)<1e-9);
});

test("Saved wall identifiers reject invalid data or different origin and stale/deleted buildings",()=>{
 const r=renderer([stone]);
 const p=nearestBuildingWall(r,controller).placement;
 assert.equal(WALL_SCREEN_STORAGE_KEY,"universal-engine:tablet:mounted-screen:v1");
 assert.deepEqual(sanitizeMountedWall(JSON.stringify(p)),{
  scope:"construction",id:17,side:"front",planetId:"terra",origin:[35.5,136.2]
 });
 assert.ok(resolveMountedWall(p,r,controller));
 assert.equal(resolveMountedWall(p,renderer([]),controller),null);
 assert.equal(resolveMountedWall(p,r,{...controller,origin:{lat:36,lon:136.2}}),null);
 assert.equal(resolveMountedWall(p,{...r,planet:{...r.planet,id:"nix"}},controller),null);
 for(const bad of ['{broken',null,{...p,scope:"prototype"},{...p,side:"bottom"},
  {...p,id:-5},{...p,planetId:""}]){
  assert.equal(sanitizeMountedWall(bad),null);
 }
});

test("World facade quad follows WebGL view projection and rejects points behind camera",()=>{
 const vp=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
 const facade={x:0,y:0,z:0,right:[1,0,0],normal:[0,0,1],width:1.6,height:.9};
 const p=projectedWallCorners(facade,vp,0,0,1000,600);
 assert.ok(p);
 assert.deepEqual(p.map(c=>c.map(x=>Math.round(x))),[
  [100,165],[900,165],[900,435],[100,435]
 ]);
 const behind=[...vp];behind[15]=-1;
 assert.equal(projectedWallCorners(facade,behind,0,0,1000,600),null);
 assert.equal(projectedWallCorners(null,vp,0,0,1000,600),null);
});

test("Perspective CSS matrix maps every source iframe corner without reading pixels",()=>{
 const corners=[[100,120],[840,160],[770,500],[170,460]];
 const result=perspectiveCssMatrix(corners,960,540);
 assert.match(result,/^matrix3d\(/);
 const m=result.slice(9,-1).split(",").map(Number);
 assert.equal(m.length,16);
 for(const [idx,[x,y]] of [[0,[0,0]],[1,[960,0]],[2,[960,540]],[3,[0,540]]]){
  const w=m[3]*x+m[7]*y+m[15];
  const gotX=(m[0]*x+m[4]*y+m[12])/w;
  const gotY=(m[1]*x+m[5]*y+m[13])/w;
  assert.ok(Math.abs(gotX-corners[idx][0])<1e-5,[idx,gotX]);
  assert.ok(Math.abs(gotY-corners[idx][1])<1e-5,[idx,gotY]);
 }
 assert.equal(perspectiveCssMatrix([[1,1],[1,1],[1,1],[1,1]]),null);
});
