/** Client-side, one-time gate for optional avatar study outfits.
 * This is a UI restriction, not cryptographic protection or age verification.
 */
export const AVATAR_V10_WARDROBE_UNLOCK_KEY="universal-engine:avatar-v10:wardrobe-verified:v1";
export const requiresAvatarWardrobeUnlock=outfit=>outfit==="swim"||outfit==="base";
export const validAvatarWardrobeCode=input=>String(input??"").trim()==="9876";
export function avatarWardrobeUnlocked(storage){
 try{return storage?.getItem(AVATAR_V10_WARDROBE_UNLOCK_KEY)==="1";}
 catch{return false;}
}
export function unlockAvatarWardrobe(storage,code){
 if(!validAvatarWardrobeCode(code))return false;
 try{storage?.setItem(AVATAR_V10_WARDROBE_UNLOCK_KEY,"1");}
 catch{return false;}
 return avatarWardrobeUnlocked(storage);
}
