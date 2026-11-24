// Tabistock アプリ版（app/）
// サイトと同じ Firestore を読み、アプリ用のデザインで表示する。
// 第1段階：ホーム（おすすめ／フォロー中）・探す・記事。投稿／AI／DM などは当面サイトのページへつなぐ。
import { auth, db, storage } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, getCountFromServer, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  cinfo, esc, para, yen, isDomestic, prefLabel, derivePrefs, pubSec, costTotalOf, fmtPeriod,
  STYLES, COST_ITEMS, DAYS_OPT, REGION_JP, REGION_EN, COUNTRY_LL, COUNTRY_ISO, COUNTRIES, PREF_GROUPS
} from "../tabistock-render.js";
import { ILL, BOARD_CATS, BOARD_SEED } from "./board.js?v=202611250623";

const $ = (id) => document.getElementById(id);
const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  post: '<path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ai: '<path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor"/>',
  sodan: '<path d="M3.5 4.5h12v9H8.5l-3.5 3v-3H3.5z" fill="currentColor"/><path d="M17.5 8.5h3v9h-2v3l-3.5-3H10v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  me: '<circle cx="12" cy="8.5" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 20.5c1-3.8 4-5.8 7.5-5.8s6.5 2 7.5 5.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
};
const CH = '<svg viewBox="0 0 10 10"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const PIN = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>';
const COL = ['#1f6f5b', '#e2683b', '#5aa88c', '#f3a07c', '#9cc9b6', '#c9a46b', '#7a8fa6', '#d9cbb2'];
const DEF_AV = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e7ddcb'/%3E%3Ccircle cx='50' cy='40' r='18' fill='%23b9ad95'/%3E%3Cpath d='M20 86c0-17 13-28 30-28s30 11 30 28z' fill='%23b9ad95'/%3E%3C/svg%3E";
document.querySelectorAll("[data-i]").forEach((s) => (s.innerHTML = I[s.dataset.i]));

let ALL = [];             // 公開記事（新しい順）
const BY = {};            // id -> 記事
const PROF = {};          // uid -> publicProfile
let me = null, saved = new Set();

const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };
let tt;
function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => el.classList.remove("show"), 1900); }

// ---------- 記事の見せ方 ----------
const thumbOf = (d) => d.thumbUrl || (d.heroUrls && d.heroUrls[0]) || "";
const titleOf = (d) => d.title || (d.type === "transit" ? `${(cinfo((d.countries || [])[0]) || {}).jp || ""}でのトランジット` : "");
function placeEn(d) {
  if (d.type === "transit") return "Transit" + (d.airport ? " · " + d.airport : "");
  if (isDomestic(d)) return "Japan" + (derivePrefs(d).length ? " · " + prefLabel(d) : "");
  const cs = (d.countries || []).map((v) => (cinfo(v) || {}).en).filter(Boolean);
  return cs.slice(0, 2).join(" · ") + (cs.length > 2 ? " …" : "");
}
function placeJp(d) {
  if (isDomestic(d)) return derivePrefs(d).length ? prefLabel(d) : "日本";
  const cs = (d.countries || []).map((v) => (cinfo(v) || {}).jp).filter(Boolean);
  return cs.slice(0, 2).join("・") + (cs.length > 2 ? " ほか" : "");
}
function daysLabel(d) {
  if (d.dateStart && d.dateEnd) {
    const n = Math.round((new Date(d.dateEnd) - new Date(d.dateStart)) / 864e5) + 1;
    if (n > 0 && n < 400) return n === 1 ? "日帰り" : `${n - 1}泊${n}日`;
  }
  return (DAYS_OPT.find((x) => x.v === d.days_v) || {}).l || "";
}
const authorName = (d) => d.authorNickname || (PROF[d.authorId] || {}).nickname || "旅人";
const avatarOf = (uid) => (PROF[uid] || {}).photoURL || DEF_AV;
const ovText = (d) => `<span class="ovt"><em>${esc(placeEn(d))}</em><b>${esc(titleOf(d))}</b><small><img src="${esc(avatarOf(d.authorId))}" alt="">${esc(authorName(d))}${daysLabel(d) ? "・" + esc(daysLabel(d)) : ""}</small></span>`;
const cardH = (d) => `<a class="oc mcard press" href="#a-${esc(d.id)}" style="background-image:url('${esc(thumbOf(d))}')">${ovText(d)}</a>`;
const gridCard = (d) => `<a class="oc" href="#a-${esc(d.id)}" style="background-image:url('${esc(thumbOf(d))}')">${ovText(d)}</a>`;

async function loadProfiles(uids) {
  const need = [...new Set(uids)].filter((u) => u && !(u in PROF));
  await Promise.all(need.map(async (u) => {
    try { const s = await getDoc(doc(db, "publicProfiles", u)); PROF[u] = s.exists() ? s.data() : {}; } catch (e) { PROF[u] = {}; }
  }));
}

// ---------- タブ ----------
const TABS = [["home", "ホーム"], ["search", "探す"], ["post", "投稿"], ["sodan", "旅ひろば"], ["me", "マイページ"]];
const VIEWS = ["home", "search", "post", "sodan", "ai", "me", "saved"];
let curTab = "home";
// 下のタブ。選んでいる丸い背景（.ind）は1つだけ置いて、選んだタブまで横にすべらせる（インスタの Liquid Glass 風）
function renderTab() {
  const act = curTab === "saved" ? "me" : curTab;
  const tab = $("tab");
  if (!tab.querySelector(".ind")) {
    tab.innerHTML = '<i class="ind"></i>' + TABS.map(([k, l]) => `<button class="${k === "post" ? "tpost" : ""}" data-go="${k}" aria-label="${l}"><svg viewBox="0 0 24 24">${I[k]}</svg></button>`).join("");
  }
  const btns = [...tab.querySelectorAll("button")];
  const target = btns.find((b) => b.dataset.go === act);
  btns.forEach((b) => b.classList.toggle("on", b === target));
  moveInd(target);
  syncNativeTab();
  if (act === "ai" && aiLastTab !== "ai") aiSymPlay();   // AI相談を開くたびに、見出しの星を組み上げ直す
  aiLastTab = act;
}
let aiLastTab = null;
// アプリ（iPhone）では、下のタブを iOS 標準のタブバー（Liquid Glass）に任せる。
// ネイティブ側に「tabbar」の窓口があるときだけ、Webのタブを隠して、選択中のタブと表示・非表示をネイティブへ伝える
const NTAB = () => !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.tabbar);
function syncNativeTab() {
  if (!NTAB()) return;
  document.documentElement.classList.add("ntab");
  const sp = $("splash");
  const hidden = STACK.length > 0 || $("app").classList.contains("typing") || $("bs").classList.contains("show") || !!document.querySelector(".md-menu,.md-ov") || !!(sp && !sp.hidden && !sp.classList.contains("out"));   // 起動のロゴアニメーション中も隠す
  try { window.webkit.messageHandlers.tabbar.postMessage({ tab: ({ saved: "me", sodan: "ai", ai: "search" })[curTab] || curTab, hidden }); } catch (e) {}
}
// 下シート（マイページのメニューなど）を開いているあいだは、ネイティブのタブを隠す（シートの下の項目に被らないように）
new MutationObserver(() => syncNativeTab()).observe($("bs"), { attributes: true, attributeFilter: ["class"] });
// 「…」のメニューや通報の画面（body の直下に足される）を開いているあいだも隠す
new MutationObserver(() => syncNativeTab()).observe(document.body, { childList: true });
window.tbGo = (k) => { if (k === "ai") k = "sodan"; if (k === "post" || TABS.some((t) => t[0] === k)) go(k); };
let indAt = null;
function moveInd(target) {
  const ind = $("tab").querySelector(".ind");
  if (!ind || !target) return;
  const x = target.offsetLeft, w = target.offsetWidth;
  if (!w) { requestAnimationFrame(() => moveInd(target)); return; }   // まだレイアウト前
  const to = `translateX(${x}px)`;
  ind.style.width = w + "px";
  if (indAt === null || !ind.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) { ind.style.transform = to; indAt = x; return; }
  if (indAt === x) return;
  const from = `translateX(${indAt}px)`, mid = `translateX(${(indAt + x) / 2}px) scale(1.18, .9)`;
  ind.style.transform = to;
  // 動いている途中で少し横に伸びて、着いたらぷるっと戻る
  ind.animate([{ transform: from }, { transform: mid, offset: 0.45 }, { transform: `${to} scale(.96, 1.04)`, offset: 0.8 }, { transform: to }], { duration: 480, easing: "cubic-bezier(.3,.7,.3,1)" });
  indAt = x;
}
addEventListener("resize", () => { indAt = null; renderTab(); });
// タブの画面で文字を入力している間は、下のタブを隠す（キーボードの上にタブが乗って入力欄の邪魔になるため）
document.addEventListener("focusin", (e) => { if (e.target.matches("textarea, input[type=text], input[type=search], input:not([type])") && !e.target.closest(".page, #bs")) { $("app").classList.add("typing"); syncNativeTab(); } });
document.addEventListener("focusout", () => setTimeout(() => { const a = document.activeElement; if (!a || !a.matches || !a.matches("textarea, input")) { $("app").classList.remove("typing"); syncNativeTab(); } }, 50));
function go(k, opt = {}) {
  if (STACK.length) { location.hash = ""; }
  if (k === curTab && !Object.keys(opt).length) { $(k).scrollTo({ top: 0, behavior: "smooth" }); return; }
  const from = curTab;
  curTab = k; haptic();
  // 下のタブで別のページから来たときは、中のタブを最初（ホームは「おすすめ」、マイページは「旅程」）に戻す
  if (from !== k) {
    if (k === "home" && $("htabs") && !$("htabs").children[0].classList.contains("on")) homeTab(0);
    if (k === "me") myTab = "trips";
  }
  VIEWS.forEach((t) => ($(t).hidden = t !== k));
  $("aiCmp").hidden = k !== "ai";
  renderTab();
  if (k === "search") {
    if (opt.reset) { Object.assign(state, { q: "", country: [], pref: [], budget: [], days: [], style: [] }); $("q").value = ""; }
    if (opt.country) { state.country = [opt.country]; state.pref = []; }
    if (opt.style) state.style = [opt.style];
    renderSearch();
  }
  if (k === "me") renderMe();
  if (k === "post") renderDrafts();
  if (k === "saved") renderSaved();
  if (k === "ai") { aiLoad(); aiRender(); }
  if (k === "sodan") SD().then((M) => M.renderSodan());
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]");
  if (!b) return;
  e.preventDefault();
  go(b.dataset.go, b.dataset.reset ? { reset: 1, country: b.dataset.country, style: b.dataset.style } : {});
});

// ---------- ホーム ----------
// ピックアップの自動スライド（ストーリー風：上のゲージが7秒で溜まったら、ゆっくり次の記事へ）
// 指で押さえている間・ホームを見ていない間はゲージを止める。指でめくったら、その記事からゲージをやり直す
let carRaf = null;
function startCarousel(n) {
  cancelAnimationFrame(carRaf);
  const car = $("fcar"); if (!car || n < 2) return;
  const DUR = 7000, SLIDE = 1200;
  const bars = [...document.querySelectorAll("#fdots b")];
  let idx = 0, t = 0, last = performance.now(), hold = false, moving = false;
  const paint = () => bars.forEach((b, j) => { b.style.transform = `scaleX(${j < idx ? 1 : j === idx ? Math.min(1, t / DUR) : 0})`; b.parentNode.classList.toggle("on", j === idx); });
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  function slideTo(i) {
    moving = true;
    const from = car.scrollLeft, to = i * car.clientWidth, t0 = performance.now();
    car.style.scrollSnapType = "none";
    idx = i; t = 0;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / SLIDE);
      car.scrollLeft = from + (to - from) * ease(k);
      if (k < 1) requestAnimationFrame(step);
      else { car.style.scrollSnapType = ""; moving = false; last = performance.now(); }
    };
    requestAnimationFrame(step);
  }
  car.addEventListener("scroll", () => { if (moving) return; const i = Math.round(car.scrollLeft / car.clientWidth); if (i !== idx) { idx = i; t = 0; } }, { passive: true });
  car.addEventListener("touchstart", () => (hold = true), { passive: true });
  car.addEventListener("touchend", () => (hold = false), { passive: true });
  car.addEventListener("touchcancel", () => (hold = false), { passive: true });
  const tick = (now) => {
    const dt = Math.min(100, now - last); last = now;
    if (!hold && !moving && curTab === "home" && !STACK.length && !$("home").hidden && !document.hidden) {
      t += dt;
      if (t >= DUR) slideTo((idx + 1) % n);
    }
    paint();
    carRaf = requestAnimationFrame(tick);
  };
  carRaf = requestAnimationFrame(tick);
}
// 写真のモザイク（プロフィール用）：その人が投稿者の記事の DAY の写真を、大小組み合わせて敷き詰める。
// 共同投稿の記事は、一緒に旅した人が写っていることがあるので入れない
const MOS_MAX = 30;   // 写真タブに出す枚数（3列×10段）
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function photoMosaic(arts) {
  // 記事ごとに写真をまとめ、記事の順番も写真もシャッフル → 各記事から1枚ずつ順番に取って MOS_MAX 枚まで
  const groups = shuffle(arts.map((d) => {
    const list = d.type === "transit" ? (d.heroUrls || []).map((u) => ({ d, u, di: -1 }))
      : (d.days || []).flatMap((dy, di) => (dy.photoUrls || []).map((u) => ({ d, u, di })));
    return shuffle(list);
  }).filter((g) => g.length));
  const items = [], seen = new Set();
  groups.forEach((g, i) => (groups[i] = g.filter((p) => !seen.has(p.u) && seen.add(p.u))));   // 同じ写真は1回だけ
  for (let k = 0; items.length < MOS_MAX && groups.some((g) => g.length > k); k++) groups.forEach((g) => { if (g[k] && items.length < MOS_MAX) items.push(g[k]); });
  if (!items.length) return "";
  // 3枚ずつのブロックで並べて隙間をなくす：大(左)+小2／小+大(右)+小／小3枚の横一列。大きいブロックの次は必ず横一列
  if (items.length >= 3) items.length -= items.length % 3;
  const cls = [];
  let prevBig = false;
  for (let i = 0; i < items.length; i += 3) {
    const r = Math.random(), t = items.length - i < 3 || prevBig || r < 0.25 ? "row" : r < 0.625 ? "L" : "R";
    cls.push(...(t === "L" ? ["big", "", ""] : t === "R" ? ["", "big br", ""] : ["", "", ""]));
    prevBig = t !== "row";
  }
  return `<div class="mos">${items.map((p, i) => `<a class="mt ${cls[i] || ""}" href="#a-${esc(p.d.id)}"><img src="${esc(p.u)}" alt="" loading="lazy" decoding="async"></a>`).join("")}</div>`;
}
function renderHome() {
  ALL.slice(0, 40).forEach((d) => { const u = thumbOf(d); if (u) ratioOf(u, () => {}); });   // 記事を開いたときにトップ写真が上下に動かないよう、先に縦横比を調べておく
  const trips = ALL.filter((d) => d.type !== "transit" && !isDomestic(d));
  const jp = ALL.filter((d) => d.type !== "transit" && isDomestic(d));
  const tr = ALL.filter((d) => d.type === "transit");
  // ピックアップ：中欧ヨーロッパ・中央アジア・イタリア（8泊9日）の3本を自動でスライド。見つからない分は写真のある海外の旅で補う
  const pool = trips.filter((d) => thumbOf(d));
  const has = (d, cs) => (d.countries || []).some((c) => cs.includes(c));
  const finders = [
    (d) => /中欧/.test(titleOf(d)) || (has(d, ["czech", "austria", "hungary", "slovakia", "poland"]) && !has(d, ["italy"])),
    (d) => /中央アジア/.test(titleOf(d)) || has(d, ["kazakhstan", "kyrgyzstan", "uzbekistan", "tajikistan", "turkmenistan"]),
    (d) => (/イタリア/.test(titleOf(d)) && /8泊9日/.test(titleOf(d))) || ((d.countries || []).includes("italy") && daysLabel(d) === "8泊9日"),
  ];
  const picks = [];
  finders.forEach((f) => { const d = pool.find((x) => !picks.includes(x) && f(x)); if (d) picks.push(d); });
  for (const d of pool) { if (picks.length >= 3) break; if (!picks.includes(d)) picks.push(d); }
  const pick = picks[0];
  if (picks.length) {
    $("feat").innerHTML = `<div class="fcar" id="fcar">${picks.map((p) => `<a class="feat" href="#a-${esc(p.id)}" style="background-image:url('${esc(thumbOf(p))}')"><span class="tag">PICK UP</span>
      <div class="in"><div class="pl">${PIN} ${esc(placeJp(p))}</div><div class="tt">${esc(titleOf(p))}</div>
      <div class="row"><div class="au"><img src="${esc(avatarOf(p.authorId))}" alt="">${esc(authorName(p))}${p.dateStart ? "・" + esc(p.dateStart.slice(0, 4) + "年" + Number(p.dateStart.slice(5, 7)) + "月") : ""}</div></div></div></a>`).join("")}</div>`
      + (picks.length > 1 ? `<div class="fdots" id="fdots">${picks.map(() => "<i><b></b></i>").join("")}</div>` : "");
    startCarousel(picks.length);
  }
  $("newList").innerHTML = trips.filter((d) => !picks.includes(d)).slice(0, 10).map(cardH).join("") || '<p class="loading">まだ記事がありません</p>';
  $("jpSec").hidden = !jp.length; $("jpList").innerHTML = jp.slice(0, 10).map(cardH).join("");
  $("trSec").hidden = !tr.length; $("trList").innerHTML = tr.slice(0, 10).map(cardH).join("");
}
document.querySelectorAll("#htabs button").forEach((b) => b.addEventListener("click", () => homeTab(+b.dataset.ht)));
function homeTab(i) {
  haptic();
  [...$("htabs").children].forEach((b, j) => b.classList.toggle("on", i === j));
  $("recPane").hidden = i !== 0; $("folPane").hidden = i !== 1; $("boardPane").hidden = i !== 2;
  if (i === 1) renderFeed();
  if (i === 2) renderBoard();
}
$("home").addEventListener("scroll", () => {
  const h = $("htabs");
  h.classList.toggle("stuck", h.getBoundingClientRect().top <= $("home").getBoundingClientRect().top + 0.5 && $("home").scrollTop > 10);
}, { passive: true });

