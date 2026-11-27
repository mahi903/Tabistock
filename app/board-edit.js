// 旅の掲示板：管理者だけが使う記事エディタ（#ge-記事ID ／ 新しい記事は #ge-new）
// 編集できるもの：上の画像（イラスト or 写真）・カテゴリー・並び順・タイトル・リード・facts（上の表）・本文ブロック
// ブロックは追加・削除・上下の入れ替えができる。保存すると Firestore の boards に入り、デプロイなしで反映される。
import { db, storage } from "../firebase-config.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { ILL, BOARD_CATS, BOARD_SEED, JIKEN, toFs } from "./board.js?v=202611272310";

// ブロックの種類（追加ボタンの並び順）
const KINDS = [
  ["h", "見出し"], ["p", "文章"], ["list", "箇条書き"], ["steps", "手順"], ["table", "表"], ["note", "注意"], ["photo", "写真"], ["ill", "イラスト・図"],
];
const kindName = (t) => (KINDS.find((k) => k[0] === t) || [, t])[1];
const ILL_KEYS = Object.keys(ILL);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const newBlock = (t) => (t === "list" ? { t, items: [""] } : t === "steps" ? { t, items: [{ h: "", x: "" }] } : t === "photo" ? { t, url: "", size: "l", cap: "" } : t === "ill" ? { t, k: "suitcase", cap: "" }
  : t === "table" ? { t, head: true, rows: [{ c: ["", "", ""] }, { c: ["", "", ""] }, { c: ["", "", ""] }] } : t === "h" ? { t, lv: 2, x: "" } : { t, x: "" });
const LV = [[1, "大"], [2, "中"], [3, "小"]];
const SIZES = [["l", "大"], ["m", "中"], ["s", "小"], ["two", "2枚並べる"]];

