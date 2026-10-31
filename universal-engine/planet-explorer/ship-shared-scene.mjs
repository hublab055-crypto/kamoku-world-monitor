/** Shared WebGL2 geometry: the cabin is drawn on the same framebuffer and view matrix as the world. */
import {createShipGeometry} from "./ship-interior-3d.mjs?v=8";
export function triangleSoupToIndexed(soup){
 if(!soup||soup.length%9!==0)throw Error("Ship mesh data must have position/normal/color stride 9");
 const vertices=soup.length/9;
 if(vertices>65535)throw Error("Ship mesh exceeds 16-bit index limit");
 const positions=[],normals=[],colors=[],indices=[];
 for(let i=0;i<vertices;i++){
  const o=i*9;positions.push(soup[o],soup[o+1],soup[o+2]);
  normals.push(soup[o+3],soup[o+4],soup[o+5]);
  colors.push(soup[o+6],soup[o+7],soup[o+8]);indices.push(i);
 }
 return {positions,normals,colors,indices};
}
export function sharedShipInteriorGeometry(open=false){
 return triangleSoupToIndexed(createShipGeometry(open));
}
export function celestialBallGeometry(color=[.5,.65,.84],rings=22,sectors=42){
 const positions=[],normals=[],colors=[],indices=[];
 for(let i=0;i<=rings;i++){
  const phi=i*Math.PI/rings;
  for(let j=0;j<=sectors;j++){
   const theta=j*2*Math.PI/sectors;
   const x=Math.sin(phi)*Math.cos(theta),y=Math.cos(phi),z=Math.sin(phi)*Math.sin(theta);
   positions.push(x,y,z);normals.push(x,y,z);colors.push(...color);
  }
 }
 for(let i=0;i<rings;i++)for(let j=0;j<sectors;j++){
  const k=i*(sectors+1)+j;
  indices.push(k,k+sectors+1,k+1,k+1,k+sectors+1,k+sectors+2);
 }
 return {positions,normals,colors,indices};
}
/** Coordinate mapping from starship world frame to its local camera origin; floor at y=0. */
export function groundScenePhase(voyage){
 const status=voyage?.status||"docked",p=Math.max(0,Math.min(1,voyage?.stageProgress||0));
 const near=status==="docked"||status==="landed"||status==="touchdown"||status==="ascent"||status==="entry";
 const lift=status==="ascent"?Math.pow(p,2)*7000:status==="entry"?Math.pow(1-p,2)*7000:0;
 const sky=status==="docked"||status==="landed"||status==="touchdown"?1:
   status==="ascent"?1-p:status==="entry"?p:0;
 // While entering, a wide destination terrain patch replaces the orbit planet
 // before the spacecraft drops into the low-altitude landing corridor.
 const terrainDistance=status==="entry"?5000:1100;
 return {near,lift,sky,showGround:near&&lift<terrainDistance,
  showGlobe:status!=="docked"&&status!=="landed"&&status!=="touchdown"&&!(status==="entry"&&lift<4700)};
}
