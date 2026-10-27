/** Portable offline cross-device handoff. No account or cloud sync is implied.
 * The JSON holds only the explicitly captured game and optional VR wearables.
 * Exported game data may include player-created notes, media links and world details.
 * Do not share the JSON publicly. No unrelated localStorage or auth keys are copied.
 */
export const PORTABLE_SAVE_FORMAT = "ue/portable-explorer";
export const PORTABLE_SAVE_VERSION = 1;
export const MAX_PORTABLE_SAVE_BYTES = 16 * 1024 * 1024;
export const VR_WEARABLE_SAVE_KEY = "universal-engine:explorer:vr-wearables:v1";

export function validateExplorerGame(game) {
 if (!game || game.format !== "ue/explorer-demo" || game.version !== 1 ||
     !game.explorer || game.explorer.format !== "ue/explorer" ||
     game.explorer.version !== 1 || !game.planet || !game.universe)
   throw new Error("Universal Engineの対応する冒険データではありません");
 if (![game.explorer.x,game.explorer.z,game.explorer.yaw,
       game.explorer.altitudeM].every(Number.isFinite))
   throw new Error("プレイヤーの位置情報が不正です");
 return game;
}

export function createPortableSave(game,{wearables=null,exportedAt=new Date().toISOString()}={}) {
 validateExplorerGame(game);
 if (wearables !== null && (typeof wearables !== "object" || Array.isArray(wearables)))
   throw new Error("VR装備データが不正です");
 const document={format:PORTABLE_SAVE_FORMAT,version:PORTABLE_SAVE_VERSION,
  exportedAt,game,wearables};
 const json=JSON.stringify(document);
 if (new TextEncoder().encode(json).length>MAX_PORTABLE_SAVE_BYTES)
   throw new Error("セーブデータが16MBを超えています");
 return json;
}
export function parsePortableSave(raw) {
 if (typeof raw !== "string" || new TextEncoder().encode(raw).length>MAX_PORTABLE_SAVE_BYTES)
   throw new Error("ファイルが大きすぎるか、文字列ではありません");
 let data;
 try {data=JSON.parse(raw);} catch (_) {throw new Error("JSONファイルを読み取れません");}
 // Old raw explorer quick saves can also be imported, without changing the original.
 if (data?.format==="ue/explorer-demo")
   return {game:validateExplorerGame(data),wearables:null,exportedAt:null};
 if (data?.format!==PORTABLE_SAVE_FORMAT || data.version!==PORTABLE_SAVE_VERSION)
   throw new Error("このセーブファイル形式には対応していません");
 validateExplorerGame(data.game);
 if (data.wearables!==null && data.wearables!==undefined &&
     (typeof data.wearables!=="object" || Array.isArray(data.wearables)))
   throw new Error("VR装備データが不正です");
 return {game:data.game,wearables:data.wearables??null,exportedAt:data.exportedAt??null};
}
