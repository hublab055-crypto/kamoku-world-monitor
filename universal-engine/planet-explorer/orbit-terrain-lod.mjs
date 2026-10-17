import {geoNormal,geoOffset,terrainSurface,clamp} from "./geo.mjs";

/** A close-up spherical terrain tile, using the same deterministic surface
 * sampler and planet coordinates as the kilometre-scale ground mesh.
 * Never replaces the planet or the local ground mesh.
 */
export function orbitalTerrainTier(altitudeM){
 if(!Number.isFinite(altitudeM)||altitudeM<0)throw new RangeError("Invalid orbital altitude");
 if(altitudeM>450000)return null;
 if(altitudeM>170000)return {radiusM:470000,resolution:52};
 if(altitudeM>65000)return {radiusM:245000,resolution:60};
 return {radiusM:112000,resolution:64};
}
export function buildOrbitalTerrainTile(terrain,{lat,lon,renderRadius=600,radiusM=112000,resolution=64}={}){
 if(!terrain?.planet||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||
  !Number.isFinite(renderRadius)||renderRadius<=0||!(radiusM>=1000&&radiusM<=500000)||
  !Number.isInteger(resolution)||resolution<4||resolution>96)
  throw new RangeError("Invalid orbital terrain tile");
 const positions=[],normals=[],colors=[],indices=[],planetRadius=terrain.planet.radiusM;
 const den=renderRadius/planetRadius;
 const lookups=[];
 for(let j=0;j<=resolution;j++){
  const north=(j/resolution*2-1)*radiusM;
  for(let i=0;i<=resolution;i++){
   const east=(i/resolution*2-1)*radiusM;
   const geo=geoOffset(lat,lon,east,north,planetRadius);
   const surface=terrainSurface(terrain,geo.lat,geo.lon);
   const n=geoNormal(geo.lat,geo.lon);
   // Coarse planetary facets need a small raised detailed shell. This shell
   // is cinematic only; landing altitude and collision retain real heights.
   const altitude=(surface.water?0:Math.max(0,surface.elevationM))*3+4400;
   const rad=renderRadius+altitude*den;
   positions.push(n[0]*rad,n[1]*rad,n[2]*rad);normals.push(...n);
   const elevation=surface.elevationM;
   const temp=28-Math.abs(geo.lat)*.61-Math.max(0,elevation)*.006;
   const color=surface.water?[.07,.26,.51]:temp<-3||elevation>3200?
    [.86,.90,.91]:elevation>1900?[.51,.49,.42]:temp>29?
    [.60,.56,.35]:elevation>1200?[.34,.49,.24]:
    surface.category==="forest"?[.15,.43,.24]:
    surface.category==="valley"?[.28,.50,.25]:[.27,.46,.25];
   colors.push(...color);
   lookups.push({lat:geo.lat,lon:geo.lon});
  }
 }
 for(let j=0;j<resolution;j++)for(let i=0;i<resolution;i++){
  const a=j*(resolution+1)+i,b=a+1,c=a+resolution+1,d=c+1;
  indices.push(a,c,b,b,c,d);
 }
 return {positions,normals,colors,indices,center:{lat,lon},radiusM,
  resolution,vertexCount:positions.length/3};
}
