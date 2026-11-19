// Tabistock アプリ版（app/）
// サイトと同じ Firestore を読み、アプリ用のデザインで表示する。
// 第1段階：ホーム（おすすめ／フォロー中）・探す・記事。投稿／AI／DM などは当面サイトのページへつなぐ。
import { auth, db } from "../firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, getCountFromServer, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  cinfo, esc, para, yen, isDomestic, prefLabel, derivePrefs, pubSec, costTotalOf, fmtPeriod,
  STYLES, COST_ITEMS, DAYS_OPT, REGION_JP, REGION_EN, COUNTRY_LL, COUNTRY_ISO, COUNTRIES, PREF_GROUPS
} from "../tabistock-render.js";

const $ = (id) => document.getElementById(id);
const I = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor"/>',
  search: '<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  post: '<path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  ai: '<path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" fill="currentColor"/>',
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
const TABS = [["home", "ホーム"], ["search", "探す"], ["post", "投稿"], ["ai", "AI"], ["me", "マイページ"]];
const VIEWS = ["home", "search", "post", "ai", "me", "saved"];
let curTab = "home";
function renderTab() {
  const act = curTab === "saved" ? "me" : curTab;
  $("tab").innerHTML = TABS.map(([k, l]) => `<button class="${k === act ? "on" : ""}${k === "post" ? " tpost" : ""}" data-go="${k}"><svg viewBox="0 0 24 24">${I[k]}</svg>${l}</button>`).join("");
}
function go(k, opt = {}) {
  if (STACK.length) { location.hash = ""; }
  if (k === curTab && !Object.keys(opt).length) { $(k).scrollTo({ top: 0, behavior: "smooth" }); return; }
  curTab = k; haptic();
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
  if (k === "saved") renderSaved();
  if (k === "ai") { aiLoad(); aiRender(); }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]");
  if (!b) return;
  e.preventDefault();
  go(b.dataset.go, b.dataset.reset ? { reset: 1, country: b.dataset.country, style: b.dataset.style } : {});
});