// フォロー中：フォローしている人の公開記事を新しい順に
async function renderFeed() {
  const box = $("folPane");
  if (!me) { box.innerHTML = '<p class="fol-empty">ログインすると、フォローしている人の新しい旅がここに流れます。<br><br><a href="#x-login" style="color:var(--green);font-weight:700">ログイン・新規登録 →</a></p>'; return; }
  box.innerHTML = '<p class="fol-empty">読み込み中…</p>';
  let ids = [];
  try { (await getDocs(collection(db, "users", me, "following"))).forEach((s) => ids.push(s.id)); } catch (e) {}
  if (!ids.length) { box.innerHTML = '<p class="fol-empty">まだ誰もフォローしていません。気になる旅人のプロフィールからフォローしてみましょう。</p>'; return; }
  const set = new Set(ids);
  const list = ALL.filter((d) => set.has(d.authorId) || (d.coAuthorIds || []).some((u) => set.has(u)));
  if (!list.length) { box.innerHTML = '<p class="fol-empty">フォロー中の人の記事はまだありません。</p>'; return; }
  const SAVE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M6.5 3.5h11v17l-5.5-3.6-5.5 3.6z"/></svg>';
  const HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  box.innerHTML = list.slice(0, 30).map((d) => {
    const imgs = (d.heroUrls && d.heroUrls.length ? d.heroUrls : [thumbOf(d)]).filter(Boolean);
    return `<article class="post">
      <div class="ph"><a href="#u-${esc(d.authorId)}"><img src="${esc(avatarOf(d.authorId))}" alt=""></a><div><b>${esc(authorName(d))}</b><small>${esc(ago(pubSec(d)))}・${esc(placeJp(d))}</small></div></div>
      <div class="pgn"><a class="pg" href="#a-${esc(d.id)}">${imgs.map((u) => `<div style="background-image:url('${esc(u)}')"></div>`).join("")}</a>${imgs.length > 1 ? `<span>1/${imgs.length}</span>` : ""}</div>
      <div class="acts"><button class="lk" data-flike="${esc(d.id)}" aria-label="いいね">${HEART}<b></b></button><button class="sv ${saved.has(d.id) ? "on" : ""}" data-save="${esc(d.id)}">${SAVE}</button></div>
      <div class="pc"><div class="pl">${esc(placeJp(d))}${daysLabel(d) ? "・" + esc(daysLabel(d)) : ""}</div><h3>${esc(titleOf(d))}</h3>${d.lead ? `<p>${esc(String(d.lead).replace(/\n+/g, " "))}</p>` : ""}<a class="more" href="#a-${esc(d.id)}">旅程を見る →</a></div>
    </article>`;
  }).join("");
  box.querySelectorAll("[data-flike]").forEach((b) => { const d = BY[b.dataset.flike]; if (d) wireLike(b, b.querySelector("b"), d, "on"); });
  box.querySelectorAll(".pg").forEach((g) => (g.onscroll = () => { const n = g.parentNode.querySelector("span"); if (n) n.textContent = Math.round(g.scrollLeft / g.clientWidth) + 1 + "/" + g.children.length; }));
}
function ago(sec) {
  if (!sec) return "";
  const m = Math.floor((Date.now() / 1000 - sec) / 60);
  if (m < 60) return `${Math.max(1, m)}分前`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}時間前`;
  const dd = Math.floor(h / 24); if (dd < 7) return `${dd}日前`;
  if (dd < 30) return `${Math.floor(dd / 7)}週間前`;
  const t = new Date(sec * 1000); return `${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()}`;
}

// ---------- 探す ----------
const BUD = [[0, 5, "〜5万円"], [5, 10, "5〜10万円"], [10, 15, "10〜15万円"], [15, 20, "15〜20万円"], [20, 30, "20〜30万円"], [30, 1e9, "30万円〜"]];
const DAYS = [[0, 1, "日帰り"], [1, 3, "2〜3日"], [3, 7, "4日〜1週間"], [7, 14, "8日〜2週間"], [14, 1e9, "2週間以上"]];
const state = { q: "", country: [], pref: [], budget: [], days: [], style: [], map: 0 };
const LABEL = { country: "国・地域", budget: "予算", days: "日数", style: "スタイル" };
function nDays(d) {
  if (d.dateStart && d.dateEnd) return Math.round((new Date(d.dateEnd) - new Date(d.dateStart)) / 864e5) + 1;
  return null;
}
function hasStyle(d, v) { return (d.styles || []).includes(v) || (v === "transit" && d.type === "transit"); }
function match(d, skip) {
  const q = state.q.trim().toLowerCase();
  if (q) {
    const hay = [titleOf(d), d.lead, placeJp(d), placeEn(d), d.airport, ...(d.days || []).map((x) => x && x.summary)].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (skip !== "country" && (state.country.length || state.pref.length)) {
    const okC = state.country.some((c) => (d.countries || []).includes(c));
    const okP = state.pref.length && (d.countries || []).includes("japan") && derivePrefs(d).some((x) => state.pref.includes(x));
    if (!okC && !okP) return false;
  }
  if (skip !== "style" && state.style.length && !state.style.some((v) => hasStyle(d, v))) return false;
  if (skip !== "budget" && state.budget.length) {
    const t = costTotalOf(d) / 1e4; if (!t) return false;
    if (!state.budget.some((i) => t > BUD[i][0] && t <= BUD[i][1])) return false;
  }
  if (skip !== "days" && state.days.length) {
    const n = nDays(d); if (!n) return false;
    if (!state.days.some((i) => n > DAYS[i][0] && n <= DAYS[i][1])) return false;
  }
  return true;
}
// 各項目の選択肢：[値, 表示名]
function optionsOf(key) {
  if (key === "budget") return BUD.map((b, i) => [i, b[2]]);
  if (key === "days") return DAYS.map((b, i) => [i, b[2]]);
  if (key === "style") return STYLES.filter((x) => x.v !== "transit" || ALL.some((d) => d.type === "transit")).map((x) => [x.v, x.tag]);
  return COUNTRIES.map((c) => [c.v, c.jp]);
}
function summary(key) {
  if (key === "country") {
    const names = [...state.country.map((v) => (cinfo(v) || {}).jp || v), ...state.pref];
    return names.length ? names[0] + (names.length > 1 ? ` ほか${names.length - 1}` : "") : "すべて";
  }
  const v = state[key]; if (!v.length) return "すべて";
  const first = (optionsOf(key).find((o) => String(o[0]) === String(v[0])) || [0, ""])[1];
  return v.length > 1 ? `${first} ほか${v.length - 1}` : first;
}
function renderFilters() {
  $("filters").innerHTML = ["country", "budget", "days", "style"].map((k) => `<button class="dd ${(k === "country" ? state.country.length + state.pref.length : state[k].length) ? "on" : ""}" data-sheet="${k}"><small>${LABEL[k]}</small><span>${esc(summary(k))}</span>${CH}</button>`).join("");
  $("filters").querySelectorAll("[data-sheet]").forEach((b) => (b.onclick = () => openSheet(b.dataset.sheet)));
}
// 下から出る複数選択シート
let sheetKey = null, sel = {};
function openSheet(key) {
  sheetKey = key; haptic();
  sel = { country: [...state.country], pref: [...state.pref], [key]: [...state[key]] };
  drawSheet();
  $("ov").classList.add("show"); $("bs").classList.add("show");
}
let prefOpen = false;
function drawSheet() {
  const key = sheetKey;
  const base = ALL.filter((d) => match(d, key));
  const cntC = (v) => base.filter((d) => (d.countries || []).includes(v)).length;
  const cntP = (p) => base.filter((d) => (d.countries || []).includes("japan") && derivePrefs(d).includes(p)).length;
  const cntO = (v) => base.filter((d) => key === "style" ? hasStyle(d, v) : key === "budget" ? (() => { const t = costTotalOf(d) / 1e4; return t > BUD[v][0] && t <= BUD[v][1]; })() : (() => { const n = nDays(d); return n && n > DAYS[v][0] && n <= DAYS[v][1]; })()).length;
  const has = (arr, v) => arr.some((x) => String(x) === String(v));
  const row = (k, v, label, n) => `<button class="frow ${has(sel[k], v) ? "on" : ""} ${n ? "" : "zero"}" data-k="${k}" data-v="${esc(v)}"><span class="bx"></span><span class="nm">${esc(label)}</span><small>${n || ""}</small></button>`;
  const all = (k, vals, label) => { const on = vals.length && vals.every((v) => has(sel[k], v)); return `<button class="fall ${on ? "on" : ""}" data-all="${k}" data-vals="${esc(vals.join("|"))}"><span class="bx"></span>${label}</button>`; };
  // エリアの見出しそのものにチェックを付けて、まとめて選べるようにする
  const head = (k, vals, label, cls = "") => { const on = vals.length && vals.every((v) => has(sel[k], v)); return `<button class="fall fh ${cls} ${on ? "on" : ""}" data-all="${k}" data-vals="${esc(vals.join("|"))}"><span class="bx"></span><b>${esc(label)}</b></button>`; };
  let body = "";
  if (key === "country") {
    // 日本：都道府県は最初は隠しておき、「都道府県で選ぶ」で開く（都道府県を選んでいるときは開いたまま）
    const prefShow = prefOpen || sel.pref.length > 0;
    body += `<div class="fsec"><div class="fhead">${head("country", ["japan"], "日本")}</div>`
      + `<button class="fpref ${prefShow ? "open" : ""}" id="fPref">都道府県で選ぶ${sel.pref.length ? `<small>${sel.pref.length}</small>` : ""}${CH}</button>`
      + (prefShow ? PREF_GROUPS.map((g) => `<p class="fsub">${head("pref", g.list, g.r, "sm")}</p><div class="fgrid">${g.list.map((p) => row("pref", p, p, cntP(p))).join("")}</div>`).join("") : "") + "</div>";
    const regions = [...new Set(COUNTRIES.filter((c) => c.v !== "japan").map((c) => c.r))];
    body += regions.map((r) => { const cs = COUNTRIES.filter((c) => c.r === r && c.v !== "japan"); return `<div class="fsec"><div class="fhead">${head("country", cs.map((c) => c.v), REGION_JP[r] || r)}</div><div class="fgrid">${cs.map((c) => row("country", c.v, c.jp, cntC(c.v))).join("")}</div></div>`; }).join("");
  } else {
    body = `<div class="fsec"><div class="fgrid ${key === "style" ? "" : "one"}">${optionsOf(key).map((o) => row(key, o[0], o[1], cntO(o[0]))).join("")}</div></div>`;
  }
  const tmp = { country: state.country, pref: state.pref, [key]: state[key] };
  Object.assign(state, sel); const n = ALL.filter((d) => match(d)).length; Object.assign(state, tmp);
  $("bs").innerHTML = `<div class="grab"></div><div class="bsh"><h3>${LABEL[key]}<small style="font-size:12px;color:var(--muted);font-weight:500;margin-left:8px">複数選べます</small></h3><button id="bsClr">クリア</button></div>
    <div class="bsb">${body}<div style="height:12px"></div></div>
    <button class="ok" id="bsOk">${n}件の旅を表示</button>`;
  const num = (k, v) => (k === "budget" || k === "days" ? Number(v) : v);
  const keep = () => { const b = $("bs").querySelector(".bsb"); const st = b.scrollTop; drawSheet(); $("bs").querySelector(".bsb").scrollTop = st; };
  $("bs").querySelectorAll(".frow").forEach((b) => (b.onclick = () => {
    const k = b.dataset.k, v = num(k, b.dataset.v), arr = sel[k];
    const i = arr.findIndex((x) => String(x) === String(v));
    if (i >= 0) arr.splice(i, 1); else arr.push(v);
    haptic(); keep();
  }));
  $("bs").querySelectorAll(".fall").forEach((b) => (b.onclick = () => {
    const k = b.dataset.all, vals = b.dataset.vals.split("|").map((v) => num(k, v));
    const on = vals.every((v) => has(sel[k], v));
    sel[k] = on ? sel[k].filter((x) => !vals.some((v) => String(v) === String(x))) : [...new Set([...sel[k], ...vals])];
    haptic(); keep();
  }));
  const fp = $("fPref"); if (fp) fp.onclick = () => { prefOpen = !(prefOpen || sel.pref.length > 0); if (!prefOpen) sel.pref = []; haptic(); keep(); };
  $("bsClr").onclick = () => { sel = { country: [], pref: [], [key]: [] }; Object.assign(state, sel); renderSearch(); drawSheet(); };
  $("bsOk").onclick = () => { Object.assign(state, sel); closeSheet(); renderSearch(); };
}
let onSheetClose = null;
function closeSheet() { $("ov").classList.remove("show"); $("bs").classList.remove("show"); const f = onSheetClose; onSheetClose = null; if (f) f(); }
// 投稿画面などから使う汎用の下シート。mount(bs) で中身を配線、onClose は閉じたときに1回だけ
function openBS(html, mount, onClose) {
  onSheetClose = onClose || null; haptic();
  const bs = $("bs");
  bs.innerHTML = html ? `<div class="grab"></div>${html}` : "";
  if (mount) mount(bs);
  $("ov").classList.add("show"); bs.classList.add("show");
}
$("ov").onclick = closeSheet;

// リスト／地図
document.querySelectorAll("#seg [data-seg]").forEach((b) => (b.onclick = () => setSeg(+b.dataset.seg)));
function setSeg(i) {
  state.map = i; haptic();
  $("seg").classList.toggle("rt", !!i);
  [...$("seg").querySelectorAll("button")].forEach((b, j) => b.classList.toggle("on", i === j));
  renderSearch();
}
// 探すの地図（Leaflet）。記事のある国を緑で塗り、拡大すると国名と件数が出る。国をタップするとその国で絞り込む。
let SMAP = null, SHAPES = null, mapSel = null;
// 日付変更線をまたぐ国（ロシア・フィジーなど）は経度をつなげて、地図を横切る帯にならないようにする
const ringsOf = (iso) => (SHAPES[iso] || []).map((r) => { const pts = []; let prev = null; for (let i = 0; i < r.length; i += 2) { let lng = r[i]; if (prev !== null) { while (lng - prev > 180) lng -= 360; while (lng - prev < -180) lng += 360; } prev = lng; pts.push([r[i + 1], lng]); } return pts; });
async function renderMap(list) {
  $("results").innerHTML = `<div id="smap"></div><p class="maphint">記事のある国を緑で表示。拡大すると国名が出ます。国をタップすると下に記事が出ます</p><div id="mapList"></div>`;
  if (SMAP) { try { SMAP.remove(); } catch (e) {} SMAP = null; }
  try { await loadLeaflet(); SHAPES = SHAPES || (await fetch("/country-shapes.json").then((r) => r.json())); }
  catch (e) { $("smap").innerHTML = '<p class="loading">地図を読み込めませんでした</p>'; return; }
  const box = $("smap"); if (!box) return;
  const map = L.map(box, { zoomControl: false, attributionControl: false, worldCopyJump: true, minZoom: 1.5, maxZoom: 7, zoomSnap: 0.5, preferCanvas: true }).setView([30, 110], 2);
  SMAP = map;
  const by = {};
  list.forEach((d) => (d.countries || []).forEach((c) => (by[c] = (by[c] || 0) + 1)));
  const isoTo = {}; Object.entries(COUNTRY_ISO).forEach(([v, iso]) => (isoTo[iso] = v));
  // 陸地は国ごとの細かい形で描く（海岸線と色付けの境界をそろえる）
  const layers = {};
  Object.keys(SHAPES).forEach((iso) => {
    const c = isoTo[iso], n = c ? by[c] || 0 : 0;
    const lay = L.polygon(ringsOf(iso), n
      ? { fillColor: "#1f6f5b", fillOpacity: Math.min(0.9, 0.45 + n * 0.1), color: "#fff", weight: 0.7 }
      : { fillColor: "#f6f1e6", fillOpacity: 1, color: "#e3ddd0", weight: 0.5, interactive: false }).addTo(map);
    if (n) { layers[c] = lay; lay.on("click", () => pickCountry(c)); }
  });
  Object.entries(by).forEach(([c, n]) => {
    const ll = COUNTRY_LL[c]; if (!ll) return;
    const small = !layers[c];
    const m = L.circleMarker(ll, { radius: small ? 5 : 0.1, color: "#fff", weight: small ? 1.5 : 0, fillColor: "#1f6f5b", fillOpacity: small ? 1 : 0 }).addTo(map).on("click", () => pickCountry(c));
    m.bindTooltip(`${(cinfo(c) || {}).jp || c} ${n}`, { permanent: true, direction: "center", className: "cl", interactive: false });
  });
  const zs = () => box.classList.toggle("zs", map.getZoom() < 3.5);
  map.on("zoomend", zs); zs();
  function pickCountry(c) {
    haptic();
    if (mapSel && layers[mapSel]) layers[mapSel].setStyle({ color: "#fff", weight: 0.7 });
    mapSel = c;
    if (layers[c]) { layers[c].setStyle({ color: "#e2683b", weight: 2.2 }); layers[c].bringToFront(); }
    const ds = list.filter((d) => (d.countries || []).includes(c));
    const ml = $("mapList");
    ml.innerHTML = `<div class="sh" style="padding-top:18px"><h2>${esc((cinfo(c) || {}).jp || c)}の旅 <small style="font-family:Manrope;color:var(--muted);font-size:13px">${ds.length}件</small></h2><button id="mlx">閉じる</button></div><div class="ogrid">${ds.map(gridCard).join("")}</div>`;
    $("mlx").onclick = () => { ml.innerHTML = ""; if (layers[mapSel]) layers[mapSel].setStyle({ color: "#fff", weight: 0.7 }); mapSel = null; };
    const sc = $("search"); sc.scrollTo({ top: ml.offsetTop - 120, behavior: "smooth" });
  }
  if (mapSel && by[mapSel]) pickCountry(mapSel);
}
// いいね数（記事ごとに数える。探すで「いいね順」を選んだときに1回だけ）とフォロー中の人
let LIKES = null, FOLLOWS = null, likesLoading = false, followsLoading = false;
async function loadLikes() {
  if (likesLoading) return; likesLoading = true;
  const m = {};
  await Promise.all(ALL.map(async (d) => { try { m[d.id] = (await getCountFromServer(collection(db, "articles", d.id, "likes"))).data().count; } catch (e) { m[d.id] = 0; } }));
  LIKES = m; likesLoading = false;
  if (curTab === "search" && state.sort === "like") renderSearch();
}
async function loadFollows() {
  if (followsLoading || !me) return; followsLoading = true;
  const set = new Set();
  try { (await getDocs(collection(db, "users", me, "following"))).forEach((x) => set.add(x.id)); } catch (e) {}
  FOLLOWS = set; followsLoading = false;
  if (curTab === "search" && state.sort === "follow") renderSearch();
}
function renderSearch() {
  $("qx").style.display = state.q ? "grid" : "none";
  renderFilters();
  let list = ALL.filter((d) => match(d));
  if (state.map) { renderMap(list); return; }
  // 並び順：新しい順（そのまま）／いいね順／フォロー中の人の旅だけ
  const SORTS = { new: "新しい順", like: "いいね順", follow: "フォロー中" };
  const sort = state.sort || "new";
  if (sort === "like") {
    if (!LIKES) { loadLikes(); }
    else list = list.slice().sort((a, b) => (LIKES[b.id] || 0) - (LIKES[a.id] || 0));
  }
  if (sort === "follow") {
    if (!FOLLOWS) { loadFollows(); list = []; }
    else list = list.filter((d) => FOLLOWS.has(d.authorId) || (d.coAuthorIds || []).some((u) => FOLLOWS.has(u)));
  }
  const any = !!state.q || ["country", "pref", "budget", "days", "style"].some((k) => state[k].length);
  $("results").innerHTML = `<div class="cnt"><span><b>${list.length}件</b>の旅${any ? '<button class="cclr" id="clr2">✕ 条件をクリア</button>' : ""}</span><button class="csort" id="csort">${SORTS[sort]}${CH}</button></div>` +
    (list.length ? `<div class="ogrid">${list.map(gridCard).join("")}</div>` : sort === "follow" ? `<div class="empty">${FOLLOWS ? "フォローしている人の旅はまだありません" : "読み込み中…"}</div>` : `<div class="empty">条件に合う旅がありません<br><br><button class="chip" id="clr" style="margin:auto">条件をクリア</button></div>`);
  // 並び順：その場で開く小さなプルダウン
  $("csort").onclick = (e) => {
    e.stopPropagation();
    const old = document.querySelector(".csmenu"); if (old) { old.remove(); return; }
    const m = document.createElement("div"); m.className = "csmenu";
    m.innerHTML = Object.entries(SORTS).map(([k, l]) => `<button data-s="${k}" class="${k === sort ? "on" : ""}">${l}</button>`).join("");
    $("csort").parentNode.appendChild(m);
    m.onclick = (ev) => {
      const b = ev.target.closest("[data-s]"); if (!b) return; ev.stopPropagation();
      const k = b.dataset.s; m.remove();
      if (k === "follow" && !me) { toast("フォロー中の旅を見るにはログインが必要です"); location.hash = "#x-login"; return; }
      state.sort = k; haptic(); renderSearch();
    };
    setTimeout(() => document.addEventListener("click", function off() { m.remove(); document.removeEventListener("click", off); }), 0);
  };
  const clr2 = $("clr2"); if (clr2) clr2.onclick = () => { Object.assign(state, { q: "", country: [], pref: [], budget: [], days: [], style: [] }); $("q").value = ""; haptic(); renderSearch(); };
  const clr = $("clr"); if (clr) clr.onclick = () => { Object.assign(state, { q: "", country: [], pref: [], budget: [], days: [], style: [] }); $("q").value = ""; renderSearch(); };
}
$("q").addEventListener("input", (e) => { state.q = e.target.value; renderSearch(); });
$("qx").addEventListener("click", (e) => { e.preventDefault(); $("q").value = ""; state.q = ""; renderSearch(); });
$("fbars").innerHTML = [22, 18, 26, 30, 24, 16, 12, 20, 28, 34, 26, 19].map((h) => `<i class="${h <= 12 ? "lo" : ""}" style="height:${h}px"></i>`).join("");

// ---------- iPhoneアプリのプッシュ通知（Capacitor の PushNotifications）----------
// 許可をもらったら APNs の宛先（端末トークン）を users/{自分}/apnsTokens に保存する。
// 通知をタップしたら、その DM・記事・旅ひろばの投稿を開く
let pushReady = false;
async function setupNativePush() {
  const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
  if (!P || pushReady || !me) return;
  pushReady = true;
  try {
    await P.addListener("registration", async (t) => {
      try { await setDoc(doc(db, "users", me, "apnsTokens", t.value), { platform: "ios", createdAt: serverTimestamp() }); } catch (e) { console.warn(e); }
    });
    await P.addListener("registrationError", (e) => console.warn("push registration error", e));
    await P.addListener("pushNotificationActionPerformed", (a) => openPushUrl(((a && a.notification && a.notification.data) || {}).url || ""));
    let st = await P.checkPermissions();
    if (st.receive === "prompt" || st.receive === "prompt-with-rationale") st = await P.requestPermissions();
    if (st.receive === "granted") await P.register();
  } catch (e) { console.warn("push setup failed", e); }
}
function openPushUrl(u) {
  u = String(u || "");
  let m;
  if ((m = u.match(/#(c-[^&]+)$/))) location.hash = "#" + m[1];
  else if ((m = u.match(/view\.html\?id=([^&#]+)/))) location.hash = "#a-" + m[1];
  else if ((m = u.match(/dm\.html\?to=([^&#]+)/))) location.hash = "#dm-" + m[1];
  else if ((m = u.match(/user\.html\?uid=([^&#]+)/))) location.hash = "#u-" + m[1];
  else if (u.includes("collab")) go("me");
}

// ---------- 旅ひろば（app/sodan.js）----------
let SDM = null;
const SD = async () => {
  if (SDM) return SDM;
  const M = await import("./sodan.js?v=202611250623");
  M.initSodan({
    me: () => me, esc, para, ago, PROF, loadProfiles, avatarOf, toast, haptic, mod, bar,
    notify: (o) => import("../notify.js").then((N) => N.sendNotification(o)).catch(() => {}),
    artCard: (d) => `<a class="sart" href="#a-${esc(d.id)}"><i style="background-image:url('${esc(thumbOf(d))}')"></i><div><b>${esc(d.title || "")}</b><small>${esc(authorName(d))}${nDays(d) ? "・" + nDays(d) + "日間" : ""}</small></div></a>`,
    myArticles: async () => (ALL || []).filter((d) => d.authorId === me || (d.coAuthorIds || []).includes(me)),
    reopen: () => { const t = STACK[STACK.length - 1]; const m = t && t.hash.match(/^#c-(.+)$/); if (m && m[1] !== "new") M.pageSodan(t.el, decodeURIComponent(m[1])); },
  });
  return (SDM = M);
};

// ---------- 旅の掲示板 ----------
// Firestore の boards（公開中）を読む。1本もない・読めないときは board.js の最初の記事を出す。書いた人は今は出さない（データには残す）
let BOARDS = null, boardCat = "";
async function loadBoards() {
  if (BOARDS) return BOARDS;
  let list = [];
  try { (await getDocs(query(collection(db, "boards"), where("status", "==", "published")))).forEach((s) => list.push({ id: s.id, ...s.data() })); } catch (e) {}
  if (!list.length) list = BOARD_SEED.slice();
  list.sort((a, b) => (a.order || 99) - (b.order || 99));
  return (BOARDS = list);
}
const illOf = (k) => ILL[k] || ILL.suitcase;
const catName = (c) => (BOARD_CATS.find((x) => x[0] === c) || [, ""])[1];
async function renderBoard() {
  const box = $("boardPane");
  if (!BOARDS) box.innerHTML = '<p class="fol-empty">読み込み中…</p>';
  const list = await loadBoards();
  const cats = BOARD_CATS.filter(([k]) => !k || list.some((d) => d.cat === k));
  const shown = list.filter((d) => !boardCat || d.cat === boardCat);
  box.innerHTML = `<div class="bcats">${cats.map(([k, l]) => `<button class="${k === boardCat ? "on" : ""}" data-bc="${k}">${l}</button>`).join("")}</div>
    <div class="blist">${shown.map((d) => `<a class="bit press" href="#g-${esc(d.id)}"><span class="bill">${illOf(d.ill)}</span><div><small>${esc(catName(d.cat))}</small><h3>${esc(d.title)}</h3>${d.lead ? `<p>${esc(d.lead)}</p>` : ""}${d.mins ? `<i>${d.mins}分で読める</i>` : ""}</div></a>`).join("")}</div>`;
  box.querySelectorAll("[data-bc]").forEach((b) => (b.onclick = () => { boardCat = b.dataset.bc; haptic(); renderBoard(); }));
}
function boardBlock(b) {
  if (b.t === "h") return `<h2>${esc(b.x)}</h2>`;
  if (b.t === "p") return `<p class="bp">${para(b.x)}</p>`;
  if (b.t === "note") return `<p class="bnote">${para(b.x)}</p>`;
  if (b.t === "list") return `<ul class="bul">${(b.items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  if (b.t === "steps") return `<ol class="bsteps">${(b.items || []).map((x, i) => `<li><i>${i + 1}</i><div><b>${esc(x[0])}</b>${esc(x[1] || "")}</div></li>`).join("")}</ol>`;
  return "";
}
function fmtUpdated(u) { const m = String(u || "").match(/^(\d{4})-(\d{2})/); return m ? `${m[1]}年${+m[2]}月更新` : ""; }
async function pageBoard(el, id) {
  el.innerHTML = bar("旅の掲示板") + '<div class="ps under2"><p class="loading">読み込み中…</p></div>';
  const d = (await loadBoards()).find((x) => x.id === id);
  const ps = el.querySelector(".ps");
  if (!d) { ps.innerHTML = '<p class="empty">記事が見つかりませんでした</p>'; return; }
  ps.innerHTML = `<div class="bhero">${illOf(d.ill)}</div><div class="bart">
    <small class="bc">${esc(catName(d.cat))}</small><h1>${esc(d.title)}</h1>${d.lead ? `<p class="blead">${esc(d.lead)}</p>` : ""}${fmtUpdated(d.updated) ? `<p class="bupd">${fmtUpdated(d.updated)}</p>` : ""}
    ${(d.facts || []).length ? `<dl class="bfacts">${d.facts.map((f) => `<div><dt>${esc(f[0])}</dt><dd><b>${esc(f[1])}</b>${f[2] ? `<span>${esc(f[2])}</span>` : ""}</dd></div>`).join("")}</dl>` : ""}
    ${(d.blocks || []).map(boardBlock).join("")}</div>`;
}

// ---------- 積み重ねページ ----------
// 記事(#a-ID)・プロフィール(#u-UID)・DM一覧(#dm)・DM(#dm-UID)・埋め込みページ(#w-名前) を右から重ねて開く。
// 戻るボタン／左端スワイプは history.back() で閉じる。
const STACK = [];
const FRAMES = { "terms": ["/terms.html", "利用規約"], "privacy": ["/privacy.html", "プライバシーポリシー"], "post": ["/post.html", "旅程を投稿"], "post-transit": ["/post-transit.html", "トランジットを投稿"], "account": ["/account.html", "設定"], "notify": ["/account.html#notifications", "通知"], "ask": ["/ask.html", "AI相談"], "flights": ["/flights.html", "航空券の相場"] };
const TI = {
  grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1.2"/><rect x="9.5" y="3" width="5" height="5" rx="1.2"/><rect x="16" y="3" width="5" height="5" rx="1.2"/><rect x="3" y="9.5" width="5" height="5" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="16" y="9.5" width="5" height="5" rx="1.2"/><rect x="3" y="16" width="5" height="5" rx="1.2"/><rect x="9.5" y="16" width="5" height="5" rx="1.2"/><rect x="16" y="16" width="5" height="5" rx="1.2"/></svg>',
  transit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3.5l3.5 3.5L17 10.5"/><path d="M4 11V9.5a2.5 2.5 0 0 1 2.5-2.5h14"/><path d="M7 20.5L3.5 17 7 13.5"/><path d="M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5h-14"/></svg>',
  collab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8.5" r="3.3"/><path d="M3 20c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6"/><path d="M15.5 5.4a3.3 3.3 0 0 1 0 6.2"/><path d="M17.5 14.6c2 .7 3.5 2.6 3.5 5.4"/></svg>',
  sodan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3.5 4.5h12v9H8.5l-3.5 3v-3H3.5z"/><path d="M17.5 8.5h3v9h-2v3l-3.5-3H10v-2"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="18" height="17" rx="3.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M20.5 15.5l-4.5-4.5L5 20.3"/></svg>',
};
const BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
function isPageHash(h) { return /^#(a-|g-|c-|u-|dm|w-|f-|x-|n$|p$|p-|fare$|pass$)/.test(h); }
function route() {
  const h = location.hash;
  if (!isPageHash(h)) { while (STACK.length) popPage(); return; }
  const idx = STACK.findIndex((x) => x.hash === h);
  if (idx >= 0) { while (STACK.length > idx + 1) popPage(); return; }
  pushPage(h);
}
window.addEventListener("hashchange", route);
function pushPage(h) {
  const el = document.createElement("section");
  el.className = "page"; el.style.zIndex = 40 + STACK.length; el.dataset.k = (h.match(/^#([a-z]+)/) || [])[1] || "";
  $("pages").appendChild(el);
  STACK.push({ hash: h, el });
  $("tab").classList.add("hide"); $("aiCmp").hidden = true; syncNativeTab();
  swipeBack(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("open")));
  const m = h.match(/^#(a|g|c|u|dm|w|fare|pass|f|x|n|p)-?(.*)$/);
  const kind = m[1], arg = decodeURIComponent(m[2] || "");
  if (kind === "a") pageArticle(el, arg);
  else if (kind === "g") pageBoard(el, arg);
  else if (kind === "c") SD().then((M) => (arg === "new" ? M.pageSodanNew(el) : arg === "rules" ? M.pageRules(el) : M.pageSodan(el, arg)));
  else if (kind === "u") pageUser(el, arg);
  else if (kind === "dm" && !arg) pageInbox(el);
  else if (kind === "dm") pageThread(el, arg);
  else if (kind === "w") pageFrame(el, arg);
  else if (kind === "f") pageFollows(el, arg);
  else if (kind === "pass") { const entry = STACK[STACK.length - 1]; el.classList.add("ppg"); ppCircle(true, () => el.classList.add("shown")); import("./passport.js?v=202611250623").then((M) => { const c = M.pagePassport(el, { me, esc, bar, haptic, cinfo, fmtPeriod, profile: PROF[me] || {}, arts: [...MY.trips, ...MY.transit].filter((d) => d.authorId === me || d._collab), loadSig: async () => ((await getDoc(doc(db, "users", me))).data() || {}).ppSig || "", saveSig: (d) => setDoc(doc(db, "users", me), { ppSig: d }, { merge: true }), created: (auth.currentUser && auth.currentUser.metadata && auth.currentUser.metadata.creationTime) ? new Date(auth.currentUser.metadata.creationTime).toISOString().slice(0, 10) : "" }); if (c) entry.cleanup = c; }).catch((e) => { console.error(e); el.innerHTML = bar("Tabistock パスポート") + '<div class="ps under2"><p class="empty">開けませんでした</p></div>'; }); }
  else if (kind === "x" && arg === "profile") pageProfileEdit(el);
  else if (kind === "x" && arg === "login") pageLogin(el);
  else if (kind === "x") pageBlocks(el);
  else if (kind === "n") pageNotify(el);
  else if (kind === "fare") { const entry = STACK[STACK.length - 1]; import("./fares.js?v=202611250623").then((M) => M.pageFares(el, { me, bar, haptic, loadLeaflet, all: () => ALL, thumb: thumbOf, rings: ringsOf, shapes: async () => (SHAPES = SHAPES || (await fetch("/country-shapes.json").then((r) => r.json()))) })).then((c) => { if (c) entry.cleanup = c; }).catch((e) => { console.error(e); el.innerHTML = bar("航空券の相場") + '<div class="ps under2"><p class="empty">開けませんでした</p></div>'; }); }
  else if (kind === "p") { const entry = STACK[STACK.length - 1]; import("./post.js?v=202611250623").then((M) => M.pagePost(el, arg, postCtx())).then((c) => { if (c) entry.cleanup = c; }).catch((e) => { console.error(e); el.innerHTML = bar("旅程を投稿") + '<div class="ps under2"><p class="empty">投稿画面を開けませんでした</p></div>'; }); }
  haptic();
}
// パスポートを開く・閉じるとき：バッジの位置から緑の円が画面いっぱいに広がる／バッジへ縮んで戻る
function ppCircle(open, mid) {
  const o = window.__ppFrom || { x: innerWidth / 2, y: innerHeight / 3 };
  const c = document.createElement("div"); c.className = "ppcirc"; c.style.left = o.x + "px"; c.style.top = o.y + "px";
  document.body.appendChild(c);
  const R = Math.hypot(Math.max(o.x, innerWidth - o.x), Math.max(o.y, innerHeight - o.y)) / 20 + 1;
  const big = `scale(${R.toFixed(2)})`, small = "scale(.9)";
  if (open) {
    c.animate([{ transform: small }, { transform: big }], { duration: 850, easing: "cubic-bezier(.6,0,.25,1)", fill: "forwards" })
      .onfinish = () => (mid && mid(), c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: "ease-out", fill: "forwards" }).onfinish = () => c.remove());
  } else {
    c.style.transform = big;
    c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: "ease-in", fill: "forwards" }).onfinish = () => {
      if (mid) mid();
      c.animate([{ transform: big }, { transform: small }], { duration: 850, easing: "cubic-bezier(.6,0,.25,1)", fill: "forwards" })
        .onfinish = () => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).onfinish = () => c.remove();
    };
  }
}
function popPage() {
  const top = STACK.pop(); if (!top) return;
  if (top.cleanup) try { top.cleanup(); } catch (e) {}
  if (top.el.classList.contains("ppg")) { ppCircle(false, () => top.el.remove()); }
  else { top.el.classList.remove("open"); setTimeout(() => top.el.remove(), 380); }
  if (!STACK.length) { $("tab").classList.remove("hide"); $("aiCmp").hidden = curTab !== "ai"; }
  // 旅ひろばの投稿から戻ったら、一覧を描き直す（回答した・いいねした・解決済みにした数をすぐ反映）
  if (!STACK.length && curTab === "sodan" && SDM) SDM.renderSodan();
  syncNativeTab();
}
const back = () => (history.length > 1 ? history.back() : (location.hash = ""));
function swipeBack(el) {
  let sx = null;
  el.addEventListener("touchstart", (e) => { const t = e.touches[0]; if (t.clientX < 28) sx = t.clientX; }, { passive: true });
  el.addEventListener("touchmove", (e) => { if (sx == null) return; const dx = e.touches[0].clientX - sx; if (dx > 0) { el.style.transition = "none"; el.style.transform = `translateX(${dx}px)`; } }, { passive: true });
  el.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; el.style.transition = ""; el.style.transform = ""; if (dx > 100) back(); sx = null; });
}
const bar = (title, extra = "") => `<div class="bar2"><button class="bk2" data-back>${BACK}</button><b>${esc(title)}</b>${extra}</div>`;
document.addEventListener("click", (e) => { if (e.target.closest("[data-back]")) { e.preventDefault(); back(); } });

