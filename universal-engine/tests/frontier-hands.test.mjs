import test from "node:test";
import assert from "node:assert/strict";
import {SocialEquipment} from "../planet-explorer/social-equipment.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";
import {Lifestyle} from "../planet-explorer/lifestyle.mjs";

function scene(){
 const terrain=new Terrain(new Planet({seed:77})),control=new ExplorerController(terrain);
 const actions=new Actions(),squad=new SquadEngine(terrain,control,actions),life=new Lifestyle();
 squad.attachLifestyle(life);
 const equipment=new SocialEquipment();
 return {squad,life,equipment,control};
}
test("both hands are independent per actor and survive old v0.7i saves",()=>{
 const {squad,life,equipment}=scene(),player=squad.get("player"),scout=squad.get("scout");
 assert.equal(equipment.handItem("player","right"),"sword");
 assert.equal(equipment.handItem("player","left"),"axe");
 assert.equal(equipment.useHand(player,"left",life,squad.frontier).action,"axe");
 assert.equal(equipment.equipHand(player,"right","cup",life,squad.frontier).ok,true);
 assert.equal(equipment.handItem("player","right"),"cup");
 assert.equal(equipment.handItem("player","left"),"axe");
 assert.equal(equipment.handItem("scout","right"),"sword");
 const saved=new SocialEquipment(equipment.snapshot());
 assert.equal(saved.handItem("player","right"),"cup");
 assert.equal(saved.handItem("player","left"),"axe");
 const older=equipment.snapshot();
 for(const data of Object.values(older.actors))delete data.hands;
 assert.equal(new SocialEquipment(older).handItem("player","right"),"sword");
 assert.equal(new SocialEquipment(older).handItem("scout","left"),"axe");
 assert.equal(equipment.equipHand(scout,"left","none",life,squad.frontier).ok,true);
 assert.equal(equipment.useHand(scout,"left",life,squad.frontier).ok,false);
});
test("one unique carried consumable cannot occupy both hands",()=>{
 const {squad,life,equipment}=scene(),actor=squad.get("player");
 life.inventory.cup=1;
 assert.equal(equipment.equipHand(actor,"right","cup",life,squad.frontier).ok,true);
 assert.equal(equipment.equipHand(actor,"left","cup",life,squad.frontier).ok,false);
 life.inventory.cup=2;
 assert.equal(equipment.equipHand(actor,"left","cup",life,squad.frontier).ok,true);
 life.inventory.cup=1;
 const used=equipment.useHand(actor,"right",life,squad.frontier);
 assert.equal(used.ok,true);
 assert.equal(life.inventory.cup,0);
 assert.equal(equipment.useHand(actor,"left",life,squad.frontier).ok,false);
});
test("inventory list includes earned/gifted materials, and hand use checks real stock",()=>{
 const {squad,life,equipment}=scene(),player=squad.get("player");
 life.inventory.meal=1;
 const bag=squad.frontier.person("player").inventory;
 bag.wood=3;
 const choices=equipment.inventoryFor(player,life,squad.frontier);
 assert.equal(choices.find(item=>item.id==="wood")?.quantity,3);
 assert.equal(choices.find(item=>item.id==="meal")?.quantity,1);
 assert.equal(choices.find(item=>item.id==="sword")?.source,"基本装備");
 assert.equal(equipment.equipHand(player,"right","meal",life,squad.frontier).ok,true);
 const before=life.stats.hunger;
 assert.equal(equipment.useHand(player,"right",life,squad.frontier).ok,true);
 assert.equal(life.inventory.meal,0);
 assert.ok(life.stats.hunger<before);
 assert.equal(equipment.useHand(player,"right",life,squad.frontier).ok,false);
 assert.equal(equipment.equipHand(player,"left","chest",life,squad.frontier).ok,false);
});
test("gifted inventory can be equipped and used by recipient without duplicating items",()=>{
 const {squad,life,equipment}=scene(),scout=squad.get("scout");
 life.inventory.cup=0;life.inventory.water=3;
 squad.frontier.person("scout").gifts={cup:1};
 assert.equal(equipment.equipHand(scout,"left","cup",life,squad.frontier).ok,true);
 const result=equipment.useHand(scout,"left",life,squad.frontier);
 assert.equal(result.ok,true);
 assert.equal(squad.frontier.person("scout").gifts.cup,0);
 assert.equal(life.inventory.cup,0);
 assert.equal(life.inventory.water,2);
});
test("selected NPC uses correct hand while maintaining tool animation metadata",()=>{
 const {squad}=scene();
 const scout=squad.get("scout");
 scout.control.altitudeM=2.5;
 scout.control.targetAltitudeM=2.5;
 assert.equal(squad.performEquippedAction("scout","axe","left"),true);
 assert.equal(scout.task.hand,"left");
 assert.equal(squad.getMotion(scout).hand,"left");
});
