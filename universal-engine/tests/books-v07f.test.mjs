import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {BOOKS,BOOK_MAP,BookCollection,pagesForBook,STARTING_SHELF} from "../planet-explorer/books.mjs";
import {Actions} from "../planet-explorer/actions.mjs";
const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../planet-explorer/style.css",import.meta.url),"utf8");
const render=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");

test("real book catalog contains public-domain Iroha and three full original titles",()=>{
 assert.equal(BOOKS.length,4);
 assert.equal(new Set(BOOKS.map(b=>b.id)).size,BOOKS.length);
 assert.deepEqual(STARTING_SHELF,BOOKS.map(b=>b.id));
 assert.ok(BOOK_MAP.get("iroha").chapters[0].paragraphs[0].includes("いろはにほへと"));
 for(const book of BOOKS){
  assert.ok(book.author&&book.title&&book.summary&&book.license);
  assert.ok(book.chapters.length>=3);
  assert.ok(book.chapters.every(ch=>ch.title&&ch.paragraphs.length>=2));
 }
});
test("full source text survives page splitting, no chapter, character, or page is lost",()=>{
 for(const book of BOOKS){
  const pages=pagesForBook(book);
  assert.ok(pages.length>=book.chapters.length);
  const original=book.chapters.flatMap(ch=>ch.paragraphs).join("").replace(/\s/g,"");
  const paged=pages.map(p=>p.text).join("").replace(/\s/g,"");
  assert.equal(paged,original,"Book pages reconstruct the complete text: "+book.id);
  assert.ok(pages.every(p=>p.chapter&&p.text.length));
 }
});
test("page splitter bounds input and handles small print pages without losing text",()=>{
 const book=BOOK_MAP.get("frontier-journal");
 assert.throws(()=>pagesForBook(book,0),RangeError);
 const small=pagesForBook(book,80),large=pagesForBook(book,450);
 assert.ok(small.length>large.length);
 assert.equal(small.map(p=>p.text).join("").replace(/\s/g,""),
  large.map(p=>p.text).join("").replace(/\s/g,""));
});
test("book is a tangible inventory item: take, read anywhere, return per cabin",()=>{
 const actions=new Actions(),hut={id:42,kind:"hut",progress:1,x:2,z:3};
 actions.structures=[hut];
 const library=new BookCollection();
 assert.equal(library.carried.length,0);
 assert.equal(library.available(null).length,0);
 assert.equal(library.available(hut).length,4);
 assert.equal(library.take("iroha",hut),true);
 assert.equal(library.carried.includes("iroha"),true);
 assert.equal(hut.bookshelfBooks.includes("iroha"),false);
 assert.equal(library.available(null).length,1);
 assert.equal(library.take("iroha",hut),false);
 assert.equal(library.putBack("iroha",hut),true);
 assert.equal(library.available(null).length,0);
 assert.equal(hut.bookshelfBooks.includes("iroha"),true);
});
test("bookmark, carried book, shelf contents and font size can be restored",()=>{
 const actions=new Actions(),hut={id:7,kind:"hut",progress:1,x:2,z:3};
 actions.structures=[hut];
 const library=new BookCollection();
 library.ensureShelf(hut);
 assert.equal(library.take("frontier-journal",hut),true);
 assert.equal(library.bookmark("frontier-journal",3),true);
 library.fontSize=24;
 assert.equal(library.bookmark("frontier-journal",99999),false);
 const saved=JSON.parse(JSON.stringify({actions:actions.snapshot(),v0_7f:library.snapshot()}));
 const actions2=Actions.fromSnapshot(saved.actions),restored=new BookCollection(saved.v0_7f);
 assert.equal(restored.carried.includes("frontier-journal"),true);
 assert.equal(restored.page("frontier-journal"),3);
 assert.equal(restored.fontSize,24);
 assert.equal(actions2.structures[0].bookshelfBooks.includes("frontier-journal"),false);
 assert.equal(restored.putBack("frontier-journal",actions2.structures[0]),true);
});
test("old saves without book metadata still open stocked bookshelves",()=>{
 const restored=new BookCollection(null),hut={progress:1,id:11};
 assert.equal(restored.available(hut).length,4);
 assert.equal(restored.page("iroha"),0);
 assert.ok(!restored.has("nonexistent",hut));
});
test("book UI can be opened from the viewport, mobile hut shelf or tools menu",()=>{
 for(const id of ["viewport-books","toolbar-books","door-shelf","book-overlay",
  "book-library-list","book-reading","book-text","book-prev","book-next",
  "book-font-down","book-font-up","book-close","book-back"]){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 assert.match(app,/pickBookshelf\(e\.clientX,e\.clientY\)/);
 assert.match(app,/v0_7f:books\.snapshot\(\)/);
 assert.match(app,/BOOK_JOURNAL_KEY/);
 assert.match(app,/p\.textContent=text/);
 assert.match(css,/\.book-overlay\[hidden\]/);
 assert.match(css,/\.book-paper/);
 assert.match(render,/makeRoomMeshes\(gl\)/);
 assert.match(render,/pickBookshelf\(clientX,clientY\)/);
});
