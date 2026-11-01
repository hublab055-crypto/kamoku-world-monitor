/** Recoverable, per-planet supply caches placed at safe surveyed landing pads. */
const finite=Number.isFinite;
const valid=c=>c&&typeof c.id==="string"&&typeof c.resource==="string"&&/^[a-zA-Z0-9_-]{1,80}$/.test(c.resource)&&
 Number.isInteger(c.quantity)&&c.quantity>0&&c.quantity<=100&&
 typeof c.bodyId==="string"&&finite(c.lat)&&finite(c.lon)&&Math.abs(c.lat)<=90&&Math.abs(c.lon)<=180;
export function distanceOnPlanet(a,b,radiusM){
 if(!a||!b||![a.lat,a.lon,b.lat,b.lon,radiusM].every(finite)||radiusM<=0)return Infinity;
 const rad=Math.PI/180,p1=a.lat*rad,p2=b.lat*rad,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dlon/2)**2;
 return radiusM*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export class ShipCargoCaches{
 constructor(data={}){
  const entries=Array.isArray(data?.caches)?data.caches:[];
  this.caches=entries.filter(valid).slice(-512).map(x=>({...x}));
 }
 storeDrops(drops,bodyId){
  if(!Array.isArray(drops))return 0;
  let added=0;
  for(const drop of drops){
   if(!valid(drop)||drop.bodyId!==bodyId||this.caches.some(c=>c.id===drop.id))continue;
   if(this.caches.length>=512)break;
   this.caches.push({id:drop.id,resource:drop.resource,quantity:drop.quantity,
    bodyId:drop.bodyId,lat:drop.lat,lon:drop.lon});
   added++;
  }
  return added;
 }
 near(actor,bodyId,radiusM,limitM=25){
  return this.caches.map(c=>({...c,distanceM:c.bodyId===bodyId?distanceOnPlanet(actor,c,radiusM):Infinity}))
   .filter(c=>c.distanceM<=limitM).sort((a,b)=>a.distanceM-b.distanceM);
 }
 recover(actor,bodyId,radiusM,bag,id=null){
  const cache=this.near(actor,bodyId,radiusM).find(c=>id===null||c.id===id);
  if(!cache)return {ok:false,message:"25m以内に回収できる投下カプセルがありません"};
  if(!bag||typeof bag!=="object")return {ok:false,message:"収納先の資源インベントリがありません"};
  const current=Object.hasOwn(bag,cache.resource)?bag[cache.resource]:0;
  if(!finite(current)||current<0)return {ok:false,message:"収納先の資源データが不正です"};
  bag[cache.resource]=current+cache.quantity;
  this.caches=this.caches.filter(c=>c.id!==cache.id);
  return {ok:true,resource:cache.resource,quantity:cache.quantity,
   message:"📦 投下カプセル回収："+cache.resource+" ×"+cache.quantity};
 }
 snapshot(){return {schemaVersion:1,caches:this.caches.map(c=>({...c}))};}
}
