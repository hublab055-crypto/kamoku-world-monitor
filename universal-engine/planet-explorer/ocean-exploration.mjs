/** Deterministic ocean floor, archaeological sites and wearable diving equipment. */
import {geoOffset,geoLocal,terrainSurface} from "./geo.mjs?v=0.8b-river-valley";
export const SWIM_STYLES=Object.freeze({
 crawl:{name:"クロール",speed:1.28,effort:1.3},
 breast:{name:"平泳ぎ",speed:.90,effort:.72},
 back:{name:"背泳ぎ",speed:.83,effort:.65},
 tread:{name:"立ち泳ぎ",speed:0,effort:.42}
});
export const DIVE_GEAR=Object.freeze({
 none:{name:"素潜り",cost:{},maxDepth:12,air:100,drain:8,speed:1},
 snorkel:{name:"シュノーケル・足ひれ",cost:{fiber:8,wood:2},maxDepth:12,air:100,drain:6,speed:1.23},
 scuba:{name:"アクアラング",cost:{metal:8,fiber:10},maxDepth:42,air:160,drain:1.6,speed:1.12},
 suit:{name:"海底作業用潜水服",cost:{metal:20,fiber:18,plank:4},maxDepth:85,air:240,drain:.85,speed:.42}
});
export const SEA_SITE_TYPES=Object.freeze({
 wreck:{name:"沈没船",symbol:"🚢",loot:{wood:8,metal:3,ancientCoins:4}},
 treasure:{name:"海底の宝箱",symbol:"💎",loot:{ancientCoins:12,metal:2}},
 ruins:{name:"古代海底遺跡",symbol:"🏛️",loot:{stone:8,ancientCoins:3}},
 dragon:{name:"竜人文明の海底遺跡",symbol:"🐉",loot:{dragonRelic:1,metal:6}}
});
const clip=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(a,b,seed=0)=>{
 let h=(Math.imul((a|0)^seed,374761393)+Math.imul((b|0)^0x5f356495,668265263))|0;
 h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;
};
export function oceanFloorDepth(terrain,lat,lon){
 const s=terrainSurface(terrain,lat,lon);
 if(!s.water&&!s.river)return 0;
 const ilat=Math.floor((lat+90)*180),ilon=Math.floor((lon+180)*180);
 const rough=hash(ilat,ilon,terrain.planet.seed||0);
 return s.river?3.5+rough*5:8+rough*28+hash(Math.floor(lat*36),Math.floor(lon*36),79)*31;
}
/** Bounded patch; no per-frame global ocean scans. Ground mesh is an underwater visualization only. */
export function seabedPatch(terrain,origin,cx,cz,{radius=100,cells=18}={}){
 const positions=[],normals=[],colors=[],indices=[],wet=[];
 for(let j=0;j<=cells;j++)for(let i=0;i<=cells;i++){
  const x=cx-radius+2*radius*i/cells,z=cz-radius+2*radius*j/cells;
  const geo=geoOffset(origin.lat,origin.lon,x,z,terrain.planet.radiusM);
  const depth=oceanFloorDepth(terrain,geo.lat,geo.lon);
  positions.push(x,-depth,z);wet.push(depth>0);
  normals.push(0,1,0);
  const noise=hash(i+Math.floor(cx),j+Math.floor(cz));
  colors.push(.16+noise*.07,.24+noise*.09,.23+noise*.045);
 }
 for(let j=0;j<cells;j++)for(let i=0;i<cells;i++){
  const a=j*(cells+1)+i,b=a+1,c=a+cells+1,d=c+1;
  if(wet[a]&&wet[b]&&wet[c]&&wet[d])indices.push(a,c,b,b,c,d);
 }
 return {positions,normals,colors,indices};
}
/** Deterministic sites on fixed geographical cells, stable across save/reload.
 * Coordinates do not depend on the player's changing local tangent origin. */
export function seaSitesNear(terrain,lat,lon,radiusM=420){
 const step=.0014,la=Math.floor(lat/step),lo=Math.floor(lon/step),out=[];
 const seed=terrain.planet.seed||0;
 const n=Math.min(7,Math.max(1,Math.ceil(radiusM/125)));
 for(let a=-n;a<=n;a++)for(let b=-n;b<=n;b++){
  const i=la+a,j=lo+b;
  const pLat=clip((i+.25+.5*hash(i,j,17))*step,-89.9,89.9);
  const pLon=((j+.25+.5*hash(i,j,19))*step+540)%360-180;
  const range=geoLocal(lat,lon,pLat,pLon,terrain.planet.radiusM);
  if(Math.hypot(range.eastM,range.northM)>radiusM)continue;
  if(!terrainSurface(terrain,pLat,pLon).water)continue;
  const rarity=hash(i,j,seed);
  if(rarity>.32)continue;
  const kind=rarity<.026?"dragon":rarity<.085?"treasure":rarity<.18?"ruins":"wreck";
  const depth=oceanFloorDepth(terrain,pLat,pLon);
  out.push({id:"sea-"+i+"-"+j,kind,name:SEA_SITE_TYPES[kind].name,
   lat:pLat,lon:pLon,depthM:depth,
   distanceM:Math.hypot(range.eastM,range.northM),eastM:range.eastM,northM:range.northM});
 }
 return out.sort((a,b)=>a.distanceM-b.distanceM).slice(0,30);
}
