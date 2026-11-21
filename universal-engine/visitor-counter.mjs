// Universal Engine — browser-level visitor number (no cookies or account required).
const STORAGE_KEY = "ue:visitor-id:v1";
const API = "https://htwcscrllohavtbejhjr.supabase.co/functions/v1/ue-visitor";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function visitorId() {
  let saved = null;
  try { saved = window.localStorage.getItem(STORAGE_KEY); } catch { /* private mode */ }
  if (saved && UUID_V4.test(saved)) return saved;
  const fresh = crypto.randomUUID();
  try { window.localStorage.setItem(STORAGE_KEY, fresh); } catch { /* nonpersistent */ }
  return fresh;
}
function deviceClass() {
  const ua = navigator.userAgent || "";
  if (/OculusBrowser|Meta Quest|Quest|PicoBrowser/i.test(ua)) return "vr";
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/iPhone|iPod|Android|Mobile/i.test(ua)) return "mobile";
  return "desktop";
}
function mountCounter() {
  const isLanding = /\/universal-engine\/(?:index\.html)?$/.test(location.pathname);
  const panel = document.createElement("aside");
  panel.className = "ue-visitor-badge" + (isLanding ? "" : " ue-visitor-badge--overlay");
  panel.setAttribute("aria-label", "Universal Engine 訪問者番号");
  panel.innerHTML = [
    '<span class="ue-visitor-eyebrow">UNIVERSAL ENGINE · VISITOR RECORD</span>',
    '<strong class="ue-visitor-title" role="status" aria-live="polite">訪問者番号を確認中…</strong>',
    '<span class="ue-visitor-caption">初回アクセス時に番号を発行します</span>',
  ].join("");
  const css = document.createElement("style");
  css.textContent = `
    .ue-visitor-badge{box-sizing:border-box;padding:16px 19px;margin:0 0 22px;
      border-radius:14px;border:1px solid #4d8194;color:#ecfaff;
      background:linear-gradient(120deg,#142b43,#0c2337);font:inherit;
      display:flex;flex-direction:column;align-items:flex-start;gap:6px;
      box-shadow:0 6px 24px #02111d55}
    .ue-visitor-eyebrow{font-size:10px;letter-spacing:.1em;color:#81dfeb;font-weight:750}
    .ue-visitor-title{font-size:clamp(16px,3vw,23px);font-weight:750;line-height:1.3}
    .ue-visitor-caption{font-size:11px;color:#a7c7d6}
    .ue-visitor-badge--overlay{position:fixed;z-index:2147483000;top:calc(12px + env(safe-area-inset-top));
      left:50%;transform:translateX(-50%);width:max-content;max-width:94vw;margin:0;
      pointer-events:none;padding:12px 16px;text-align:center;align-items:center}
    .ue-visitor-badge--overlay .ue-visitor-title{font-size:16px}
    @media(max-width:480px){.ue-visitor-badge{padding:13px 15px}
      .ue-visitor-badge--overlay{width:90vw}}
  `;
  document.head.append(css);
  if (isLanding) {
    (document.querySelector("main.wrap") || document.querySelector("main") || document.body).prepend(panel);
  } else {
    document.body.append(panel);
  }
  return { panel, isLanding };
}
async function register() {
  const { panel, isLanding } = mountCounter();
  const title = panel.querySelector(".ue-visitor-title");
  const caption = panel.querySelector(".ue-visitor-caption");
  try {
    const response = await fetch(API, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitor_id: visitorId(), device_class: deviceClass() }),
    });
    if (!response.ok) throw new Error("register failed");
    const data = await response.json();
    const number = Number(data.number);
    const total = Number(data.total);
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error("invalid ordinal");
    title.textContent = "あなたは " + String(number).padStart(7, "0") + " 人目の訪問者です";
    caption.textContent = Number.isSafeInteger(total) && total >= 1
      ? "現在の登録数 " + total.toLocaleString("ja-JP") + " · " + (data.first_visit ? "ようこそ、開拓者！" : "おかえりなさい！")
      : "ようこそ、Universal Engineへ";
  } catch {
    title.textContent = "訪問者番号を取得できませんでした";
    caption.textContent = "オンライン時に再読み込みすると再試行できます";
  }
  if (!isLanding) window.setTimeout(() => panel.remove(), 12000);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", register, { once: true });
} else {
  register();
}
