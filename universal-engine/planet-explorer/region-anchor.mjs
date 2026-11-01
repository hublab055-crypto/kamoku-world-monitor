import {legacySurfacePoint,surfaceLocalOffset} from "./reference-frames.mjs";

/** Immutable legacy generator address. It is NOT the moving render origin.
 * Registry/persistence integration belongs to the subsequent streaming phase. */
export function regionAnchor({bodyId,regionId,origin,seed,generatorVersion="legacy-v1",contentRevision=0}={}){
 if(![bodyId,regionId,generatorVersion].every(s=>typeof s==="string"&&s.length>0)||
    ![origin?.lat,origin?.lon].every(Number.isFinite)||Math.abs(origin.lat)>90||
    !Number.isSafeInteger(seed)||!Number.isSafeInteger(contentRevision)||contentRevision<0)
  throw RangeError("Invalid region anchor");
 return Object.freeze({schemaVersion:1,bodyId,regionId,
  frameId:"region:"+encodeURIComponent(bodyId)+":"+encodeURIComponent(regionId),
  legacyOrigin:Object.freeze({lat:origin.lat,lon:origin.lon}),seed,generatorVersion,contentRevision});
}
export class LegacyRegionAdapter{
 constructor(anchor,radiusM){
  // Validate/copy the record, so external origin changes cannot move this region.
  this.anchor=regionAnchor({...anchor,origin:anchor?.legacyOrigin});
  if(!Number.isFinite(radiusM)||radiusM<=0)throw RangeError("Invalid planet radius");
  this.radiusM=radiusM;
  Object.freeze(this);
 }
 surfacePoint(x,z,elevationM=0){return legacySurfacePoint(this.anchor.legacyOrigin,x,z,this.radiusM,elevationM);}
 localPoint(lat,lon){return surfaceLocalOffset(this.anchor.legacyOrigin,lat,lon,this.radiusM);}
 entityId(localId){
  if(typeof localId!=="string"||!localId)throw TypeError("Local entity ID required");
  return this.anchor.frameId+":"+encodeURIComponent(localId);
 }
 /** Legacy generator always sees its original seed/local cell coordinates. */
 generate(generator,options={}){
  if(typeof generator!=="function")throw TypeError("Generator required");
  return generator({...options,seed:this.anchor.seed});
 }
}
