/**
 * PUBLIC protocol is deliberately independent of PRIVATE playback.
 * An authenticated authoritative server must validate publishing permission,
 * provider policy, origin allowlists and playback commands before broadcast.
 */
const actions=new Set(["play","pause","seek","stop"]);
const providerIds={
  youtube:/^[A-Za-z0-9_-]{11}$/,
  vimeo:/^[0-9]{6,12}$/,
  dailymotion:/^[a-zA-Z0-9]{5,16}$/
};
const validId=(provider,id,streamHosts)=> {
  if(typeof id!=="string" || id.length>2048)return false;
  if(providerIds[provider])return providerIds[provider].test(id);
  if(provider!=="direct")return false;
  try {
    const u=new URL(id);
    return u.protocol==="https:"&&!u.username&&!u.password&&
      streamHosts.includes(u.hostname.toLowerCase())&&
      /\.(mp4|webm|m3u8)$/i.test(u.pathname);
  }catch(_){return false;}
};
/** Returns the ONLY serializable public wire shape; strips incidental/private keys. */
export function publicCommand({screenId,provider,id,action,position=0,version=1},policy){
  const providers=policy?.approvedProviders||[];
  const streamHosts=policy?.streamHosts||[];
  if(typeof screenId!=="string" || !/^[a-zA-Z0-9_-]{1,72}$/.test(screenId) ||
     !providers.includes(provider)||!validId(provider,id,streamHosts)||
     !actions.has(action)||!Number.isFinite(position)||position<0||
     position>24*3600||version!==1)throw Error("PUBLIC放送の認可または同期コマンドが不正です");
  return {version:1,screenId,provider,id,action,position};
}
export class PublicSyncController {
  constructor({transport=null,policy=null,authorize=null,onCommand=()=>{}}={}){
    this.transport=transport;this.policy=policy;
    this.authorize=authorize;this.onCommand=onCommand;
    this.unsub=null;this.ready=false;
  }
  connect(){
    if(!this.transport?.send||!this.transport?.subscribe||!this.policy?.approvedProviders?.length)
      return false;
    this.unsub=this.transport.subscribe(packet=>{
      // Transport MUST be a verified, server-authoritative PUBLIC channel.
      if(packet?.channel!=="ue-public-video" || packet?.verified!==true)return;
      let command;
      try{command=publicCommand(packet,this.policy);}catch(_){return;}
      const issued=Number(packet.serverTime);
      if(!Number.isFinite(issued)||issued<=0)return;
      const elapsed=command.action==="play"?
        Math.max(0,Math.min(30,(Date.now()-issued)/1000)):0;
      this.onCommand({...command,position:command.position+elapsed});
    });
    this.ready=true;return true;
  }
  async publish(command){
    if(!this.ready||typeof this.authorize!=="function")
      throw Error("認証済みPUBLIC配信サーバーに接続されていません");
    const wire=publicCommand(command,this.policy);
    // The authorize callback must consult a trusted server, never local owner flags.
    if(await this.authorize(wire)!==true)throw Error("PUBLIC公開の許可がありません");
    await this.transport.send({channel:"ue-public-video",...wire});
    return wire;
  }
  disconnect(){this.unsub?.();this.unsub=null;this.ready=false;}
}
