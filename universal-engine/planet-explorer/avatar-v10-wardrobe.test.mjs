import test from "node:test";
import assert from "node:assert/strict";
import {requiresAvatarWardrobeUnlock,validAvatarWardrobeCode,unlockAvatarWardrobe,avatarWardrobeUnlocked} from "./avatar-v10-wardrobe.mjs";
test("base and swim modes require one-time 9876 before first use",()=>{
 const data=new Map(),store={getItem:key=>data.get(key)||null,setItem:(key,v)=>data.set(key,v)};
 assert.equal(requiresAvatarWardrobeUnlock("work"),false);
 assert.equal(requiresAvatarWardrobeUnlock("swim"),true);
 assert.equal(requiresAvatarWardrobeUnlock("base"),true);
 assert.equal(avatarWardrobeUnlocked(store),false);
 assert.equal(unlockAvatarWardrobe(store,"1111"),false);
 assert.equal(unlockAvatarWardrobe(store,"9876"),true);
 assert.equal(avatarWardrobeUnlocked(store),true);
 assert.equal(validAvatarWardrobeCode("9876"),true);
});
