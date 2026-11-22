/** Fictional settlements with reproducible local layouts and planetary addresses.
 * Destination browsing is separate from short-range waypoint navigation.
 */
import {findLand,geoOffset,terrainSurface} from "./geo.mjs?v=0.8y-harbor";

export const DESTINATIONS=Object.freeze([
 {id:"pioneer",name:"開拓者の集落",region:"はじまりの谷",icon:"⛺",kind:"hamlet",lat:28,lon:42,
  description:"開拓の拠点。仲間や家畜が集う小さな集落。"},
 {id:"capital",name:"王都アルディナス",region:"王都",icon:"🏰",kind:"city",lat:-7,lon:116,
  description:"城壁と大市場を持つ都市。住宅、工房、広場で市民が暮らす。"},
 {id:"tower",name:"塔の街ルミナス",region:"塔の街",icon:"🗼",kind:"city",lat:36,lon:53,
  description:"朱色と白の鉄骨展望塔がそびえる街。市場や宿、住居の集まる観光地。"},
 {id:"port",name:"港町セレノート",region:"港町",icon:"⚓",kind:"town",lat:7,lon:89,
  description:"旅人や商人が行き交う港町。市場と倉庫、宿場が並ぶ。"},
 {id:"mountain",name:"山あいの村 エルムの里",region:"山村",icon:"🏔️",kind:"village",lat:49,lon:-107,
  description:"山間に家々と納屋が点在する、木工職人の村。"},
 {id:"meadow",name:"草原の村 フロウベル",region:"農村",icon:"🌾",kind:"village",lat:-17,lon:32,
  description:"畑と農家が広がり、住人が畑と市場を行き来する村。"},
 {id:"forest",name:"森の集落 リーフォル",region:"森の集落",icon:"🌳",kind:"village",lat:-22,lon:-124,
  description:"森の中で暮らす木こりと薬草採集者の集落。"}
]);
export function destinationById(id){return DESTINATIONS.find(p=>p.id===id)||null;}

function safeLand(terrain,lat,lon){
 const first=findLand(terrain,lat,lon);
 // Refined playable surface can contain rivers even when the coarse land sample is dry.
 for(const distance of [0,80,180,350,700,1500]){
  for(let i=0;i<(distance?16:1);i++){
   const theta=i*Math.PI/8;
   const p=geoOffset(first.lat,first.lon,Math.cos(theta)*distance,
    Math.sin(theta)*distance,terrain.planet.radiusM);
   const s=terrainSurface(terrain,p.lat,p.lon);
   if(!s.water&&!s.river&&s.elevationM>15&&s.elevationM<2200)return p;
  }
 }
 throw new Error("この街の着陸可能な地表が見つかりません");
}
/** Safe, stable landing locations derived from the current planet seed. */
export function settlementDestinations(terrain){
 const locations=DESTINATIONS.map(d=>({...d,...safeLand(terrain,
  d.id==="pioneer"?(terrain.landscapeAnchor?.lat??d.lat):d.lat,
  d.id==="pioneer"?(terrain.landscapeAnchor?.lon??d.lon):d.lon)}));
 // Carve an actual walkable coast and a navigable bay around Serenote. The anchor
 // follows the seed-specific safe town position, not the original abstract map pin.
 const port=locations.find(d=>d.id==="port");
 if(port)terrain.harborAnchor={lat:port.lat,lon:port.lon};
 // The village anchor is the actual walkable arrival point. Never move town
 // buildings; surrounding mountains begin beyond the settlement clearing.
 const mountain=locations.find(d=>d.id==="mountain");
 if(mountain)terrain.alpineVillageAnchor={lat:mountain.lat,lon:mountain.lon};
 return locations;
}
const site=(type,x,z,angle=0)=>({type,x,z,angle});
const ACTIVITIES=["散歩","買い物","会話","仕事","休憩","配達"];
/** World-metre offsets relative to a named arrival point. */
export function settlementLayout(id){
 const place=destinationById(id);
 if(!place||id==="pioneer")return {buildings:[],residents:[],landmark:null,clearing:0};
 const isCity=place.kind==="city",isTown=place.kind==="town";
 const radius=isCity?174:isTown?133:88,spacing=isCity?27:isTown?25:23;
 const buildings=[],residents=[];
 const bounds=Math.floor(radius/spacing);
 for(let row=-bounds;row<=bounds;row++)for(let col=-bounds;col<=bounds;col++){
  const x=col*spacing+(row%2?3:0),z=row*spacing;
  // Broad cross-shaped roads, a shared square and tower grounds.
  if(Math.abs(x)<17||Math.abs(z)<15||Math.hypot(x,z)<28)continue;
  if(id==="tower"&&Math.hypot(x,z-105)<29)continue;
  if(id==="forest"&&Math.abs(col+row)%3===0)continue;
  if(!isCity&&!isTown&&(Math.abs(row)+Math.abs(col))%3===0)continue;
  const n=(row*47+col*61+Math.abs(row*col)*7+100000)%19;
  const type=n===0?"lodge":n===1?"workshop":n===2?"barn":n===3?"granary":n===4?"market":
   n===5?"stable":"cabin";
  buildings.push(site(type,x,z,((n%5)-2)*.12));
 }
 buildings.push(site("market",24,26),site("well",-23,-23));
 if(isCity||isTown){
  buildings.push(site("lodge",-31,24),site("workshop",30,-26),
   site("market",-32,-27),site("watchtower",radius-9,0));
 }
 if(id==="tower")buildings.push(site("market",-27,106),site("lodge",34,112));
 // Townsfolk congregate by the market, walkways and around homes.
 const count=isCity?34:isTown?24:13;
 for(let i=0;i<count;i++){
  const lane=(i%3)-1,side=i%2?1:-1;
  const extent=(i%9-4)*(isCity?27:isTown?20:13);
  const x=i%2===0?lane*4:extent;
  const z=i%2===0?extent:lane*4;
  if(id==="tower"&&Math.hypot(x,z-105)<22)continue;
  residents.push({id:"resident-"+i,x:x+side*1.4,z:z+(i%5-2)*1.7,
   facing:(i*1.73)%6.283,activity:ACTIVITIES[i%ACTIVITIES.length],
   clothing:i%6});
 }
 return {buildings,residents,landmark:id==="tower"?{x:0,z:105}:null,clearing:radius};
}
