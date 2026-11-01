/** Destination-world terrain prepared BEFORE atmospheric entry and used again on touchdown.
 * The actual planet save and the cockpit preview use the same terrain sampler. */
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs?v=0.8p-islands";
import {createCelestialPlanet,bodyById} from "./solar-system.mjs?v=1";
import {adjustDryWorld} from "./solar-terrain.mjs?v=1";
import {findLand,geoOffset} from "./geo.mjs?v=0.8y-harbor";
import {Earthworks} from "./earthworks.mjs";
import {OwnerWorld} from "./owner-world.mjs?v=0.9c-asset-v2";
import {findStarshipPad,evaluateStarshipPad} from "./surface-starship-landing.mjs?v=2";

/** Explorer v1 saves origin+x/z, not lat/lon. Resolve that address first;
 * otherwise a return voyage silently searches near the starter valley. */
export function savedSurfaceLocation(explorer,radiusM,fallback){
 const o=explorer?.origin;
 if([o?.lat,o?.lon,explorer?.x,explorer?.z].every(Number.isFinite)&&Math.abs(o.lat)<=90)
  return geoOffset(o.lat,o.lon,explorer.x,explorer.z,radiusM);
 if([explorer?.lat,explorer?.lon].every(Number.isFinite)&&Math.abs(explorer.lat)<=90)
  return {lat:explorer.lat,lon:explorer.lon};
 return fallback;
}

export function prepareShipArrivalTerrain({destinationId,visitedSave=null,days=0,preferredSite=null}={}){
 const body=bodyById(destinationId);
 if(!body?.landable)throw Error("着陸できない惑星です");
 const planet=visitedSave?.planet?Planet.fromSnapshot(visitedSave.planet):
  createCelestialPlanet(destinationId,days);
 if(planet.id!==destinationId)throw Error("訪問済み記録の天体が一致しません");
 const terrain=new Terrain(planet);
 adjustDryWorld(terrain,destinationId);
 terrain.earthworks=new Earthworks(visitedSave?.v0_8a?.earthworks||null);
 terrain.ownerWorld=new OwnerWorld(visitedSave?.v0_8w?.owner||null);
 terrain.landscapeAnchor=findLand(terrain);
 const old=preferredSite?.bodyId===destinationId?preferredSite:null;
 let pad=old?evaluateStarshipPad(terrain,old.lat,old.lon,old.yaw||0):null;
 if(!pad?.safe){
  const ex=visitedSave?.explorer;
  const base=savedSurfaceLocation(ex,planet.radiusM,terrain.landscapeAnchor);
  pad=findStarshipPad(terrain,base,{yaw:old?.yaw||0,distanceM:30})||
    findStarshipPad(terrain,terrain.landscapeAnchor,{distanceM:30});
 }
 if(!pad?.safe)throw Error(body.name+"で安全な宇宙船着陸地点を見つけられません");
 return {bodyId:destinationId,terrain,site:{
  bodyId:destinationId,lat:pad.lat,lon:pad.lon,yaw:pad.yaw,
  padElevationM:pad.padElevationM
 }};
}
