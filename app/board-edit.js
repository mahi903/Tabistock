// 旅の掲示板：管理者だけが使う記事エディタ（#ge-記事ID ／ 新しい記事は #ge-new）
// 編集できるもの：上の画像（イラスト or 写真）・カテゴリー・並び順・タイトル・リード・facts（上の表）・本文ブロック
// ブロックは追加・削除・上下の入れ替えができる。保存すると Firestore の boards に入り、デプロイなしで反映される。
import { db, storage } from "../firebase-config.js";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { ILL, BOARD_CATS, BOARD_SEED, toFs } from "./board.js?v=202611260140";

// ブロックの種類（追加ボタンの並び順）
const KINDS = [
  ["h", "見出し"], ["p", "文章"], ["list", "箇条書き"], ["steps", "手順"], ["note", "注意"], ["photo", "写真"], ["ill", "イラスト・図"],
];
const kindName = (t) => (KINDS.find((k) => k[0] === t) || [, t])[1];
const ILL_KEYS = Object.keys(ILL);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const newBlock = (t) => (t === "list" ? { t, items: [""] } : t === "steps" ? { t, items: [{ h: "", x: "" }] } : t === "photo" ? { t, url: "", cap: "" } : t === "ill" ? { t, k: "suitcase", cap: "" } : { t, x: "" });

