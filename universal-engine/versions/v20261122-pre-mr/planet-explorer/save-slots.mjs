/** Independent named save slots. Legacy quick saves remain untouched. */
export const SAVE_SLOT_PREFIX="universal-engine:explorer:slot:v1:";
export const MAX_SAVE_SLOTS=5;
export const slotKey=id=>{
 const n=Number(id);
 if(!Number.isSafeInteger(n)||n<1||n>MAX_SAVE_SLOTS)throw new RangeError("セーブスロットは1〜5です");
 return SAVE_SLOT_PREFIX+n;
};
export function readSlot(storage,id){
 const raw=storage.getItem(slotKey(id));
 if(!raw)return null;
 const slot=JSON.parse(raw);
 if(slot?.format!=="ue/save-slot"||slot.version!==1||
   slot.game?.format!=="ue/explorer-demo"||slot.game.version!==1)
   throw new Error("このスロットの形式は未対応です");
 return slot;
}
export function writeSlot(storage,id,game,name=""){
 if(game?.format!=="ue/explorer-demo"||game.version!==1)throw new Error("保存形式が不正です");
 const safeName=String(name||"").trim().slice(0,40)||"スロット"+id;
 const slot={format:"ue/save-slot",version:1,name:safeName,updatedAt:new Date().toISOString(),
  settlementId:game.v0_8r?.destinationId||"pioneer",timeDays:game.planet?.timeDays??null,game};
 storage.setItem(slotKey(id),JSON.stringify(slot));
 return slot;
}
export function eraseSlot(storage,id){storage.removeItem(slotKey(id));}
export function slotIndex(storage){
 return Array.from({length:MAX_SAVE_SLOTS},(_,i)=>{
  try{return {id:i+1,slot:readSlot(storage,i+1)};}
  catch(error){return {id:i+1,error:error.message,slot:null};}
 });
}