// ---------- 写真ビューア ----------
function openViewer(urls, start) {
  const v = document.createElement("div");
  v.className = "viewer";
  v.innerHTML = `<div class="vs">${urls.map((u) => `<div style="background-image:url('${esc(u)}')"></div>`).join("")}</div><button class="vx" aria-label="閉じる">✕</button><div class="vc">${start + 1} / ${urls.length}</div>`;
  $("app").appendChild(v);
  const vs = v.querySelector(".vs");
  requestAnimationFrame(() => (vs.scrollLeft = start * vs.clientWidth));
  vs.onscroll = () => (v.querySelector(".vc").textContent = `${Math.round(vs.scrollLeft / vs.clientWidth) + 1} / ${urls.length}`);
  v.querySelector(".vx").onclick = () => v.remove();
}

// ---------- 記事 ----------
let cur = null;
async function pageArticle(el, id, opt = {}) {
  el.innerHTML = '<div class="ps"><p class="loading" style="padding-top:120px">読み込み中…</p></div>';
  let d = BY[id];
  if (!d) { try { const s = await getDoc(doc(db, "articles", id)); if (s.exists()) { d = { id: s.id, ...s.data() }; BY[id] = d; } } catch (e) {} }
  if (!d) { el.innerHTML = bar("記事") + '<div class="ps under2"><p class="empty">記事が見つかりませんでした</p></div>'; return; }
  if (!opt.preview) cur = d;
  await loadProfiles([d.authorId, ...(d.coAuthorIds || [])]);
  const mv = isDomestic(d) || !!d.notFromJapan;
  const imgs = (d.heroUrls && d.heroUrls.length ? d.heroUrls : [thumbOf(d)]).filter(Boolean);
  const tags = [placeJp(d), daysLabel(d), ...(d.styles || []).map((v) => (STYLES.find((x) => x.v === v) || {}).tag)].filter(Boolean);
  const stars = d.difficulty ? "★".repeat(d.difficulty) + "☆".repeat(5 - d.difficulty) : "";
  const facts = d.type === "transit"
    ? [["空港・都市", d.airport], ["乗り継ぎ", d.layover ? d.layover + "時間" : ""]]
    : isDomestic(d) ? [["旅行時期", fmtPeriod(d.dateStart, d.dateEnd)], ["難易度", stars]]
    : [["通貨", d.currency], ["言語", d.language], ["治安", d.safety], ["難易度", stars]];
  const costs = d.costs || {}, total = costTotalOf(d);
  const lab = (k, l) => (mv && k === "flight" ? "移動" : mv && k === "transit" ? "現地の交通" : l);
  const crow = COST_ITEMS.map((it) => [lab(it.k, it.l), Number(costs[it.k] || 0)]).filter((c) => c[1] > 0).sort((a, b) => b[1] - a[1]);
  const days = d.days || [];
  const authors = [d.authorId, ...(d.coAuthorIds || [])].filter(Boolean);
  const flights = d.flights || [], services = d.services || [];
  const hasRoute = d.type === "transit" ? (d.places || []).some((p) => p && typeof p.lat === "number") : days.some((x) => (x.places || []).some((p) => p && typeof p.lat === "number") || typeof x.lat === "number");
  el.innerHTML = `<div class="ps" id="aps">
    <div style="position:relative"><div class="gal">${imgs.map((u, i) => `<div data-hv="${i}" style="background-image:url('${esc(u)}')"></div>`).join("")}</div><div class="gtop"></div>
    ${imgs.length > 1 ? `<div class="dots">${imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}</div>
    <div class="sheet">
      <div class="meta">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
      <h1>${esc(titleOf(d))}</h1>${d.lead ? `<p class="lead">${esc(d.lead)}</p>` : ""}
      <div class="sau">${authors.map((u) => `<a href="#u-${esc(u)}" style="display:flex;align-items:center;gap:8px"><img src="${esc(avatarOf(u))}" alt=""><b>${esc((PROF[u] || {}).nickname || (u === d.authorId ? authorName(d) : "旅人"))}</b></a>`).join("")}<span>${esc(isDomestic(d) ? "" : fmtPeriod(d.dateStart, d.dateEnd))}</span></div>
      ${facts.some((f) => f[1]) ? `<div class="facts" style="grid-template-columns:repeat(${facts.length},1fr)">${facts.map((f) => `<div><small>${f[0]}</small>${esc(f[1] || "—")}</div>`).join("")}</div>` : ""}
      ${total ? `<div class="cost"><div class="h"><span>この旅にかかった費用</span><b>${yen(total)}</b></div>
        <div class="bar">${crow.map((c, i) => `<span style="flex:0.0001;background:${COL[i % COL.length]}" data-f="${c[1]}"></span>`).join("")}</div>
        <div class="lg">${crow.map((c, i) => `<button data-hl="${i}"><i style="background:${COL[i % COL.length]}"></i>${esc(c[0])}<b>${yen(c[1])}</b></button>`).join("")}</div><div class="pct"></div></div>` : ""}
      ${d.type === "transit" && d.body ? `<div class="dh"><h2>トランジットの記録</h2></div><p class="ph2">${placeLinks(para(d.body), d.places, 0, hasRoute)}</p>` : ""}
      ${flights.length ? `<div class="dh"><h2>${mv ? "移動" : "航空券"}</h2></div><div class="rows2">${flights.map((f, i) => `<div class="r2"><small>${mv ? "区間" : "航路"}${i + 1}</small><div>${esc(f.route || "")}<span>${esc([f.airline].filter(Boolean).join("・"))}</span></div>${f.price ? `<b>${yen(f.price)}</b>` : ""}</div>`).join("")}
        ${d.flightWhen ? `<div class="r2"><small>予約時期</small><div>${esc(d.flightWhen)}</div></div>` : ""}${d.flightSite ? `<div class="r2"><small>予約サイト</small><div>${esc(d.flightSite)}</div></div>` : ""}</div>` : ""}
      ${services.length ? `<div class="dh"><h2>利用サービス</h2></div><div class="rows2">${services.map((x) => `<div class="r2"><small>${esc(x.label || "")}</small><div>${(x.items || []).map(esc).join("<br>")}</div></div>`).join("")}</div>` : ""}
      ${hasRoute ? `<div class="dh"><h2>ルートマップ</h2></div><div class="rtabs" id="rtabs"></div><div id="rmap"></div>` : ""}
      ${days.length ? `<div class="dh"><h2>旅の記録</h2><small style="color:var(--muted);font-size:12px">${days.length}日間</small></div>
      <div class="days">${days.map((x, i) => {
        const ph = x.photoUrls || [];
        const has = String(x.text || "").trim() || ph.length;
        return `<div class="day"><button ${has ? "data-day" : ""}><div class="th ${ph[0] ? "" : "no"}" style="${ph[0] ? `background-image:url('${esc(ph[0])}')` : ""}">${ph[0] ? "" : i + 1}</div><div><small>DAY ${i + 1}${x.date ? "　" + esc(x.date) : ""}</small><p>${esc(x.summary || "")}</p></div>${has ? '<span class="pm">＋</span>' : ""}</button>
          <div class="body"><div class="bin">${ph.length ? `<div class="dpw"><div class="dphotos">${ph.map((u, k) => `<img src="${esc(u)}" alt="" loading="lazy" data-dv="${i}" data-k="${k}">`).join("")}</div>${ph.length > 1 ? `<span class="dpc">1/${ph.length}</span>` : ""}</div>` : ""}${String(x.text || "").trim() ? `<p class="ph">${placeLinks(para(x.text), x.places, i + 1, hasRoute)}</p>` : ""}</div></div></div>`;
      }).join("")}</div>` : ""}
      ${d.comment ? `<div class="dh"><h2>投稿者のコメント</h2></div><p class="ph2">${para(d.comment)}</p>` : ""}
      <div class="dh"><h2>投稿者</h2></div>
      ${authors.map((u) => { const p = PROF[u] || {}; return `<div class="acard"><a href="#u-${esc(u)}"><img src="${esc(avatarOf(u))}" alt=""></a><div><a href="#u-${esc(u)}"><b>${esc(p.nickname || authorName(d))}</b></a>${p.bio ? `<p>${esc(p.bio)}</p>` : ""}</div>${u !== me ? `<button class="btn-s" data-follow="${esc(u)}">フォロー</button>` : ""}</div>`; }).join("")}
      <div class="dh"><h2>コメント <small id="ccount" style="font-family:Manrope;color:var(--muted)"></small></h2></div>
      <div id="clist"><p class="loading">読み込み中…</p></div>
      <div id="cform"></div>
      <p style="margin:22px 0 4px"><button id="repA" style="font-size:12px;color:var(--muted);text-decoration:underline">この記事を通報する</button></p>
    </div></div>
    <div class="pnav"><div class="topnav">${esc(titleOf(d))}</div>
      <button class="fb" style="left:16px" data-back aria-label="戻る"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1b2330" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
      ${me && (d.authorId === me || (d.coAuthorIds || []).includes(me)) ? '<button class="fb" style="right:64px" data-own aria-label="記事のメニュー"><svg width="18" height="18" viewBox="0 0 24 24" fill="#1b2330"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>' : ""}
      <button class="fb" style="right:16px" data-share aria-label="共有"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1b2330" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12"/></svg></button></div>
    <div class="act show"><button class="ab" data-like aria-label="いいね"><svg viewBox="0 0 24 24" fill="none" stroke="#1b2330" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg><b data-lc></b>いいね</button>
      <button class="ab ${saved.has(d.id) ? "saved" : ""}" data-save="${esc(d.id)}" aria-label="保存"><svg viewBox="0 0 24 24" fill="none" stroke="#1b2330" stroke-width="2" stroke-linejoin="round"><path d="M6.5 3.5h11v17l-5.5-3.6-5.5 3.6z"/></svg>保存</button>
      <button class="ab" data-share2 aria-label="共有"><svg viewBox="0 0 24 24" fill="none" stroke="#1b2330" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12"/></svg>共有</button></div>`;
  const ps = el.querySelector(".ps");
  ps.onscroll = () => { const on = ps.scrollTop > 360; el.querySelector(".topnav").classList.toggle("show", on); el.querySelectorAll(".pnav .fb").forEach((b) => b.classList.toggle("solid", on)); };
  // トップの写真は4:3で固定（CSS）
  el.querySelectorAll(".dphotos").forEach(fitDayPhotos);
  const gal = el.querySelector(".gal");
  gal.onscroll = () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); el.querySelectorAll(".dots i").forEach((x, j) => x.classList.toggle("on", i === j)); };
  gal.querySelectorAll("[data-hv]").forEach((x) => (x.onclick = () => openViewer(imgs, +x.dataset.hv)));
  el.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { b.parentNode.classList.toggle("open"); haptic(); }));
  el.querySelectorAll("[data-pl]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); goPlace(el, b.dataset.pl); }));
  el.querySelectorAll("[data-dv]").forEach((im) => (im.onclick = () => openViewer(days[+im.dataset.dv].photoUrls, +im.dataset.k)));
  el.querySelectorAll(".dphotos").forEach((g) => (g.onscroll = () => { const c = g.parentNode.querySelector(".dpc"); if (c) c.textContent = `${Math.round(g.scrollLeft / g.clientWidth) + 1}/${g.children.length}`; }));
  el.querySelectorAll("[data-hl]").forEach((b) => (b.onclick = () => {
    const i = +b.dataset.hl, c = crow[i], barEl = el.querySelector(".bar"), p = el.querySelector(".pct"); haptic();
    [...barEl.children].forEach((x, j) => (x.style.opacity = j === i ? 1 : 0.25));
    p.style.display = "block"; p.textContent = `${c[0]}は全体の${Math.round((c[1] / total) * 100)}%（${yen(c[1])}）`;
    clearTimeout(b._t); b._t = setTimeout(() => { [...barEl.children].forEach((x) => (x.style.opacity = 1)); p.style.display = "none"; }, 2600);
  }));
  setTimeout(() => el.querySelectorAll(".bar span").forEach((x) => (x.style.flex = x.dataset.f)), 380);
  if (opt.preview) {   // 投稿フォームからのプレビュー：いいね・コメント・共有などは出さない
    el.querySelectorAll(".act, [data-own], .pnav [data-share], #clist, #cform, [data-follow]").forEach((x) => x.remove());
    const ch = el.querySelector("#ccount"); if (ch) ch.closest(".dh").remove();
    const rp = el.querySelector("#repA"); if (rp) rp.parentNode.remove();
    const bk = el.querySelector(".pnav [data-back]"); bk.removeAttribute("data-back"); bk.onclick = opt.onClose;
    el.querySelector(".pnav").insertAdjacentHTML("beforeend", '<span class="pvbadge">プレビュー</span>');
    if (hasRoute) drawRoute(el.querySelector("#rmap"), d);
    return;
  }
  el.querySelector("[data-share]").onclick = () => shareMenu(d);
  el.querySelector("[data-share2]").onclick = () => shareMenu(d);
  const own = el.querySelector("[data-own]"); if (own) own.onclick = () => postMenu(d.id);
  el.querySelector("#repA").onclick = async () => (await mod()).openReport({ type: "article", targetId: d.id, articleId: d.id, targetUid: d.authorId || "", excerpt: titleOf(d) });
  el.querySelectorAll("[data-follow]").forEach((b) => wireFollow(b, b.dataset.follow));
  if (hasRoute) drawRoute(el.querySelector("#rmap"), d);
  wireArticleLike(el, d);
  loadComments(el, d);
}
async function share(title, url) {
  try { if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); toast("リンクをコピーしました"); } } catch (e) {}
}
let MOD = null;
const mod = async () => (MOD = MOD || (await import("../moderation.js")));
let NOTI = null;
const notify = async (o) => { try { NOTI = NOTI || (await import("../notify.js")); NOTI.sendNotification(o); } catch (e) {} };

