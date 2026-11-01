/** Render-only rebasing. All gameplay coordinates stay in their legacy region.
 * A complete replacement is prepared before any currently visible GPU mesh is
 * retired. No game clock, entity, collision coordinate or save is modified. */
const singles=["patch","ownerRoadMesh","riverWater","lakeWater","groundClouds","oceanWave","distantLandscape"];
const lists=["trees","meadow","settlement","settlementDecor","residentMeshes"];
const fields=[...singles,...lists,"groundPatchData","resourceNodes","townSites","sceneryStats",
 "cloudOriginEast","cloudOriginNorth","cloudCoverBand","lastWaveAt","distantCenter","distantKey"];
const resources=data=>new Set([...singles.map(k=>data[k]),...lists.flatMap(k=>data[k]||[])].filter(Boolean));
const dispose=(items,keep=new Set())=>{
 for(const mesh of items)if(!keep.has(mesh))try{mesh.destroy();}catch{/* Retirement cannot undo a published frame. */}
};

export function groundRegionKey(planet,origin,settlementId){
 if(typeof planet?.id!=="string"||!Number.isSafeInteger(planet.seed)||
   ![origin?.lat,origin?.lon].every(Number.isFinite)||Math.abs(origin.lat)>90||
   typeof settlementId!=="string")throw RangeError("Invalid ground region");
 // Include the fixed generator address; identical x/z in another region must
 // never reuse the preceding city's trees or distant landscape.
 return JSON.stringify([planet.id,planet.seed,origin.lat,origin.lon,settlementId]);
}

/** Cache-owned smoothed positions are in render metres, never world metres. */
export function rebaseCameraHistory(camera,previous,next){
 if(!camera)return;
 if(!previous||previous.regionKey!==next.regionKey){
  camera.smoothEye=null;camera.smoothTarget=null;return;
 }
 for(const key of ["smoothEye","smoothTarget"]){
  const value=camera[key];
  if(Array.isArray(value)&&value.length===3)
   camera[key]=[value[0]+previous.cx-next.cx,value[1],value[2]+previous.cz-next.cz];
 }
}

/** Synchronous prepare/validate/publish/retire transaction at a frame boundary.
 * own() tracks partial allocations so a failed builder cannot destroy the old
 * scene. A failure may retain only a scene from the SAME immutable region. */
export function replaceGroundRenderFrame(renderer,request,prepare){
 if(!request||typeof request.key!=="string"||typeof request.regionKey!=="string"||
   ![request.cx,request.cz,request.radius].every(Number.isFinite)||request.radius<=0)
  throw RangeError("Invalid render frame request");
 const previous=renderer.groundFrame||null,old=resources(renderer),allocated=new Set();
 let next;
 try{
  const own=mesh=>{
   if(!mesh||typeof mesh.destroy!=="function"||old.has(mesh))throw Error("Invalid staged mesh ownership");
   allocated.add(mesh);return mesh;
  };
  const built=prepare(own);
  if(!built||fields.some(k=>!Object.hasOwn(built,k))||!built.patch||!built.groundPatchData||
    lists.some(k=>!Array.isArray(built[k]))||!Array.isArray(built.resourceNodes)||!Array.isArray(built.townSites))
   throw Error("Incomplete ground render frame");
  next=Object.fromEntries(fields.map(k=>[k,built[k]]));
  const staged=resources(next);
  if([...staged].some(m=>!allocated.has(m)&&!old.has(m)))throw Error("Untracked staged mesh");
 }catch(error){
  dispose(allocated);
  renderer.groundRebaseError=error;
  const retained=Boolean(previous&&previous.regionKey===request.regionKey);
  if(!retained){
   // A failed teleport/region change must not leave the old city's clickable
   // projections active against a different gameplay origin.
   renderer.pickVP=null;renderer.groundPickFrame=null;renderer.actorMarker=null;
   for(const key of Object.keys(renderer))if(/^screen[A-Z]/.test(key)&&Array.isArray(renderer[key]))renderer[key]=[];
  }
  return {ok:false,error,retained};
 }
 const frame=Object.freeze({...request,revision:(previous?.revision||0)+1});
 // There are no awaits or simulation callbacks between publication and the
 // next draw. All static/dynamic draw paths read the same renderer cx/cz.
 Object.assign(renderer,next,{cx:frame.cx,cz:frame.cz,patchKey:frame.key,
  groundFrame:frame,groundPickFrame:null,pickVP:null,groundRebaseError:null});
 rebaseCameraHistory(renderer.cameraController,previous,frame);
 const keep=resources(next);
 dispose(old,keep);dispose(allocated,keep);
 return {ok:true,frame};
}

/** A pick uses exactly the centre and mesh that produced its projection.
 * Passing another current revision rejects stale screen input. */
export function groundHitToWorld(frame,currentFrame,hit){
 if(!frame||frame!==currentFrame||!Array.isArray(hit)||hit.length<3||!hit.slice(0,3).every(Number.isFinite))return null;
 return {x:hit[0]+frame.cx,z:hit[2]+frame.cz,elevationM:hit[1]};
}
