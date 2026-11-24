// 旅ひろば（コミュニティ）
// sodan/{id}                       投稿：uid, kind, area, text, likeCount, replyCount, createdAt, lastReplyAt
// sodan/{id}/likes/{uid}           投稿へのいいね
// sodan/{id}/replies/{rid}         回答・コメント：uid, text, articleId, replyToUid, replyToName, likeCount, createdAt
// sodan/{id}/replies/{rid}/likes/{uid}
// 一覧は新しい順に最大200件を読み、種類・エリア・並び順は手元で絞り込む（複合インデックスを使わない）
import { db } from "../firebase-config.js";
import {
  collection, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc, deleteDoc, addDoc, updateDoc, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const KINDS = [["q", "質問・相談"], ["info", "現地の情報"], ["flight", "航空券"], ["save", "節約"], ["chat", "雑談"]];
export const AREAS = [["eastasia", "東アジア"], ["seasia", "東南アジア"], ["southasia", "南アジア"], ["centralasia", "中央アジア"], ["middleeast", "中東"], ["europe", "ヨーロッパ"], ["africa", "アフリカ"], ["namerica", "北米"], ["samerica", "中南米"], ["oceania", "オセアニア"], ["japan", "日本国内"]];
const kindName = (k) => (KINDS.find((x) => x[0] === k) || [, ""])[1];
const areaName = (a) => (AREAS.find((x) => x[0] === a) || [, ""])[1];
const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
const BUB = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5h16v11H9l-4 4V5z"/></svg>';
const CHK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const DOTS = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

let C = null;                       // app.js から渡される道具（me, esc, para, ago, PROF, loadProfiles, avatarOf, toast, haptic, mod, bar, notify）
let LIST = null, fKind = "", fArea = "", fSort = "new";
export function initSodan(ctx) { C = ctx; }
export function invalidate() { LIST = null; }

const secOf = (t) => (t && t.seconds) || (t && t.toMillis ? t.toMillis() / 1000 : 0) || Date.now() / 1000;
// 名前の横：スタイルタグを最大2つ
const tagsOf = (uid) => { const t = (C.PROF[uid] || {}).tags; return Array.isArray(t) ? t.slice(0, 2) : []; };
const who = (uid) => `<a class="snm" href="#u-${C.esc(uid)}"><b>${C.esc((C.PROF[uid] || {}).nickname || "旅人")}</b>${tagsOf(uid).map((t) => `<small>${C.esc(t)}</small>`).join("")}</a>`;
const avatar = (uid, s = 36) => `<a href="#u-${C.esc(uid)}" class="sav" style="width:${s}px;height:${s}px"><img src="${C.esc(C.avatarOf(uid))}" alt=""></a>`;

async function load(force) {
  if (LIST && !force) return LIST;
  const list = [];
  const s = await getDocs(query(collection(db, "sodan"), orderBy("createdAt", "desc"), limit(200)));
  s.forEach((d) => list.push({ id: d.id, ...d.data() }));
  let blocked = new Set(); if (C.me()) { try { blocked = await (await C.mod()).getBlocked(); } catch (e) {} }
  LIST = list.filter((p) => p.status !== "hidden" && !blocked.has(p.uid));
  await C.loadProfiles([...new Set(LIST.map((p) => p.uid))]);
  return LIST;
}

// 質問・相談の状態：投稿した本人が「解決済み」にする
const stateTag = (p) => (p.kind !== "q" ? "" : p.solved ? `<span class="sst ok">${CHK}解決済み</span>` : '<span class="sst">未解決</span>');
async function setSolved(p, v) {
  try {
    await updateDoc(doc(db, "sodan", p.id), { solved: v, solvedAt: serverTimestamp() });
    p.solved = v; invalidate(); C.haptic(); C.toast(v ? "解決済みにしました" : "未解決に戻しました");
  } catch (e) { console.error(e); C.toast("変更できませんでした"); }
}
function postRow(p, full) {
  const text = full ? C.para(p.text) : C.esc(p.text).replace(/\n/g, "<br>");
  return `<div class="spost${full ? " full" : ""}" ${full ? "" : `data-open="${C.esc(p.id)}"`}>${avatar(p.uid, full ? 32 : 38)}<div class="sb">
    <div class="shd">${who(p.uid)}${p.kind ? `<span class="skind k-${C.esc(p.kind)}">${C.esc(kindName(p.kind))}</span>` : ""}</div>
    <p class="stx${full ? "" : " clamp"}" data-ptx="${C.esc(p.id)}">${text}${p.editedAt ? '<span class="sed">（編集済み）</span>' : ""}</p>
    <div class="sft">${stateTag(p)}<span>${C.ago(secOf(p.createdAt))}</span>${p.area ? `<span>${C.esc(areaName(p.area))}</span>` : ""}<button class="slk" data-like="${C.esc(p.id)}">${HEART}<i>${p.likeCount || 0}</i></button>${full ? "" : `<span class="src">${BUB}${p.replyCount || 0}</span>`}<button class="smore" data-pmore="${C.esc(p.id)}" aria-label="その他">${DOTS}</button></div>
  </div></div>`;
}

// ---------- 一覧（下のタブ「旅ひろば」） ----------
export async function renderSodan() {
  const box = document.getElementById("sodanBody");
  if (!LIST) box.innerHTML = '<p class="fol-empty">読み込み中…</p>';
  let list;
  try { list = await load(); } catch (e) { console.error(e); box.innerHTML = '<p class="fol-empty">読み込めませんでした。時間をおいてもう一度開いてください。</p>'; return; }
  let shown = list.filter((p) => (!fKind || p.kind === fKind) && (!fArea || p.area === fArea));
  if (fSort === "pop") shown = shown.slice().sort((a, b) => ((b.likeCount || 0) + 2 * (b.replyCount || 0)) - ((a.likeCount || 0) + 2 * (a.replyCount || 0)));
  if (fSort === "open") shown = shown.filter((p) => p.kind === "q" && !p.solved);
  const liked = await likedSet(shown.map((p) => p.id));
  box.innerHTML = `
    <div class="schips">${[["", "すべて"], ...KINDS].map(([k, l]) => `<button class="${k === fKind ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}</div>
    <div class="schips sa">${[["", "全エリア"], ...AREAS].map(([k, l]) => `<button class="${k === fArea ? "on" : ""}" data-a="${k}">${l}</button>`).join("")}</div>
    <div class="ssort">${[["new", "新着"], ["pop", "人気"], ["open", "未解決の相談"]].map(([k, l]) => `<button class="${k === fSort ? "on" : ""}" data-s="${k}">${l}</button>`).join("")}</div>
    <div class="slist">${shown.length ? shown.map((p) => postRow(p)).join("") : `<p class="fol-empty">${list.length ? "まだこの条件の投稿はありません。" : "まだ投稿がありません。最初の相談を書いてみませんか？"}</p>`}</div>
    <div style="height:110px"></div>`;
  box.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { fKind = b.dataset.k; C.haptic(); renderSodan(); }));
  box.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => { fArea = b.dataset.a; C.haptic(); renderSodan(); }));
  box.querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { fSort = b.dataset.s; C.haptic(); renderSodan(); }));
  box.querySelectorAll("[data-open]").forEach((r) => (r.onclick = (e) => { if (e.target.closest("a,button")) return; location.hash = "#c-" + r.dataset.open; }));
  bindPostActions(box, liked, list);
}
export async function refreshSodan() { await load(true).catch(() => {}); renderSodan(); }

async function likedSet(ids) {
  const me = C.me(), out = new Set(); if (!me) return out;
  await Promise.all(ids.slice(0, 60).map(async (id) => { try { if ((await getDoc(doc(db, "sodan", id, "likes", me))).exists()) out.add(id); } catch (e) {} }));
  return out;
}

function bindPostActions(root, liked, list) {
  root.querySelectorAll("[data-like]").forEach((b) => {
    const id = b.dataset.like; b.classList.toggle("on", liked.has(id));
    b.onclick = async (e) => {
      e.stopPropagation();
      const me = C.me(); if (!me) { C.toast("いいねするにはログインが必要です"); location.hash = "#x-login"; return; }
      const on = !b.classList.contains("on"), n = b.querySelector("i");
      b.classList.toggle("on", on); n.textContent = Math.max(0, (+n.textContent || 0) + (on ? 1 : -1)); C.haptic();
      const p = (list || []).find((x) => x.id === id); if (p) p.likeCount = Math.max(0, (p.likeCount || 0) + (on ? 1 : -1));
      try {
        if (on) await setDoc(doc(db, "sodan", id, "likes", me), { at: serverTimestamp() }); else await deleteDoc(doc(db, "sodan", id, "likes", me));
        await updateDoc(doc(db, "sodan", id), { likeCount: increment(on ? 1 : -1) });
      } catch (err) { console.error(err); }
    };
  });
  root.querySelectorAll("[data-pmore]").forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const p = (list || []).find((x) => x.id === b.dataset.pmore) || (await getDoc(doc(db, "sodan", b.dataset.pmore)).then((s) => ({ id: s.id, ...s.data() })));
    moreMenu({ kind: "post", p });
  }));
}

async function moreMenu({ kind, p, r }) {
  const me = C.me(), M = await C.mod(), item = r || p, uid = item.uid;
  const items = [];
  if (me && uid === me && kind === "post" && p.kind === "q") items.push({ label: p.solved ? "未解決に戻す" : "解決済みにする", onClick: async () => { await setSolved(p, !p.solved); if (location.hash.startsWith("#c-")) C.reopen(); else renderSodan(); } });
  if (me && uid === me) items.push({ label: "編集する", onClick: () => editText(kind, p, r) });
  if (me && uid === me) items.push({ label: "削除する", red: true, onClick: async () => {
    if (!confirm(kind === "post" ? "この投稿を削除しますか？" : "この回答を削除しますか？")) return;
    try {
      if (kind === "post") { await deleteDoc(doc(db, "sodan", p.id)); invalidate(); C.toast("削除しました"); if (location.hash.startsWith("#c-")) history.back(); else renderSodan(); }
      else { await deleteDoc(doc(db, "sodan", p.id, "replies", r.id)); await updateDoc(doc(db, "sodan", p.id), { replyCount: increment(-1) }).catch(() => {}); C.toast("削除しました"); C.reopen(); }
    } catch (e) { console.error(e); C.toast("削除できませんでした"); }
  } });
  if (uid !== me) {
    items.push({ label: "通報する", red: true, onClick: () => M.openReport({ type: "comment", targetId: kind === "post" ? p.id : r.id, targetUid: uid, articleId: "sodan:" + p.id, excerpt: item.text }) });
    items.push({ label: `${C.esc((C.PROF[uid] || {}).nickname || "このユーザー")}さんをブロック`, onClick: async () => { if (!confirm("ブロックすると、この人の投稿や回答が表示されなくなります。")) return; await M.blockUser(uid, (C.PROF[uid] || {}).nickname || ""); invalidate(); C.toast("ブロックしました"); if (location.hash.startsWith("#c-")) history.back(); else renderSodan(); } });
  }
  M.openMenu(items);
}

// 自分の投稿・回答を、その場で書き直す
function editText(kind, p, r) {
  const item = r || p;
  const el = document.querySelector(kind === "post" ? `[data-ptx="${CSS.escape(p.id)}"]` : `[data-rtx="${CSS.escape(r.id)}"]`);
  if (!el) return;
  const box = document.createElement("div");
  box.className = "sedit";
  box.innerHTML = `<textarea maxlength="1000"></textarea><div><button type="button" class="sc">キャンセル</button><button type="button" class="ss">保存</button></div>`;
  const ta = box.querySelector("textarea"); ta.value = item.text || "";
  el.replaceWith(box);
  const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 260) + "px"; };
  ta.oninput = fit; setTimeout(() => { fit(); ta.focus(); }, 30);
  box.onclick = (e) => e.stopPropagation();
  box.querySelector(".sc").onclick = () => box.replaceWith(el);
  box.querySelector(".ss").onclick = async () => {
    const text = ta.value.trim(); if (!text) { C.toast("本文を入れてください"); return; }
    const b = box.querySelector(".ss"); b.disabled = true; b.textContent = "保存中…";
    try {
      const ref = kind === "post" ? doc(db, "sodan", p.id) : doc(db, "sodan", p.id, "replies", r.id);
      await updateDoc(ref, { text: text.slice(0, 1000), editedAt: serverTimestamp() });
      item.text = text; item.editedAt = { seconds: Date.now() / 1000 };
      invalidate(); C.toast("保存しました");
      if (location.hash.startsWith("#c-")) C.reopen(); else renderSodan();
    } catch (e) { console.error(e); C.toast("保存できませんでした"); b.disabled = false; b.textContent = "保存"; }
  };
}

// ---------- 投稿のページ（#c-ID） ----------
export async function pageSodan(el, id) {
  el.innerHTML = C.bar("投稿") + '<div class="ps under2 sdp"><p class="loading">読み込み中…</p></div>';
  const ps = el.querySelector(".ps");
  let p;
  try { const s = await getDoc(doc(db, "sodan", id)); if (!s.exists()) { ps.innerHTML = '<p class="empty">投稿が見つかりませんでした（削除された可能性があります）</p>'; return; } p = { id: s.id, ...s.data() }; }
  catch (e) { ps.innerHTML = '<p class="empty">読み込めませんでした</p>'; return; }
  let reps = [];
  try { (await getDocs(query(collection(db, "sodan", id, "replies"), orderBy("createdAt", "asc"), limit(300)))).forEach((d) => reps.push({ id: d.id, ...d.data() })); } catch (e) {}
  let blocked = new Set(); if (C.me()) { try { blocked = await (await C.mod()).getBlocked(); } catch (e) {} }
  reps = reps.filter((r) => !blocked.has(r.uid));
  await C.loadProfiles([p.uid, ...reps.map((r) => r.uid)]);
  // 回答に付いた記事
  const arts = {};
  await Promise.all([...new Set(reps.map((r) => r.articleId).filter(Boolean))].map(async (a) => { try { const s = await getDoc(doc(db, "articles", a)); if (s.exists() && s.data().status === "published") arts[a] = { id: a, ...s.data() }; } catch (e) {} }));
  const me = C.me();
  const likedP = await likedSet([id]);
  const likedR = new Set();
  if (me) await Promise.all(reps.map(async (r) => { try { if ((await getDoc(doc(db, "sodan", id, "replies", r.id, "likes", me))).exists()) likedR.add(r.id); } catch (e) {} }));

  const own = me && p.uid === me && p.kind === "q";
  ps.innerHTML = `${postRow(p, true)}${own ? `<div class="ssolve"><span>${p.solved ? "この相談は解決済みです（もう一度押すと未解決に戻せます）" : "回答をもらって解決したら、解決済みにしてください"}</span><button class="mtog${p.solved ? " on" : ""}" data-solve>${p.solved ? CHK + "解決済み" : "解決済みにする"}</button></div>` : ""}
    <p class="srh">回答・コメント（${reps.length}）</p>
    <div class="sreps">${reps.length ? reps.map((r) => `<div class="srep">${avatar(r.uid, 34)}<div class="sb">
      <div class="shd">${who(r.uid)}</div>
      <p class="stx" data-rtx="${C.esc(r.id)}">${r.replyToName ? `<span class="sto">@${C.esc(r.replyToName)}</span> ` : ""}${C.para(r.text)}${r.editedAt ? '<span class="sed">（編集済み）</span>' : ""}</p>
      ${r.articleId && arts[r.articleId] ? C.artCard(arts[r.articleId]) : ""}
      <div class="sft"><span>${C.ago(secOf(r.createdAt))}</span><button class="slk${likedR.has(r.id) ? " on" : ""}" data-rlike="${C.esc(r.id)}">${HEART}<i>${r.likeCount || 0}</i></button><button class="srb" data-rto="${C.esc(r.uid)}">${BUB}返信</button><button class="smore" data-rmore="${C.esc(r.id)}" aria-label="その他">${DOTS}</button></div>
    </div></div>`).join("") : '<p class="fol-empty" style="padding:24px 20px">まだ回答はありません。最初に答えてみませんか？</p>'}</div>
    <div style="height:140px"></div>`;
  bindPostActions(ps, likedP, [p]);
  const sb = ps.querySelector("[data-solve]"); if (sb) sb.onclick = async () => { sb.disabled = true; await setSolved(p, !p.solved); C.reopen(); };
  ps.querySelectorAll("[data-rlike]").forEach((b) => (b.onclick = async () => {
    if (!me) { C.toast("いいねするにはログインが必要です"); location.hash = "#x-login"; return; }
    const rid = b.dataset.rlike, on = !b.classList.contains("on"), n = b.querySelector("i");
    b.classList.toggle("on", on); n.textContent = Math.max(0, (+n.textContent || 0) + (on ? 1 : -1)); C.haptic();
    try {
      if (on) await setDoc(doc(db, "sodan", id, "replies", rid, "likes", me), { at: serverTimestamp() }); else await deleteDoc(doc(db, "sodan", id, "replies", rid, "likes", me));
      await updateDoc(doc(db, "sodan", id, "replies", rid), { likeCount: increment(on ? 1 : -1) });
    } catch (e) { console.error(e); }
  }));
  ps.querySelectorAll("[data-rmore]").forEach((b) => (b.onclick = () => moreMenu({ kind: "reply", p, r: reps.find((x) => x.id === b.dataset.rmore) })));

  // 回答の入力欄（下に固定）
  let replyTo = null, artId = "";
  const foot = document.createElement("div");
  foot.className = "scmp";
  foot.innerHTML = me ? `<div class="sto2" hidden></div><div class="sart2" hidden></div><div class="srow"><img class="sme" src="${C.esc(C.avatarOf(me))}" alt=""><div class="spill"><textarea rows="1" maxlength="1000" placeholder="${p.kind === "q" ? "回答を書く…" : "コメントを書く…"}"></textarea><button class="sartb" type="button" aria-label="自分の記事を付ける"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h9l3 3V20.5H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/></svg></button><button class="ssend" type="button" disabled aria-label="送信"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></div></div>`
    : '<p class="slog"><a href="#x-login">ログイン</a>すると回答・コメントできます</p>';
  el.appendChild(foot);
  if (!me) return;
  const ta = foot.querySelector("textarea"), send = foot.querySelector(".ssend"), toEl = foot.querySelector(".sto2"), artEl = foot.querySelector(".sart2");
  const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; send.disabled = !ta.value.trim(); foot.classList.toggle("hastx", !!ta.value.trim()); };
  ta.oninput = fit;
  ps.querySelectorAll("[data-rto]").forEach((b) => (b.onclick = () => {
    const uid = b.dataset.rto; replyTo = { uid, name: (C.PROF[uid] || {}).nickname || "旅人" };
    toEl.hidden = false; toEl.innerHTML = `@${C.esc(replyTo.name)} さんに返信<button type="button">✕</button>`;
    toEl.querySelector("button").onclick = () => { replyTo = null; toEl.hidden = true; };
    ta.focus();
  }));
  foot.querySelector(".sartb").onclick = async () => {
    const mine = await C.myArticles();
    if (!mine.length) { C.toast("公開中の旅程記事がまだありません"); return; }
    (await C.mod()).openMenu(mine.map((a) => ({ label: C.esc(a.title || "（タイトルなし）"), onClick: () => {
      artId = a.id; artEl.hidden = false; artEl.innerHTML = `記事：${C.esc(a.title || "")}<button type="button">✕</button>`;
      artEl.querySelector("button").onclick = () => { artId = ""; artEl.hidden = true; };
    } })));
  };
  send.onclick = async () => {
    const text = ta.value.trim(); if (!text) return;
    const M = await C.mod();
    if (M.checkText) { const ng = M.checkText(text); if (ng) { C.toast(ng); return; } }
    send.disabled = true;
    try {
      await addDoc(collection(db, "sodan", id, "replies"), { uid: me, text: text.slice(0, 1000), articleId: artId || "", replyToUid: replyTo ? replyTo.uid : "", replyToName: replyTo ? replyTo.name : "", likeCount: 0, createdAt: serverTimestamp() });
      await updateDoc(doc(db, "sodan", id), { replyCount: increment(1), lastReplyAt: serverTimestamp() }).catch(() => {});
      const ex = p.text.slice(0, 40);
      C.notify({ toUid: p.uid, type: "sodan", articleId: id, articleTitle: ex });
      if (replyTo && replyTo.uid !== p.uid) C.notify({ toUid: replyTo.uid, type: "sodan", articleId: id, articleTitle: ex });
      invalidate(); C.haptic(); C.reopen();
    } catch (e) { console.error(e); C.toast("送信できませんでした"); send.disabled = false; }
  };
}

// ---------- 新しく投稿する（#c-new） ----------
export function pageSodanNew(el) {
  const me = C.me();
  if (!me) { el.innerHTML = C.bar("旅ひろばに投稿") + '<div class="ps under2"><p class="fol-empty"><a href="#x-login">ログイン</a>すると投稿できます。</p></div>'; return; }
  let kind = "q", area = "";
  el.innerHTML = C.bar("旅ひろばに投稿", '<button class="sgo" disabled>投稿</button>') + `<div class="ps under2 snew">
    <textarea class="sbody" maxlength="1000" placeholder="例：オーストラリアに1週間行くなら、どこがおすすめですか？"></textarea>
    <p class="slab">種類</p><div class="schips wrap" data-g="k">${KINDS.map(([k, l]) => `<button class="${k === kind ? "on" : ""}" data-v="${k}">${l}</button>`).join("")}</div>
    <p class="slab">エリア（任意）</p><div class="schips wrap" data-g="a">${AREAS.map(([k, l]) => `<button data-v="${k}">${l}</button>`).join("")}</div>
    <p class="snote">個人が特定できる情報（電話番号・住所など）は書かないでください。<a href="#c-rules">ルール</a>に沿わない投稿は削除することがあります。</p></div>`;
  const go = el.querySelector(".sgo"), ta = el.querySelector(".sbody");
  el.querySelectorAll("[data-g] button").forEach((b) => (b.onclick = () => {
    const g = b.parentNode.dataset.g, v = b.dataset.v;
    if (g === "k") kind = v; else area = area === v ? "" : v;
    b.parentNode.querySelectorAll("button").forEach((x) => x.classList.toggle("on", g === "k" ? x.dataset.v === kind : x.dataset.v === area));
    C.haptic();
  }));
  ta.oninput = () => (go.disabled = !ta.value.trim());
  // iPhoneはキーボードが出ると画面ごと上にずらすので、入力欄をタップしたら一番上に戻す（自動でキーボードは出さない）
  const ps = el.querySelector(".ps");
  const keepTop = () => { [0, 120, 350].forEach((t) => setTimeout(() => { window.scrollTo(0, 0); document.scrollingElement && (document.scrollingElement.scrollTop = 0); ps.scrollTop = 0; }, t)); };
  ta.addEventListener("focus", keepTop);
  go.onclick = async () => {
    const text = ta.value.trim(); if (!text) return;
    const M = await C.mod();
    if (M.checkText) { const ng = M.checkText(text); if (ng) { C.toast(ng); return; } }
    go.disabled = true; go.textContent = "投稿中…";
    try {
      const r = await addDoc(collection(db, "sodan"), { uid: me, kind, area, text: text.slice(0, 1000), likeCount: 0, replyCount: 0, status: "ok", createdAt: serverTimestamp(), lastReplyAt: serverTimestamp() });
      invalidate(); C.toast("投稿しました"); C.haptic();
      history.back(); setTimeout(() => { location.hash = "#c-" + r.id; }, 450);
    } catch (e) { console.error(e); C.toast("投稿できませんでした"); go.disabled = false; go.textContent = "投稿"; }
  };
}

// ---------- プロフィールの「旅ひろば」：その人の投稿。本人なら、未解決／解決済みをここで切り替えられる ----------
export async function renderMine(box, uid, isOwner) {
  box.innerHTML = '<p class="fol-empty">読み込み中…</p>';
  let list = [];
  try { (await getDocs(query(collection(db, "sodan"), where("uid", "==", uid), limit(100)))).forEach((d) => list.push({ id: d.id, ...d.data() })); }
  catch (e) { console.error(e); box.innerHTML = '<p class="empty">読み込めませんでした</p>'; return; }
  list = list.filter((p) => p.status !== "hidden").sort((a, b) => secOf(b.createdAt) - secOf(a.createdAt));
  await C.loadProfiles([uid]);
  if (!list.length) { box.innerHTML = `<p class="empty">${isOwner ? 'まだ旅ひろばの投稿がありません<br><br><a class="btn-s" href="#c-new">投稿する</a>' : "まだ旅ひろばの投稿はありません"}</p>`; return; }
  const open = list.filter((p) => p.kind === "q" && !p.solved).length;
  box.innerHTML = `<div class="slist">${list.map((p) => `<div class="mrow" data-open="${C.esc(p.id)}">
      <div class="mtop"><span class="skind k-${C.esc(p.kind || "")}">${C.esc(kindName(p.kind))}</span>${stateTag(p)}<small>${C.ago(secOf(p.createdAt))}</small></div>
      <p class="stx clamp">${C.esc(p.text)}</p>
      <div class="sft"><span>${HEART}${p.likeCount || 0}</span><span>${BUB}${p.replyCount || 0}</span>${isOwner && p.kind === "q" ? `<button class="mtog${p.solved ? " on" : ""}" data-tog="${C.esc(p.id)}">${p.solved ? CHK + "解決済み" : "解決済みにする"}</button>` : ""}</div>
    </div>`).join("")}</div>`;
  box.querySelectorAll("[data-open]").forEach((r) => (r.onclick = (e) => { if (e.target.closest("a,button")) return; location.hash = "#c-" + r.dataset.open; }));
  box.querySelectorAll("[data-tog]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); b.disabled = true; const p = list.find((x) => x.id === b.dataset.tog); await setSolved(p, !p.solved); renderMine(box, uid, isOwner); }));
}

// ---------- 旅ひろばのルール（#c-rules） ----------
export function pageRules(el) {
  const R = [
    ["経験にもとづいた情報を", "旅ひろばの価値は、実際に旅をした人の声にあります。人から聞いた話や、時間がたった情報を書くときは、その旨を添えてください。"],
    ["相手への敬意を忘れずに", "誹謗中傷、差別的な表現、執拗な書き込みは控えてください。旅のスタイルは人それぞれです。意見が違うときも、落ち着いたやり取りをお願いします。"],
    ["個人情報は書かない", "電話番号、住所、メールアドレス、宿泊先の部屋番号など、個人が特定できる情報は、ご自身のものも他の方のものも投稿しないでください。"],
    ["宣伝・勧誘・出会い目的はお断り", "商品やサービスの宣伝、副業などの勧誘、出会いを目的とした投稿や回答は削除します。"],
    ["危険・違法な行為をすすめない", "法律や現地のルールに反する行為、身の危険につながる行為をすすめる投稿は削除します。"],
    ["最終確認は公式情報で", "ビザや入国条件、料金などは変わることがあります。旅ひろばの情報は参考にしつつ、出発前には必ず公式の情報を確認してください。"],
  ];
  el.innerHTML = C.bar("旅ひろばのルール") + `<div class="ps under2 srules">
    <p class="slead">旅ひろばは、旅の相談や現地の情報を旅行好き同士で共有するための場所です。投稿や回答の前に、ひととおり目を通してください。</p>
    <ol>${R.map((r, i) => `<li><i>${i + 1}</i><div><b>${r[0]}</b><p>${r[1]}</p></div></li>`).join("")}</ol>
    <h3>ルールに沿わない投稿を見かけたら</h3>
    <p>投稿や回答の「…」から通報してください。運営が内容を確認し、ルールに沿わないものは削除します。違反がくり返される場合は、アカウントの利用を制限することがあります。通報したことが相手に伝わることはありません。</p>
    <p class="sfoot">そのほかの取り決めは、<a href="#w-terms">利用規約</a>をご確認ください。</p>
  </div>`;
}
