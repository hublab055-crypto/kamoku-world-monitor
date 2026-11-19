import {
 YOUTUBE_URL_LIBRARY_KEY,normalizeYoutubeSaved,registerYoutubeUrl,unregisterYoutubeUrl,
 youtubeSearchHref,parseYoutubeSearchResults
} from "./world-tablet-youtube.mjs?v=20261119-search-register";

const create=(tag,className,text)=>{
 const e=document.createElement(tag);
 if(className)e.className=className;
 if(text!==undefined)e.textContent=text;
 return e;
};
const btn=(label,action)=>{
 const b=create("button","",label);b.type="button";b.addEventListener("click",action);return b;
};

export function installYoutubeTabletUI({root,state,extractVideoId,searchEndpoint=null,onPlay=()=>false,onStop=()=>{}}){
 if(!root)return null;
 const $=selector=>root.querySelector(selector);
 const pane=$('[data-pane="video"]');
 const form=$("[data-video-form]");
 const input=$('[name="video"]');
 const iframe=$("[data-video-frame]");
 if(!pane||!form||!input||!iframe)return null;

 const registerButton=btn("☆ URL登録",()=>registerCurrent());
 form.append(registerButton);

 const options=create("div","ue-tablet-youtube-forms");
 options.innerHTML=
  '<label>登録名（任意）<input name="youtube-title" type="text" maxlength="120" placeholder="お気に入り動画の名前"></label>'+
  '<form data-youtube-search class="ue-tablet-form">'+
  '<label>YouTube動画を検索<input name="youtube-query" maxlength="180" autocomplete="off" placeholder="検索キーワード"></label>'+
  '<button type="submit">🔎 検索</button><button type="button" data-search-website>公式サイト検索</button></form>'+
  '<p data-search-status role="status">ゲーム内検索には専用サーバが必要です。未設定の場合はYouTube検索を別タブで開きます。</p>'+
  '<div data-youtube-results class="ue-tablet-video-list"></div>';
 form.after(options);
 const savedSection=create("section","ue-tablet-youtube-library");
 savedSection.innerHTML='<div class="ue-tablet-library-heading"><strong>☆ 登録済みURL</strong>'+
  '<small data-saved-count></small></div>'+
  '<div data-youtube-saved class="ue-tablet-video-list"></div>';
 pane.append(savedSection);
 const labelInput=options.querySelector('[name="youtube-title"]');
 const queryInput=options.querySelector('[name="youtube-query"]');
 const searchStatus=options.querySelector("[data-search-status]");
 const results=options.querySelector("[data-youtube-results]");
 const savedList=savedSection.querySelector("[data-youtube-saved]");
 const count=savedSection.querySelector("[data-saved-count]");
 let saved=[];
 try{saved=normalizeYoutubeSaved(localStorage.getItem(YOUTUBE_URL_LIBRARY_KEY));}
 catch(_){saved=[];}

 const play=(id)=>{
  input.value="https://www.youtube.com/watch?v="+id;
  if(onPlay(id)!==true)iframe.src="https://www.youtube-nocookie.com/embed/"+id+"?playsinline=1";
  state("動画を再生します: "+id);
 };
 const persist=(next)=>{
  try{
   localStorage.setItem(YOUTUBE_URL_LIBRARY_KEY,JSON.stringify(next));
   saved=next;renderSaved();return true;
  }catch(_){
   state("URL登録の保存に失敗しました（端末の保存領域を確認してください）");
   return false;
  }
 };
 function registerId(id,title){
  const next=registerYoutubeUrl(saved,id,title);
  if(!next){state("登録できるYouTube動画IDではありません");return;}
  if(persist(next))state("☆ URL登録しました: "+(next[0]?.title||id));
 }
 function registerCurrent(){
  const id=extractVideoId(input.value);
  if(!id){state("登録する動画URLまたは動画IDを入力してください");return;}
  registerId(id,labelInput.value);
 }
 function renderSaved(){
  savedList.replaceChildren();
  count.textContent=saved.length+" / 100件・この端末に保存";
  if(!saved.length){savedList.append(create("p","","登録済みの動画はありません。動画URLを入力して「☆ URL登録」を押してください。"));return;}
  for(const item of saved){
   const row=create("div","ue-tablet-video-item");
   const title=create("div","ue-tablet-video-info");
   title.append(create("strong","",item.title),create("small","","https://youtu.be/"+item.id));
   const actions=create("div","ue-tablet-video-actions");
   actions.append(btn("▶ 再生",()=>play(item.id)),
    btn("URLをコピー",async()=>{
     const url="https://www.youtube.com/watch?v="+item.id;
     try{await navigator.clipboard.writeText(url);state("URLをコピーしました");}
     catch(_){state("コピーできませんでした: "+url);}
    }),
    btn("削除",()=>{
     if(persist(unregisterYoutubeUrl(saved,item.id)))state("登録を削除しました");
    }));
   row.append(title,actions);savedList.append(row);
  }
 }
 renderSaved();

 const searched=options.querySelector("[data-youtube-search]");
 const openYoutubeSearch=()=>{
  const href=youtubeSearchHref(queryInput.value);
  if(!href){searchStatus.textContent="検索キーワードを入力してください";return;}
  window.open(href,"_blank","noopener,noreferrer");
  searchStatus.textContent="YouTube公式検索を別タブで開く操作を実行しました。表示されない場合はポップアップ許可をご確認ください。見つけた動画URLはこの端末に登録できます。";
 };
 options.querySelector("[data-search-website]").addEventListener("click",openYoutubeSearch);
 let searchSequence=0;
 searched.addEventListener("submit",async event=>{
  event.preventDefault();
  const href=youtubeSearchHref(queryInput.value);
  if(!href){searchStatus.textContent="検索キーワードを入力してください";return;}
  if(!searchEndpoint){openYoutubeSearch();return;}
  const seq=++searchSequence;
  results.replaceChildren();
  searchStatus.textContent="検索中…";
  try{
   const target=new URL(searchEndpoint,location.origin);
   target.searchParams.set("q",queryInput.value.trim().slice(0,180));
   const response=await fetch(target.pathname+target.search,{method:"GET",credentials:"same-origin",headers:{"Accept":"application/json"}});
   if(!response.ok)throw Error("HTTP "+response.status);
   const data=await response.json();
   if(seq!==searchSequence)return;
   const matches=parseYoutubeSearchResults(data);
   if(!matches.length){
    searchStatus.textContent="該当動画がありません。公式サイト検索も利用できます。";return;
   }
   searchStatus.textContent=matches.length+"件表示（ゲーム内検索）";
   for(const item of matches){
    const row=create("div","ue-tablet-video-item");
    const info=create("div","ue-tablet-video-info");
    info.append(create("strong","",item.title),create("small","",item.channel||"YouTube"));
    const actions=create("div","ue-tablet-video-actions");
    actions.append(btn("▶ 再生",()=>play(item.id)),
     btn("☆ 登録",()=>registerId(item.id,item.title)));
    row.append(info,actions);results.append(row);
   }
  }catch(error){
   if(seq!==searchSequence)return;
   searchStatus.textContent="ゲーム内検索に接続できませんでした（"+error.message+"）。「公式サイト検索」を利用してください。";
  }
 });
 const syncBookmarks=(event)=>{
  if(event.key===YOUTUBE_URL_LIBRARY_KEY){
   saved=normalizeYoutubeSaved(event.newValue);renderSaved();
  }
 };
 window.addEventListener("storage",syncBookmarks);
 const existingPlay=(event)=>{
  event.preventDefault();
  const id=extractVideoId(input.value);
  if(!id){state("YouTubeのURLまたは11文字の動画IDを入力してください");return;}
  play(id);
 };
 form.addEventListener("submit",existingPlay);
 $("[data-video-stop]").addEventListener("click",()=>{
  iframe.removeAttribute("src");onStop();state("動画を停止しました");
 });
 return {registerCurrent,renderSaved,dispose(){
  window.removeEventListener("storage",syncBookmarks);
  form.removeEventListener("submit",existingPlay);
  options.remove();savedSection.remove();registerButton.remove();
 }};
}