// 写真の縦横比に合わせて枠の高さを決める（Instagram と同じく 4:5〜1.91:1 の範囲）
// 写真の縦横比（読み込んだことのある写真は覚えておいて、次からは最初から正しい高さで出す＝表示後に上下に動かない）
const RATIO = new Map();
function ratioOf(url, cb) {
  if (RATIO.has(url)) { cb(RATIO.get(url), true); return; }
  const im = new Image();
  const done = () => { if (!im.naturalWidth) return; const r = Math.min(1.91, Math.max(0.8, im.naturalWidth / im.naturalHeight)); RATIO.set(url, r); cb(r, false); };
  im.onload = done;
  im.src = url;
  if (im.complete) done();
}
function fitRatio(box, url) {
  if (!box || !url) return;
  ratioOf(url, (r) => { box.style.height = "auto"; box.style.aspectRatio = String(r); });
}
// DAYの写真：枠の高さは「その日の中でいちばん縦長の写真」に合わせて固定する（スワイプしても本文の位置は動かない）。
// 写真は切らずに全体を表示（横長の写真は上下に余白が出る）
function fitDayPhotos(g) {
  const urls = [...g.querySelectorAll("img")].map((x) => x.getAttribute("src"));
  const rs = urls.map(() => null);
  urls.forEach((u, i) => ratioOf(u, (r) => {
    rs[i] = r;
    const known = rs.filter(Boolean);
    g.style.aspectRatio = String(Math.min(...known));   // 縦長の写真が読み込まれたら、その高さに合わせる
  }));
}

// ルートマップ（Leaflet を必要なときだけ読み込む）
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((ok, ng) => {
    const c = document.createElement("link"); c.rel = "stylesheet"; c.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(c);
    const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = ok; s.onerror = ng; document.head.appendChild(s);
  });
}
const PIN_SVG = `<svg width="22" height="29" viewBox="0 0 30 40"><path transform="translate(3,3)" d="M13 1C6.4 1 1 6.2 1 12.6 1 21 13 35 13 35S25 21 25 12.6C25 6.2 19.6 1 13 1Z" fill="#1b2330"/><path d="M13 1C6.4 1 1 6.2 1 12.6 1 21 13 35 13 35S25 21 25 12.6C25 6.2 19.6 1 13 1Z" fill="#1f6f5b" stroke="#1b2330" stroke-width="1.8"/><circle cx="13" cy="12.5" r="5" fill="#fff"/></svg>`;
async function drawRoute(box, d) {
  const pts = [];
  if (d.type === "transit") (d.places || []).forEach((p) => p && typeof p.lat === "number" && pts.push({ n: 0, lat: p.lat, lng: p.lng, name: p.name || "", cc: p.cc || "" }));
  else (d.days || []).forEach((x, i) => {
    if (Array.isArray(x.places) && x.places.length) x.places.forEach((p) => typeof p.lat === "number" && pts.push({ n: i + 1, lat: p.lat, lng: p.lng, name: p.name || "", cc: p.cc || "" }));
    else if (typeof x.lat === "number") pts.push({ n: i + 1, lat: x.lat, lng: x.lng, name: "", cc: "" });
  });
  // 各ピンの国：保存された国コード→記事の国のうち一番近い国
  const cs = (d.countries || []).filter((c) => COUNTRY_LL[c]);
  pts.forEach((p) => {
    const hit = cs.find((c) => COUNTRY_ISO[c] && COUNTRY_ISO[c] === String(p.cc).toLowerCase());
    p.c = hit || cs.slice().sort((a, b) => dist2(p, COUNTRY_LL[a]) - dist2(p, COUNTRY_LL[b]))[0] || "";
  });
  try { await loadLeaflet(); } catch (e) { box.innerHTML = '<p class="loading">地図を読み込めませんでした</p>'; return; }
  const map = L.map(box, { scrollWheelZoom: false, minZoom: 2, attributionControl: true, doubleClickZoom: false, touchZoom: true });
  map.attributionControl.setPrefix(false);
  dblTapZoom(map, box);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 18, className: "tstile" }).addTo(map);
  // ピン（緑のしずく型＋黒いずらし影。カードと同じデザイン）
  const pinIcon = L.divIcon({ className: "tpin", html: PIN_SVG, iconSize: [22, 29], iconAnchor: [10, 26], popupAnchor: [0, -24] });
  const ms = pts.map((p) => { const m = L.marker([p.lat, p.lng], { icon: pinIcon }).addTo(map).bindPopup((p.n ? `DAY ${p.n}` : "") + (p.name ? "　" + esc(p.name) : ""), { autoPanPaddingTopLeft: [64, 12] }); m._c = p.c; m._k = p.n + "|" + p.name; return m; });
  box._map = map; box._ms = ms;
  const fit = (c) => { const sub = c ? ms.filter((m) => m._c === c) : ms; if (sub.length) map.fitBounds(L.featureGroup(sub).getBounds().pad(0.3), { maxZoom: 10 }); };
  fit("");
  const used = [...new Set(pts.map((p) => p.c).filter(Boolean))];
  const tabs = box.parentNode.querySelector("#rtabs");
  if (tabs && used.length > 1) {
    tabs.innerHTML = `<button class="on" data-rc="">すべて</button>` + used.map((c) => `<button data-rc="${esc(c)}">${esc((cinfo(c) || {}).jp || c)}</button>`).join("");
    tabs.querySelectorAll("button").forEach((b) => (b.onclick = () => { tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); fit(b.dataset.rc); haptic(); }));
  } else if (tabs) tabs.remove();
}
// 地図をダブルタップで拡大（iPhoneではダブルタップのイベントが来ないことがあるので、タップの間隔から自分で判定する）
// 1本指のタップを0.3秒以内・30px以内で2回 → タップした場所を中心に1段拡大。2本指で広げる拡大はLeafletのまま
function dblTapZoom(map, box) {
  let last = 0, lx = 0, ly = 0, moved = false, sx = 0, sy = 0;
  box.addEventListener("touchstart", (e) => { if (e.touches.length !== 1) { last = 0; return; } moved = false; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  box.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t && Math.hypot(t.clientX - sx, t.clientY - sy) > 10) moved = true; }, { passive: true });
  box.addEventListener("touchend", (e) => {
    if (moved || e.touches.length || e.changedTouches.length !== 1) { last = 0; return; }
    const t = e.changedTouches[0], now = Date.now();
    if (now - last < 300 && Math.hypot(t.clientX - lx, t.clientY - ly) < 30) {
      e.preventDefault(); last = 0;
      const r = box.getBoundingClientRect();
      map.setZoomAround(L.point(t.clientX - r.left, t.clientY - r.top), Math.min(map.getZoom() + 1, map.getMaxZoom() || 18));
      haptic();
    } else { last = now; lx = t.clientX; ly = t.clientY; }
  }, { passive: false });
  box.addEventListener("dblclick", (e) => { const r = box.getBoundingClientRect(); map.setZoomAround(L.point(e.clientX - r.left, e.clientY - r.top), map.getZoom() + 1); });
}
// 記事の文章の中で、地図に登録した場所の名前をタップできるようにする（各場所につき最初の1か所だけ）
function placeLinks(html, places, n, on) {
  if (!on || !Array.isArray(places)) return html;
  const names = [...new Set(places.filter((p) => p && typeof p.lat === "number" && String(p.name || "").trim().length >= 2).map((p) => String(p.name).trim()))].sort((a, b) => b.length - a.length);
  if (!names.length) return html;
  const done = new Set();
  // タグの外（文章の部分）だけを置き換える
  return html.split(/(<[^>]+>)/).map((seg) => {
    if (seg.startsWith("<")) return seg;
    names.forEach((nm) => {
      if (done.has(nm)) return;
      const e = esc(nm), at = seg.indexOf(e);
      if (at < 0) return;
      done.add(nm);
      seg = seg.slice(0, at) + `\u0000${names.indexOf(nm)}\u0001` + seg.slice(at + e.length);
    });
    return seg.replace(/\u0000(\d+)\u0001/g, (_, k) => `<button class="plk" data-pl="${n}|${esc(names[k])}">${esc(names[k])}</button>`);
  }).join("");
}
// タップした場所へ：地図までスクロールして、その場所に寄ってピンの吹き出しを開く
function goPlace(el, key) {
  const box = el.querySelector("#rmap"); if (!box) return;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  const open = (tries) => {
    if (!box._map) { if (tries < 20) setTimeout(() => open(tries + 1), 200); return; }
    const m = box._ms.find((x) => x._k === key) || box._ms.find((x) => x._k.split("|")[1] === key.split("|")[1]);
    if (!m) return;
    const tabs = el.querySelector("#rtabs"); if (tabs) tabs.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === 0));
    setTimeout(() => { box._map.flyTo(m.getLatLng(), Math.max(box._map.getZoom(), 13), { duration: 0.8 }); setTimeout(() => m.openPopup(), 850); }, 350);
  };
  open(0); haptic();
}
const dist2 = (p, ll) => (p.lat - ll[0]) ** 2 + (p.lng - ll[1]) ** 2;

// 共有メニュー：ストーリー画像／リンクをコピー／ほかのアプリで共有
function shareMenu(d) {
  const url = location.origin + "/articles/view.html?id=" + d.id, title = titleOf(d);
  const ICS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="5" y="2.5" width="14" height="19" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8"/></svg>';
  const ICL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
  const ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12"/></svg>';
  $("bs").innerHTML = `<div class="grab"></div><div class="shs"><h3>共有</h3>
    <button class="srow" data-sa="story">${ICS}ストーリー画像を作成（インスタ向け）</button>
    <button class="srow" data-sa="dm"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></svg>DMで送る</button>
    <button class="srow" data-sa="copy">${ICL}リンクをコピー</button>
    <button class="srow" data-sa="other">${ICO}ほかのアプリで共有</button></div>`;
  $("ov").classList.add("show"); $("bs").classList.add("show");
  const q = (a) => $("bs").querySelector(`[data-sa="${a}"]`);
  q("dm").onclick = () => dmShareArticle(d);
  q("copy").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("リンクをコピーしました"); } catch (e) { toast(url); } closeSheet(); };
  q("other").onclick = async () => { closeSheet(); try { if (navigator.share) await navigator.share({ title, url }); else { await navigator.clipboard.writeText(url); toast("リンクをコピーしました"); } } catch (e) {} };
  q("story").onclick = () => {
    const imgs = (d.heroUrls && d.heroUrls.length ? d.heroUrls : [thumbOf(d)]).filter(Boolean);
    if (imgs.length <= 1) { makeStory(d, imgs[0]); return; }
    $("bs").innerHTML = `<div class="grab"></div><div class="shs"><h3>ストーリーに使う写真を選ぶ</h3><div class="pick">${imgs.map((u, i) => `<button data-pi="${i}" style="background-image:url('${esc(u)}')"></button>`).join("")}</div></div>`;
    $("bs").querySelectorAll("[data-pi]").forEach((b) => (b.onclick = () => makeStory(d, imgs[+b.dataset.pi])));
  };
}
async function makeStory(d, url) {
  $("bs").querySelector(".shs h3").textContent = "作成中…";
  let file = null;
  try { const { makeStoryImage } = await import("./story.js?v=202611250623"); file = await makeStoryImage(d, url, storyEyebrow(d)); } catch (e) { console.warn(e); }
  closeSheet();
  if (!file) { toast("画像を作成できませんでした"); return; }
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file] });
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast("ストーリー画像を保存しました"); }
  } catch (e) {}
}
// ストーリー画像の小見出し（サイトと同じ：国名 · 地域）
function storyEyebrow(d) {
  if (isDomestic(d)) return ["Japan", prefLabel(d)].filter(Boolean).join(" · ");
  const cs = (d.countries || []).map(cinfo).filter(Boolean);
  if (cs.length > 1) return cs.map((c) => c.en).join(" · ");
  return cs[0] ? `${cs[0].en} · ${REGION_EN[cs[0].r] || ""}` : "";
}

// いいね（記事）
async function wireArticleLike(el, d) { return wireLike(el.querySelector("[data-like]"), el.querySelector("[data-lc]"), d, "liked"); }
// いいねボタンの共通処理（記事ページの下のバーと、フォロー中の投稿で使う）
async function wireLike(b, n, d, onCls) {
  if (!b) return;
  let cnt = 0, mine = false;
  try { cnt = (await getCountFromServer(collection(db, "articles", d.id, "likes"))).data().count; } catch (e) {}
  if (me) { try { mine = (await getDoc(doc(db, "articles", d.id, "likes", me))).exists(); } catch (e) {} }
  const paint = () => { b.classList.toggle(onCls, mine); if (n) n.textContent = cnt || ""; };
  paint();
  b.onclick = async () => {
    if (!me) { toast("いいねするにはログインが必要です"); location.hash = "#x-login"; return; }
    const ref = doc(db, "articles", d.id, "likes", me);
    try {
      if (mine) { await deleteDoc(ref); mine = false; cnt = Math.max(0, cnt - 1); }
      else { await setDoc(ref, { likedAt: serverTimestamp() }); mine = true; cnt++; [d.authorId, ...(d.coAuthorIds || [])].forEach((u) => notify({ toUid: u, type: "like", articleId: d.id, articleTitle: titleOf(d) })); }
      haptic(); paint();
    } catch (e) { toast("いいねできませんでした"); }
  };
}