// ---- アプリ内の記事（BOARD_SEED）を Firestore にコピー。すでにある記事は上書きしない ----
export async function importSeed(me, only) {
  const have = new Set();
  (await getDocs(collection(db, "boards"))).forEach((s) => have.add(s.id));
  const todo = BOARD_SEED.filter((d) => !have.has(d.id) && (!only || only.includes(d.id)));
  if (!todo.length) return 0;
  const batch = writeBatch(db);
  todo.forEach((d) => {
    const { mins, ...rest } = toFs(d);   // 「〇分で読める」はもう使わない
    batch.set(doc(db, "boards", d.id), { ...rest, heroType: "ill", status: d.status || "published", authorId: me, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  await batch.commit();
  return todo.length;
}

// ---- 事件簿（board.js の JIKEN）を Firestore にコピー。boards に jiken: true で入れる。すでにあるものは上書きしない ----
export async function importJiken(me) {
  const have = new Set();
  (await getDocs(collection(db, "boards"))).forEach((s) => have.add(s.id));
  const todo = JIKEN.map((j, i) => ({ ...j, order: i + 1 })).filter((j) => !have.has(j.id));
  if (!todo.length) return 0;
  const batch = writeBatch(db);
  todo.forEach(({ id, ...j }) => batch.set(doc(db, "boards", id), { ...j, jiken: true, cat: "trouble", status: "published", authorId: me, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await batch.commit();
  return todo.length;
}

// ---- エディタ ----
// C = { me, esc, toast, haptic, cat（新規のときのカテゴリー）, nextOrder, afterSave(id, {deleted}) }
export async function pageBoardEdit(el, id, C) {
  const { esc } = C;
  const isNew = id === "new";
  el.innerHTML = `<div class="bar2"><button class="bk2" data-eback aria-label="戻る"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><b>${isNew ? "新しい記事" : "記事を編集"}</b><span class="bed-bar"><button class="bed-bb mk" data-act="mark" aria-label="マーカー"><i></i>マーカー</button><button class="bed-bb" data-act="preview">プレビュー</button><button class="btn-s" data-act="save">保存</button></span></div>
    <div class="ps under2 bed"><p class="loading">読み込み中…</p></div>`;
  const root = el.querySelector(".bed");
  let S, dirty = false, saving = false;

  // 事件簿は別の入力画面。事件簿のタブの一番上（イラストと説明文）も別
  if (id === "newj") return pageJikenEdit(el, root, null, C);
  if (id === "jhead") return pageJikenHeadEdit(el, root, C);

  if (isNew) {
    S = { id: doc(collection(db, "boards")).id, title: "", lead: "", cat: C.cat && C.cat !== "trouble" ? C.cat : "prep", order: C.nextOrder || 1, status: "draft", heroType: "ill", ill: "suitcase", heroUrl: "", facts: [], blocks: [newBlock("p")] };
  } else {
    let d = null;
    try { const s = await getDoc(doc(db, "boards", id)); if (s.exists()) d = s.data(); } catch (e) {}
    if (!d) { root.innerHTML = '<p class="empty">この記事はまだ Firestore にありません。<br>掲示板の一覧を開き直してから、もう一度お試しください。</p>'; bindBack(); return; }
    if (d.jiken) return pageJikenEdit(el, root, { id, ...d }, C);
    const f = toFs(d);   // 古い形（配列）が混ざっていても編集用の形にそろえる
    S = { id, title: f.title || "", lead: f.lead || "", cat: f.cat || "prep", order: f.order ?? 99, status: f.status === "published" ? "published" : "draft", heroType: f.heroType === "photo" ? "photo" : "ill", ill: f.ill || "suitcase", heroUrl: f.heroUrl || "", facts: f.facts.map((x) => ({ k: x.k || "", v: x.v || "", s: x.s || "" })), blocks: f.blocks.map((b) => ({ ...b })) };
  }

  // ---------- 描画 ----------
  const illPick = (cur, act, extra = "") => `<div class="bed-ills">${ILL_KEYS.map((k) => `<button class="${k === cur ? "on" : ""}" data-act="${act}" data-k="${k}" ${extra} aria-label="${k}">${ILL[k]}</button>`).join("")}</div>`;
  const tools = (i) => `<div class="bed-tools"><b>${kindName(S.blocks[i].t)}</b>
    <button data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="上へ">↑</button><button data-act="down" data-i="${i}" ${i === S.blocks.length - 1 ? "disabled" : ""} aria-label="下へ">↓</button><button data-act="del" data-i="${i}" class="x" aria-label="削除">削除</button></div>`;
  const ta = (attrs, v, ph, rows = 2) => `<textarea ${attrs} rows="${rows}" placeholder="${esc(ph)}">${esc(v || "")}</textarea>`;

  function blockHtml(b, i) {
    let body = "";
    const seg = (list, cur, act) => `<div class="bed-seg sm">${list.map(([v, l]) => `<button class="${String(v) === String(cur) ? "on" : ""}" data-act="${act}" data-i="${i}" data-v="${v}">${l}</button>`).join("")}</div>`;
    if (b.t === "h") body = seg(LV, b.lv || 2, "lv") + `<input class="bed-h${b.lv || 2}" data-b="${i}" data-k="x" value="${esc(b.x || "")}" placeholder="見出し">`;
    else if (b.t === "table") {
      const rows = b.rows || [], n = Math.max(1, ...rows.map((r) => (r.c || []).length));
      body = seg([["1", "1行目を見出しにする"], ["0", "しない"]], b.head ? "1" : "0", "tb-head")
        + `<div class="bed-tbl"><table>${rows.map((r, ri) => `<tr class="${b.head && ri === 0 ? "hd" : ""}">${Array.from({ length: n }, (_, ci) => `<td><input data-tb="${i},${ri},${ci}" value="${esc((r.c || [])[ci] || "")}"></td>`).join("")}<td class="x"><button data-act="tb-rdel" data-i="${i}" data-r="${ri}" aria-label="この行を消す" ${rows.length < 2 ? "disabled" : ""}>×</button></td></tr>`).join("")}
          <tr class="cx">${Array.from({ length: n }, (_, ci) => `<td><button data-act="tb-cdel" data-i="${i}" data-c="${ci}" ${n < 2 ? "disabled" : ""}>× 列を消す</button></td>`).join("")}<td></td></tr></table></div>
          <div class="bed-tbtn"><button class="bed-add1" data-act="tb-radd" data-i="${i}">＋ 行を足す</button><button class="bed-add1" data-act="tb-cadd" data-i="${i}">＋ 列を足す</button></div>`;
    }
    else if (b.t === "p") body = ta(`data-b="${i}" data-k="x"`, b.x, "文章", 4);
    else if (b.t === "note") body = ta(`data-b="${i}" data-k="x"`, b.x, "注意書き（緑の枠で表示）", 2);
    else if (b.t === "list") body = ta(`data-b="${i}" data-k="lines"`, (b.items || []).join("\n"), "1行に1項目", 4) + `<p class="bed-hint">改行ごとに1つの項目になります</p>`;
    else if (b.t === "steps") body = (b.items || []).map((s, j) => `<div class="bed-step"><i>${j + 1}</i><div><input data-st="${i},${j}" data-k="h" value="${esc(s.h || "")}" placeholder="手順の見出し">${ta(`data-st="${i},${j}" data-k="x"`, s.x, "説明", 3)}</div><button data-act="st-del" data-i="${i}" data-j="${j}" aria-label="この手順を消す">×</button></div>`).join("")
      + `<button class="bed-add1" data-act="st-add" data-i="${i}">＋ 手順を足す</button>`;
    else if (b.t === "photo") {
      const ph = (u, up, act, label) => `<div class="bed-phw"><div class="bed-ph">${up ? '<span class="bed-up">アップロード中…</span>' : u ? `<img src="${esc(u)}" alt="">` : '<span class="bed-up">写真が選ばれていません</span>'}</div>
        <button class="bed-add1" data-act="${act}" data-i="${i}">${u ? label + "を変える" : label + "を選ぶ"}</button></div>`;
      const two = b.size === "two";
      body = seg(SIZES, b.size || "l", "psize")
        + `<div class="bed-phs ${two ? "two" : "sz-" + (b.size || "l")}">${ph(b.url, b._up, "photo", two ? "1枚目" : "写真")}${two ? ph(b.url2, b._up2, "photo2", "2枚目") : ""}</div>
        <input data-b="${i}" data-k="cap" data-nomk="1" value="${esc(b.cap || "")}" placeholder="説明文（任意）">`;
    }
    else if (b.t === "ill") body = `<div class="bed-ph ill">${ILL[b.k] || ""}</div>${illPick(b.k, "pickill", `data-i="${i}"`)}
      <input data-b="${i}" data-k="cap" data-nomk="1" value="${esc(b.cap || "")}" placeholder="説明文（任意）">`;
    return `<div class="bed-blk" data-blk="${i}">${tools(i)}${body}</div>`;
  }

  function draw() {
    const top = el.scrollTop, inner = root.scrollTop;
    root.innerHTML = `
      <div class="bed-sec">
        <div class="bed-seg"><button class="${S.status === "draft" ? "on" : ""}" data-act="status" data-v="draft">下書き</button><button class="${S.status === "published" ? "on" : ""}" data-act="status" data-v="published">公開</button></div>
        <p class="bed-hint">${S.status === "published" ? "保存すると、すぐにみんなのアプリに表示されます" : "下書きは、管理者にだけ見えます"}</p>
      </div>
      <div class="bed-sec"><h4>上の画像</h4>
        <div class="bed-seg"><button class="${S.heroType === "ill" ? "on" : ""}" data-act="hero" data-v="ill">イラスト</button><button class="${S.heroType === "photo" ? "on" : ""}" data-act="hero" data-v="photo">写真</button></div>
        ${S.heroType === "photo"
          ? `<div class="bed-ph hero">${S._heroUp ? '<span class="bed-up">アップロード中…</span>' : S.heroUrl ? `<img src="${esc(S.heroUrl)}" alt="">` : '<span class="bed-up">写真が選ばれていません</span>'}</div><button class="bed-add1" data-act="herophoto">${S.heroUrl ? "写真を変える" : "写真を選ぶ"}</button>`
          : `<div class="bed-ph ill hero">${ILL[S.ill] || ""}</div>${illPick(S.ill, "pickhero")}`}
      </div>
      <div class="bed-sec bed-row2">
        <label>カテゴリー<select data-f="cat">${BOARD_CATS.filter(([k]) => k !== "trouble").map(([k, l]) => `<option value="${k}" ${k === S.cat ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label>並び順<input data-f="order" type="number" inputmode="numeric" value="${esc(String(S.order))}"></label>
      </div>
      <p class="bed-hint bed-pad">並び順は、数字が小さいほど上に出ます</p>
      <div class="bed-sec"><h4>タイトル</h4><input data-f="title" value="${esc(S.title)}" placeholder="タイトル"></div>
      <div class="bed-sec"><h4>リード</h4>${ta('data-f="lead"', S.lead, "記事の最初に出る短い紹介文", 3)}</div>
      <div class="bed-sec"><h4>上の表</h4>
        ${S.facts.map((f, i) => `<div class="bed-fact"><div><input data-fa="${i}" data-k="k" data-nomk="1" value="${esc(f.k)}" placeholder="項目（例：費用）"><input data-fa="${i}" data-k="v" value="${esc(f.v)}" placeholder="内容（太字）"><input data-fa="${i}" data-k="s" value="${esc(f.s)}" placeholder="補足（任意）"></div><button data-act="fa-del" data-i="${i}" aria-label="この行を消す">×</button></div>`).join("")}
        <button class="bed-add1" data-act="fa-add">＋ 行を足す</button>
      </div>
      <div class="bed-sec"><h4>本文</h4>${S.blocks.length ? "" : '<p class="bed-hint">下のボタンからブロックを足してください</p>'}</div>
      ${S.blocks.map(blockHtml).join("")}
      <div class="bed-sec bed-addrow"><p class="bed-hint">ブロックを足す</p><div>${KINDS.map(([t, l]) => `<button data-act="add" data-t="${t}">＋ ${l}</button>`).join("")}</div></div>
      ${isNew ? "" : '<div class="bed-sec"><button class="bed-delart" data-act="delete">この記事を削除する</button></div>'}`;
    root.querySelectorAll("textarea").forEach(grow);
    el.scrollTop = top; root.scrollTop = inner;
  }
  function grow(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }

  // ---------- 入力（描き直さずに S に入れる。カーソルが飛ばないように）----------
  root.addEventListener("input", (e) => {
    const t = e.target, v = t.value, k = t.dataset.k;
    if (t.tagName === "TEXTAREA") grow(t);
    if (t.dataset.f) S[t.dataset.f] = t.dataset.f === "order" ? Number(v) || 0 : v;
    else if (t.dataset.fa != null) S.facts[+t.dataset.fa][k] = v;
    else if (t.dataset.st != null) { const [i, j] = t.dataset.st.split(",").map(Number); S.blocks[i].items[j][k] = v; }
    else if (t.dataset.b != null) { const b = S.blocks[+t.dataset.b]; if (k === "lines") b.items = v.split("\n"); else b[k] = v; }
    else if (t.dataset.tb != null) { const [i, r, c] = t.dataset.tb.split(",").map(Number); const row = S.blocks[i].rows[r]; row.c = row.c || []; while (row.c.length <= c) row.c.push(""); row.c[c] = v; }
    else return;
    dirty = true;
  });

  // ---------- マーカー：最後に触った文字の欄で、選んだ文字を ==…== で囲む（もう一度押すと外す）----------
  let lastField = null;
  root.addEventListener("focusin", (e) => {
    const t = e.target;
    if ((t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && t.type !== "number")) && !t.dataset.nomk) lastField = t;
  });
  // ボタンを押しても文字の欄からカーソルが外れないように（iPhone で選んだ範囲が消えないように）
  el.addEventListener("pointerdown", (e) => { if (e.target.closest('[data-act="mark"]')) e.preventDefault(); });
  el.addEventListener("mousedown", (e) => { if (e.target.closest('[data-act="mark"]')) e.preventDefault(); });
  function mark() {
    const f = lastField;
    const a = f && document.contains(f) ? f.selectionStart : null, b = f ? f.selectionEnd : null;
    if (a == null || a === b) { C.toast("マーカーを引きたい文字を選んでから押してください"); return; }
    const v = f.value, sel = v.slice(a, b);
    if (sel.includes("\n")) { C.toast("マーカーは1行ずつ引いてください"); return; }
    let nv, ca, cb;
    if (v.slice(a - 2, a) === "==" && v.slice(b, b + 2) === "==") { nv = v.slice(0, a - 2) + sel + v.slice(b + 2); ca = a - 2; cb = b - 2; }
    else if (sel.length > 4 && sel.startsWith("==") && sel.endsWith("==")) { nv = v.slice(0, a) + sel.slice(2, -2) + v.slice(b); ca = a; cb = b - 4; }
    else { const inner = sel.replace(/==/g, ""); nv = v.slice(0, a) + "==" + inner + "==" + v.slice(b); ca = a + 2; cb = ca + inner.length; }
    f.value = nv; f.focus(); f.setSelectionRange(ca, cb);
    f.dispatchEvent(new Event("input", { bubbles: true }));
    C.haptic();
  }

  // ---------- プレビュー：今の内容を、記事ページと同じ見た目で出す ----------
  let previewing = false, editScroll = 0;
  function togglePreview() {
    const btn = el.querySelector('[data-act="preview"]');
    if (!previewing) {
      editScroll = root.scrollTop;
      previewing = true; btn.textContent = "編集に戻る"; btn.classList.add("on");
      root.innerHTML = `<p class="bed-pvbar">プレビュー（まだ保存されていません）</p>${C.preview({ ...buildData(), updated: today() })}`;
      root.scrollTop = 0;
    } else {
      previewing = false; btn.textContent = "プレビュー"; btn.classList.remove("on");
      draw(); root.scrollTop = editScroll;
    }
  }

  // ---------- ボタン ----------
  el.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn || btn.disabled) return;
    const a = btn.dataset.act, i = +btn.dataset.i;
    if (a === "save") { if (previewing) togglePreview(); return save(); }
    if (a === "preview") return togglePreview();
    if (a === "mark") { if (!previewing) mark(); return; }
    if (a === "delete") return remove();
    if (a === "photo" || a === "herophoto" || a === "photo2") return pickPhoto(a === "herophoto" ? null : i, a === "photo2");
    const B = S.blocks[i];
    if (a === "lv") B.lv = Number(btn.dataset.v);
    else if (a === "psize") B.size = btn.dataset.v;
    else if (a === "tb-head") B.head = btn.dataset.v === "1";
    else if (a === "tb-radd") { const n = Math.max(1, ...B.rows.map((r) => (r.c || []).length)); B.rows.push({ c: Array(n).fill("") }); }
    else if (a === "tb-cadd") B.rows.forEach((r) => (r.c = [...(r.c || []), ""]));
    else if (a === "tb-rdel") { const r = B.rows[+btn.dataset.r]; if ((r.c || []).some(Boolean) && !confirm("この行を消しますか？")) return; B.rows.splice(+btn.dataset.r, 1); }
    else if (a === "tb-cdel") { const c = +btn.dataset.c; if (B.rows.some((r) => (r.c || [])[c]) && !confirm("この列を消しますか？")) return; B.rows.forEach((r) => (r.c || []).splice(c, 1)); }
    else if (a === "status") S.status = btn.dataset.v;
    else if (a === "hero") S.heroType = btn.dataset.v;
    else if (a === "pickhero") S.ill = btn.dataset.k;
    else if (a === "pickill") S.blocks[i].k = btn.dataset.k;
    else if (a === "fa-add") S.facts.push({ k: "", v: "", s: "" });
    else if (a === "fa-del") S.facts.splice(i, 1);
    else if (a === "st-add") S.blocks[i].items.push({ h: "", x: "" });
    else if (a === "st-del") S.blocks[i].items.splice(+btn.dataset.j, 1);
    else if (a === "up" && i > 0) [S.blocks[i - 1], S.blocks[i]] = [S.blocks[i], S.blocks[i - 1]];
    else if (a === "down" && i < S.blocks.length - 1) [S.blocks[i + 1], S.blocks[i]] = [S.blocks[i], S.blocks[i + 1]];
    else if (a === "del") { const b = S.blocks[i]; const empty = !(b.x || b.url || b.cap || (b.items || []).some((x) => (typeof x === "string" ? x : x.h || x.x)) || (b.rows || []).some((r) => (r.c || []).some(Boolean))); if (!empty && !confirm(`この「${kindName(b.t)}」ブロックを消しますか？`)) return; S.blocks.splice(i, 1); }
    else if (a === "add") {
      S.blocks.push(newBlock(btn.dataset.t)); dirty = true; C.haptic(); draw();
      const last = root.querySelector(`[data-blk="${S.blocks.length - 1}"]`);
      if (last) { last.scrollIntoView({ behavior: "smooth", block: "center" }); const f = last.querySelector("input,textarea"); if (f && btn.dataset.t !== "photo" && btn.dataset.t !== "ill") setTimeout(() => f.focus({ preventScroll: true }), 350); }
      return;
    } else return;
    dirty = true; C.haptic(); draw();
  });

  // ---------- 写真：選ぶ → 縮小 → Storage（boards/記事ID/…）へ ----------
  function pickFile() {
    return new Promise((ok) => { const f = document.createElement("input"); f.type = "file"; f.accept = "image/*"; f.onchange = () => ok(f.files[0] || null); f.click(); });
  }
  async function pickPhoto(i, second) {
    const file = await pickFile(); if (!file) return;
    const target = i == null ? null : S.blocks[i];
    const upKey = second ? "_up2" : "_up", urlKey = second ? "url2" : "url";
    if (target) target[upKey] = true; else S._heroUp = true;
    draw();
    try {
      const { resizeImage } = await import("../post-core.js");
      const blob = await resizeImage(file, 1600, 0.82);
      const r = ref(storage, `boards/${S.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
      await uploadBytes(r, blob, { contentType: "image/jpeg" });
      const url = await getDownloadURL(r);
      if (target) target[urlKey] = url; else S.heroUrl = url;
      dirty = true;
    } catch (e) { console.error(e); C.toast("写真をアップロードできませんでした"); }
    if (target) delete target[upKey]; else delete S._heroUp;
    draw();
  }

  // ---------- 保存・削除 ----------
  // 空の行・空のブロックは落としてから保存する（_up などの作業用の値も入れない）
  function cleanBlocks() {
    return S.blocks.map((b) => {
      if (b.t === "list") return { t: "list", items: (b.items || []).map((x) => x.trim()).filter(Boolean) };
      if (b.t === "steps") return { t: "steps", items: (b.items || []).map((s) => ({ h: (s.h || "").trim(), x: (s.x || "").trim() })).filter((s) => s.h || s.x) };
      if (b.t === "photo") return { t: "photo", url: b.url || "", size: b.size || "l", ...(b.size === "two" ? { url2: b.url2 || "" } : {}), cap: (b.cap || "").trim() };
      if (b.t === "h") return { t: "h", lv: b.lv || 2, x: (b.x || "").trim() };
      if (b.t === "table") {
        const rows = (b.rows || []).map((r) => (r.c || []).map((x) => String(x || "").trim())).filter((r) => r.some(Boolean));
        const n = Math.max(0, ...rows.map((r) => r.length));
        return { t: "table", head: !!b.head, rows: rows.map((r) => ({ c: [...r, ...Array(n - r.length).fill("")] })) };
      }
      if (b.t === "ill") return { t: "ill", k: b.k || "suitcase", cap: (b.cap || "").trim() };
      return { t: b.t, x: (b.x || "").trim() };
    }).filter((b) => (b.t === "list" || b.t === "steps" ? b.items.length : b.t === "table" ? b.rows.length : b.t === "photo" ? b.url : b.t === "ill" ? true : b.x));
  }
  // 保存する中身（プレビューでも使う）
  function buildData() {
    return {
      title: S.title.trim(), lead: S.lead.trim(), cat: S.cat, order: Number(S.order) || 0, status: S.status,
      heroType: S.heroType, ill: S.ill, heroUrl: S.heroUrl || "",
      facts: S.facts.map((f) => ({ k: f.k.trim(), v: f.v.trim(), s: f.s.trim() })).filter((f) => f.k || f.v),
      blocks: cleanBlocks(),
    };
  }
  async function save() {
    if (saving) return;
    if (S._heroUp || S.blocks.some((b) => b._up || b._up2)) { C.toast("写真のアップロードが終わるまで待ってください"); return; }
    if (!S.title.trim()) { C.toast("タイトルを入れてください"); return; }
    if (S.heroType === "photo" && !S.heroUrl) { C.toast("上の写真を選ぶか、イラストにしてください"); return; }
    saving = true;
    const btn = el.querySelector('[data-act="save"]'); btn.textContent = "保存中…";
    const data = {
      ...buildData(),
      updated: today(), updatedAt: serverTimestamp(), updatedBy: C.me(),
      ...(isNew ? { createdAt: serverTimestamp(), authorId: C.me() } : {}),
    };
    try {
      await setDoc(doc(db, "boards", S.id), data, { merge: true });
      dirty = false;
      C.toast(S.status === "published" ? "保存して公開しました" : "下書きを保存しました");
      C.afterSave(S.id, { isNew });
    } catch (e) { console.error(e); C.toast("保存できませんでした"); btn.textContent = "保存"; }
    saving = false;
  }
  async function remove() {
    if (!confirm("この記事を削除しますか？この操作は取り消せません。\n（いったん非表示にしたいだけなら「下書き」にして保存してください）")) return;
    try { await deleteDoc(doc(db, "boards", S.id)); C.toast("削除しました"); C.afterSave(S.id, { deleted: true }); }
    catch (e) { console.error(e); C.toast("削除できませんでした"); }
  }

  function bindBack() {
    el.querySelector("[data-eback]").onclick = () => {
      if (dirty && !confirm("保存していない変更があります。破棄して戻りますか？")) return;
      history.back();
    };
  }
  bindBack();
  draw();
}

// ---- 事件簿の入力画面（#ge-newj ／ 事件簿の ID）----
// カードに出るもの：場所・種類・タイトル・手口・被害・その後、下に「〇〇さんの『△△』より」。タップで元の記事（art）へ
const KIND_HINTS = ["詐欺", "スリ", "盗難", "ぼったくり", "強盗", "詐欺サイト", "ロストバゲージ", "欠航・遅延", "病気・けが"];
function pageJikenEdit(el, root, d, C) {
  const { esc } = C;
  const isNew = !d;
  el.querySelector(".bar2 b").textContent = isNew ? "新しい事件" : "事件を編集";
  const arts = (C.articles && C.articles()) || [];
  const S = d
    ? { id: d.id, status: d.status === "draft" ? "draft" : "published", order: d.order ?? 99, art: d.art || "", by: d.by || "", from: d.from || "", where: d.where || "", kind: d.kind || "", title: d.title || "", how: d.how || "", loss: d.loss || "", after: d.after || "" }
    : { id: doc(collection(db, "boards")).id, status: "draft", order: C.nextJikenOrder || 1, art: "", by: "", from: "", where: "", kind: "", title: "", how: "", loss: "", after: "" };
  let dirty = false, saving = false;
  const inp = (k, ph, list = "") => `<input data-f="${k}" value="${esc(S[k])}" placeholder="${esc(ph)}" ${list}>`;
  const ta = (k, ph, rows = 3) => `<textarea data-f="${k}" rows="${rows}" placeholder="${esc(ph)}">${esc(S[k])}</textarea>`;
  const grow = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };

  function draw() {
    const known = arts.some((a) => a.id === S.art);
    root.innerHTML = `
      <div class="bed-sec">
        <div class="bed-seg"><button class="${S.status === "draft" ? "on" : ""}" data-act="status" data-v="draft">下書き</button><button class="${S.status === "published" ? "on" : ""}" data-act="status" data-v="published">公開</button></div>
        <p class="bed-hint">${S.status === "published" ? "保存すると、すぐにみんなのアプリに表示されます" : "下書きは、管理者にだけ見えます"}</p>
      </div>
      <div class="bed-sec"><h4>元の旅の記事</h4>
        <select data-f="art"><option value="">選んでください</option>${!known && S.art ? `<option value="${esc(S.art)}" selected>（今は公開されていない記事）</option>` : ""}${arts.map((a) => `<option value="${esc(a.id)}" ${a.id === S.art ? "selected" : ""}>${esc(a.title)}（${esc(a.by)}）</option>`).join("")}</select>
        <p class="bed-hint">カードをタップすると、この記事が開きます。選ぶと、下の「書いた人」と「記事のタイトル」が入ります</p>
      </div>
      <div class="bed-sec bed-row2"><label>書いた人${inp("by", "名前")}</label><label style="flex:2">記事のタイトル${inp("from", "旅のタイトル")}</label></div>
      <p class="bed-hint bed-pad">カードの下に「${esc(S.by || "〇〇")}さんの「${esc(S.from || "△△")}」より」と出ます</p>
      <div class="bed-sec bed-row2"><label style="flex:2">場所${inp("where", "例：イタリア・ローマ")}</label><label>種類${inp("kind", "例：スリ", 'list="bed-kinds"')}</label></div>
      <datalist id="bed-kinds">${KIND_HINTS.map((k) => `<option value="${k}">`).join("")}</datalist>
      <div class="bed-sec"><h4>タイトル</h4>${inp("title", "何が起きたか、ひとことで")}</div>
      <div class="bed-sec"><h4>手口</h4>${ta("how", "どんな流れで起きたか（記事に書いてあることだけ）")}</div>
      <div class="bed-sec"><h4>被害</h4>${inp("loss", "例：現金 約15,000円／なし")}</div>
      <div class="bed-sec"><h4>その後</h4>${ta("after", "どうしたか、次の人へのひとこと", 2)}</div>
      <div class="bed-sec bed-row2"><label>並び順<input data-f="order" type="number" inputmode="numeric" value="${esc(String(S.order))}"></label><span style="flex:3"></span></div>
      <p class="bed-hint bed-pad">並び順は、数字が小さいほど上に出ます</p>
      ${isNew ? "" : '<div class="bed-sec"><button class="bed-delart" data-act="delete">この事件を削除する</button></div>'}`;
    root.querySelectorAll("textarea").forEach(grow);
  }

  root.addEventListener("input", (e) => {
    const t = e.target, k = t.dataset.f; if (!k) return;
    if (t.tagName === "TEXTAREA") grow(t);
    if (k === "art") {
      // 記事を選んだら、書いた人とタイトルを入れる（自分で書き換えていたら、そのまま）
      const prev = arts.find((a) => a.id === S.art), a = arts.find((x) => x.id === t.value);
      if (a) { if (!S.by || (prev && S.by === prev.by)) S.by = a.by; if (!S.from || (prev && S.from === prev.title)) S.from = a.title; }
      S.art = t.value; dirty = true; draw(); return;
    }
    S[k] = k === "order" ? Number(t.value) || 0 : t.value;
    dirty = true;
  });
  el.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const a = btn.dataset.act;
    if (a === "status") { S.status = btn.dataset.v; dirty = true; C.haptic(); draw(); }
    else if (a === "save") save();
    else if (a === "delete") {
      if (!confirm("この事件を削除しますか？この操作は取り消せません。\n（いったん非表示にしたいだけなら「下書き」にして保存してください）")) return;
      try { await deleteDoc(doc(db, "boards", S.id)); C.toast("削除しました"); C.afterSave(S.id, { deleted: true }); }
      catch (err) { console.error(err); C.toast("削除できませんでした"); }
    }
  });
  async function save() {
    if (saving) return;
    if (!S.title.trim()) { C.toast("タイトルを入れてください"); return; }
    if (!S.art) { C.toast("元の旅の記事を選んでください"); return; }
    saving = true;
    const btn = el.querySelector('[data-act="save"]'); btn.textContent = "保存中…";
    const t = (k) => String(S[k] || "").trim();
    const data = {
      jiken: true, cat: "trouble", status: S.status, order: Number(S.order) || 0,
      art: S.art, by: t("by"), from: t("from"), where: t("where"), kind: t("kind"), title: t("title"), how: t("how"), loss: t("loss"), after: t("after"),
      updated: today(), updatedAt: serverTimestamp(), updatedBy: C.me(),
      ...(isNew ? { createdAt: serverTimestamp(), authorId: C.me() } : {}),
    };
    try {
      await setDoc(doc(db, "boards", S.id), data, { merge: true });
      dirty = false;
      C.toast(S.status === "published" ? "保存して公開しました" : "下書きを保存しました");
      C.afterSave(S.id, { isNew });
    } catch (err) { console.error(err); C.toast("保存できませんでした"); btn.textContent = "保存"; }
    saving = false;
  }
  el.querySelector("[data-eback]").onclick = () => {
    if (dirty && !confirm("保存していない変更があります。破棄して戻りますか？")) return;
    history.back();
  };
  draw();
}

// ---- 事件簿のタブの一番上（イラスト or 写真と、説明文）：boards/jhead に保存 ----
export const JHEAD_TEXT = "みんなの旅の記事から、旅先で起きたトラブルや事件をまとめました。タップすると、元の旅の記事が読めます。";
async function pageJikenHeadEdit(el, root, C) {
  const { esc } = C;
  el.querySelector(".bar2 b").textContent = "事件簿の上の部分";
  let d = {};
  try { const s = await getDoc(doc(db, "boards", "jhead")); if (s.exists()) d = s.data(); } catch (e) {}
  const S = { heroType: d.heroType === "photo" ? "photo" : "ill", ill: d.ill || "alert", heroUrl: d.heroUrl || "", text: d.text || JHEAD_TEXT, _up: false };
  let dirty = false, saving = false;
  const grow = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; };
  function draw() {
    const img = S.heroType === "photo"
      ? (S._up ? '<span class="bed-up">アップロード中…</span>' : S.heroUrl ? `<img src="${esc(S.heroUrl)}" alt="">` : '<span class="bed-up">写真が選ばれていません</span>')
      : ILL[S.ill] || "";
    root.innerHTML = `
      <div class="bed-sec"><h4>プレビュー</h4>
        <div class="bjhd" style="padding:4px 0"><span class="bill ${S.heroType === "photo" && S.heroUrl ? "ph" : ""}" style="${S.heroType === "photo" && S.heroUrl ? `background-image:url('${esc(S.heroUrl)}')` : ""}">${S.heroType === "photo" ? "" : ILL[S.ill] || ""}</span><p>${esc(S.text)}</p></div>
      </div>
      <div class="bed-sec"><h4>画像</h4>
        <div class="bed-seg"><button class="${S.heroType === "ill" ? "on" : ""}" data-act="hero" data-v="ill">イラスト</button><button class="${S.heroType === "photo" ? "on" : ""}" data-act="hero" data-v="photo">写真</button></div>
        <div class="bed-ph ${S.heroType === "ill" ? "ill" : ""} hero">${img}</div>
        ${S.heroType === "photo"
          ? `<button class="bed-add1" data-act="photo">${S.heroUrl ? "写真を変える" : "写真を選ぶ"}</button>`
          : `<div class="bed-ills">${ILL_KEYS.map((k) => `<button class="${k === S.ill ? "on" : ""}" data-act="pick" data-k="${k}" aria-label="${k}">${ILL[k]}</button>`).join("")}</div>`}
      </div>
      <div class="bed-sec"><h4>説明文</h4><textarea data-f="text" rows="3">${esc(S.text)}</textarea>
        <button class="bed-add1" data-act="reset">最初の文に戻す</button></div>`;
    root.querySelectorAll("textarea").forEach(grow);
  }
  root.addEventListener("input", (e) => {
    const t = e.target; if (t.dataset.f !== "text") return;
    grow(t); S.text = t.value; dirty = true;
    const p = root.querySelector(".bjhd p"); if (p) p.textContent = t.value;   // プレビューにもすぐ反映
  });
  el.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const a = btn.dataset.act;
    if (a === "save") return save();
    if (a === "hero") S.heroType = btn.dataset.v;
    else if (a === "pick") S.ill = btn.dataset.k;
    else if (a === "reset") S.text = JHEAD_TEXT;
    else if (a === "photo") {
      const f = document.createElement("input"); f.type = "file"; f.accept = "image/*";
      const file = await new Promise((ok) => { f.onchange = () => ok(f.files[0] || null); f.click(); });
      if (!file) return;
      S._up = true; draw();
      try {
        const { resizeImage } = await import("../post-core.js");
        const r = ref(storage, `boards/jhead/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
        await uploadBytes(r, await resizeImage(file, 1600, 0.82), { contentType: "image/jpeg" });
        S.heroUrl = await getDownloadURL(r);
      } catch (err) { console.error(err); C.toast("写真をアップロードできませんでした"); }
      S._up = false;
    } else return;
    dirty = true; C.haptic(); draw();
  });
  async function save() {
    if (saving) return;
    if (S._up) { C.toast("写真のアップロードが終わるまで待ってください"); return; }
    if (S.heroType === "photo" && !S.heroUrl) { C.toast("写真を選ぶか、イラストにしてください"); return; }
    saving = true;
    const btn = el.querySelector('[data-act="save"]'); btn.textContent = "保存中…";
    try {
      await setDoc(doc(db, "boards", "jhead"), { jikenHead: true, status: "published", heroType: S.heroType, ill: S.ill, heroUrl: S.heroUrl, text: S.text.trim() || JHEAD_TEXT, updatedAt: serverTimestamp(), updatedBy: C.me() }, { merge: true });
      dirty = false; C.toast("保存しました"); C.afterSave("jhead", {});
    } catch (err) { console.error(err); C.toast("保存できませんでした"); btn.textContent = "保存"; }
    saving = false;
  }
  el.querySelector("[data-eback]").onclick = () => {
    if (dirty && !confirm("保存していない変更があります。破棄して戻りますか？")) return;
    history.back();
  };
  draw();
}
