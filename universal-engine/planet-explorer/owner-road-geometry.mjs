/** Local mesh strips for owner-laid roads.
 * Heights are queried from the same edited terrain used by collision/picking.
 */
import {geoLocal,geoOffset,terrainSurface} from "./geo.mjs";
export function ownerRoadGeometry(world,terrain,origin){
 const g={positions:[],normals:[],colors:[],indices:[]};
 if(!world||!terrain||!origin)return g;
 const radius=terrain.planet.radiusM;
 for(const road of world.roads){
  for(let edge=1;edge<road.points.length;edge++){
   const a=geoLocal(origin.lat,origin.lon,road.points[edge-1].lat,road.points[edge-1].lon,radius);
   const b=geoLocal(origin.lat,origin.lon,road.points[edge].lat,road.points[edge].lon,radius);
   const dx=b.eastM-a.eastM,dz=b.northM-a.northM,len=Math.hypot(dx,dz);
   if(len<.1||len>2100)continue;
   const segments=Math.min(350,Math.ceil(len/5));
   const ox=-dz/len*road.width*.5,oz=dx/len*road.width*.5;
   const startIndex=g.positions.length/3;
   for(let j=0;j<=segments;j++){
    const t=j/segments,x=a.eastM+dx*t,z=a.northM+dz*t;
    for(const side of [-1,1]){
     const px=x+ox*side,pz=z+oz*side;
     const geo=geoOffset(origin.lat,origin.lon,px,pz,radius);
     const surf=terrainSurface(terrain,geo.lat,geo.lon);
     const y=Math.max(0,surf.elevationM)+.16;
     g.positions.push(px,y,pz);g.normals.push(0,1,0);
     g.colors.push(...(road.width>=8?[.40,.41,.42]:[.51,.46,.37]));
    }
    if(j<segments){const k=startIndex+j*2;
     g.indices.push(k,k+1,k+2,k+1,k+3,k+2);
    }
   }
  }
 }
 return g;
}
