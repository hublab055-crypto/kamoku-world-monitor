/**
 * Only official HTTPS embeds and explicit direct-stream hosts are accepted.
 * A URL is treated as input, never as HTML or executable code.
 */
const fail = message => { throw new Error(message); };
const safeUrl = input => {
  if (typeof input !== "string" || input.length > 2048) fail("URLが長すぎるか不正です");
  let url;
  try { url = new URL(input); } catch (_) { fail("正しいURLを入力してください"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port && url.port !== "443")
    fail("HTTPSで認証情報を含まないURLだけ使用できます");
  if (url.hostname.endsWith(".") || !url.hostname) fail("URLのホストが不正です");
  return url;
};
const hosts = (host, allowed) => allowed.includes(host);
const clean = id => String(id || "");
const yt = url => {
  const h = url.hostname.toLowerCase();
  if (!hosts(h, ["youtu.be", "www.youtu.be", "youtube.com", "www.youtube.com",
    "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"])) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  let id = null;
  if (h.endsWith("youtu.be")) id = parts.length === 1 ? parts[0] : null;
  else if (url.pathname === "/watch") id = url.searchParams.get("v");
  else if (parts.length === 2 && ["embed", "shorts", "live"].includes(parts[0])) id = parts[1];
  return /^[A-Za-z0-9_-]{11}$/.test(clean(id)) ? id : null;
};
const vimeo = url => {
  if (!hosts(url.hostname.toLowerCase(), ["vimeo.com", "www.vimeo.com", "player.vimeo.com"])) return null;
  const match = url.pathname.match(/^\/(?:video\/)?([0-9]{6,12})\/?$/);
  return match ? match[1] : null;
};
const daily = url => {
  if (!hosts(url.hostname.toLowerCase(), ["dailymotion.com", "www.dailymotion.com", "dai.ly"])) return null;
  const match = url.hostname.toLowerCase() === "dai.ly" ?
    url.pathname.match(/^\/([a-zA-Z0-9]{5,16})\/?$/) :
    url.pathname.match(/^\/(?:video|embed\/video)\/([a-zA-Z0-9]{5,16})(?:_[^/]*)?\/?$/);
  return match ? match[1] : null;
};
export const DEFAULT_PUBLIC_PROVIDERS = Object.freeze([]); // no browser-side public authority
export const PROVIDERS = Object.freeze({
  youtube: Object.freeze({kind:"embed", publicEligible:true}),
  vimeo: Object.freeze({kind:"embed", publicEligible:true}),
  dailymotion: Object.freeze({kind:"embed", publicEligible:true}),
  direct: Object.freeze({kind:"video", publicEligible:true})
});
export function resolveVideoSource(input, {directHosts=[]}={}) {
  const u = safeUrl(input), host = u.hostname.toLowerCase();
  let id = yt(u);
  if (id) return Object.freeze({provider:"youtube",kind:"embed",id,
    embedUrl:"https://www.youtube-nocookie.com/embed/"+id+"?playsinline=1"});
  id = vimeo(u);
  if (id) return Object.freeze({provider:"vimeo",kind:"embed",id,
    embedUrl:"https://player.vimeo.com/video/"+id});
  id = daily(u);
  if (id) return Object.freeze({provider:"dailymotion",kind:"embed",id,
    embedUrl:"https://www.dailymotion.com/embed/video/"+id});
  if (["youtube.com","www.youtube.com","youtu.be","www.youtu.be","vimeo.com",
    "www.vimeo.com","player.vimeo.com","dailymotion.com","www.dailymotion.com","dai.ly"].includes(host))
    fail("この動画URLは公式埋め込みの形式に対応していません");
  if (!directHosts.includes(host)) fail("直接動画の配信元は許可リストへの登録が必要です");
  if (!/^\/[\s\S]*\.(mp4|webm|m3u8)$/i.test(u.pathname)) fail("MP4、WebM、HLS(.m3u8) のURLのみ利用できます");
  const ext = u.pathname.split(".").pop().toLowerCase();
  return Object.freeze({provider:"direct",kind:"video",id:u.href,
    format:ext === "m3u8" ? "hls" : ext,url:u.href});
}
/** Code-only plugin registration: a page cannot inject an adapter from a URL. */
export class ProviderAdapterRegistry {
  constructor(options={}) {
    this.options=options;
    this.adapters=[{id:"official-or-direct",resolve:url=>resolveVideoSource(url,this.options)}];
  }
  register(id, resolve) {
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(id) || typeof resolve !== "function" ||
      this.adapters.some(a=>a.id===id)) fail("Provider Adapterの登録が不正です");
    this.adapters.unshift({id,resolve});
  }
  resolve(url) {
    let last;
    for (const adapter of this.adapters) {
      try {
        const result=adapter.resolve(url);
        if(result)return Object.freeze(result);
      } catch(e) { last=e; }
    }
    throw last||new Error("未対応の配信元です");
  }
}
