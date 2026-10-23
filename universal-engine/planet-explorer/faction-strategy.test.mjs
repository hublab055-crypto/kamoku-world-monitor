import test from "node:test";
import assert from "node:assert/strict";
import {TerritoryEconomy} from "./territory-economy.mjs";
import {FactionStrategy} from "./faction-strategy.mjs";

const setup=()=>{
 const economy=new TerritoryEconomy(null,0);
 const strategy=new FactionStrategy(economy,null,0);
 return {economy,strategy};
};
const month=({economy,strategy},day)=>{
 economy.collectUntil(day);
 return strategy.advanceUntil(day);
};

test("treasury collection and army upkeep happen once per month",()=>{
 const game=setup();
 const initial=game.strategy.armies.pioneer;
 assert.equal(month(game,30),1);
 assert.equal(game.strategy.armies.pioneer,initial);
 const balance=game.economy.town("pioneer").treasury;
 assert.ok(balance>0);
 assert.equal(month(game,30),0);
 assert.equal(game.economy.town("pioneer").treasury,balance);
});
test("peaceful trade gives monthly income and diplomacy can reach alliances",()=>{
 const game=setup();
 month(game,30);
 assert.equal(game.strategy.startTrade("port").ok,true);
 assert.equal(game.strategy.sendEnvoy("port").ok,true);
 assert.equal(game.strategy.sendEnvoy("port").ok,false);
 month(game,60);
 assert.equal(game.strategy.sendEnvoy("port").ok,true);
 assert.equal(game.strategy.signPact("port").ok,true);
 month(game,90);
 assert.equal(game.strategy.sendEnvoy("port").ok,true);
 assert.equal(game.strategy.signAlliance("port").ok,true);
 assert.equal(game.strategy.relation("port").alliance,true);
 const before=game.economy.town("pioneer").treasury;
 month(game,120);
 assert.ok(game.economy.town("pioneer").treasury>before);
});
test("alliance requires treaties to be cancelled before a declaration of war",()=>{
 const game=setup();
 month(game,30);game.strategy.startTrade("port");
 assert.equal(game.strategy.declareWar("port").ok,false);
 assert.equal(game.strategy.withdraw("port").ok,true);
 assert.equal(game.strategy.declareWar("port").ok,true);
 assert.equal(game.strategy.relation("port").war,true);
 assert.equal(game.strategy.seekPeace("port").ok,true);
 assert.equal(game.strategy.declareWar("port").ok,false);
});
test("military recruitment charges treasury and rejects insufficient funds",()=>{
 const game=setup();
 assert.equal(game.strategy.recruit("pioneer").ok,false);
 month(game,60);
 const before=game.economy.town("pioneer").treasury;
 assert.equal(game.strategy.recruit("pioneer").ok,true);
 assert.equal(game.economy.town("pioneer").treasury,before-125);
 assert.equal(game.strategy.armies.pioneer,17);
});
test("campaign changes governing rights but never title-deed ownership",()=>{
 const game=setup();
 game.economy.assets.push({id:"land:1",kind:"land",ownerId:"villager",
  tenantId:"resident",territoryId:"capital",lat:-7,lon:116,radiusM:20,destroyed:false});
 game.strategy.armies.pioneer=200;
 game.economy.town("pioneer").treasury=1000;
 assert.equal(game.strategy.declareWar("capital").ok,true);
 const result=game.strategy.campaign("pioneer","capital",150);
 assert.equal(result.ok,true);
 assert.equal(result.won,true);
 assert.equal(game.economy.town("capital").rulerId,"player");
 assert.equal(game.economy.assets[0].ownerId,"villager");
 assert.equal(game.economy.assets[0].tenantId,"resident");
 assert.equal(game.strategy.campaign("pioneer","capital",20).ok,false);
});
test("strategy can save and restore alongside the territory economy",()=>{
 const game=setup();
 month(game,30);
 game.strategy.sendEnvoy("forest");
 const restoredEconomy=new TerritoryEconomy(game.economy.snapshot(),30);
 const restored=new FactionStrategy(restoredEconomy,game.strategy.snapshot(),30);
 assert.deepEqual(restored.snapshot(),game.strategy.snapshot());
 assert.deepEqual(restoredEconomy.snapshot(),game.economy.snapshot());
});
test("invalid troop quantities and target codes cannot modify state",()=>{
 const game=setup();
 game.economy.town("pioneer").treasury=2000;
 game.strategy.declareWar("mountain");
 const before=game.strategy.snapshot();
 assert.equal(game.strategy.campaign("pioneer","mountain",NaN).ok,false);
 assert.equal(game.strategy.campaign("pioneer","mountain",-1).ok,false);
 assert.equal(game.strategy.campaign("pioneer","nonexistent",5).ok,false);
 assert.deepEqual(game.strategy.snapshot(),before);
});
