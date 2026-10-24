import test from "node:test";
import assert from "node:assert/strict";
import {TerritoryEconomy} from "../planet-explorer/territory-economy.mjs";

const setup=()=>{
 const economy=new TerritoryEconomy(null,0);
 const wallet={coins:40};
 return {economy,wallet,bonds:economy.bonds};
};
const offer=(game,options={})=>{
 const response=game.bonds.issue("pioneer",{face:10,units:20,termMonths:3,interestPercent:10,...options});
 assert.equal(response.ok,true);
 return response.id;
};

test("bond issuance alone does not create money; buying transfers player funds to public treasury",()=>{
 const g=setup(),id=offer(g);
 assert.equal(g.economy.town("pioneer").treasury,0);
 assert.equal(g.wallet.coins,40);
 assert.equal(g.bonds.buy(id,2,g.wallet).ok,true);
 assert.equal(g.wallet.coins,20);
 assert.equal(g.economy.town("pioneer").treasury,20);
 assert.equal(g.bonds.debt("pioneer"),22);
 assert.equal(g.bonds.issues[0].sold,2);
 const before=g.economy.snapshot();
 assert.equal(g.bonds.buy(id,3,g.wallet).ok,false);
 assert.deepEqual(g.economy.snapshot(),before);
 assert.equal(g.wallet.coins,20);
});

test("non-rulers cannot issue, and invalid issue settings or quantities cannot mutate funds",()=>{
 const g=setup();
 assert.equal(g.bonds.issue("capital",{}).ok,false);
 assert.equal(g.bonds.issue("pioneer",{face:0}).ok,false);
 assert.equal(g.bonds.issue("pioneer",{face:10,units:1001}).ok,false);
 const id=offer(g);
 assert.equal(g.bonds.buy(id,0,g.wallet).ok,false);
 assert.equal(g.bonds.buy(id,21,g.wallet).ok,false);
 assert.equal(g.bonds.buy("bond:unknown",1,g.wallet).ok,false);
 assert.equal(g.wallet.coins,40);
 assert.equal(g.economy.town("pioneer").treasury,0);
});

test("principal and interest are paid exactly once from treasury on maturity",()=>{
 const g=setup(),id=offer(g);
 g.bonds.buy(id,2,g.wallet);
 g.economy.town("pioneer").treasury=22;
 assert.equal(g.bonds.settle(89.99,g.wallet),0);
 assert.equal(g.bonds.settle(90,g.wallet),1);
 assert.equal(g.wallet.coins,42);
 assert.equal(g.economy.town("pioneer").treasury,0);
 assert.equal(g.bonds.issues[0].closed,true);
 assert.equal(g.bonds.settle(120,g.wallet),0);
 assert.equal(g.bonds.buy(id,1,g.wallet).ok,false);
});

test("treasury shortage records late payment once per month and later repays",()=>{
 const g=setup(),id=offer(g);
 g.bonds.buy(id,2,g.wallet);
 const t=g.economy.town("pioneer"),support=t.support;
 assert.equal(g.bonds.settle(90,g.wallet),1);
 assert.equal(t.support,support-2);
 assert.equal(g.bonds.settle(90,g.wallet),0);
 assert.equal(t.support,support-2);
 assert.equal(g.bonds.settle(120,g.wallet),1);
 assert.equal(t.support,support-4);
 t.treasury=22;
 assert.equal(g.bonds.settle(120,g.wallet),1);
 assert.equal(g.wallet.coins,42);
 assert.equal(g.bonds.debt("pioneer"),0);
});

test("save restore retains outstanding bonds, and version 1 territory saves migrate",()=>{
 const g=setup(),id=offer(g,{termMonths:6});
 g.bonds.buy(id,1,g.wallet);
 const copy=new TerritoryEconomy(g.economy.snapshot(),30);
 assert.deepEqual(copy.snapshot(),g.economy.snapshot());
 assert.equal(copy.bonds.debt("pioneer"),11);
 assert.notEqual(copy.bonds.issue("pioneer",{}).id,id);
 const v1=g.economy.snapshot();
 delete v1.bonds;
 const migrated=new TerritoryEconomy(v1,30);
 assert.equal(migrated.bonds.issues.length,0);
 assert.equal(migrated.town("pioneer").treasury,10);
});

test("redemption does not destroy coins when player wallet is at its cap",()=>{
 const g=setup(),id=offer(g);
 g.bonds.buy(id,1,g.wallet);
 g.wallet.coins=999999;
 g.economy.town("pioneer").treasury=11;
 assert.equal(g.bonds.settle(90,g.wallet),0);
 assert.equal(g.economy.town("pioneer").treasury,11);
 assert.equal(g.bonds.issues[0].closed,false);
 g.wallet.coins=999980;
 assert.equal(g.bonds.settle(90,g.wallet),1);
 assert.equal(g.wallet.coins,999991);
});