// コメント
async function loadComments(el, d) {
  const list = el.querySelector("#clist"), form = el.querySelector("#cform");
  let all = [];
  try { const qs = await getDocs(collection(db, "articles", d.id, "comments")); qs.forEach((s) => all.push({ id: s.id, ...s.data() })); } catch (e) {}
  let blocked = new Set(); if (me) { try { blocked = await (await mod()).getBlocked(); } catch (e) {} }
  const hidden = new Set(all.filter((c) => blocked.has(c.authorId)).map((c) => c.id));
  all = all.filter((c) => !hidden.has(c.id) && !hidden.has(c.parentId));
  all.sort((a, b) => ((a.createdAt && a.createdAt.seconds) || 0) - ((b.createdAt && b.createdAt.seconds) || 0));
  el.querySelector("#ccount").textContent = all.length ? all.length : "";
  const one = (c, rp) => `<div class="cm ${rp ? "rp" : ""}"><a href="${c.authorId ? "#u-" + esc(c.authorId) : "#"}"><img src="${esc(c.authorPhotoURL || DEF_AV)}" alt=""></a><div class="cb"><div class="ch"><b>${esc(c.authorName || "ゲスト")}</b><small>${esc(ago((c.createdAt || {}).seconds))}</small>${me ? `<button data-cmore="${esc(c.id)}">…</button>` : ""}</div><div class="ct">${para(c.text || "")}</div>${!rp && me ? `<div class="ca"><button data-reply="${esc(c.id)}">返信</button></div>` : ""}</div></div>`;
  const tops = all.filter((c) => !c.parentId);
  list.innerHTML = tops.length ? tops.map((c) => one(c) + all.filter((r) => r.parentId === c.id).map((r) => one(r, true)).join("")).join("") : '<p style="font-size:13px;color:var(--muted);padding:6px 0">まだコメントはありません。</p>';
  let replyTo = null;
  form.innerHTML = me ? `<div class="cform"><textarea id="ctext" maxlength="1000" rows="1" placeholder="コメントを書く…"></textarea><button id="csend">送信</button></div><p id="crep" style="font-size:12px;color:var(--green);margin-top:6px" hidden></p>`
    : '<p style="font-size:13px;margin-top:10px"><a href="#x-login" style="color:var(--green);font-weight:700">ログイン</a>するとコメントできます。</p>';
  list.querySelectorAll("[data-reply]").forEach((b) => (b.onclick = () => { replyTo = b.dataset.reply; const c = all.find((x) => x.id === replyTo); const r = el.querySelector("#crep"); r.hidden = false; r.textContent = `${c.authorName || "ゲスト"} さんに返信中（タップで取り消し）`; r.onclick = () => { replyTo = null; r.hidden = true; }; el.querySelector("#ctext").focus(); }));
  list.querySelectorAll("[data-cmore]").forEach((b) => (b.onclick = async () => {
    const c = all.find((x) => x.id === b.dataset.cmore); const M = await mod();
    const items = [];
    if (c.authorId === me) items.push({ label: "このコメントを削除", red: true, onClick: async () => { if (!confirm("このコメントを削除しますか？")) return; try { await deleteDoc(doc(db, "articles", d.id, "comments", c.id)); loadComments(el, d); } catch (e) { toast("削除できませんでした"); } } });
    else {
      items.push({ label: "このコメントを通報", red: true, onClick: () => M.openReport({ type: "comment", targetId: c.id, articleId: d.id, targetUid: c.authorId || "", excerpt: c.text || "" }) });
      items.push({ label: `${c.authorName || "このユーザー"}さんをブロック`, red: true, onClick: async () => { if (await M.blockUser(c.authorId, c.authorName)) loadComments(el, d); } });
    }
    M.openMenu(items);
  }));
  const send = el.querySelector("#csend");
  if (send) send.onclick = async () => {
    const t = el.querySelector("#ctext"), text = t.value.trim(); if (!text) return;
    send.disabled = true;
    try {
      const pr = PROF[me] || {};
      const { addDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      await addDoc(collection(db, "articles", d.id, "comments"), { authorId: me, authorName: pr.nickname || "ゲスト", authorPhotoURL: pr.photoURL || "", text, ...(replyTo ? { parentId: replyTo } : {}), createdAt: serverTimestamp() });
      [d.authorId, ...(d.coAuthorIds || [])].forEach((u) => notify({ toUid: u, type: "comment", articleId: d.id, articleTitle: titleOf(d) }));
      t.value = ""; replyTo = null; loadComments(el, d); haptic();
    } catch (e) { toast("コメントできませんでした"); }
    send.disabled = false;
  };
}

// フォローボタン
async function wireFollow(btn, uid, onChange) {
  let on = false;
  if (me) { try { on = (await getDoc(doc(db, "users", me, "following", uid))).exists(); } catch (e) {} }
  const paint = () => { btn.classList.toggle("on", on); btn.textContent = on ? "フォロー中" : "フォロー"; };
  paint();
  btn.onclick = async () => {
    if (!me) { toast("フォローするにはログインが必要です"); location.hash = "#x-login"; return; }
    btn.disabled = true;
    try {
      if (on) { await deleteDoc(doc(db, "users", me, "following", uid)); await deleteDoc(doc(db, "users", uid, "followers", me)); on = false; }
      else { await setDoc(doc(db, "users", me, "following", uid), { createdAt: serverTimestamp() }); await setDoc(doc(db, "users", uid, "followers", me), { createdAt: serverTimestamp() }); on = true; notify({ toUid: uid, type: "follow" }); } FOLLOWS = null;
      haptic(); paint(); onChange && onChange(on);
    } catch (e) { toast("フォローできませんでした"); }
    btn.disabled = false;
  };
}

// SNS（Instagram・X・note・TikTok・YouTube）。ユーザー名でもURLでも入力できる
const SNS = [["instagram", "Instagram", (h) => `https://www.instagram.com/${h}/`], ["x", "X", (h) => `https://x.com/${h}`], ["note", "note", (h) => `https://note.com/${h}`], ["tiktok", "TikTok", (h) => `https://www.tiktok.com/@${h}`], ["youtube", "YouTube", (h) => `https://www.youtube.com/@${h}`]];
function snsUrl(key, v) { v = String(v || "").trim(); if (!v) return ""; if (/^https?:\/\//.test(v)) return v; const f = SNS.find((x) => x[0] === key); return f ? f[2](v.replace(/^@/, "")) : ""; }
// 旅のスタイルのタグ（プロフィールに最大6つ）
const TAG_MAX = 6;
// 次の旅：行き先と時期（月まで）。過ぎた月は出さない
function nextMonths() { const d = new Date(), out = []; for (let i = 0; i < 18; i++) { const x = new Date(d.getFullYear(), d.getMonth() + i, 1); out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`); } return out; }
const ymLabel = (ym) => { const m = String(ym || "").match(/^(\d{4})-(\d{2})$/); return m ? `${m[1]}年${+m[2]}月` : ""; };
function nextTripLine(p) {
  const t = p.nextTrip; if (!t || !t.place) return "";
  const now = new Date(), cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (t.ym && t.ym < cur) return "";
  return `<p class="ntl"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg><b>次の旅</b>${esc(t.place)}${t.ym ? `<span>${ymLabel(t.ym)}</span>` : ""}</p>`;
}
const TAG_PRESET = ["一人旅", "バックパッカー", "低予算", "弾丸旅", "周遊", "長期旅", "登山", "自然", "世界遺産", "街歩き", "食べ歩き", "カフェ巡り", "ローカル体験", "ビーチ", "秘境", "鉄道旅", "写真", "ホステル派", "国内旅", "海外旅"];
function tagChips(p, own) {
  const t = Array.isArray(p.tags) ? p.tags.slice(0, TAG_MAX) : [];
  if (!t.length && !own) return "";
  return `<div class="utags">${t.map((x) => `<span>${esc(x)}</span>`).join("")}${own && t.length < TAG_MAX ? `<a href="#x-profile" class="add" aria-label="タグを追加">＋${t.length ? "" : " 旅のスタイルを追加"}</a>` : ""}</div>`;
}
function snsLinks(p) { const a = SNS.map(([k, l]) => { const u = snsUrl(k, p[k]); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${l} ↗</a>` : ""; }).filter(Boolean); return a.length ? `<div class="sns">${a.join("")}</div>` : ""; }

// ---------- プロフィール ----------
async function pageUser(el, uid) {
  await loadProfiles([uid]);
  const p = PROF[uid] || {};
  const posts = ALL.filter((d) => d.authorId === uid || (d.coAuthorIds || []).includes(uid));
  const ig = String(p.instagram || "").trim();
  const igUrl = ig ? (/^https?:\/\//.test(ig) ? ig : "https://www.instagram.com/" + ig.replace(/^@/, "") + "/") : "";
  const isMe = uid === me;
  el.innerHTML = bar(p.nickname || "旅人", isMe ? "" : '<button class="mo" data-umore>…</button>') + `<div class="ps under2">
    <div class="uhead"><div class="row"><img src="${esc(p.photoURL || DEF_AV)}" alt=""><div class="side"><h1>${esc(p.nickname || "旅人")}</h1><div class="st"><div><b>${posts.length}</b><span>投稿</span></div><a href="#f-followers-${esc(uid)}"><b data-fc>—</b><span>フォロワー</span></a><a href="#f-following-${esc(uid)}"><b data-gc>—</b><span>フォロー中</span></a></div></div></div>
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ""}${nextTripLine(p)}${tagChips(p, false)}${snsLinks(p)}
      <div class="ub" data-ub></div></div>
    <div class="mtabs itabs" style="margin-top:26px"><button class="on" data-ut="posts" aria-label="投稿">${TI.grid}</button><button data-ut="sodan" aria-label="旅ひろば">${TI.sodan}</button><button data-ut="photos" aria-label="写真">${TI.photo}</button></div>
    <div data-upane="posts">${posts.length ? `<div class="ogrid">${posts.map(gridCard).join("")}</div>` : '<p class="empty">まだ公開された投稿はありません</p>'}</div>
    <div data-upane="sodan" hidden></div>
    <div data-upane="photos" hidden>${photoMosaic(posts.filter((d) => d.authorId === uid)) || '<p class="empty">まだ写真がありません</p>'}</div>
  </div>`;
  const cnt = async () => {
    try { el.querySelector("[data-fc]").textContent = (await getCountFromServer(collection(db, "users", uid, "followers"))).data().count; } catch (e) {}
    try { el.querySelector("[data-gc]").textContent = (await getCountFromServer(collection(db, "users", uid, "following"))).data().count; } catch (e) {}
  };
  cnt();
  el.querySelectorAll("[data-ut]").forEach((b) => (b.onclick = () => { el.querySelectorAll("[data-ut]").forEach((x) => x.classList.toggle("on", x === b)); el.querySelectorAll("[data-upane]").forEach((x) => (x.hidden = x.dataset.upane !== b.dataset.ut)); if (b.dataset.ut === "sodan") SD().then((M) => M.renderMine(el.querySelector('[data-upane="sodan"]'), uid, isMe)); haptic(); }));
  const ub = el.querySelector("[data-ub]");
  if (isMe) { ub.innerHTML = '<a class="btn-g" href="#x-profile">プロフィールを編集</a>'; return; }
  let blocked = false; if (me) { try { blocked = await (await mod()).isBlocked(uid); } catch (e) {} }
  if (blocked) { ub.innerHTML = '<span style="font-size:13px;color:var(--muted);align-self:center">ブロック中</span><button class="btn-g" data-unb>ブロックを解除</button>'; el.querySelector("[data-unb]").onclick = async () => { await (await mod()).unblockUser(uid); back(); }; }
  else {
    ub.innerHTML = '<button class="btn-s" data-f>フォロー</button><a class="btn-g" href="#dm-' + esc(uid) + '">メッセージ</a>';
    wireFollow(el.querySelector("[data-f]"), uid, cnt);
  }
  el.querySelector("[data-umore]").onclick = async () => {
    const M = await mod();
    M.openMenu([
      { label: "このユーザーを通報", red: true, onClick: () => M.openReport({ type: "user", targetId: uid, targetUid: uid, excerpt: p.nickname || "" }) },
      { label: "ブロックする", red: true, onClick: async () => { if (await M.blockUser(uid, p.nickname)) back(); } }
    ]);
  };
}

// ---------- DM ----------
const convIdOf = (a, b) => [a, b].sort().join("__");
async function pageInbox(el) {
  el.innerHTML = bar("メッセージ") + `<div class="ps under2 nb"><div id="ilist"><p class="loading">読み込み中…</p></div></div>`;
  const box = el.querySelector("#ilist");
  if (!me) { box.innerHTML = '<p class="fol-empty">メッセージを使うには<a href="#x-login">ログイン</a>してください。</p>'; return; }
  const { onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  let blocked = new Set(); try { blocked = await (await mod()).getBlocked(); } catch (e) {}
  const unsub = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", me)), async (snap) => {
    const docs = snap.docs.map((x) => x.data()).sort((a, b) => ((b.updatedAt || {}).seconds || 0) - ((a.updatedAt || {}).seconds || 0));
    const others = docs.map((c) => (c.participants || []).find((u) => u !== me) || me);
    await loadProfiles(others);
    const rows = docs.map((c, i) => {
      const o = others[i]; if (blocked.has(o) || !c.lastMessage) return "";
      const pr = PROF[o] || {}, un = (c.unread || {})[me] || 0;
      return `<a class="cv2 ${un ? "un" : ""}" href="#dm-${esc(o)}"><img src="${esc(pr.photoURL || DEF_AV)}" alt=""><span class="m"><b>${esc(pr.nickname || "旅人")}</b><p>${c.lastSenderId === me ? "あなた: " : ""}${esc(c.lastMessage || "")}</p></span><span class="tm">${esc(ago((c.updatedAt || {}).seconds))}</span>${un ? '<span class="dot"></span>' : ""}</a>`;
    }).join("");
    box.innerHTML = rows || '<p class="fol-empty">まだメッセージはありません。気になる旅人のプロフィールからメッセージを送ってみましょう。</p>';
  }, () => (box.innerHTML = '<p class="fol-empty">読み込めませんでした。</p>'));
  STACK[STACK.length - 1].cleanup = unsub;
}
async function pageThread(el, other) {
  await loadProfiles([other]);
  const pr = PROF[other] || {};
  el.innerHTML = `<div class="thr">${bar(pr.nickname || "旅人", '<button class="mo" data-tmore>…</button>')}<div class="msgs" id="tmsgs"><p class="loading">読み込み中…</p></div><div id="tfoot"></div></div>`;
  el.querySelector(".bar2 b").innerHTML = `<a href="#u-${esc(other)}" style="display:flex;align-items:center;gap:8px"><img src="${esc(pr.photoURL || DEF_AV)}" style="width:30px;height:30px;border-radius:50%;object-fit:cover" alt="">${esc(pr.nickname || "旅人")}</a>`;
  const M = await mod();
  el.querySelector("[data-tmore]").onclick = () => M.openMenu([
    { label: "このユーザーを通報", red: true, onClick: () => M.openReport({ type: "user", targetId: other, targetUid: other, convId: me ? convIdOf(me, other) : "", excerpt: pr.nickname || "" }) },
    { label: "ブロックする", red: true, onClick: async () => { if (await M.blockUser(other, pr.nickname)) back(); } }
  ]);
  const msgs = el.querySelector("#tmsgs"), foot = el.querySelector("#tfoot");
  if (!me) { msgs.innerHTML = '<p class="fol-empty">メッセージを送るには<a href="#x-login">ログイン</a>してください。</p>'; return; }
  if (await M.isBlocked(other)) { msgs.innerHTML = ""; foot.innerHTML = '<div class="blockedbar">このユーザーをブロックしています<button data-unb>解除</button></div>'; foot.querySelector("[data-unb]").onclick = async () => { await M.unblockUser(other); back(); }; return; }
  const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const cid = convIdOf(me, other), convRef = doc(db, "conversations", cid);
  try { await setDoc(convRef, { participants: [me, other].sort(), unread: { [me]: 0 } }, { merge: true }); } catch (e) {}
  foot.innerHTML = '<form class="cmp"><label class="tph" aria-label="写真を送る"><input type="file" accept="image/*" multiple hidden><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg></label><button type="button" class="tph tart" aria-label="記事を送る"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5h9l3 3V20.5H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/></svg></button><textarea rows="1" maxlength="2000" placeholder="メッセージを入力"></textarea><button disabled aria-label="送信"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></form>';
  const form = foot.querySelector("form"), ta = form.querySelector("textarea"), sb = form.querySelector("button[aria-label='送信']");
  form.querySelector(".tart").onclick = () => pickArticle((d) => dmSend(other, { articleId: d.id }, "📄 " + titleOf(d).slice(0, 60)));
  ta.oninput = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; sb.disabled = !ta.value.trim(); };
  const unsub = F.onSnapshot(F.query(collection(convRef, "messages"), F.orderBy("createdAt", "asc")), (snap) => {
    let h = "", last = "", prev = "", prevAt = 0;
    const avImg = esc(pr.photoURL || DEF_AV);
    snap.forEach((s) => {
      const m = s.data(), t = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : null;
      const day = t ? `${t.getMonth() + 1}/${t.getDate()}` : "";
      if (day && day !== last) { h += `<div class="day-sep">${day}</div>`; last = day; prev = ""; }
      const who = m.senderId === me ? "u" : "a", at = t ? t.getTime() : 0;
      const cont = prev === who && at - prevAt < 5 * 60 * 1000 ? " c" : "";   // 5分以内に続けて送ったものはまとめる
      if (who === "a" && !cont) h += `<a class="dav" href="#u-${esc(other)}"><img src="${avImg}" alt=""></a>`;
      prev = who; prevAt = at;
      // 写真のメッセージ（縦横比を保ったまま表示。タップで大きく）
      if (m.imageUrl) h += `<button class="msg img ${who}${cont}" data-dmimg="${esc(m.imageUrl)}" style="aspect-ratio:${Number(m.w) > 0 && Number(m.h) > 0 ? `${Number(m.w)}/${Number(m.h)}` : "4/3"}"><img src="${esc(m.imageUrl)}" alt="写真" loading="lazy"></button>`;
      if (m.articleId) h += dmArtCard(m.articleId, who, m.imageUrl ? " c" : cont);
      if (m.text) h += `<div class="msg ${who}${m.imageUrl || m.articleId ? " c" : cont}">${esc(m.text)}</div>`;
    });
    msgs.innerHTML = (h || '<p class="fol-empty">最初のメッセージを送ってみましょう。</p>') + pend.map((p) => `<div class="msg img u sending" style="aspect-ratio:${p.r}"><span>送信中…</span></div>`).join("");
    requestAnimationFrame(() => (msgs.scrollTop = msgs.scrollHeight));
    fillArtCards(msgs);
    F.updateDoc(convRef, { ["unread." + me]: 0 }).catch(() => {});
  });
  STACK[STACK.length - 1].cleanup = unsub;
  msgs.onclick = (e) => { const b = e.target.closest("[data-dmimg]"); if (b) viewImage(b.dataset.dmimg); };
  // 写真を送る：縮小（長辺1600px）→ Storage の dm/{会話ID}/{自分}/ にアップロード → メッセージとして保存
  const pend = [];
  foot.querySelector(".tph input").onchange = async (e) => {
    const files = [...e.target.files]; e.target.value = "";
    if (!files.length) return;
    const { resizeImage } = await import("../post-core.js");
    const S = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
    for (const f of files) {
      const p = { r: "4/3" }; pend.push(p); msgs.insertAdjacentHTML("beforeend", `<div class="msg img u sending" style="aspect-ratio:4/3"><span>送信中…</span></div>`); msgs.scrollTop = msgs.scrollHeight;
      let step = "縮小";
      try {
        const blob = await resizeImage(f, 1600, 0.82);
        const bmp = await createImageBitmap(blob); const w = bmp.width, hh = bmp.height; bmp.close(); p.r = `${w}/${hh}`;
        const r = S.ref(storage, `dm/${cid}/${me}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
        step = "アップロード"; await S.uploadBytes(r, blob, { contentType: "image/jpeg" });
        step = "URL取得"; const url = await S.getDownloadURL(r);
        step = "保存"; await F.addDoc(collection(convRef, "messages"), { senderId: me, text: "", imageUrl: url, w, h: hh, createdAt: serverTimestamp() });
        await F.updateDoc(convRef, { lastMessage: "📷 写真", lastSenderId: me, updatedAt: serverTimestamp(), ["unread." + other]: F.increment(1), ["unread." + me]: 0 });
        notify({ toUid: other, type: "dm" }); haptic();
      } catch (err) { console.error(err); toast(`写真を送れませんでした（${step}：${(err && (err.code || err.message)) || err}）`); }
      pend.splice(pend.indexOf(p), 1);
      msgs.querySelectorAll(".sending").forEach((x, i) => { if (i >= pend.length) x.remove(); });
    }
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = ta.value.trim(); if (!text) return;
    sb.disabled = true; ta.value = ""; ta.oninput();
    try {
      await F.addDoc(collection(convRef, "messages"), { senderId: me, text, createdAt: serverTimestamp() });
      await F.updateDoc(convRef, { lastMessage: text.slice(0, 200), lastSenderId: me, updatedAt: serverTimestamp(), ["unread." + other]: F.increment(1), ["unread." + me]: 0 });
      notify({ toUid: other, type: "dm" }); haptic();
    } catch (err) { ta.value = text; ta.oninput(); toast(err && err.code === "permission-denied" ? "このユーザーにはメッセージを送れません" : "送信できませんでした"); }
  };
}

// DMで記事を送る・表示する
async function dmSend(other, data, preview) {
  if (!me) { toast("ログインが必要です"); return false; }
  const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const convRef = doc(db, "conversations", convIdOf(me, other));
  try {
    await setDoc(convRef, { participants: [me, other].sort() }, { merge: true });
    await F.addDoc(collection(convRef, "messages"), { senderId: me, text: "", ...data, createdAt: serverTimestamp() });
    await F.updateDoc(convRef, { lastMessage: preview, lastSenderId: me, updatedAt: serverTimestamp(), ["unread." + other]: F.increment(1), ["unread." + me]: 0 });
    notify({ toUid: other, type: "dm" }); haptic();
    return true;
  } catch (e) { console.error(e); toast(e && e.code === "permission-denied" ? "このユーザーには送れません" : "送れませんでした"); return false; }
}
function dmArtCard(id, who, cont) {
  const d = BY[id];
  const inner = d ? `<span class="ai" style="background-image:url('${esc(thumbOf(d))}')"></span><span class="at"><small>${esc(placeJp(d))}${daysLabel(d) ? "・" + esc(daysLabel(d)) : ""}</small><b>${esc(titleOf(d) || "(無題)")}</b><em>旅程を見る →</em></span>`
    : `<span class="ai"></span><span class="at"><small>Tabistock</small><b>記事を読み込み中…</b></span>`;
  return `<a class="msg art ${who}${cont}" href="#a-${esc(id)}" data-art="${esc(id)}">${inner}</a>`;
}
// 手元にない記事（下書き・自分の未公開など）は1件ずつ取りにいって、カードを埋める
async function fillArtCards(box) {
  const ids = [...new Set([...box.querySelectorAll("[data-art]")].map((a) => a.dataset.art))].filter((id) => !BY[id]);
  for (const id of ids) {
    try { const sn = await getDoc(doc(db, "articles", id)); if (sn.exists()) BY[id] = { id, ...sn.data() }; } catch (e) {}
    box.querySelectorAll(`[data-art="${CSS.escape(id)}"]`).forEach((a) => {
      const cls = a.className.replace(/^msg art /, "").split(" ");
      if (BY[id]) a.outerHTML = dmArtCard(id, cls[0], cls[1] ? " " + cls[1] : "");
      else a.querySelector("b").textContent = "見られない記事です";
    });
  }
}
// 送る記事を選ぶシート（自分の記事 → 保存した旅）
function pickArticle(onPick) {
  const mine = ALL.filter((d) => d.authorId === me || (d.coAuthorIds || []).includes(me));
  const sv = ALL.filter((d) => saved.has(d.id) && !mine.includes(d));
  const row = (d) => `<button class="srow aprow" data-ap="${esc(d.id)}"><span class="ai" style="background-image:url('${esc(thumbOf(d))}')"></span><span class="at"><b>${esc(titleOf(d) || "(無題)")}</b><small>${esc(placeJp(d))}${daysLabel(d) ? "・" + esc(daysLabel(d)) : ""}</small></span></button>`;
  const body = (mine.length ? `<p class="fsub">自分の記事</p>${mine.map(row).join("")}` : "") + (sv.length ? `<p class="fsub" style="margin-top:14px">保存した旅</p>${sv.map(row).join("")}` : "");
  openBS(`<div class="shs"><h3>記事を送る</h3><div class="apl">${body || '<p class="fol-empty">送れる記事がまだありません。公開した記事か、保存した旅から選べます。</p>'}</div></div>`, (bs) =>
    bs.querySelectorAll("[data-ap]").forEach((b) => (b.onclick = () => { closeSheet(); onPick(BY[b.dataset.ap]); })));
}
// 記事の共有メニューから「DMで送る」：最近やりとりした人から選ぶ
async function dmShareArticle(d) {
  if (!me) { closeSheet(); toast("DMで送るにはログインが必要です"); location.hash = "#x-login"; return; }
  openBS(`<div class="shs"><h3>DMで送る</h3><div id="dmsl"><p class="loading">読み込み中…</p></div></div>`);
  let docs = [];
  try { const qs = await getDocs(query(collection(db, "conversations"), where("participants", "array-contains", me))); qs.forEach((x) => docs.push(x.data())); } catch (e) {}
  docs = docs.filter((c) => c.lastMessage).sort((a, b) => ((b.updatedAt || {}).seconds || 0) - ((a.updatedAt || {}).seconds || 0));
  const others = [...new Set(docs.map((c) => (c.participants || []).find((u) => u !== me)).filter(Boolean))];
  await loadProfiles(others);
  const box = $("bs").querySelector("#dmsl"); if (!box) return;
  box.innerHTML = others.length ? others.map((u) => `<button class="srow aprow" data-to="${esc(u)}"><img src="${esc((PROF[u] || {}).photoURL || DEF_AV)}" alt=""><span class="at"><b>${esc((PROF[u] || {}).nickname || "旅人")}</b></span><span class="snd">送る</span></button>`).join("")
    : '<p class="fol-empty">まだDMでやりとりした人がいません。相手のプロフィールの「メッセージ」から始められます。</p>';
  box.querySelectorAll("[data-to]").forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.querySelector(".snd").textContent = "送信中…";
    if (await dmSend(b.dataset.to, { articleId: d.id }, "📄 " + titleOf(d).slice(0, 60))) { b.querySelector(".snd").textContent = "送りました"; b.classList.add("done"); toast("送りました"); }
    else { b.disabled = false; b.querySelector(".snd").textContent = "送る"; }
  }));
}

// 写真を全画面で見る（DMの写真など）。タップで閉じる
function viewImage(url) {
  const v = document.createElement("div");
  v.className = "imgview";
  v.innerHTML = `<img src="${esc(url)}" alt=""><button aria-label="閉じる">×</button>`;
  $("app").appendChild(v);
  requestAnimationFrame(() => v.classList.add("on"));
  v.onclick = () => { v.classList.remove("on"); setTimeout(() => v.remove(), 250); };
}

// ---------- 投稿・編集（app/post.js）に渡す道具 ----------
// 投稿フォームのプレビュー：入力中の内容を、公開後と同じ記事ページの見た目で表示する（保存はしない）
function openPreview(d) {
  const el = document.createElement("section");
  el.className = "page pvw"; el.style.zIndex = 95;
  $("pages").appendChild(el);
  const close = () => { el.classList.remove("open"); setTimeout(() => { el.remove(); delete BY.__pv; }, 380); haptic(); };
  BY.__pv = { ...d, id: "__pv" };
  pageArticle(el, "__pv", { preview: true, onClose: close });
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("open")));
  haptic();
}
function postCtx() {
  return {
    me, bar, back, toast, haptic, loadLeaflet, preview: openPreview,
    sheet: openBS, closeSheet,
    onSaved: (id) => { delete BY[id]; loadMyPosts(); renderDrafts(); },
    done: () => { go("me"); setTimeout(loadMyPosts, 400); }
  };
}

// ---------- 埋め込みページ（トランジット投稿など。アプリ版の画面ができるまでの間） ----------
function pageFrame(el, name) {
  let f = FRAMES[name] || ["/" + name + ".html", ""];
  if (name.startsWith("edit-")) { const id = name.slice(5), d = BY[id] || {}; f = [(d.type === "transit" ? "/post-transit.html" : "/post.html") + "?edit=" + encodeURIComponent(id), "記事を編集"]; }
  el.innerHTML = bar(f[1]) + `<iframe class="wf" src="${esc(f[0])}" title="${esc(f[1])}"></iframe>`;
}

// ---------- 保存 ----------
async function toggleSave(id) {
  if (!me) { toast("保存するにはログインが必要です"); setTimeout(() => (location.hash = "#x-login"), 900); return; }
  const ref = doc(db, "users", me, "saves", id);
  try {
    if (saved.has(id)) { await deleteDoc(ref); saved.delete(id); toast("保存を外しました"); }
    else { await setDoc(ref, { createdAt: serverTimestamp() }); saved.add(id); toast("保存しました"); }
  } catch (e) { toast("保存できませんでした"); }
  haptic();
  document.querySelectorAll(`[data-save="${CSS.escape(id)}"]`).forEach((b) => b.classList.toggle(b.classList.contains("ab") ? "saved" : "on", saved.has(id)));
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-save]"); if (b) { e.preventDefault(); toggleSave(b.dataset.save); } });

function renderSaved() {
  const l = ALL.filter((d) => saved.has(d.id));
  $("savedList").innerHTML = l.length ? `<div class="cnt"><span><b>${l.length}件</b>保存中</span></div><div class="ogrid">${l.map(gridCard).join("")}</div>` : '<div class="empty">まだ保存した旅はありません<br>記事の保存ボタンで保存できます</div>';
}

// ---------- マイページ ----------
function renderMe() {
  const box = $("meBody");
  if (!me) {
    box.innerHTML = `<div class="lt">マイページ</div><p class="sub" style="padding-top:6px">ログインすると、保存・フォロー・投稿ができます。</p>
      <div class="plist"><a class="pnew" href="#x-login"><span class="pt2"><b>ログイン・新規登録</b><small>サイトと同じアカウントで使えます</small></span><span class="pa">→</span></a></div>`;
    return;
  }
  const p = PROF[me] || {};
  const mine = ALL.filter((d) => d.authorId === me || (d.coAuthorIds || []).includes(me));
  const ig = String(p.instagram || "").trim();
  const igUrl = ig ? (/^https?:\/\//.test(ig) ? ig : "https://www.instagram.com/" + ig.replace(/^@/, "") + "/") : "";
  myTab = myTab && myTab !== "collab" ? myTab : "trips";
  box.innerHTML = `<div class="mehead nm0"><b>マイページ</b><button class="hb" id="meMenu" aria-label="メニュー"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>
    <div class="uhead"><div class="row"><img src="${esc(p.photoURL || DEF_AV)}" alt="">
      <div class="side"><h1>${esc(p.nickname || "旅人")}</h1><div class="st"><div><b>${mine.length}</b><span>投稿</span></div><a href="#f-followers-${esc(me)}"><b data-mfc>—</b><span>フォロワー</span></a><a href="#f-following-${esc(me)}"><b data-mgc>—</b><span>フォロー中</span></a></div></div></div>
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ""}${nextTripLine(p)}${tagChips(p, true)}${snsLinks(p)}
      <div class="ub mub"><a class="btn-g" href="#x-profile">プロフィールを編集</a><button class="btn-g" data-go="saved">保存した旅</button></div></div>
    <div class="mtabs itabs" id="mtabs"><button class="${myTab === "trips" ? "on" : ""}" data-mt="trips" aria-label="旅程">${TI.grid}<i id="invDot" hidden></i></button><button class="${myTab === "transit" ? "on" : ""}" data-mt="transit" aria-label="トランジット">${TI.transit}</button><button class="${myTab === "sodan" ? "on" : ""}" data-mt="sodan" aria-label="旅ひろば">${TI.sodan}</button><button class="${myTab === "photos" ? "on" : ""}" data-mt="photos" aria-label="写真">${TI.photo}</button></div>
    <div id="myPosts"><p class="loading">読み込み中…</p></div>`;
  box.querySelectorAll("[data-mt]").forEach((b) => (b.onclick = () => { myTab = b.dataset.mt; box.querySelectorAll("[data-mt]").forEach((x) => x.classList.toggle("on", x === b)); drawMyPosts(); haptic(); }));
  // パスポート（試作・管理者のみ）：プロフィール画像の右下に小さなパスポート。タップで開く
  isAdminMe().then((ok) => {
    const im = box.querySelector(".uhead .row > img"); if (!ok || !im || im.closest(".ppav")) return;
    import("./passport.js?v=202611250623").then((M) => M.warmFonts && M.warmFonts()).catch(() => {});
    const a = document.createElement("a"); a.className = "ppav"; a.href = "#pass"; a.setAttribute("aria-label", "パスポートを開く");
    a.addEventListener("click", () => { const r = (a.querySelector("i") || a).getBoundingClientRect(); window.__ppFrom = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    im.replaceWith(a); a.appendChild(im);
    a.insertAdjacentHTML("beforeend", '<i><svg viewBox="120 240 792 618"><path d="M606 411H888Q908 411 908 431V532Q908 552 889 560L606 678Z" fill="rgba(226,196,120,.3)"/><path d="M606 370H835Q855 370 855 390V499Q855 519 836 527L606 612Z" fill="rgba(226,196,120,.5)"/><path d="M606 328H782Q802 328 802 348V458Q802 478 783 486L606 552Z" fill="rgba(226,196,120,.8)"/><path d="M364 488H606V784Q606 854 536 854H434Q364 854 364 784Z" fill="#d9bd73"/><path d="M244 244H680Q742 244 742 306V426Q742 488 680 488H244A122 122 0 0 1 244 244Z" fill="#e8cf8a"/><path d="M648 244H680Q742 244 742 306V426Q742 488 680 488H380Z" fill="#a8843a"/></svg></i>');
  });
  loadMyPosts();
  getCountFromServer(collection(db, "users", me, "followers")).then((r) => { const e = box.querySelector("[data-mfc]"); if (e) e.textContent = r.data().count; }).catch(() => {});
  getCountFromServer(collection(db, "users", me, "following")).then((r) => { const e = box.querySelector("[data-mgc]"); if (e) e.textContent = r.data().count; }).catch(() => {});
  $("meMenu").onclick = meMenu;
}
// ---------- 自分の投稿（旅程／トランジット／共同投稿）と記事メニュー ----------
const STATUS_LABEL = { published: "公開中", pending: "承認待ち", rejected: "却下", draft: "下書き", hidden: "非表示" };
let myTab = "trips", MY = { trips: [], transit: [], collab: [], invites: [] };
async function loadMyPosts() {
  if (!me) return;
  const docs = [], invites = [];
  try {
    const [a, b, c] = await Promise.all([
      getDocs(query(collection(db, "articles"), where("authorId", "==", me))),
      getDocs(query(collection(db, "articles"), where("coAuthorIds", "array-contains", me))).catch(() => null),
      getDocs(query(collection(db, "articles"), where("coAuthorInvites", "array-contains", me))).catch(() => null)
    ]);
    a.forEach((x) => docs.push({ id: x.id, ...x.data() }));
    if (b) b.forEach((x) => { if (!docs.some((d) => d.id === x.id)) docs.push({ id: x.id, ...x.data(), _collab: true }); });
    if (c) c.forEach((x) => invites.push({ id: x.id, ...x.data() }));
  } catch (e) { const el = $("myPosts"); if (el) el.innerHTML = '<p class="loading">読み込めませんでした</p>'; return; }
  docs.forEach((d) => (BY[d.id] = BY[d.id] || d));
  docs.sort((x, y) => ((y.createdAt || {}).seconds || 0) - ((x.createdAt || {}).seconds || 0));
  const owned = docs.filter((d) => !d._collab);
  // 旅程とトランジットに分ける。共同投稿の記事もそれぞれに混ぜて、カードに「共同投稿」のラベルを出す
  MY = { trips: docs.filter((d) => d.type !== "transit"), transit: docs.filter((d) => d.type === "transit"), collab: docs.filter((d) => d._collab || (d.coAuthorIds || []).length || (d.coAuthorInvites || []).length), invites };
  await loadProfiles(invites.map((d) => d.authorId));
  ["trips", "transit", "collab"].forEach((k) => { const n = document.querySelector(`[data-mn="${k}"]`); if (n) n.textContent = MY[k].length || ""; });
  const dot = $("invDot"); if (dot) dot.hidden = !invites.length;
  drawMyPosts();
}
function myCard(d, editLink) {
  const st = STATUS_LABEL[d.status] ? d.status : "pending";
  return `<div class="mycard"><a class="oc" href="${editLink ? "#p-" : "#a-"}${esc(d.id)}" style="background-image:url('${esc(thumbOf(d))}')">${ovText({ ...d, title: d.title || "(無題)" })}</a>
    <div class="mymeta">${st !== "published" ? `<span class="pst s-${st}">${STATUS_LABEL[st]}</span>` : ""}${d._collab || (d.coAuthorIds || []).length ? '<span class="pst">共同投稿</span>' : ""}<button class="pmn" data-pm="${esc(d.id)}" aria-label="メニュー"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button></div></div>`;
}
let ADMIN_ME = null;
const isAdminMe = async () => { if (ADMIN_ME === null) { try { ADMIN_ME = (await getDoc(doc(db, "admins", me))).exists(); } catch (e) { ADMIN_ME = false; } } return ADMIN_ME; };
function drawMyPosts() {
  const box = $("myPosts"); if (!box) return;
  if (myTab === "sodan") { SD().then((M) => M.renderMine(box, me, true)); return; }
  if (myTab === "photos") {
    const mine = [...MY.trips, ...MY.transit].filter((d) => d.authorId === me);
    box.innerHTML = photoMosaic(mine) || '<p class="empty">まだ写真がありません。<br>旅程の DAY に写真を入れると、ここに並びます。</p>';
    return;
  }
  const list = MY[myTab] || [];
  const empty = { trips: '<p class="empty">まだ旅程がありません<br><br><a class="btn-s" href="#p">旅程を投稿する</a></p>', transit: '<p class="empty">まだトランジット記事がありません<br><br><a class="btn-s" href="#p-transit">トランジットを投稿する</a></p>', collab: '<p class="empty">共同投稿はまだありません。<br>投稿の編集画面から、一緒に旅した友達を招待できます。</p>' };
  let inv = "";
  if (myTab === "trips" && MY.invites.length) {   // 共同投稿の招待は旅程タブの上に
    inv = `<p class="fsub" style="margin:14px 20px 6px">招待 ${MY.invites.length}件</p>` + MY.invites.map((d) => `<div class="cv2"><a href="#a-${esc(d.id)}"><img src="${esc(thumbOf(d))}" alt="" style="border-radius:2px"></a><span class="m"><b>${esc(d.title || "(無題)")}</b><p>${esc(authorName(d))}さんから共同投稿の招待</p></span><button class="btn-s" data-inv="accept" data-id="${esc(d.id)}">承認</button><button class="btn-g" data-inv="decline" data-id="${esc(d.id)}">辞退</button></div>`).join("");
  }
  box.innerHTML = inv + (list.length ? `<div class="ogrid">${list.map((d) => myCard(d)).join("")}</div>` : (inv ? "" : empty[myTab]));
  box.querySelectorAll("[data-pm]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); postMenu(b.dataset.pm); }));
  box.querySelectorAll("[data-inv]").forEach((b) => (b.onclick = async () => {
    b.disabled = true;
    try {
      const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const ref = doc(db, "articles", b.dataset.id);
      if (b.dataset.inv === "accept") await F.updateDoc(ref, { coAuthorInvites: F.arrayRemove(me), coAuthorIds: F.arrayUnion(me) });
      else await F.updateDoc(ref, { coAuthorInvites: F.arrayRemove(me) });
      haptic(); loadMyPosts();
    } catch (e) { toast("操作できませんでした"); b.disabled = false; }
  }));
}
// 投稿タブの下書き一覧（タップで続きを編集）
async function renderDrafts() {
  const sec = $("draftSec"), box = $("draftList"); if (!sec) return;
  if (!me) { sec.hidden = true; return; }
  const list = [];
  try {
    const [a, b] = await Promise.all([
      getDocs(query(collection(db, "articles"), where("authorId", "==", me))),
      getDocs(query(collection(db, "articles"), where("coAuthorIds", "array-contains", me))).catch(() => null)
    ]);
    const add = (x, co) => { const d = { id: x.id, ...x.data(), ...(co ? { _collab: true } : {}) }; if (d.status === "draft" && !list.some((y) => y.id === d.id)) { list.push(d); BY[d.id] = d; } };
    a.forEach((x) => add(x)); if (b) b.forEach((x) => add(x, true));
  } catch (e) { sec.hidden = true; return; }
  list.sort((x, y) => ((y.updatedAt || y.createdAt || {}).seconds || 0) - ((x.updatedAt || x.createdAt || {}).seconds || 0));
  sec.hidden = !list.length;
  $("draftN").textContent = list.length || "";
  box.innerHTML = `<div class="ogrid">${list.map((d) => myCard(d, true)).join("")}</div>`;
  box.querySelectorAll("[data-pm]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); postMenu(b.dataset.pm); }));
}

// 記事メニュー（サイトのマイページと同じ：編集／共同投稿者／投稿者を譲る／非表示・再公開／削除・抜ける）
async function postMenu(id) {
  let d = BY[id];
  if (!d) return;
  const collab = d.authorId !== me;
  const people = (d.coAuthorIds || []).length + (d.coAuthorInvites || []).length;
  const it = [];
  it.push(`<a class="srow" href="#p-${esc(id)}">編集</a>`);
  if (people || collab) it.push(`<button class="srow" data-pa="people">共同投稿者<small style="margin-left:auto;color:var(--muted)">${people + (collab ? 1 : 0)}人</small></button>`);
  if (!collab && (d.coAuthorIds || []).length) it.push('<button class="srow" data-pa="handover">投稿者を譲る</button>');
  if (d.status === "published") it.push('<button class="srow" data-pa="hide">非表示にする</button>');
  if (d.status === "hidden") it.push('<button class="srow" data-pa="show">再公開する</button>');
  it.push(collab ? '<button class="srow red" data-pa="leave">共同投稿から抜ける</button>' : '<button class="srow red" data-pa="delete">削除</button>');
  $("bs").innerHTML = `<div class="grab"></div><div class="shs mmenu"><h3 style="font-size:15px">${esc(d.title || "(無題)")}</h3>${it.join("")}</div>`;
  $("ov").classList.add("show"); $("bs").classList.add("show");
  $("bs").querySelectorAll("a.srow").forEach((a) => a.addEventListener("click", closeSheet));
  $("bs").querySelectorAll("[data-pa]").forEach((b) => (b.onclick = () => postAction(b.dataset.pa, d)));
}
async function postAction(act, d) {
  const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const ref = doc(db, "articles", d.id);
  if (act === "people") {
    const rows = [[d.authorId, "投稿者"], ...(d.coAuthorIds || []).map((u) => [u, "共同投稿者"]), ...(d.coAuthorInvites || []).map((u) => [u, "招待中"])];
    await loadProfiles(rows.map((r) => r[0]));
    $("bs").innerHTML = `<div class="grab"></div><div class="shs"><h3>共同投稿者</h3>${rows.map(([u, role]) => `<a class="cv2" href="#u-${esc(u)}" style="padding-left:0;padding-right:0"><img src="${esc((PROF[u] || {}).photoURL || DEF_AV)}" alt=""><span class="m"><b>${esc((PROF[u] || {}).nickname || "旅人")}${u === me ? "（あなた）" : ""}</b><p>${role}</p></span></a>`).join("")}<p style="font-size:12px;color:var(--muted);margin-top:10px">招待や取り消しは「編集」画面からできます</p></div>`;
    $("bs").querySelectorAll("a").forEach((a) => a.addEventListener("click", closeSheet));
    return;
  }
  if (act === "delete" && !confirm("この投稿を削除しますか？この操作は取り消せません。")) return;
  if (act === "leave" && !confirm("この共同投稿から抜けますか？あなたのプロフィールに表示されなくなり、編集もできなくなります。")) return;
  closeSheet();
  try {
    if (act === "hide") await F.updateDoc(ref, { status: "hidden", updatedAt: serverTimestamp() });
    else if (act === "show") await F.updateDoc(ref, { status: "published", updatedAt: serverTimestamp() });
    else if (act === "delete") await deleteDoc(ref);
    else if (act === "leave") await F.updateDoc(ref, { coAuthorIds: F.arrayRemove(me) });
    else if (act === "handover") {
      const ids = d.coAuthorIds || []; await loadProfiles(ids);
      const names = ids.map((u) => (PROF[u] || {}).nickname || "旅人");
      let idx = 0;
      if (ids.length > 1) { const a = prompt("誰に投稿者を譲りますか？番号を入力してください。\n" + names.map((n, i) => `${i + 1}. ${n}`).join("\n")); if (a == null) return; idx = parseInt(a, 10) - 1; if (!(idx >= 0 && idx < ids.length)) { toast("番号が正しくありません"); return; } }
      if (!confirm(`「${d.title || "(無題)"}」の投稿者を ${names[idx]} さんに譲りますか？\nあなたは共同投稿者として残ります。`)) return;
      await F.updateDoc(ref, { authorId: ids[idx], authorNickname: names[idx], coAuthorIds: [...ids.filter((u) => u !== ids[idx]), me] });
      notify({ toUid: ids[idx], type: "handover", articleId: d.id, articleTitle: d.title || "" });
    }
    toast("完了しました"); haptic();
    delete BY[d.id]; loadMyPosts(); loadAll(); if (curTab === "post") renderDrafts();
  } catch (e) { toast("操作できませんでした"); }
}

// マイページのハンバーガーメニュー
function meMenu() {
  haptic();
  $("bs").innerHTML = `<div class="grab"></div><div class="shs mmenu">
    <a class="srow" href="#x-profile">プロフィールを編集</a>
    <a class="srow" href="#w-account">通知の設定</a>
    <a class="srow" href="#dm">メッセージ</a>
    <a class="srow" href="#x-blocks">ブロックしたユーザー</a>
    <button class="srow" id="mmPw">パスワードを変更</button>
    <p class="mlab">SUPPORT</p>
    <a class="srow" href="/terms.html" target="_blank">利用規約</a>
    <a class="srow" href="/privacy.html" target="_blank">プライバシーポリシー</a>
    <a class="srow" href="https://www.instagram.com/tabistock/" target="_blank" rel="noopener">お問い合わせ（Instagram）</a>
    <p class="mlab">ACCOUNT</p>
    <button class="srow" id="mmOut">ログアウト</button>
    <button class="srow red" id="mmDel">アカウントを削除</button></div>`;
  $("ov").classList.add("show"); $("bs").classList.add("show");
  $("bs").querySelectorAll("a.srow").forEach((a) => a.addEventListener("click", closeSheet));
  $("mmOut").onclick = async () => { if (!confirm("ログアウトしますか？")) return; closeSheet(); try { const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"); await A.signOut(auth); toast("ログアウトしました"); } catch (e) { toast("ログアウトできませんでした"); } };
  $("mmDel").onclick = deleteAccountSheet;
  $("mmPw").onclick = passwordSheet;
}
// パスワード変更（今のパスワードで本人確認 → 新しいパスワードに更新）。忘れた場合は再設定メールを送る
function passwordSheet() {
  const u = auth.currentUser;
  const inp = (id, ph, ac) => `<input id="${id}" type="password" autocomplete="${ac}" placeholder="${ph}" style="width:100%;border:0;border-bottom:1px solid var(--ink);background:none;padding:12px 0;font:inherit;font-size:16px;outline:none;margin-top:6px">`;
  $("bs").innerHTML = `<div class="grab"></div><div class="shs"><h3>パスワードを変更</h3>
    ${inp("pwNow", "今のパスワード", "current-password")}${inp("pwNew", "新しいパスワード（6文字以上）", "new-password")}${inp("pwNew2", "新しいパスワード（確認）", "new-password")}
    <p id="pwMsg" style="font-size:12.5px;margin-top:10px;color:#d4493f"></p>
    <button class="ok" id="pwGo">変更する</button>
    <button id="pwForgot" style="display:block;margin:14px auto 0;font-size:12.5px;color:var(--muted);text-decoration:underline">今のパスワードを忘れた（再設定メールを送る）</button></div>`;
  $("ov").classList.add("show"); $("bs").classList.add("show");
  const msg = (t, ok) => { const m = $("pwMsg"); m.textContent = t; m.style.color = ok ? "var(--green)" : "#d4493f"; };
  $("pwGo").onclick = async () => {
    const now = $("pwNow").value, nw = $("pwNew").value, nw2 = $("pwNew2").value;
    if (!now || !nw) { msg("パスワードを入力してください"); return; }
    if (nw.length < 6) { msg("新しいパスワードは6文字以上にしてください"); return; }
    if (nw !== nw2) { msg("確認用のパスワードが一致しません"); return; }
    const b = $("pwGo"); b.disabled = true; b.textContent = "変更中…";
    try {
      const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, now));
      await A.updatePassword(u, nw);
      closeSheet(); toast("パスワードを変更しました"); haptic();
    } catch (e) {
      const c = e && e.code;
      msg(c === "auth/wrong-password" || c === "auth/invalid-credential" || c === "auth/invalid-login-credentials" ? "今のパスワードが違います" : c === "auth/too-many-requests" ? "試行回数が多すぎます。しばらくしてからお試しください" : c === "auth/weak-password" ? "もっと強いパスワードにしてください" : "変更できませんでした");
      b.disabled = false; b.textContent = "変更する";
    }
  };
  $("pwForgot").onclick = async () => {
    try { const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"); await A.sendPasswordResetEmail(auth, u.email); msg(`${u.email} に再設定メールを送りました`, true); }
    catch (e) { msg("メールを送れませんでした"); }
  };
}

// アカウント削除（パスワードを入れ直して確定。サーバーの /api/deleteAccount が全データを消す）
function deleteAccountSheet() {
  $("bs").innerHTML = `<div class="grab"></div><div class="shs"><h3 style="color:#d4493f">アカウントを削除</h3>
    <p style="font-size:13.5px;line-height:1.75">削除すると、次のデータがすべて消え、<b>元に戻せません</b>。</p>
    <ul style="font-size:13px;line-height:1.85;padding-left:1.3em;margin:6px 0 4px"><li>投稿した記事（写真を含む）</li><li>書いたコメント、いいね</li><li>DMのメッセージ（相手側の履歴からも消えます）</li><li>プロフィール、保存した記事、フォロー、通知</li></ul>
    <p style="font-size:12px;color:var(--muted)">共同投稿者になっている他の人の記事は残り、あなたの名前だけが外れます。</p>
    <p style="font-size:13px;font-weight:700;margin:14px 0 6px">確認のため、パスワードを入力してください</p>
    <input id="delPw" type="password" autocomplete="current-password" style="width:100%;border:1px solid var(--line);padding:12px;font:inherit;font-size:16px;background:#fff;border-radius:2px">
    <p id="delMsg" style="font-size:12.5px;color:#d4493f;margin-top:8px"></p>
    <button class="ok" id="delGo" style="background:#d4493f">削除する</button></div>`;
  $("delGo").onclick = async () => {
    const pw = $("delPw").value, msg = $("delMsg"), user = auth.currentUser;
    if (!user) { msg.textContent = "ログインしてからもう一度お試しください。"; return; }
    if (!pw) { msg.textContent = "パスワードを入力してください。"; return; }
    if (!confirm("本当に削除しますか？この操作は取り消せません。")) return;
    const go = $("delGo"); go.disabled = true; go.textContent = "削除中…"; msg.textContent = "";
    try {
      const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      await A.reauthenticateWithCredential(user, A.EmailAuthProvider.credential(user.email, pw));
      const token = await user.getIdToken(true);
      const r = await fetch("/api/deleteAccount", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ confirm: "DELETE" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error === "admin account" ? "管理者アカウントはここからは削除できません。" : "削除に失敗しました（" + r.status + "）。");
      try { localStorage.clear(); } catch (e) {}
      await A.signOut(auth).catch(() => {});
      closeSheet(); toast("アカウントを削除しました");
    } catch (e) {
      const c = e && e.code;
      msg.textContent = c === "auth/wrong-password" || c === "auth/invalid-credential" || c === "auth/invalid-login-credentials" ? "パスワードが違います。" : c === "auth/too-many-requests" ? "試行回数が多すぎます。しばらくしてからお試しください。" : (e && e.message) || "削除に失敗しました。";
      go.disabled = false; go.textContent = "削除する";
    }
  };
}

// フォロワー／フォロー一覧（#f-followers-UID / #f-following-UID）
async function pageFollows(el, arg) {
  const [kind, uid] = [arg.split("-")[0], arg.slice(arg.indexOf("-") + 1)];
  el.innerHTML = bar(kind === "followers" ? "フォロワー" : "フォロー") + '<div class="ps under2 nb"><div id="flist"><p class="loading">読み込み中…</p></div></div>';
  let ids = [];
  try { (await getDocs(collection(db, "users", uid, kind))).forEach((s) => ids.push(s.id)); } catch (e) {}
  await loadProfiles(ids);
  el.querySelector("#flist").innerHTML = ids.length ? ids.map((u) => { const p = PROF[u] || {}; return `<a class="cv2" href="#u-${esc(u)}"><img src="${esc(p.photoURL || DEF_AV)}" alt=""><span class="m"><b>${esc(p.nickname || "旅人")}</b><p>${esc(p.bio || "")}</p></span></a>`; }).join("") : `<p class="fol-empty">${kind === "followers" ? "まだフォロワーはいません。" : "まだ誰もフォローしていません。"}</p>`;
}
// ブロックしたユーザー（#x-blocks）
async function pageBlocks(el) {
  el.innerHTML = bar("ブロックしたユーザー") + '<div class="ps under2 nb"><div id="blist"><p class="loading">読み込み中…</p></div></div>';
  const M = await mod();
  const draw = async () => {
    const list = await M.listBlocked();
    el.querySelector("#blist").innerHTML = list.length ? list.map((b) => `<div class="cv2"><a href="#u-${esc(b.uid)}" style="display:flex;align-items:center;gap:12px;flex:1"><img src="${esc((PROF[b.uid] || {}).photoURL || DEF_AV)}" alt=""><b>${esc(b.nickname || "ユーザー")}</b></a><button class="btn-g" data-unb="${esc(b.uid)}">解除</button></div>`).join("") : '<p class="fol-empty">ブロックしているユーザーはいません。</p>';
    el.querySelectorAll("[data-unb]").forEach((b) => (b.onclick = async () => { await M.unblockUser(b.dataset.unb); draw(); }));
  };
  draw();
}

// ---------- ログイン・新規登録（#x-login） ----------
const AUTH_ERR = { "auth/invalid-email": "メールアドレスの形式が正しくありません。", "auth/missing-password": "パスワードを入力してください。", "auth/weak-password": "パスワードは6文字以上にしてください。", "auth/email-already-in-use": "このメールアドレスは既に登録されています。ログインしてください。", "auth/invalid-credential": "メールアドレスかパスワードが違います。", "auth/invalid-login-credentials": "メールアドレスかパスワードが違います。", "auth/user-not-found": "アカウントが見つかりません。新規登録してください。", "auth/wrong-password": "パスワードが違います。", "auth/too-many-requests": "試行回数が多すぎます。しばらく待ってから再度お試しください。", "auth/network-request-failed": "通信エラーです。接続を確認してください。" };
function pageLogin(el) {
  let mode = "login";
  el.innerHTML = bar("") + `<div class="ps under2 nb"><div class="lgn">
    <img src="./logo.png" alt="Tabistock" class="lglogo">
    <p class="lgsub">大学生のリアルな旅程と費用が集まる場所</p>
    <div class="mtabs" style="margin:26px 0 6px"><button class="on" data-lm="login">ログイン</button><button data-lm="signup">新規登録</button></div>
    <label class="pfl" id="lgNickW" hidden>ユーザーネーム（記事に表示される名前）<input id="lgNick" maxlength="30" autocomplete="nickname"></label>
    <label class="pfl">メールアドレス<input id="lgEmail" type="email" autocomplete="email" autocapitalize="off" placeholder="you@example.com"></label>
    <label class="pfl">パスワード<input id="lgPw" type="password" autocomplete="current-password" placeholder="6文字以上"></label>
    <label class="agree2" id="lgAgreeW" hidden><input type="checkbox" id="lgAgree"><span><a href="/terms.html" target="_blank">利用規約</a>と<a href="/privacy.html" target="_blank">プライバシーポリシー</a>に同意します</span></label>
    <p class="pfm" id="lgMsg"></p>
    <button class="ok" id="lgGo" style="margin-top:18px">ログイン</button>
    <button id="lgForgot" class="lgfg">パスワードを忘れた方</button>
  </div></div>`;
  const $$ = (id) => el.querySelector("#" + id);
  const msg = (t, ok) => { const m = $$("lgMsg"); m.textContent = t; m.style.color = ok ? "var(--green)" : "#d4493f"; };
  const setMode = (m) => {
    mode = m;
    el.querySelectorAll("[data-lm]").forEach((b) => b.classList.toggle("on", b.dataset.lm === m));
    $$("lgNickW").hidden = m !== "signup"; $$("lgAgreeW").hidden = m !== "signup"; $$("lgForgot").hidden = m !== "login";
    $$("lgGo").textContent = m === "login" ? "ログイン" : "登録する";
    $$("lgPw").autocomplete = m === "login" ? "current-password" : "new-password";
    msg("");
  };
  el.querySelectorAll("[data-lm]").forEach((b) => (b.onclick = () => { setMode(b.dataset.lm); haptic(); }));
  $$("lgGo").onclick = async () => {
    const email = $$("lgEmail").value.trim(), pw = $$("lgPw").value, nick = $$("lgNick").value.trim();
    if (!email || !pw) { msg("メールアドレスとパスワードを入力してください。"); return; }
    if (mode === "signup" && !nick) { msg("ユーザーネームを入力してください。"); return; }
    if (mode === "signup" && !$$("lgAgree").checked) { msg("利用規約とプライバシーポリシーへの同意が必要です。"); return; }
    const go = $$("lgGo"); go.disabled = true; msg(mode === "login" ? "ログイン中…" : "登録中…", true);
    try {
      const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      if (mode === "signup") {
        const dup = await getDocs(query(collection(db, "publicProfiles"), where("nickname", "==", nick)));
        if (!dup.empty) { msg("このユーザーネームは既に使われています。別の名前にしてください。"); go.disabled = false; return; }
        const cred = await A.createUserWithEmailAndPassword(auth, email, pw);
        await A.updateProfile(cred.user, { displayName: nick });
        await setDoc(doc(db, "users", cred.user.uid), { nickname: nick, email, createdAt: serverTimestamp() });
        await setDoc(doc(db, "publicProfiles", cred.user.uid), { nickname: nick, createdAt: serverTimestamp() }, { merge: true });
        try { await A.sendEmailVerification(cred.user); } catch (e) {}
        await A.signOut(auth);   // メールの確認が済むまではログインしない（サイトと同じ）
        setMode("login");
        msg("確認メールを送りました。メールのリンクを開いて認証してから、ログインしてください。", true);
      } else {
        const cred = await A.signInWithEmailAndPassword(auth, email, pw);
        if (!cred.user.emailVerified) {
          try { await A.sendEmailVerification(cred.user); } catch (e) {}
          await A.signOut(auth);
          msg("メールアドレスが未確認です。確認メールのリンクを開いて認証してください（確認メールを再送しました）。");
        } else { toast("ログインしました"); haptic(); back(); }
      }
    } catch (e) { msg(AUTH_ERR[e && e.code] || "エラー：" + ((e && e.code) || "不明")); }
    go.disabled = false;
  };
  $$("lgForgot").onclick = async () => {
    const email = $$("lgEmail").value.trim();
    if (!email) { msg("上にメールアドレスを入れてから押してください。"); return; }
    try { const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"); await A.sendPasswordResetEmail(auth, email); msg(`${email} に再設定メールを送りました。`, true); }
    catch (e) { msg(AUTH_ERR[e && e.code] || "メールを送れませんでした。"); }
  };
}

// ---------- 通知（#n） ----------
async function pageNotify(el) {
  el.innerHTML = bar("通知") + '<div class="ps under2 nb"><div id="nlist"><p class="loading">読み込み中…</p></div></div>';
  const box = el.querySelector("#nlist");
  if (!me) { box.innerHTML = '<p class="fol-empty"><a href="#x-login">ログイン</a>すると通知が届きます。</p>'; return; }
  let items = [];
  // 出すのは新しい順に20件だけ。未読は、出さない古いものも含めてすべて既読にする
  let allUnread = [];
  try {
    const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const col = collection(db, "users", me, "notifications");
    const [a, u] = await Promise.all([getDocs(F.query(col, F.orderBy("createdAt", "desc"), F.limit(20))), getDocs(query(col, where("read", "==", false))).catch(() => null)]);
    a.forEach((x) => items.push({ id: x.id, ...x.data() }));
    if (u) u.forEach((x) => allUnread.push({ id: x.id, ...x.data() }));
  } catch (e) {}
  if (!allUnread.length) allUnread = items.filter((n) => !n.read);
  await loadProfiles(items.map((n) => n.fromUid).filter(Boolean));
  box.innerHTML = items.length ? items.map((n) => {
    const name = `<b>${esc(n.fromNickname || (PROF[n.fromUid] || {}).nickname || "ある旅人")}</b>`, t = esc(n.articleTitle || "旅程");
    let txt, href;
    if (n.type === "follow") { txt = `${name}さんがあなたをフォローしました`; href = "#u-" + esc(n.fromUid || ""); }
    else if (n.type === "dm") { txt = `${name}さんからメッセージが届きました`; href = "#dm-" + esc(n.fromUid || ""); }
    else if (n.type === "handover") { txt = `${name}さんから「${t}」の投稿者を引き継ぎました`; href = "#a-" + esc(n.articleId || ""); }
    else if (n.type === "collab") { txt = `${name}さんから「${t}」の共同投稿に招待されました`; href = "#a-" + esc(n.articleId || ""); }
    else if (n.type === "sodan") { txt = `${name}さんがあなたの旅ひろばの投稿に回答しました${t ? `「${t}」` : ""}`; href = "#c-" + esc(n.articleId || ""); }
    else if (n.type === "comment") { txt = `${name}さんが「${t}」にコメントしました`; href = "#a-" + esc(n.articleId || ""); }
    else { txt = `${name}さんがあなたの旅程「${t}」にいいねしました`; href = "#a-" + esc(n.articleId || ""); }
    return `<a class="nrow ${n.read ? "" : "un"}" href="${href}"><img src="${esc(avatarOf(n.fromUid))}" alt=""><span class="nt">${txt}<small>${esc(ago((n.createdAt || {}).seconds))}</small></span></a>`;
  }).join("") : '<p class="fol-empty">通知はまだありません。</p>';
  // 開いたら既読にする
  $("bellDot").hidden = true;
  const un = allUnread;
  if (un.length) {
    try {
      const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      for (let i = 0; i < un.length; i += 400) { const b = F.writeBatch(db); un.slice(i, i + 400).forEach((n) => b.update(doc(db, "users", me, "notifications", n.id), { read: true })); await b.commit(); }
    } catch (e) {}
  }
}

// ---------- プロフィール編集（#x-profile） ----------
async function pageProfileEdit(el) {
  if (!me) { el.innerHTML = bar("プロフィールを編集") + '<div class="ps under2"><p class="fol-empty"><a href="#x-login">ログイン</a>してください。</p></div>'; return; }
  await loadProfiles([me]);
  const p = PROF[me] || {};
  el.innerHTML = bar("プロフィールを編集", '<button class="mo" id="pfSave" style="font-size:15px;font-weight:700;color:var(--green);padding:0 4px">保存</button>') + `<div class="ps under2 nb"><div class="pfe">
    <div class="pfav"><img id="pfImg" src="${esc(p.photoURL || DEF_AV)}" alt=""><label class="btn-g">写真を変更<input type="file" accept="image/*" id="pfFile" hidden></label></div>
    <label class="pfl">ユーザーネーム<input id="pfNick" maxlength="30" value="${esc(p.nickname || "")}"></label>
    <label class="pfl">自己紹介<textarea id="pfBio" rows="2" maxlength="300">${esc(p.bio || "")}</textarea></label>
    <p class="pfh">旅のスタイル <small id="tgCnt"></small></p>
    <p class="pfn">あなたの旅を表すタグを${TAG_MAX}つまで選べます</p>
    <div class="tgpick" id="tgPick"></div>
    <div class="tgadd"><input id="tgNew" maxlength="12" placeholder="自分で追加（12文字まで）"><button id="tgAdd" type="button">追加</button></div>
    <p class="pfh">次の旅（任意）</p>
    <p class="pfn">決まっている次の旅を、プロフィールに出せます。時期は月まで（日にちは出しません）</p>
    <div class="ntrip"><input id="ntPlace" maxlength="30" placeholder="行き先（例：バンコク）" value="${esc((p.nextTrip || {}).place || "")}"><select id="ntYm"><option value="">時期は未定</option>${nextMonths().map((ym) => `<option value="${ym}" ${(p.nextTrip || {}).ym === ym ? "selected" : ""}>${ymLabel(ym)}</option>`).join("")}</select></div>
    <p class="pfh">SNS（ユーザー名 または URL）</p>
    ${SNS.map(([k, l]) => `<label class="pfl">${l}<input data-sns="${k}" autocapitalize="off" autocorrect="off" placeholder="${k === "note" ? "noteのID" : "@なしのユーザー名"}" value="${esc(p[k] || "")}"></label>`).join("")}
    <p class="pfm" id="pfMsg"></p></div></div>`;
  const bioEl = el.querySelector("#pfBio"), fitBio = () => { bioEl.style.height = "auto"; bioEl.style.height = Math.min(180, bioEl.scrollHeight) + "px"; };
  bioEl.addEventListener("input", fitBio); requestAnimationFrame(fitBio);
  let tags = Array.isArray(p.tags) ? p.tags.slice(0, TAG_MAX) : [];
  const drawTags = () => {
    const all = [...tags.filter((x) => !TAG_PRESET.includes(x)), ...TAG_PRESET];
    el.querySelector("#tgPick").innerHTML = all.map((x) => `<button type="button" class="${tags.includes(x) ? "on" : ""}" data-tg="${esc(x)}">${esc(x)}</button>`).join("");
    el.querySelector("#tgCnt").textContent = `${tags.length}/${TAG_MAX}`;
  };
  drawTags();
  el.querySelector("#tgPick").onclick = (e) => {
    const b = e.target.closest("[data-tg]"); if (!b) return;
    const x = b.dataset.tg;
    if (tags.includes(x)) tags = tags.filter((y) => y !== x);
    else if (tags.length >= TAG_MAX) { toast(`タグは${TAG_MAX}つまでです`); return; }
    else tags.push(x);
    drawTags(); haptic();
  };
  const addTag = () => {
    const i = el.querySelector("#tgNew"), x = i.value.replace(/[#＃\s]/g, "").slice(0, 12);
    if (!x) return;
    if (tags.includes(x)) { i.value = ""; return; }
    if (tags.length >= TAG_MAX) { toast(`タグは${TAG_MAX}つまでです`); return; }
    tags.push(x); i.value = ""; drawTags(); haptic();
  };
  el.querySelector("#tgAdd").onclick = addTag;
  el.querySelector("#tgNew").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } };
  const msg = (t, ok) => { const m = el.querySelector("#pfMsg"); m.textContent = t; m.style.color = ok ? "var(--green)" : "#d4493f"; };
  el.querySelector("#pfFile").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    msg("アイコンをアップロード中…", true);
    try {
      const blob = await squareJpeg(f, 256);
      const S = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
      const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
      const { storage } = await import("../firebase-config.js");
      const r = S.ref(storage, `avatars/${me}/avatar.jpg`);
      await S.uploadBytes(r, blob, { contentType: "image/jpeg" });
      const url = await S.getDownloadURL(r);
      await A.updateProfile(auth.currentUser, { photoURL: url });
      await setDoc(doc(db, "users", me), { photoURL: url }, { merge: true });
      await setDoc(doc(db, "publicProfiles", me), { photoURL: url }, { merge: true });
      PROF[me] = { ...(PROF[me] || {}), photoURL: url };
      el.querySelector("#pfImg").src = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
      msg("アイコンを更新しました", true);
    } catch (err) { msg("アップロードに失敗しました"); }
  };
  el.querySelector("#pfSave").onclick = async () => {
    const nick = el.querySelector("#pfNick").value.trim(), bio = el.querySelector("#pfBio").value.trim();
    const sns = {}; el.querySelectorAll("[data-sns]").forEach((i) => (sns[i.dataset.sns] = i.value.trim()));
    const instagram = sns.instagram;
    const ntPlace = el.querySelector("#ntPlace").value.trim().slice(0, 30), ntYm = el.querySelector("#ntYm").value;
    const nextTrip = ntPlace ? { place: ntPlace, ym: ntYm } : null;
    if (!nick) { msg("ユーザーネームを入力してください"); return; }
    msg("保存中…", true);
    try {
      if (nick !== (p.nickname || "")) {
        const dup = await getDocs(query(collection(db, "publicProfiles"), where("nickname", "==", nick)));
        let taken = false; dup.forEach((x) => { if (x.id !== me) taken = true; });
        if (taken) { msg("このユーザーネームは既に使われています"); return; }
        const A = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
        await A.updateProfile(auth.currentUser, { displayName: nick });
      }
      await setDoc(doc(db, "publicProfiles", me), { nickname: nick, bio, tags, nextTrip, ...sns, ...(p.photoURL ? { photoURL: p.photoURL } : {}) }, { merge: true });
      await setDoc(doc(db, "users", me), { nickname: nick, bio, tags, ...sns }, { merge: true });
      PROF[me] = { ...(PROF[me] || {}), nickname: nick, bio, tags, nextTrip, ...sns };
      toast("プロフィールを保存しました"); haptic();
      if (curTab === "me") renderMe();
      back();
    } catch (err) { msg("保存に失敗しました"); }
  };
}
function squareJpeg(file, size) {
  return new Promise((ok, ng) => {
    const img = new Image();
    img.onload = () => { const s = Math.min(img.width, img.height); const c = document.createElement("canvas"); c.width = c.height = size; c.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size); c.toBlob((b) => (b ? ok(b) : ng(new Error("変換失敗"))), "image/jpeg", 0.85); };
    img.onerror = () => ng(new Error("読み込み失敗"));
    img.src = URL.createObjectURL(file);
  });
}

// ---------- AI相談（タブ） ----------
let aiConv = [], aiBusy = false;
const aiKey = () => (me ? "tabistock-ask-v1:" + me : null);
function aiLoad() { try { const v = JSON.parse(localStorage.getItem(aiKey()) || "[]"); aiConv = Array.isArray(v) ? v : []; } catch (e) { aiConv = []; } }
function aiSave() { try { if (aiKey()) localStorage.setItem(aiKey(), JSON.stringify(aiConv.slice(-40))); } catch (e) {} }
// AIのシンボル：3枚のコンパスの星を、奥（薄い緑）から手前（濃い緑）へ重ねたもの。重なりは乗算で少し透ける
const AI_SP = ["M0 -250Q-21.2 -21.2 -125 0Q-21.2 21.2 0 150Q21.2 21.2 125 0Q21.2 -21.2 0 -250Z", "M0 -210Q-17.8 -17.8 -105 0Q-17.8 17.8 0 126Q17.8 17.8 105 0Q17.8 -17.8 0 -210Z", "M0 -170Q-14.4 -14.4 -85 0Q-14.4 14.4 0 102Q14.4 14.4 85 0Q14.4 -14.4 0 -170Z"];
const AI_COL = [["#d6f6e6", "#9fdcc0"], ["#5cc596", "#24936c"], ["#1f8a65", "#0b4636"]], AI_DY = [-40, -10, 20];
let aiSymN = 0;
function aiSym(cls = "") {
  const id = "ais" + aiSymN++;
  return `<svg class="aisym ${cls}" viewBox="-140 -300 280 480" aria-hidden="true"><defs>${AI_COL.map((c, i) => `<linearGradient id="${id}${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>`).join("")}</defs><g style="isolation:isolate">${AI_SP.map((d, i) => `<g class="s${i}" transform="translate(0 ${AI_DY[i]})"><g class="b"><path d="${d}" fill="url(#${id}${i})"/></g></g>`).join("")}</g></svg>`;
}
function aiSymPlay() {
  const h = $("aiSymH"); if (!h) return;
  h.classList.remove("in"); void h.getBoundingClientRect(); h.classList.add("in");
}
$("aiSymH").innerHTML = aiSym();
$("aiGo").innerHTML = aiSym();   // 探すの検索欄の右横：AI相談の入口（シンボルだけ）
function aiBody(m) {
  const arts = (m.articles || []).map((a) => `<a class="aref" href="#a-${esc(a.id)}">${a.country ? `<em>${esc(a.country)}</em>` : ""}<span>${esc(a.title)}</span><b>→</b></a>`).join("");
  const fare = m.fares ? '<a class="aref" href="#fare"><em>航空券</em><span>相場カレンダーで月ごとの値段を見る</span><b>→</b></a>' : "";
  return `<div class="mt">${m.html || esc(m.content).replace(/\n/g, "<br>")}</div>${arts || fare ? `<div class="arefs">${fare}${arts ? '<p class="arh">詳しくはこちらの記事を参考に</p>' + arts : ""}</div>` : ""}`;
}
function aiBubble(m) {
  if (m.role === "user") return `<div class="msg u">${esc(m.content)}</div>`;
  return `<div class="msg a">${aiSym()}<div class="mb">${aiBody(m)}</div></div>`;
}
let aiTypeT = null;
function aiRender(extra = "", typeLast = false) {
  clearInterval(aiTypeT);
  $("aiIntro").hidden = !!aiConv.length; $("aiNew").hidden = !aiConv.length;
  $("aiLog").innerHTML = aiConv.map(aiBubble).join("") + extra;
  const end = () => requestAnimationFrame(() => $("ai").scrollTo({ top: 1e6, behavior: "smooth" }));
  end();
  // 届いたばかりの答えは、文字が流れるように出す（記事の案内は最後にふわっと出す）
  const m = aiConv[aiConv.length - 1];
  if (!typeLast || !m || m.role === "user" || m.html || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = $("aiLog").lastElementChild, mt = box.querySelector(".mt"), refs = box.querySelector(".arefs");
  const full = m.content || ""; let n = 0;
  if (refs) refs.classList.add("wait");
  mt.textContent = "";
  aiTypeT = setInterval(() => {
    n = Math.min(full.length, n + 3);
    mt.innerHTML = esc(full.slice(0, n)).replace(/\n/g, "<br>");
    if (n % 30 < 3) end();
    if (n >= full.length) { clearInterval(aiTypeT); if (refs) refs.classList.remove("wait"); end(); }
  }, 30);
}
async function aiSend(q) {
  q = (q || "").trim(); if (!q || aiBusy) return;
  if (!me) { aiRender(aiBubble({ role: "assistant", html: '相談するには<a href="#x-login" style="color:var(--green);font-weight:700">ログイン</a>が必要です。' })); return; }
  aiBusy = true; $("aiSend").disabled = true;
  aiConv.push({ role: "user", content: q });
  aiRender(`<div class="msg a">${aiSym("think")}<div class="mb"><p class="th">旅程記事を探しています…</p></div></div>`);
  try {
    const token = await auth.currentUser.getIdToken();
    const history = aiConv.slice(-20).map((m) => (m.role === "user" ? { role: "user", content: m.content } : { role: "assistant", content: m.content, articleIds: (m.articles || []).map((a) => a.id), usedFares: !!m.fares }));
    const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify({ messages: history }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(String(r.status));
    aiConv.push({ role: "assistant", content: data.answer || "", articles: data.articles || [], fares: !!data.fares });
    aiSave(); aiRender("", true);
  } catch (e) {
    aiConv.pop(); $("aiIn").value = q;
    aiRender(aiBubble({ role: "assistant", html: `うまく相談できませんでした。少し時間をおいてもう一度お試しください。<br><small style="color:var(--muted)">（エラー：${esc((e && e.message) || "通信")}）</small>` }));
  }
  aiBusy = false; $("aiSend").disabled = false;
}
document.querySelectorAll(".aichips button").forEach((b) => (b.onclick = () => aiSend(b.textContent)));
$("aiCmp").onsubmit = (e) => { e.preventDefault(); const v = $("aiIn").value; $("aiIn").value = ""; $("aiIn").style.height = "auto"; aiSend(v); };
$("aiIn").oninput = () => { const t = $("aiIn"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 110) + "px"; };
$("aiNew").onclick = () => { if (!confirm("今の会話を消して、新しい相談を始めますか？")) return; aiConv = []; aiSave(); aiRender(); };

// ---------- その他のボタン ----------
$("dmBtn").onclick = () => (location.hash = "#dm");
$("bellBtn").onclick = () => (location.hash = "#n");

// ---------- 読み込み ----------
async function loadAll() {
  try {
    const snap = await getDocs(query(collection(db, "articles"), where("status", "==", "published")));
    ALL = [];
    snap.forEach((s) => { const d = { id: s.id, ...s.data() }; ALL.push(d); BY[d.id] = d; });
    ALL.sort((a, b) => pubSec(b) - pubSec(a));
  } catch (e) {
    console.error(e);
    $("newList").innerHTML = '<p class="loading">読み込めませんでした。通信を確認してください。</p>';
    return;
  }
  await loadProfiles(ALL.map((d) => d.authorId));
  const cs = new Set(ALL.flatMap((d) => d.countries || []).filter((c) => c !== "japan"));
  $("snum").innerHTML = `<b>${cs.size}</b> の国と地域、<b>${ALL.length}</b> の旅程から`;
  renderHome();
  if (curTab === "search") renderSearch();
}

// DMの未読数：会話の変化をずっと見張って、読んだらすぐ数字が消えるようにする
let dmUnsub = null;
let bellUnsub = null;
async function watchDmBadge() {
  if (dmUnsub) { dmUnsub(); dmUnsub = null; }
  if (bellUnsub) { bellUnsub(); bellUnsub = null; }
  const b = $("dmBadge");
  if (!me) { b.hidden = true; $("bellDot").hidden = true; return; }
  try {
    const { onSnapshot, limit } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    // お知らせの赤い点：未読が1件でもあれば点ける（読んだら・新着が来たらすぐ反映）
    bellUnsub = onSnapshot(query(collection(db, "users", me, "notifications"), where("read", "==", false), limit(1)), (q) => {
      $("bellDot").hidden = q.empty || (STACK.length && STACK[STACK.length - 1].hash === "#n");
    }, () => {});
    dmUnsub = onSnapshot(query(collection(db, "conversations"), where("participants", "array-contains", me)), (cs) => {
      let un = 0; cs.forEach((c) => { un += Number(((c.data().unread || {})[me]) || 0); });
      b.hidden = !un; b.textContent = un > 99 ? "99+" : un;
    }, () => {});
  } catch (e) {}
}
onAuthStateChanged(auth, async (u) => {
  me = u ? u.uid : null;
  if (me) setTimeout(setupNativePush, 2500);   // iPhoneアプリ：通知の許可と宛先の登録（起動のロゴのあとに）
  if (!me) watchDmBadge();
  saved = new Set();
  if (me) {
    try { (await getDocs(collection(db, "users", me, "saves"))).forEach((s) => saved.add(s.id)); } catch (e) {}
    await loadProfiles([me]);
    watchDmBadge();
  }
  if (curTab === "me") renderMe();
  if (!$("folPane").hidden) renderFeed();
  if (curTab === "ai") { aiLoad(); aiRender(); }
});

renderTab();
loadAll().then(route).finally(hideSplash);
// 起動画面を閉じる：ロゴアニメーションが終わり、ホームの最初に見える写真（ピックアップと新着の先頭）を読み込み終えてから、ふわっと消す。
// 通信が遅くても、起動から最大4.5秒で閉じる
async function hideSplash() {
  const sp = $("splash"); if (!sp || sp.hidden || sp.dataset.closing) return;
  sp.dataset.closing = "1";
  const urls = [...document.querySelectorAll("#feat .feat, #newList .oc, #newList [style*='background-image']")].slice(0, 5)
    .map((e) => (e.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/) || [])[1]).filter(Boolean);
  const load = (u) => new Promise((ok) => { const im = new Image(); im.onload = im.onerror = ok; im.src = u; if (im.complete) ok(); });
  const left = Math.max(0, 4500 - (Date.now() - (window.__splashAt || 0)));
  await Promise.race([Promise.all(urls.map(load)), new Promise((ok) => setTimeout(ok, left))]);
  const wait = Math.max(0, 2350 - (Date.now() - (window.__splashAt || 0)));   // ロゴアニメーション（約2.2秒）が終わるまでは待つ
  setTimeout(() => {
    setTimeout(() => {
      sp.classList.add("out");
      setTimeout(syncNativeTab, 450);             // ロゴが消えてホームが出てくるのに合わせて、ネイティブのタブを出す
      $("app").classList.add("intro");            // ホームの各パーツを、上から順にふわっと出す
      setTimeout(() => $("app").classList.remove("intro"), 2400);
      try { sessionStorage.setItem("tbs-splash", "1"); } catch (e) {}
      setTimeout(() => sp.remove(), 600);
    }, 0);
  }, wait);
}
setTimeout(hideSplash, 4500);