// ---------- ホーム ----------
function renderHome() {
  const trips = ALL.filter((d) => d.type !== "transit" && !isDomestic(d));
  const jp = ALL.filter((d) => d.type !== "transit" && isDomestic(d));
  const tr = ALL.filter((d) => d.type === "transit");
  // ピックアップ：写真のある海外の旅から、日替わりで1本
  const pool = trips.filter((d) => thumbOf(d));
  // ピックアップ：イタリア8泊9日の記事を固定（見つからなければ日替わり）
  const pick = pool.find((d) => /イタリア/.test(titleOf(d)) && /8泊9日/.test(titleOf(d))) || pool.find((d) => (d.countries || []).includes("italy") && daysLabel(d) === "8泊9日") || (pool.length ? pool[Math.floor(Date.now() / 864e5) % pool.length] : null);
  if (pick) {
    $("feat").innerHTML = `<a class="feat" href="#a-${esc(pick.id)}" style="background-image:url('${esc(thumbOf(pick))}')"><span class="tag">PICK UP</span>
      <div class="in"><div class="pl">${PIN} ${esc(placeJp(pick))}</div><div class="tt">${esc(titleOf(pick))}</div>
      <div class="row"><div class="au"><img src="${esc(avatarOf(pick.authorId))}" alt="">${esc(authorName(pick))}${pick.dateStart ? "・" + esc(pick.dateStart.slice(0, 4) + "年" + Number(pick.dateStart.slice(5, 7)) + "月") : ""}</div></div></div></a>`;
  }
  $("newList").innerHTML = trips.filter((d) => d !== pick).slice(0, 10).map(cardH).join("") || '<p class="loading">まだ記事がありません</p>';
  $("jpSec").hidden = !jp.length; $("jpList").innerHTML = jp.slice(0, 10).map(cardH).join("");
  $("trSec").hidden = !tr.length; $("trList").innerHTML = tr.slice(0, 10).map(cardH).join("");
}
document.querySelectorAll("#htabs button").forEach((b) => b.addEventListener("click", () => homeTab(+b.dataset.ht)));
function homeTab(i) {
  haptic();
  [...$("htabs").children].forEach((b, j) => b.classList.toggle("on", i === j));
  $("recPane").hidden = !!i; $("folPane").hidden = !i;
  if (i) renderFeed();
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
  const AIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z"/></svg>';
  box.innerHTML = list.slice(0, 30).map((d) => {
    const imgs = (d.heroUrls && d.heroUrls.length ? d.heroUrls : [thumbOf(d)]).filter(Boolean);
    return `<article class="post">
      <div class="ph"><a href="#u-${esc(d.authorId)}"><img src="${esc(avatarOf(d.authorId))}" alt=""></a><div><b>${esc(authorName(d))}</b><small>${esc(ago(pubSec(d)))}・${esc(placeJp(d))}</small></div></div>
      <div class="pgn"><a class="pg" href="#a-${esc(d.id)}">${imgs.map((u) => `<div style="background-image:url('${esc(u)}')"></div>`).join("")}</a>${imgs.length > 1 ? `<span>1/${imgs.length}</span>` : ""}</div>
      <div class="acts"><a href="#w-ask">${AIc}AI</a><button class="sv ${saved.has(d.id) ? "on" : ""}" data-save="${esc(d.id)}">${SAVE}</button></div>
      <div class="pc"><div class="pl">${esc(placeJp(d))}${daysLabel(d) ? "・" + esc(daysLabel(d)) : ""}</div><h3>${esc(titleOf(d))}</h3>${d.lead ? `<p>${esc(String(d.lead).replace(/\n+/g, " "))}</p>` : ""}<a class="more" href="#a-${esc(d.id)}">旅程を見る →</a></div>
    </article>`;
  }).join("");
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
function drawSheet() {
  const key = sheetKey;
  const base = ALL.filter((d) => match(d, key));
  const cntC = (v) => base.filter((d) => (d.countries || []).includes(v)).length;
  const cntP = (p) => base.filter((d) => (d.countries || []).includes("japan") && derivePrefs(d).includes(p)).length;
  const cntO = (v) => base.filter((d) => key === "style" ? hasStyle(d, v) : key === "budget" ? (() => { const t = costTotalOf(d) / 1e4; return t > BUD[v][0] && t <= BUD[v][1]; })() : (() => { const n = nDays(d); return n && n > DAYS[v][0] && n <= DAYS[v][1]; })()).length;
  const has = (arr, v) => arr.some((x) => String(x) === String(v));
  const row = (k, v, label, n) => `<button class="frow ${has(sel[k], v) ? "on" : ""} ${n ? "" : "zero"}" data-k="${k}" data-v="${esc(v)}"><span class="bx"></span><span class="nm">${esc(label)}</span><small>${n || ""}</small></button>`;
  const all = (k, vals, label) => { const on = vals.length && vals.every((v) => has(sel[k], v)); return `<button class="fall ${on ? "on" : ""}" data-all="${k}" data-vals="${esc(vals.join("|"))}"><span class="bx"></span>${label}</button>`; };
  let body = "";
  if (key === "country") {
    body += `<div class="fsec"><div class="fhead"><b>日本（都道府県）</b>${all("country", ["japan"], "日本すべて")}</div>`
      + PREF_GROUPS.map((g) => `<p class="fsub">${esc(g.r)}　${all("pref", g.list, "まとめて")}</p><div class="fgrid">${g.list.map((p) => row("pref", p, p, cntP(p))).join("")}</div>`).join("") + "</div>";
    const regions = [...new Set(COUNTRIES.filter((c) => c.v !== "japan").map((c) => c.r))];
    body += regions.map((r) => { const cs = COUNTRIES.filter((c) => c.r === r && c.v !== "japan"); return `<div class="fsec"><div class="fhead"><b>${esc(REGION_JP[r] || r)}</b>${all("country", cs.map((c) => c.v), "エリアごと選ぶ")}</div><div class="fgrid">${cs.map((c) => row("country", c.v, c.jp, cntC(c.v))).join("")}</div></div>`; }).join("");
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
function renderSearch() {
  $("qx").style.display = state.q ? "grid" : "none";
  renderFilters();
  const list = ALL.filter((d) => match(d));
  if (state.map) { renderMap(list); return; }
  $("results").innerHTML = `<div class="cnt"><span><b>${list.length}件</b>の旅</span><span>新しい順</span></div>` +
    (list.length ? `<div class="ogrid">${list.map(gridCard).join("")}</div>` : `<div class="empty">条件に合う旅がありません<br><br><button class="chip" id="clr" style="margin:auto">条件をクリア</button></div>`);
  const clr = $("clr"); if (clr) clr.onclick = () => { Object.assign(state, { q: "", country: [], pref: [], budget: [], days: [], style: [] }); $("q").value = ""; renderSearch(); };
}
$("q").addEventListener("input", (e) => { state.q = e.target.value; renderSearch(); });
$("qx").addEventListener("click", (e) => { e.preventDefault(); $("q").value = ""; state.q = ""; renderSearch(); });
$("fbars").innerHTML = [22, 18, 26, 30, 24, 16, 12, 20, 28, 34, 26, 19].map((h) => `<i class="${h <= 12 ? "lo" : ""}" style="height:${h}px"></i>`).join("");

// ---------- 積み重ねページ ----------
// 記事(#a-ID)・プロフィール(#u-UID)・DM一覧(#dm)・DM(#dm-UID)・埋め込みページ(#w-名前) を右から重ねて開く。
// 戻るボタン／左端スワイプは history.back() で閉じる。
const STACK = [];
const FRAMES = { "post": ["/post.html", "旅程を投稿"], "post-transit": ["/post-transit.html", "トランジットを投稿"], "account": ["/account.html", "設定"], "notify": ["/account.html#notifications", "通知"], "ask": ["/ask.html", "AI相談"], "flights": ["/flights.html", "航空券の相場"] };
const BACK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
function isPageHash(h) { return /^#(a-|u-|dm|w-|f-|x-|n$|p$|p-)/.test(h); }
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
  el.className = "page"; el.style.zIndex = 40 + STACK.length;
  $("pages").appendChild(el);
  STACK.push({ hash: h, el });
  $("tab").classList.add("hide"); $("aiCmp").hidden = true;
  swipeBack(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("open")));
  const m = h.match(/^#(a|u|dm|w|f|x|n|p)-?(.*)$/);
  const kind = m[1], arg = decodeURIComponent(m[2] || "");
  if (kind === "a") pageArticle(el, arg);
  else if (kind === "u") pageUser(el, arg);
  else if (kind === "dm" && !arg) pageInbox(el);
  else if (kind === "dm") pageThread(el, arg);
  else if (kind === "w") pageFrame(el, arg);
  else if (kind === "f") pageFollows(el, arg);
  else if (kind === "x" && arg === "profile") pageProfileEdit(el);
  else if (kind === "x" && arg === "login") pageLogin(el);
  else if (kind === "x") pageBlocks(el);
  else if (kind === "n") pageNotify(el);
  else if (kind === "p") { const entry = STACK[STACK.length - 1]; import("./post.js?v=202611191528").then((M) => M.pagePost(el, arg, postCtx())).then((c) => { if (c) entry.cleanup = c; }).catch((e) => { console.error(e); el.innerHTML = bar("旅程を投稿") + '<div class="ps under2"><p class="empty">投稿画面を開けませんでした</p></div>'; }); }
  haptic();
}
function popPage() {
  const top = STACK.pop(); if (!top) return;
  if (top.cleanup) try { top.cleanup(); } catch (e) {}
  top.el.classList.remove("open");
  setTimeout(() => top.el.remove(), 380);
  if (!STACK.length) { $("tab").classList.remove("hide"); $("aiCmp").hidden = curTab !== "ai"; }
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
async function pageArticle(el, id) {
  el.innerHTML = '<div class="ps"><p class="loading" style="padding-top:120px">読み込み中…</p></div>';
  let d = BY[id];
  if (!d) { try { const s = await getDoc(doc(db, "articles", id)); if (s.exists()) { d = { id: s.id, ...s.data() }; BY[id] = d; } } catch (e) {} }
  if (!d) { el.innerHTML = bar("記事") + '<div class="ps under2"><p class="empty">記事が見つかりませんでした</p></div>'; return; }
  cur = d;
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
      ${d.type === "transit" && d.body ? `<div class="dh"><h2>トランジットの記録</h2></div><p class="ph2">${para(d.body)}</p>` : ""}
      ${flights.length ? `<div class="dh"><h2>${mv ? "移動" : "航空券"}</h2></div><div class="rows2">${flights.map((f, i) => `<div class="r2"><small>${mv ? "区間" : "航路"}${i + 1}</small><div>${esc(f.route || "")}<span>${esc([f.airline].filter(Boolean).join("・"))}</span></div>${f.price ? `<b>${yen(f.price)}</b>` : ""}</div>`).join("")}
        ${d.flightWhen ? `<div class="r2"><small>予約時期</small><div>${esc(d.flightWhen)}</div></div>` : ""}${d.flightSite ? `<div class="r2"><small>予約サイト</small><div>${esc(d.flightSite)}</div></div>` : ""}</div>` : ""}
      ${services.length ? `<div class="dh"><h2>利用サービス</h2></div><div class="rows2">${services.map((x) => `<div class="r2"><small>${esc(x.label || "")}</small><div>${(x.items || []).map(esc).join("<br>")}</div></div>`).join("")}</div>` : ""}
      ${hasRoute ? `<div class="dh"><h2>ルートマップ</h2></div><div class="rtabs" id="rtabs"></div><div id="rmap"></div>` : ""}
      ${days.length ? `<div class="dh"><h2>旅の記録</h2><small style="color:var(--muted);font-size:12px">${days.length}日間</small></div>
      <div class="days">${days.map((x, i) => {
        const ph = x.photoUrls || [];
        const has = String(x.text || "").trim() || ph.length;
        return `<div class="day"><button ${has ? "data-day" : ""}><div class="th ${ph[0] ? "" : "no"}" style="${ph[0] ? `background-image:url('${esc(ph[0])}')` : ""}">${ph[0] ? "" : i + 1}</div><div><small>DAY ${i + 1}${x.date ? "　" + esc(x.date) : ""}</small><p>${esc(x.summary || "")}</p></div>${has ? '<span class="pm">＋</span>' : ""}</button>
          <div class="body"><div class="bin">${ph.length ? `<div class="dpw"><div class="dphotos">${ph.map((u, k) => `<img src="${esc(u)}" alt="" loading="lazy" data-dv="${i}" data-k="${k}">`).join("")}</div>${ph.length > 1 ? `<span class="dpc">1/${ph.length}</span>` : ""}</div>` : ""}${String(x.text || "").trim() ? `<p class="ph">${para(x.text)}</p>` : ""}</div></div></div>`;
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
  fitRatio(el.querySelector(".gal"), imgs[0], true);
  el.querySelectorAll(".dphotos").forEach((g) => { const im = g.querySelector("img"); if (im) fitRatio(g, im.getAttribute("src")); });
  const gal = el.querySelector(".gal");
  gal.onscroll = () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); el.querySelectorAll(".dots i").forEach((x, j) => x.classList.toggle("on", i === j)); };
  gal.querySelectorAll("[data-hv]").forEach((x) => (x.onclick = () => openViewer(imgs, +x.dataset.hv)));
  el.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { b.parentNode.classList.toggle("open"); haptic(); }));
  el.querySelectorAll("[data-dv]").forEach((im) => (im.onclick = () => openViewer(days[+im.dataset.dv].photoUrls, +im.dataset.k)));
  el.querySelectorAll(".dphotos").forEach((g) => (g.onscroll = () => { const c = g.parentNode.querySelector(".dpc"); if (c) c.textContent = `${Math.round(g.scrollLeft / g.clientWidth) + 1}/${g.children.length}`; }));
  el.querySelectorAll("[data-hl]").forEach((b) => (b.onclick = () => {
    const i = +b.dataset.hl, c = crow[i], barEl = el.querySelector(".bar"), p = el.querySelector(".pct"); haptic();
    [...barEl.children].forEach((x, j) => (x.style.opacity = j === i ? 1 : 0.25));
    p.style.display = "block"; p.textContent = `${c[0]}は全体の${Math.round((c[1] / total) * 100)}%（${yen(c[1])}）`;
    clearTimeout(b._t); b._t = setTimeout(() => { [...barEl.children].forEach((x) => (x.style.opacity = 1)); p.style.display = "none"; }, 2600);
  }));
  setTimeout(() => el.querySelectorAll(".bar span").forEach((x) => (x.style.flex = x.dataset.f)), 380);
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
function fitRatio(box, url, hero) {
  if (!box || !url) return;
  const im = new Image();
  im.onload = () => {
    const r = Math.min(1.91, Math.max(0.8, im.naturalWidth / im.naturalHeight));
    box.style.height = "auto"; box.style.aspectRatio = String(r);
  };
  im.src = url;
}

// ルートマップ（Leaflet を必要なときだけ読み込む）
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((ok, ng) => {
    const c = document.createElement("link"); c.rel = "stylesheet"; c.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(c);
    const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = ok; s.onerror = ng; document.head.appendChild(s);
  });
}
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
  const map = L.map(box, { scrollWheelZoom: false, minZoom: 2, attributionControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 18 }).addTo(map);
  const ms = pts.map((p) => { const m = L.circleMarker([p.lat, p.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#e2683b", fillOpacity: 1 }).addTo(map).bindPopup((p.n ? `DAY ${p.n}` : "") + (p.name ? "　" + esc(p.name) : "")); m._c = p.c; return m; });
  const fit = (c) => { const sub = c ? ms.filter((m) => m._c === c) : ms; if (sub.length) map.fitBounds(L.featureGroup(sub).getBounds().pad(0.3), { maxZoom: 10 }); };
  fit("");
  const used = [...new Set(pts.map((p) => p.c).filter(Boolean))];
  const tabs = box.parentNode.querySelector("#rtabs");
  if (tabs && used.length > 1) {
    tabs.innerHTML = `<button class="on" data-rc="">すべて</button>` + used.map((c) => `<button data-rc="${esc(c)}">${esc((cinfo(c) || {}).jp || c)}</button>`).join("");
    tabs.querySelectorAll("button").forEach((b) => (b.onclick = () => { tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); fit(b.dataset.rc); haptic(); }));
  } else if (tabs) tabs.remove();
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
    <button class="srow" data-sa="copy">${ICL}リンクをコピー</button>
    <button class="srow" data-sa="other">${ICO}ほかのアプリで共有</button></div>`;
  $("ov").classList.add("show"); $("bs").classList.add("show");
  const q = (a) => $("bs").querySelector(`[data-sa="${a}"]`);
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
  try { const { makeStoryImage } = await import("./story.js?v=202611191528"); file = await makeStoryImage(d, url, storyEyebrow(d)); } catch (e) { console.warn(e); }
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
async function wireArticleLike(el, d) {
  const b = el.querySelector("[data-like]"), n = el.querySelector("[data-lc]");
  let cnt = 0, mine = false;
  try { cnt = (await getCountFromServer(collection(db, "articles", d.id, "likes"))).data().count; } catch (e) {}
  if (me) { try { mine = (await getDoc(doc(db, "articles", d.id, "likes", me))).exists(); } catch (e) {} }
  const paint = () => { b.classList.toggle("liked", mine); n.textContent = cnt || ""; };
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
      else { await setDoc(doc(db, "users", me, "following", uid), { createdAt: serverTimestamp() }); await setDoc(doc(db, "users", uid, "followers", me), { createdAt: serverTimestamp() }); on = true; notify({ toUid: uid, type: "follow" }); }
      haptic(); paint(); onChange && onChange(on);
    } catch (e) { toast("フォローできませんでした"); }
    btn.disabled = false;
  };
}

// SNS（Instagram・X・note・TikTok・YouTube）。ユーザー名でもURLでも入力できる
const SNS = [["instagram", "Instagram", (h) => `https://www.instagram.com/${h}/`], ["x", "X", (h) => `https://x.com/${h}`], ["note", "note", (h) => `https://note.com/${h}`], ["tiktok", "TikTok", (h) => `https://www.tiktok.com/@${h}`], ["youtube", "YouTube", (h) => `https://www.youtube.com/@${h}`]];
function snsUrl(key, v) { v = String(v || "").trim(); if (!v) return ""; if (/^https?:\/\//.test(v)) return v; const f = SNS.find((x) => x[0] === key); return f ? f[2](v.replace(/^@/, "")) : ""; }
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
    <div class="uhead"><div class="row"><img src="${esc(p.photoURL || DEF_AV)}" alt=""><div class="st"><div><b>${posts.length}</b><span>投稿</span></div><a href="#f-followers-${esc(uid)}"><b data-fc>—</b><span>フォロワー</span></a><a href="#f-following-${esc(uid)}"><b data-gc>—</b><span>フォロー</span></a></div></div>
      <h1>${esc(p.nickname || "旅人")}</h1>${p.bio ? `<p>${esc(p.bio)}</p>` : ""}${snsLinks(p)}
      <div class="ub" data-ub></div></div>
    <div class="sh" style="padding-top:26px"><h2>投稿</h2></div>
    ${posts.length ? `<div class="ogrid">${posts.map(gridCard).join("")}</div>` : '<p class="empty">まだ公開された投稿はありません</p>'}
  </div>`;
  const cnt = async () => {
    try { el.querySelector("[data-fc]").textContent = (await getCountFromServer(collection(db, "users", uid, "followers"))).data().count; } catch (e) {}
    try { el.querySelector("[data-gc]").textContent = (await getCountFromServer(collection(db, "users", uid, "following"))).data().count; } catch (e) {}
  };
  cnt();
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
  el.innerHTML = bar("メッセージ") + `<div class="ps under2 nb"><div class="htabs" style="position:static;margin-top:0;padding-top:4px"><button class="on" data-dt="0">DM</button><button data-dt="1">コミュニティ</button></div><div id="ilist"><p class="loading">読み込み中…</p></div><div id="clist2" hidden></div></div>`;
  el.querySelectorAll("[data-dt]").forEach((b) => (b.onclick = () => { const i = +b.dataset.dt; el.querySelectorAll("[data-dt]").forEach((x, j) => x.classList.toggle("on", i === j)); el.querySelector("#ilist").hidden = !!i; el.querySelector("#clist2").hidden = !i; }));
  el.querySelector("#clist2").innerHTML = '<p class="comhead">行き先ごとの部屋で、行った人・これから行く人が相談し合える場所です。<span class="soon">COMING SOON</span></p>';
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
  foot.innerHTML = '<form class="cmp"><textarea rows="1" maxlength="2000" placeholder="メッセージを入力"></textarea><button disabled aria-label="送信"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg></button></form>';
  const form = foot.querySelector("form"), ta = form.querySelector("textarea"), sb = form.querySelector("button");
  ta.oninput = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; sb.disabled = !ta.value.trim(); };
  const unsub = F.onSnapshot(F.query(collection(convRef, "messages"), F.orderBy("createdAt", "asc")), (snap) => {
    let h = "", last = "";
    snap.forEach((s) => {
      const m = s.data(), t = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : null;
      const day = t ? `${t.getMonth() + 1}/${t.getDate()}` : "";
      if (day && day !== last) { h += `<div class="day-sep">${day}</div>`; last = day; }
      h += `<div class="msg ${m.senderId === me ? "u" : "a"}">${esc(m.text)}</div>`;
    });
    msgs.innerHTML = h || '<p class="fol-empty">最初のメッセージを送ってみましょう。</p>';
    requestAnimationFrame(() => (msgs.scrollTop = msgs.scrollHeight));
    F.updateDoc(convRef, { ["unread." + me]: 0 }).catch(() => {});
  });
  STACK[STACK.length - 1].cleanup = unsub;
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

// ---------- 投稿・編集（app/post.js）に渡す道具 ----------
function postCtx() {
  return {
    me, bar, back, toast, haptic, loadLeaflet,
    sheet: openBS, closeSheet,
    onSaved: (id) => { delete BY[id]; loadMyPosts(); },
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
  myTab = myTab || "trips";
  box.innerHTML = `<div class="mehead"><b>${esc(p.nickname || "旅人")}</b><button class="hb" id="meMenu" aria-label="メニュー"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div>
    <div class="uhead"><div class="row"><img src="${esc(p.photoURL || DEF_AV)}" alt="">
      <div class="st"><div><b>${mine.length}</b><span>投稿</span></div><a href="#f-followers-${esc(me)}"><b data-mfc>—</b><span>フォロワー</span></a><a href="#f-following-${esc(me)}"><b data-mgc>—</b><span>フォロー</span></a></div></div>
      ${p.bio ? `<p>${esc(p.bio)}</p>` : ""}${snsLinks(p)}
      <div class="ub"><a class="btn-g" href="#x-profile">プロフィールを編集</a><button class="btn-g" data-go="saved">保存した旅</button></div></div>
    <div class="mtabs" id="mtabs"><button class="on" data-mt="trips">旅程<b data-mn="trips"></b></button><button data-mt="transit">トランジット<b data-mn="transit"></b></button><button data-mt="collab">共同投稿<b data-mn="collab"></b><i id="invDot" hidden></i></button></div>
    <div id="myPosts"><p class="loading">読み込み中…</p></div>`;
  box.querySelectorAll("[data-mt]").forEach((b) => (b.onclick = () => { myTab = b.dataset.mt; box.querySelectorAll("[data-mt]").forEach((x) => x.classList.toggle("on", x === b)); drawMyPosts(); haptic(); }));
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
  MY = { trips: owned.filter((d) => d.type !== "transit"), transit: owned.filter((d) => d.type === "transit"), collab: docs.filter((d) => d._collab || (d.coAuthorIds || []).length || (d.coAuthorInvites || []).length), invites };
  await loadProfiles(invites.map((d) => d.authorId));
  ["trips", "transit", "collab"].forEach((k) => { const n = document.querySelector(`[data-mn="${k}"]`); if (n) n.textContent = MY[k].length || ""; });
  const dot = $("invDot"); if (dot) dot.hidden = !invites.length;
  drawMyPosts();
}
function myCard(d) {
  const st = STATUS_LABEL[d.status] ? d.status : "pending";
  return `<div class="mycard"><a class="oc" href="#a-${esc(d.id)}" style="background-image:url('${esc(thumbOf(d))}')">${ovText({ ...d, title: d.title || "(無題)" })}</a>
    <div class="mymeta">${st !== "published" ? `<span class="pst s-${st}">${STATUS_LABEL[st]}</span>` : ""}${d._collab ? '<span class="pst">共同投稿</span>' : ""}<button class="pmn" data-pm="${esc(d.id)}" aria-label="メニュー">…</button></div></div>`;
}
function drawMyPosts() {
  const box = $("myPosts"); if (!box) return;
  const list = MY[myTab] || [];
  const empty = { trips: '<p class="empty">まだ旅程がありません<br><br><a class="btn-s" href="#p">旅程を投稿する</a></p>', transit: '<p class="empty">まだトランジット記事がありません<br><br><a class="btn-s" href="#w-post-transit">トランジットを投稿する</a></p>', collab: '<p class="empty">共同投稿はまだありません。<br>投稿の編集画面から、一緒に旅した友達を招待できます。</p>' };
  let inv = "";
  if (myTab === "collab" && MY.invites.length) {
    inv = `<p class="fsub" style="margin:14px 20px 6px">招待 ${MY.invites.length}件</p>` + MY.invites.map((d) => `<div class="cv2"><a href="#a-${esc(d.id)}"><img src="${esc(thumbOf(d))}" alt="" style="border-radius:2px"></a><span class="m"><b>${esc(d.title || "(無題)")}</b><p>${esc(authorName(d))}さんから共同投稿の招待</p></span><button class="btn-s" data-inv="accept" data-id="${esc(d.id)}">承認</button><button class="btn-g" data-inv="decline" data-id="${esc(d.id)}">辞退</button></div>`).join("");
  }
  box.innerHTML = inv + (list.length ? `<div class="ogrid">${list.map(myCard).join("")}</div>` : (inv ? "" : empty[myTab]));
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
// 記事メニュー（サイトのマイページと同じ：編集／共同投稿者／投稿者を譲る／非表示・再公開／削除・抜ける）
async function postMenu(id) {
  let d = BY[id];
  if (!d) return;
  const collab = d.authorId !== me;
  const people = (d.coAuthorIds || []).length + (d.coAuthorInvites || []).length;
  const it = [];
  it.push(`<a class="srow" href="${d.type === "transit" ? "#w-edit-" : "#p-"}${esc(id)}">編集</a>`);
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
    delete BY[d.id]; loadMyPosts(); loadAll();
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
  try { (await getDocs(collection(db, "users", me, "notifications"))).forEach((x) => items.push({ id: x.id, ...x.data() })); } catch (e) {}
  items.sort((a, b) => ((b.createdAt || {}).seconds || 0) - ((a.createdAt || {}).seconds || 0));
  items = items.slice(0, 80);
  await loadProfiles(items.map((n) => n.fromUid).filter(Boolean));
  box.innerHTML = items.length ? items.map((n) => {
    const name = `<b>${esc(n.fromNickname || (PROF[n.fromUid] || {}).nickname || "ある旅人")}</b>`, t = esc(n.articleTitle || "旅程");
    let txt, href;
    if (n.type === "follow") { txt = `${name}さんがあなたをフォローしました`; href = "#u-" + esc(n.fromUid || ""); }
    else if (n.type === "dm") { txt = `${name}さんからメッセージが届きました`; href = "#dm-" + esc(n.fromUid || ""); }
    else if (n.type === "handover") { txt = `${name}さんから「${t}」の投稿者を引き継ぎました`; href = "#a-" + esc(n.articleId || ""); }
    else if (n.type === "collab") { txt = `${name}さんから「${t}」の共同投稿に招待されました`; href = "#a-" + esc(n.articleId || ""); }
    else if (n.type === "comment") { txt = `${name}さんが「${t}」にコメントしました`; href = "#a-" + esc(n.articleId || ""); }
    else { txt = `${name}さんがあなたの旅程「${t}」にいいねしました`; href = "#a-" + esc(n.articleId || ""); }
    return `<a class="nrow ${n.read ? "" : "un"}" href="${href}"><img src="${esc(avatarOf(n.fromUid))}" alt=""><span class="nt">${txt}<small>${esc(ago((n.createdAt || {}).seconds))}</small></span></a>`;
  }).join("") : '<p class="fol-empty">通知はまだありません。</p>';
  // 開いたら既読にする
  const un = items.filter((n) => !n.read);
  if (un.length) {
    try { const F = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"); const b = F.writeBatch(db); un.forEach((n) => b.update(doc(db, "users", me, "notifications", n.id), { read: true })); await b.commit(); $("bellDot").hidden = true; } catch (e) {}
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
    <label class="pfl">自己紹介<textarea id="pfBio" rows="4" maxlength="300">${esc(p.bio || "")}</textarea></label>
    <p class="pfh">SNS（ユーザー名 または URL）</p>
    ${SNS.map(([k, l]) => `<label class="pfl">${l}<input data-sns="${k}" autocapitalize="off" autocorrect="off" placeholder="${k === "note" ? "noteのID" : "@なしのユーザー名"}" value="${esc(p[k] || "")}"></label>`).join("")}
    <p class="pfm" id="pfMsg"></p></div></div>`;
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
      await setDoc(doc(db, "publicProfiles", me), { nickname: nick, bio, ...sns, ...(p.photoURL ? { photoURL: p.photoURL } : {}) }, { merge: true });
      await setDoc(doc(db, "users", me), { nickname: nick, bio, ...sns }, { merge: true });
      PROF[me] = { ...(PROF[me] || {}), nickname: nick, bio, ...sns };
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
function aiBubble(m) {
  if (m.role === "user") return `<div class="msg u">${esc(m.content)}</div>`;
  const arts = (m.articles || []).map((a) => `<a class="aref" href="#a-${esc(a.id)}">${a.country ? `<em>${esc(a.country)}</em>` : ""}<span>${esc(a.title)}</span><b>→</b></a>`).join("");
  const fare = m.fares ? '<a class="aref" href="#w-flights"><em>航空券</em><span>相場カレンダーで月ごとの値段を見る</span><b>→</b></a>' : "";
  return `<div class="msg a">${m.html || esc(m.content).replace(/\n/g, "<br>")}${arts || fare ? `<div class="arefs">${fare}${arts ? '<p class="arh">詳しくはこちらの記事を参考に</p>' + arts : ""}</div>` : ""}</div>`;
}
function aiRender(extra = "") {
  $("aiIntro").hidden = !!aiConv.length; $("aiNew").hidden = !aiConv.length;
  $("aiLog").innerHTML = aiConv.map(aiBubble).join("") + extra;
  requestAnimationFrame(() => $("ai").scrollTo({ top: 1e6, behavior: "smooth" }));
}
async function aiSend(q) {
  q = (q || "").trim(); if (!q || aiBusy) return;
  if (!me) { aiRender(aiBubble({ role: "assistant", html: '相談するには<a href="#x-login" style="color:var(--green);font-weight:700">ログイン</a>が必要です。' })); return; }
  aiBusy = true; $("aiSend").disabled = true;
  aiConv.push({ role: "user", content: q });
  aiRender('<div class="msg a"><span class="typing"><i></i><i></i><i></i></span> 旅程記事を読んでいます</div>');
  try {
    const token = await auth.currentUser.getIdToken();
    const history = aiConv.slice(-20).map((m) => (m.role === "user" ? { role: "user", content: m.content } : { role: "assistant", content: m.content, articleIds: (m.articles || []).map((a) => a.id), usedFares: !!m.fares }));
    const r = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify({ messages: history }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(String(r.status));
    aiConv.push({ role: "assistant", content: data.answer || "", articles: data.articles || [], fares: !!data.fares });
    aiSave(); aiRender();
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

onAuthStateChanged(auth, async (u) => {
  me = u ? u.uid : null;
  saved = new Set();
  if (me) {
    try { (await getDocs(collection(db, "users", me, "saves"))).forEach((s) => saved.add(s.id)); } catch (e) {}
    await loadProfiles([me]);
    try {
      const n = await getCountFromServer(query(collection(db, "users", me, "notifications"), where("read", "==", false)));
      $("bellDot").hidden = !n.data().count;
    } catch (e) {}
    try {
      const cs = await getDocs(query(collection(db, "conversations"), where("participants", "array-contains", me)));
      let un = 0; cs.forEach((c) => { un += Number(((c.data().unread || {})[me]) || 0); });
      const b = $("dmBadge"); b.hidden = !un; b.textContent = un > 99 ? "99+" : un;
    } catch (e) {}
  }
  if (curTab === "me") renderMe();
  if (!$("folPane").hidden) renderFeed();
  if (curTab === "ai") { aiLoad(); aiRender(); }
});

renderTab();
loadAll().then(route);
