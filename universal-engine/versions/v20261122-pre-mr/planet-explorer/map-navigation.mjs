/** Local navigation, no teleportation: map coordinates use the player controller's world metres.
 * The same terrain collision and route limit is enforced when confirming the order.
 */
export const ROUTE_SCALES=Object.freeze([90,160,300,600,1200,3000]);
export function mapToWorld(u,v,control,radiusM){
 if(![u,v,radiusM,control?.x,control?.z].every(Number.isFinite)||
   u<0||u>1||v<0||v>1||radiusM<=0)throw new RangeError("Invalid map pointer");
 return {x:control.x+(u*2-1)*radiusM,z:control.z+(1-v*2)*radiusM};
}
export function worldToMap(x,z,control,radiusM){
 if(![x,z,radiusM,control?.x,control?.z].every(Number.isFinite)||radiusM<=0)
  throw new RangeError("Invalid world waypoint");
 return {u:.5+(x-control.x)/(2*radiusM),v:.5-(z-control.z)/(2*radiusM)};
}
export function routePreview(controller,terrain,x,z){
 if(![x,z].every(Number.isFinite))return {ok:false,message:"目的地の座標が不正です"};
 const distanceM=Math.hypot(x-controller.x,z-controller.z);
 const geo=controller.locationAt(x,z);
 const surface=terrain.sample(geo.lat,geo.lon);
 const ship=controller.travelMode==="boat";
 const limit=ship?6000:controller.mountRiding?1200:350;
 if(distanceM<=.3||distanceM>limit)return {ok:false,distanceM,geo,
  message:"📍 目的地が移動範囲外です（現在の移動方式では"+limit+"m以内を指定）"};
 if(ship&&(!surface.water&&!surface.river||controller.boatOceanOnly&&surface.river))
  return {ok:false,distanceM,geo,message:"⛵ 船は海上・航行できる水面だけを指定できます"};
 if(surface.elevationM>2800)return {ok:false,distanceM,geo,message:"急峻な地形で移動できません"};
 return {ok:true,distanceM,geo,surface,
  message:"📍 目的地 "+distanceM.toFixed(1)+"m / "+geo.lat.toFixed(5)+"°, "+geo.lon.toFixed(5)+"°"};
}
