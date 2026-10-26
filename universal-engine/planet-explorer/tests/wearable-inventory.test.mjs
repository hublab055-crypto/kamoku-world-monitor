import assert from "node:assert/strict";
import {WearableInventory,starterWearables} from "../wearable-inventory.mjs";

const inv=starterWearables();
assert.equal(inv.capacity("shoulder-quiver").freeSlots,18);
assert.equal(inv.grab("left","hip-sheath").id,"training-sword");
assert.equal(inv.grab("right","hip-sheath"),null);
assert.equal(inv.returnToContainer("left","hip-sheath"),true);
assert.equal(inv.hands.left,null);
assert.equal(inv.grab("right","shoulder-quiver").tag,"arrow");
assert.equal(inv.capacity("shoulder-quiver").freeSlots,19);
assert.equal(inv.returnToContainer("right","hip-sheath"),false);
assert.equal(inv.returnToContainer("right","shoulder-quiver"),true);
assert.equal(inv.grab("right","travel-backpack"),null);
inv.setAccess("travel-backpack",{open:true,accessible:true});
assert.equal(inv.stow("field-note","travel-backpack"),false); // already in pocket
assert.equal(inv.grab("left","trouser-pocket").id,"field-note");
assert.equal(inv.returnToContainer("left","travel-backpack"),true);
assert.equal(inv.grab("left","travel-backpack").id,"field-note");
assert.equal(inv.stow("field-note","trouser-pocket",{fromHand:"left"}),true);
assert.equal(inv.location("field-note").containerId,"trouser-pocket");
assert.equal(inv.isInReach("hip-sheath",{x:0,y:0,z:0},{x:0.1,y:0,z:0}),true);
assert.equal(inv.isInReach("hip-sheath",{x:0,y:0,z:0},{x:1,y:0,z:0}),false);
assert.deepEqual(WearableInventory.fromSnapshot(inv.snapshot()).snapshot(),inv.snapshot());
const live=starterWearables({combatDemo:false});
assert.equal(live.items.has("training-sword"),false);
assert.equal(live.containers.get("shoulder-quiver").items.length,0);
assert.equal(live.containers.get("trouser-pocket").items.length,1);
assert.equal(live.setPreset("travel-backpack","satchel"),true);
assert.equal(live.capacity("travel-backpack").freeL,9);
assert.equal(live.setSocket("trouser-pocket","rightCoat"),true);
assert.equal(live.containers.get("trouser-pocket").socket,"rightCoat");
live.setAccess("travel-backpack",{active:false,open:true,accessible:true});
assert.equal(live.grab("right","travel-backpack"),null);
assert.throws(()=>WearableInventory.fromSnapshot({
 version:1,items:[{id:"book",tag:"paper",kg:12,litres:1}],
 containers:[{id:"too-small",preset:"pocket",socket:"rightPocket",items:["book"]}],
 hands:{left:null,right:null}
}),/overfilled/);
console.log("Wearable inventory tests passed");
