/**
 * Local, offline-friendly share dialog for the current Planet Explorer URL.
 * The QR encoder is a vendored MIT-licensed QRCode.js (no URL sent to an API).
 */
const byId = id => document.getElementById(id);
const overlay = byId("page-share-overlay");
const qrRoot = byId("page-share-qr");
const urlInput = byId("page-share-url");
const copyButton = byId("page-share-copy");
const nativeButton = byId("page-share-native");
const closeButton = byId("page-share-close");
const message = byId("page-share-message");
const triggers = [byId("header-share"), byId("viewport-share")].filter(Boolean);
let lastTrigger = null;

function openShare(event) {
  lastTrigger = event.currentTarget;
  const url = window.location.href;
  urlInput.value = url;
  qrRoot.replaceChildren();
  message.textContent = "このQRコードを別の端末で読み取ると、同じページが開きます。";
  try {
    if (typeof window.QRCode !== "function") throw new Error("QRコード生成ライブラリを読み込めませんでした。");
    new window.QRCode(qrRoot, {
      text: url,
      width: 232,
      height: 232,
      colorDark: "#172e40",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.M
    });
  } catch (error) {
    message.textContent = "QRコードを表示できません。下のURLをコピーして共有してください。";
    console.warn("QR code generation failed:", error);
  }
  nativeButton.hidden = typeof navigator.share !== "function";
  overlay.hidden = false;
  closeButton.focus();
}

function closeShare() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  lastTrigger?.focus();
}

async function copyShareUrl() {
  const url = urlInput.value;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(url);
    message.textContent = "URLをコピーしました。";
  } catch {
    urlInput.focus();
    urlInput.select();
    try {
      if (document.execCommand("copy")) {
        message.textContent = "URLをコピーしました。";
        return;
      }
    } catch { /* Older embedded webviews may deny clipboard access. */ }
    message.textContent = "URLを選択しました。長押しして「コピー」を選んでください。";
  }
}

triggers.forEach(button => button.addEventListener("click", openShare));
closeButton?.addEventListener("click", closeShare);
overlay?.addEventListener("click", event => {
  if (event.target === overlay) closeShare();
});
copyButton?.addEventListener("click", () => { void copyShareUrl(); });
nativeButton?.addEventListener("click", async () => {
  try {
    await navigator.share({title: document.title, url: urlInput.value});
    message.textContent = "共有画面を閉じました。";
  } catch (error) {
    if (error?.name !== "AbortError") message.textContent = "共有できませんでした。URLコピーをご利用ください。";
  }
});
document.addEventListener("keydown", event => {
  if (!overlay || overlay.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeShare();
  } else if (event.key === "Tab") {
    const nodes = Array.from(overlay.querySelectorAll("button:not([hidden]), input:not([hidden])"))
      .filter(node => !node.disabled);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}, true);
