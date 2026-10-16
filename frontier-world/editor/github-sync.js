(() => {
"use strict";

const SUPABASE_URL = "https://htwcscrllohavtbejhjr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_JAfSoZsiNAM2FSCVd3e_1Q_-g9AuMko";
const REPO = "hublab055-crypto/kamoku-world-monitor";
const BRANCH = "main";
const ROOT = "frontier-world/";
const REDIRECT_TO = "https://hublab055-crypto.github.io/kamoku-world-monitor/frontier-world/editor/";
const TOKEN_KEY = "fw_github_provider_token";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const client = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
});

let githubToken = sessionStorage.getItem(TOKEN_KEY) || "";
let githubUser = null;
let canPush = false;
let loaded = null;
let previewUrl = null;

function toast(msg){
  const el=$("#toast"); if(!el) return;
  el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2200);
}
function normalizePath(path){
  path=String(path||"").trim().replace(/^\/+|\/+$/g,"").replace(/\/+/g,"/");
  if(!path) return "frontier-world";
  if(path.includes("..")) throw new Error(".. を含むパスは使えません");
  if(path!=="frontier-world" && !path.startsWith(ROOT)) throw new Error("frontier-world/ 配下のみ編集できます");
  return path;
}
function isImagePath(path){ return /\.(png|jpe?g|webp|gif)$/i.test(path); }
function extMime(path){
  const ext=(path.split(".").pop()||"").toLowerCase();
  return ({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif"})[ext] || "application/octet-stream";
}
function bytesToBase64(bytes){
  let out="", chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk) out += String.fromCharCode(...bytes.subarray(i,Math.min(bytes.length,i+chunk)));
  return btoa(out);
}
function base64ToBytes(b64){
  const clean=String(b64||"").replace(/\s/g,""), bin=atob(clean), out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out;
}
function textToBase64(text){ return bytesToBase64(new TextEncoder().encode(text)); }
function base64ToText(b64){ return new TextDecoder().decode(base64ToBytes(b64)); }
function clearPreview(){
  if(previewUrl){ URL.revokeObjectURL(previewUrl); previewUrl=null; }
  $("#githubBinaryPreview").hidden=true;
  $("#githubImagePreview").removeAttribute("src");
}
function setStatus(text,user="—",permission=""){
  $("#githubConnectionStatus").textContent=text;
  $("#githubUserName").textContent=user;
  $("#githubPermissionStatus").textContent=permission || "GitHubログイン後、push権限を確認します。";
}
function updateAuthButtons(){
  const connected=!!githubToken && !!githubUser;
  $("#btnGithubLogin").hidden=connected;
  $("#btnGithubLogout").hidden=!connected;
  $("#btnGithubSave").disabled=!connected || !canPush || !loaded || loaded.binary;
  $("#btnGithubDelete").disabled=!connected || !canPush || !loaded;
  $("#btnGithubBrowse").disabled=!connected;
  $("#btnGithubLoad").disabled=!connected;
  $("#btnGithubRefresh").disabled=!connected || !loaded;
  $("#btnGithubNewFile").disabled=!connected || !canPush;
}
async function gh(path,options={}){
  if(!githubToken) throw new Error("GitHubへログインしてください");
  const res=await fetch("https://api.github.com"+path,{
    ...options,
    headers:{
      "Accept":"application/vnd.github+json",
      "Authorization":"Bearer "+githubToken,
      "X-GitHub-Api-Version":"2022-11-28",
      ...(options.headers||{})
    }
  });
  if(res.status===204) return null;
  const text=await res.text();
  let body=null; try{body=text?JSON.parse(text):null;}catch{body=text;}
  if(!res.ok){
    const msg=(body&&body.message)||("GitHub HTTP "+res.status);
    const err=new Error(msg); err.status=res.status; err.body=body; throw err;
  }
  return body;
}
async function verifyGithub(){
  if(!githubToken){ githubUser=null;canPush=false;setStatus("未接続");updateAuthButtons();return false; }
  try{
    const [user,repo]=await Promise.all([gh("/user"),gh("/repos/"+REPO)]);
    githubUser=user;
    canPush=!!repo?.permissions?.push;
    setStatus("接続済み",user.login||user.name||"GitHub user",canPush?"このRepositoryへpush可能です。":"このRepositoryへのpush権限がありません。");
    updateAuthButtons();
    return true;
  }catch(e){
    if(e.status===401){
      sessionStorage.removeItem(TOKEN_KEY);githubToken="";githubUser=null;canPush=false;
      setStatus("再ログインが必要","—","GitHubトークンが無効または期限切れです。");
      updateAuthButtons();
      return false;
    }
    setStatus("接続エラー","—",e.message);updateAuthButtons();return false;
  }
}
async function signIn(){
  if(!client){toast("Supabase Authライブラリを読み込めませんでした");return;}
  const {error}=await client.auth.signInWithOAuth({
    provider:"github",
    options:{ scopes:"public_repo read:user", redirectTo:REDIRECT_TO }
  });
  if(error) toast("GitHubログイン開始に失敗: "+error.message);
}
async function signOut(){
  sessionStorage.removeItem(TOKEN_KEY);githubToken="";githubUser=null;canPush=false;loaded=null;
  try{await client?.auth.signOut();}catch{}
  clearEditor();setStatus("未接続");updateAuthButtons();toast("ログアウトしました");
}

async function getContents(path){
  path=normalizePath(path);
  return gh("/repos/"+REPO+"/contents/"+encodePath(path)+"?ref="+encodeURIComponent(BRANCH));
}
function encodePath(path){ return path.split("/").map(encodeURIComponent).join("/"); }

async function browse(){
  try{
    const path=normalizePath($("#githubPath").value||"frontier-world");
    const data=await getContents(path);
    if(!Array.isArray(data)){
      await loadFile(path);
      return;
    }
    $("#githubFileList").innerHTML="";
    const sorted=[...data].sort((a,b)=>(a.type===b.type?String(a.name).localeCompare(String(b.name)):a.type==="dir"?-1:1));
    sorted.forEach(item=>{
      const btn=document.createElement("button");
      btn.className="github-file-row";
      btn.innerHTML='<span>'+(item.type==="dir"?"📁":"📄")+'</span><span class="name"></span><small></small>';
      btn.querySelector(".name").textContent=item.name;
      btn.querySelector("small").textContent=item.type==="dir"?"folder":formatBytes(item.size||0);
      btn.onclick=async()=>{
        $("#githubPath").value=item.path;
        if(item.type==="dir") await browse(); else await loadFile(item.path);
      };
      $("#githubFileList").appendChild(btn);
    });
  }catch(e){toast("一覧取得失敗: "+e.message);}
}
function formatBytes(n){
  if(n<1024)return n+" B"; if(n<1048576)return (n/1024).toFixed(1)+" KB"; return (n/1048576).toFixed(1)+" MB";
}
async function loadFile(path){
  try{
    path=normalizePath(path||$("#githubPath").value);
    $("#githubPath").value=path;
    const meta=await getContents(path);
    if(Array.isArray(meta)){ await browse();return; }
    clearPreview();
    const binary=isImagePath(path);
    let bytes;
    if(meta.encoding==="base64" && meta.content){
      bytes=base64ToBytes(meta.content);
    }else if(meta.download_url){
      const res=await fetch(meta.download_url,{cache:"no-store"});
      if(!res.ok) throw new Error("raw file HTTP "+res.status);
      bytes=new Uint8Array(await res.arrayBuffer());
    }else{
      throw new Error("ファイル本文を取得できません");
    }
    loaded={path,sha:meta.sha,originalBytes:bytes,binary,meta};
    $("#githubLoadedPath").textContent=path;
    $("#githubFileSha").textContent="sha "+String(meta.sha||"").slice(0,12);
    $("#githubDiff").hidden=true;
    if(binary){
      const blob=new Blob([bytes],{type:extMime(path)});
      previewUrl=URL.createObjectURL(blob);
      $("#githubImagePreview").src=previewUrl;
      $("#githubBinaryPreview").hidden=false;
      $("#githubTextEditor").value="";
      $("#githubTextEditor").disabled=true;
    }else{
      const text=new TextDecoder().decode(bytes);
      loaded.originalText=text;
      $("#githubTextEditor").value=text;
      $("#githubTextEditor").disabled=false;
    }
    updateAuthButtons();
    toast("GitHubから読み込みました");
  }catch(e){toast("読込失敗: "+e.message);}
}
function clearEditor(){
  clearPreview();loaded=null;
  $("#githubLoadedPath").textContent="ファイル未読込";
  $("#githubFileSha").textContent="";
  $("#githubTextEditor").value="";$("#githubTextEditor").disabled=true;
  $("#githubDiff").hidden=true;$("#githubFileList").innerHTML="";
  updateAuthButtons();
}
function newFile(){
  if(!canPush)return;
  let path=prompt("新規ファイルのパス", "frontier-world/data/new-file.json");
  if(!path)return;
  try{path=normalizePath(path);}catch(e){toast(e.message);return;}
  loaded={path,sha:null,originalText:"",originalBytes:new Uint8Array(),binary:false,meta:null};
  $("#githubPath").value=path;$("#githubLoadedPath").textContent=path;$("#githubFileSha").textContent="new file";
  $("#githubTextEditor").value="";$("#githubTextEditor").disabled=false;
  clearPreview();$("#githubFileList").innerHTML="";updateAuthButtons();toast("新規ファイル編集モード");
}
function protectedMainGame(path){ return path==="frontier-world/index.html"; }
function assertWriteAllowed(path){
  normalizePath(path);
  if(protectedMainGame(path) && !$("#githubConfirmMainGame").checked){
    throw new Error("ゲーム本体 index.html の更新許可チェックが必要です");
  }
}
async function saveText(){
  if(!loaded||loaded.binary||!canPush)return;
  try{
    assertWriteAllowed(loaded.path);
    const message=$("#githubCommitMessage").value.trim()||"Update Frontier World content";
    const body={message,content:textToBase64($("#githubTextEditor").value),branch:BRANCH};
    if(loaded.sha) body.sha=loaded.sha;
    const result=await gh("/repos/"+REPO+"/contents/"+encodePath(loaded.path),{
      method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
    });
    loaded.sha=result?.content?.sha||loaded.sha;
    loaded.originalText=$("#githubTextEditor").value;
    $("#githubFileSha").textContent="sha "+String(loaded.sha||"").slice(0,12);
    $("#githubDiff").hidden=true;
    toast("GitHubへコミットしました");
  }catch(e){
    if(e.status===409||e.status===422) toast("保存競合またはSHA不一致です。再読込して確認してください。");
    else toast("保存失敗: "+e.message);
  }
}
async function deleteFile(){
  if(!loaded||!loaded.sha||!canPush)return;
  if(!confirm("GitHub上の "+loaded.path+" を削除しますか？ コミット履歴からは復元できます。"))return;
  try{
    assertWriteAllowed(loaded.path);
    await gh("/repos/"+REPO+"/contents/"+encodePath(loaded.path),{
      method:"DELETE",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:"Delete "+loaded.path+" from Creator Suite",sha:loaded.sha,branch:BRANCH})
    });
    clearEditor();toast("GitHubから削除しました");
  }catch(e){toast("削除失敗: "+e.message);}
}
function showDiff(){
  if(!loaded||loaded.binary)return;
  const before=String(loaded.originalText||"").split("\n"), after=String($("#githubTextEditor").value||"").split("\n");
  const max=Math.max(before.length,after.length), rows=[];
  let changes=0;
  for(let i=0;i<max;i++){
    const a=before[i],b=after[i];
    if(a===b) continue;
    changes++;
    if(a!==undefined) rows.push('<div class="diff-del">- '+escapeHtml(a)+'</div>');
    if(b!==undefined) rows.push('<div class="diff-add">+ '+escapeHtml(b)+'</div>');
    if(rows.length>200){rows.push('<div class="muted">…差分が多いため省略…</div>');break;}
  }
  $("#githubDiff").innerHTML=changes?('<div class="diff-summary">'+changes+' 行位置に変更</div>'+rows.join("")):'<div class="diff-summary">変更はありません。</div>';
  $("#githubDiff").hidden=false;
}
function escapeHtml(v){return String(v??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}

async function getFileBlob(path){
  path=normalizePath(path);
  const meta=await getContents(path);
  if(Array.isArray(meta)) throw new Error("ファイルを指定してください");
  let bytes;
  if(meta.encoding==="base64"&&meta.content) bytes=base64ToBytes(meta.content);
  else if(meta.download_url){
    const res=await fetch(meta.download_url,{cache:"no-store"});
    if(!res.ok)throw new Error("raw file HTTP "+res.status);
    bytes=new Uint8Array(await res.arrayBuffer());
  }else throw new Error("ファイル本文を取得できません");
  return {path,sha:meta.sha,blob:new Blob([bytes],{type:extMime(path)}),meta};
}
async function putBlob(path,blob,message,knownSha=null){
  if(!canPush) throw new Error("GitHub push権限がありません");
  path=normalizePath(path);assertWriteAllowed(path);
  const bytes=new Uint8Array(await blob.arrayBuffer());
  let sha=knownSha;
  if(!sha){
    try{const meta=await getContents(path);if(!Array.isArray(meta))sha=meta.sha;}catch(e){if(e.status!==404)throw e;}
  }
  const body={message:message||("Update "+path+" from Creator Suite"),content:bytesToBase64(bytes),branch:BRANCH};
  if(sha)body.sha=sha;
  const result=await gh("/repos/"+REPO+"/contents/"+encodePath(path),{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  return result;
}

$("#btnGithubLogin").onclick=signIn;
$("#btnGithubLogout").onclick=signOut;
$("#btnGithubBrowse").onclick=browse;
$("#btnGithubLoad").onclick=()=>loadFile($("#githubPath").value);
$("#btnGithubRefresh").onclick=()=>loaded&&loadFile(loaded.path);
$("#btnGithubNewFile").onclick=newFile;
$("#btnGithubSave").onclick=saveText;
$("#btnGithubDelete").onclick=deleteFile;
$("#btnGithubDiff").onclick=showDiff;
$("#githubPath").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadFile($("#githubPath").value);}});
$("#btnGithubOpenImageEditor").onclick=async()=>{
  if(!loaded?.binary)return;
  if(!window.FrontierImageEditor?.importGithubAsset){toast("画像エディタ連携を初期化できませんでした");return;}
  const rec=await getFileBlob(loaded.path);
  await window.FrontierImageEditor.importGithubAsset(rec.path,rec.blob,rec.sha);
  document.querySelector('.nav[data-view="images"]')?.click();
  toast("画像エディタで開きました");
};

window.FrontierGitHubSync={
  isConnected:()=>!!githubToken&&canPush,
  getFileBlob,
  putBlob,
  getToken:()=>githubToken,
  repo:REPO,
  branch:BRANCH
};

if(client){
  client.auth.onAuthStateChange((event,session)=>{
    if(session?.provider_token){
      githubToken=session.provider_token;
      sessionStorage.setItem(TOKEN_KEY,githubToken);
      setTimeout(verifyGithub,0);
    }
    if(event==="SIGNED_OUT"){
      sessionStorage.removeItem(TOKEN_KEY);githubToken="";githubUser=null;canPush=false;
      setStatus("未接続");updateAuthButtons();
    }
  });
  client.auth.getSession().then(({data})=>{
    if(data?.session?.provider_token){
      githubToken=data.session.provider_token;sessionStorage.setItem(TOKEN_KEY,githubToken);
    }
    verifyGithub();
  }).catch(()=>verifyGithub());
}else{
  setStatus("Auth初期化失敗","—","Supabase Authライブラリを読み込めませんでした。");
  updateAuthButtons();
}
})();