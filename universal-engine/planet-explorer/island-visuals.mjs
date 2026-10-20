import {islandCenters} from "../planet/island-archipelago.mjs?v=0.8p-islands";
import {geoOffset,geoNormal,terrainSurface} from "./geo.mjs?v=0.8b-river-valley";
/** Additional small island geometry for the globe's very coarse mainland grid.
 * All island vertices are queried from the EXACT same sampler as the walkable islands.
 */
export function globeIslandGeometry(terrain,renderRadius=600){
 const out={positions:[],normals:[],colors:[],indices:[]};
 const planetR=terrain.planet.radiusM,seed=terrain.planet.seed;
 for(const island of islandCenters(seed)){
  if(terrain.sample(island.lat,island.lon).category!=="island")continue;
  const ring=14;
  const center=geoNormal(island.lat,island.lon);
  const coreHeight=terrainSurface(terrain,island.lat,island.lon).elevationM;
  const lift=.55; // > coarse globe triangle error; visual overlay, not actual altitude
  const push=(lat,lon,height,color)=>{
   const n=geoNormal(lat,lon),radius=renderRadius+lift+height*renderRadius/planetR*3;
   const i=out.positions.length/3;
   out.positions.push(n[0]*radius,n[1]*radius,n[2]*radius);
   out.normals.push(...n);out.colors.push(...color);
   return i;
  };
  const pivot=push(island.lat,island.lon,coreHeight,[.20,.47,.24]);
  let inner=[],outer=[],valid=[];
  for(let i=0;i<ring;i++){
   const a=i*Math.PI*2/ring;
   const inPos=geoOffset(island.lat,island.lon,Math.cos(a)*island.radiusM*.43,Math.sin(a)*island.radiusM*.43,planetR);
   const outPos=geoOffset(island.lat,island.lon,Math.cos(a)*island.radiusM*.79,Math.sin(a)*island.radiusM*.79,planetR);
   const h1=terrainSurface(terrain,inPos.lat,inPos.lon),h2=terrainSurface(terrain,outPos.lat,outPos.lon);
   valid.push(h1.category==="island"&&h2.category==="island");
   inner.push(push(inPos.lat,inPos.lon,Math.max(0,h1.elevationM),[.35,.51,.25]));
   outer.push(push(outPos.lat,outPos.lon,Math.max(0,h2.elevationM),[.71,.67,.43]));
  }
  for(let i=0;i<ring;i++){
   const j=(i+1)%ring;
   if(valid[i]&&valid[j])out.indices.push(pivot,inner[i],inner[j],inner[i],outer[i],outer[j],inner[i],outer[j],inner[j]);
  }
 }
 return out;
}