// ---- アプリ内の記事（BOARD_SEED）を Firestore にコピー。すでにある記事は上書きしない ----
export async function importSeed(me) {
  const have = new Set();
  (await getDocs(collection(db, "boards"))).forEach((s) => have.add(s.id));
  const todo = BOARD_SEED.filter((d) => !have.has(d.id));
  if (!todo.length) return 0;
  const batch = writeBatch(db);
  todo.forEach((d) => {
    const { mins, ...rest } = toFs(d);   // 「〇分で読める」はもう使わない
    batch.set(doc(db, "boards", d.id), { ...rest, heroType: "ill", status: "published", authorId: me, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  await batch.commit();
  return todo.length;
}

// ---- エディタ ----
// C = { me, esc, toast, haptic, cat（新規のときのカテゴリー）, nextOrder, afterSave(id, {deleted}) }
export async function pageBoardEdit(el, id, C) {
  const { esc } = C;
  const isNew = id === "new";
  el.innerHTML = `<div class="bar2"><button class="bk2" data-eback aria-label="戻る"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button><b>${isNew ? "新しい記事" : "記事を編集"}</b><button class="btn-s" data-act="save">保存</button></div>
    <div class="ps under2 bed"><p class="loading">読み込み中…</p></div>`;
  const root = el.querySelector(".bed");
  let S, dirty = false, saving = false;

  if (isNew) {
    S = { id: doc(collection(db, "boards")).id, title: "", lead: "", cat: C.cat && C.cat !== "trouble" ? C.cat : "prep", order: C.nextOrder || 1, status: "draft", heroType: "ill", ill: "suitcase", heroUrl: "", facts: [], blocks: [newBlock("p")] };
  } else {
    let d = null;
    try { const s = await getDoc(doc(db, "boards", id)); if (s.exists()) d = s.data(); } catch (e) {}
    if (!d) { root.innerHTML = '<p class="empty">この記事はまだ Firestore にありません。<br>掲示板の一覧を開き直してから、もう一度お試しください。</p>'; bindBack(); return; }
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
    if (b.t === "h") body = `<input data-b="${i}" data-k="x" value="${esc(b.x || "")}" placeholder="見出し">`;
    else if (b.t === "p") body = ta(`data-b="${i}" data-k="x"`, b.x, "文章", 4);
    else if (b.t === "note") body = ta(`data-b="${i}" data-k="x"`, b.x, "注意書き（緑の枠で表示）", 2);
    else if (b.t === "list") body = ta(`data-b="${i}" data-k="lines"`, (b.items || []).join("\n"), "1行に1項目", 4) + `<p class="bed-hint">改行ごとに1つの項目になります</p>`;
    else if (b.t === "steps") body = (b.items || []).map((s, j) => `<div class="bed-step"><i>${j + 1}</i><div><input data-st="${i},${j}" data-k="h" value="${esc(s.h || "")}" placeholder="手順の見出し">${ta(`data-st="${i},${j}" data-k="x"`, s.x, "説明", 3)}</div><button data-act="st-del" data-i="${i}" data-j="${j}" aria-label="この手順を消す">×</button></div>`).join("")
      + `<button class="bed-add1" data-act="st-add" data-i="${i}">＋ 手順を足す</button>`;
    else if (b.t === "photo") body = `<div class="bed-ph">${b._up ? '<span class="bed-up">アップロード中…</span>' : b.url ? `<img src="${esc(b.url)}" alt="">` : '<span class="bed-up">写真が選ばれていません</span>'}</div>
      <button class="bed-add1" data-act="photo" data-i="${i}">${b.url ? "写真を変える" : "写真を選ぶ"}</button>
      <input data-b="${i}" data-k="cap" value="${esc(b.cap || "")}" placeholder="説明文（任意）">`;
    else if (b.t === "ill") body = `<div class="bed-ph ill">${ILL[b.k] || ""}</div>${illPick(b.k, "pickill", `data-i="${i}"`)}
      <input data-b="${i}" data-k="cap" value="${esc(b.cap || "")}" placeholder="説明文（任意）">`;
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
        ${S.facts.map((f, i) => `<div class="bed-fact"><div><input data-fa="${i}" data-k="k" value="${esc(f.k)}" placeholder="項目（例：費用）"><input data-fa="${i}" data-k="v" value="${esc(f.v)}" placeholder="内容（太字）"><input data-fa="${i}" data-k="s" value="${esc(f.s)}" placeholder="補足（任意）"></div><button data-act="fa-del" data-i="${i}" aria-label="この行を消す">×</button></div>`).join("")}
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
    else return;
    dirty = true;
  });

  // ---------- ボタン ----------
  el.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn || btn.disabled) return;
    const a = btn.dataset.act, i = +btn.dataset.i;
    if (a === "save") return save();
    if (a === "delete") return remove();
    if (a === "photo" || a === "herophoto") return pickPhoto(a === "herophoto" ? null : i);
    if (a === "status") S.status = btn.dataset.v;
    else if (a === "hero") S.heroType = btn.dataset.v;
    else if (a === "pickhero") S.ill = btn.dataset.k;
    else if (a === "pickill") S.blocks[i].k = btn.dataset.k;
    else if (a === "fa-add") S.facts.push({ k: "", v: "", s: "" });
    else if (a === "fa-del") S.facts.splice(i, 1);
    else if (a === "st-add") S.blocks[i].items.push({ h: "", x: "" });
    else if (a === "st-del") S.blocks[i].items.splice(+btn.dataset.j, 1);
    else if (a === "up" && i > 0) [S.blocks[i - 1], S.blocks[i]] = [S.blocks[i], S.blocks[i - 1]];
    else if (a === "down" && i < S.blocks.length - 1) [S.blocks[i + 1], S.blocks[i]] = [S.blocks[i], S.blocks[i + 1]];
    else if (a === "del") { const b = S.blocks[i]; const empty = !(b.x || b.url || b.cap || (b.items || []).some((x) => (typeof x === "string" ? x : x.h || x.x))); if (!empty && !confirm(`この「${kindName(b.t)}」ブロックを消しますか？`)) return; S.blocks.splice(i, 1); }
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
  async function pickPhoto(i) {
    const file = await pickFile(); if (!file) return;
    const target = i == null ? null : S.blocks[i];
    if (target) target._up = true; else S._heroUp = true;
    draw();
    try {
      const { resizeImage } = await import("../post-core.js");
      const blob = await resizeImage(file, 1600, 0.82);
      const r = ref(storage, `boards/${S.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
      await uploadBytes(r, blob, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" });
      const url = await getDownloadURL(r);
      if (target) target.url = url; else S.heroUrl = url;
      dirty = true;
    } catch (e) { console.error(e); C.toast("写真をアップロードできませんでした"); }
    if (target) delete target._up; else delete S._heroUp;
    draw();
  }

  // ---------- 保存・削除 ----------
  // 空の行・空のブロックは落としてから保存する（_up などの作業用の値も入れない）
  function cleanBlocks() {
    return S.blocks.map((b) => {
      if (b.t === "list") return { t: "list", items: (b.items || []).map((x) => x.trim()).filter(Boolean) };
      if (b.t === "steps") return { t: "steps", items: (b.items || []).map((s) => ({ h: (s.h || "").trim(), x: (s.x || "").trim() })).filter((s) => s.h || s.x) };
      if (b.t === "photo") return { t: "photo", url: b.url || "", cap: (b.cap || "").trim() };
      if (b.t === "ill") return { t: "ill", k: b.k || "suitcase", cap: (b.cap || "").trim() };
      return { t: b.t, x: (b.x || "").trim() };
    }).filter((b) => (b.t === "list" || b.t === "steps" ? b.items.length : b.t === "photo" ? b.url : b.t === "ill" ? true : b.x));
  }
  async function save() {
    if (saving) return;
    if (S._heroUp || S.blocks.some((b) => b._up)) { C.toast("写真のアップロードが終わるまで待ってください"); return; }
    if (!S.title.trim()) { C.toast("タイトルを入れてください"); return; }
    if (S.heroType === "photo" && !S.heroUrl) { C.toast("上の写真を選ぶか、イラストにしてください"); return; }
    saving = true;
    const btn = el.querySelector('[data-act="save"]'); btn.textContent = "保存中…";
    const data = {
      title: S.title.trim(), lead: S.lead.trim(), cat: S.cat, order: Number(S.order) || 0, status: S.status,
      heroType: S.heroType, ill: S.ill, heroUrl: S.heroUrl || "",
      facts: S.facts.map((f) => ({ k: f.k.trim(), v: f.v.trim(), s: f.s.trim() })).filter((f) => f.k || f.v),
      blocks: cleanBlocks(),
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
