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
  STYLES, COST_ITEMS, DAYS_OPT, REGION_JP
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
  if ($("article").classList.contains("open")) closeArticle(true);
  if (k === curTab && !Object.keys(opt).length) { $(k).scrollTo({ top: 0, behavior: "smooth" }); return; }
  curTab = k; haptic();
  VIEWS.forEach((t) => ($(t).hidden = t !== k));
  renderTab();
  if (k === "search") {
    if (opt.country) state.country = opt.country;
    if (opt.style) state.style = opt.style;
    renderSearch();
  }
  if (k === "me") renderMe();
  if (k === "saved") renderSaved();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]");
  if (!b) return;
  e.preventDefault();
  go(b.dataset.go, { country: b.dataset.country, style: b.dataset.style });
});

// ---------- ホーム ----------
function renderHome() {
  const trips = ALL.filter((d) => d.type !== "transit" && !isDomestic(d));
  const jp = ALL.filter((d) => d.type !== "transit" && isDomestic(d));
  const tr = ALL.filter((d) => d.type === "transit");
  // ピックアップ：写真のある海外の旅から、日替わりで1本
  const pool = trips.filter((d) => thumbOf(d));
  const pick = pool.length ? pool[Math.floor(Date.now() / 864e5) % pool.length] : null;
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
  if (!me) { box.innerHTML = '<p class="fol-empty">ログインすると、フォローしている人の新しい旅がここに流れます。<br><br><a href="/account.html" style="color:var(--green);font-weight:700">ログイン・新規登録 →</a></p>'; return; }
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
      <div class="ph"><img src="${esc(avatarOf(d.authorId))}" alt=""><div><b>${esc(authorName(d))}</b><small>${esc(ago(pubSec(d)))}・${esc(placeJp(d))}</small></div></div>
      <div class="pgn"><a class="pg" href="#a-${esc(d.id)}">${imgs.map((u) => `<div style="background-image:url('${esc(u)}')"></div>`).join("")}</a>${imgs.length > 1 ? `<span>1/${imgs.length}</span>` : ""}</div>
      <div class="acts"><a href="/ask.html">${AIc}AI</a><button class="sv ${saved.has(d.id) ? "on" : ""}" data-save="${esc(d.id)}">${SAVE}</button></div>
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
const BUD = [[5, "〜5万円"], [10, "〜10万円"], [15, "〜15万円"], [20, "〜20万円"], [30, "〜30万円"], [999, "30万円〜"]];
const DAYS = [[1, "日帰り"], [3, "〜3日"], [7, "〜1週間"], [14, "〜2週間"], [999, "2週間〜"]];
const state = { q: "", country: null, budget: null, days: null, style: null };
function nDays(d) {
  if (d.dateStart && d.dateEnd) return Math.round((new Date(d.dateEnd) - new Date(d.dateStart)) / 864e5) + 1;
  return null;
}
function match(d) {
  const q = state.q.trim().toLowerCase();
  if (q) {
    const hay = [titleOf(d), d.lead, placeJp(d), placeEn(d), d.airport, ...(d.days || []).map((x) => x && x.summary)].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (state.country && !(d.countries || []).includes(state.country)) return false;
  if (state.style && !(d.styles || []).includes(state.style) && !(state.style === "transit" && d.type === "transit")) return false;
  if (state.budget != null) {
    const t = costTotalOf(d) / 1e4; if (!t) return false;
    const i = state.budget, max = BUD[i][0], min = i ? BUD[i - 1][0] : 0;
    if (max === 999 ? t <= min : t > max) return false;
  }
  if (state.days != null) {
    const n = nDays(d); if (!n) return false;
    const i = state.days, max = DAYS[i][0], min = i ? DAYS[i - 1][0] : 0;
    if (max === 999 ? n <= min : n > max || (i > 0 && n <= min)) return false;
  }
  return true;
}
function renderSearch() {
  $("qx").style.display = state.q ? "grid" : "none";
  const countries = [...new Set(ALL.flatMap((d) => d.countries || []))].map((v) => cinfo(v)).filter(Boolean).sort((a, b) => a.jp.localeCompare(b.jp, "ja"));
  const styles = STYLES.filter((s) => ALL.some((d) => (d.styles || []).includes(s.v) || (s.v === "transit" && d.type === "transit")));
  const sel = (key, label, opts) => {
    const v = state[key];
    const cur = v == null ? "すべて" : (opts.find((o) => String(o[0]) === String(v)) || [0, "すべて"])[1];
    return `<label class="dd ${v != null ? "on" : ""}"><small>${label}</small><span>${esc(cur)}</span>${CH}<select data-f="${key}"><option value="">すべて</option>${opts.map(([val, l]) => `<option value="${esc(val)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`;
  };
  $("filters").innerHTML = sel("country", "国・地域", countries.map((c) => [c.v, c.jp])) + sel("budget", "予算", BUD.map((b, i) => [i, b[1]])) + sel("days", "日数", DAYS.map((d, i) => [i, d[1]])) + sel("style", "スタイル", styles.map((s) => [s.v, s.tag]));
  $("filters").querySelectorAll("select").forEach((s) => s.addEventListener("change", () => {
    const k = s.dataset.f, v = s.value; haptic();
    state[k] = v === "" ? null : (k === "budget" || k === "days" ? Number(v) : v);
    renderSearch();
  }));
  const list = ALL.filter(match);
  $("results").innerHTML = `<div class="cnt"><span><b>${list.length}件</b>の旅</span><span>新しい順</span></div>` +
    (list.length ? `<div class="ogrid">${list.map(gridCard).join("")}</div>` : `<div class="empty">条件に合う旅がありません<br><br><button class="chip" id="clr" style="margin:auto">条件をクリア</button></div>`);
  const clr = $("clr"); if (clr) clr.onclick = () => { Object.assign(state, { q: "", country: null, budget: null, days: null, style: null }); $("q").value = ""; renderSearch(); };
}
$("q").addEventListener("input", (e) => { state.q = e.target.value; renderSearch(); });
$("qx").addEventListener("click", (e) => { e.preventDefault(); $("q").value = ""; state.q = ""; renderSearch(); });
$("fbars").innerHTML = [22, 18, 26, 30, 24, 16, 12, 20, 28, 34, 26, 19].map((h) => `<i class="${h <= 12 ? "lo" : ""}" style="height:${h}px"></i>`).join("");

// ---------- 記事 ----------
let cur = null;
async function openArticle(id) {
  let d = BY[id];
  if (!d) {
    try { const s = await getDoc(doc(db, "articles", id)); if (s.exists()) { d = { id: s.id, ...s.data() }; BY[id] = d; } } catch (e) {}
  }
  if (!d) { toast("記事が見つかりませんでした"); return; }
  cur = d; haptic();
  await loadProfiles([d.authorId, ...(d.coAuthorIds || [])]);
  const imgs = (d.heroUrls && d.heroUrls.length ? d.heroUrls : [thumbOf(d)]).filter(Boolean);
  const tags = [placeJp(d), daysLabel(d), ...(d.styles || []).map((v) => (STYLES.find((s) => s.v === v) || {}).tag)].filter(Boolean);
  const stars = d.difficulty ? "★".repeat(d.difficulty) + "☆".repeat(5 - d.difficulty) : "";
  const facts = d.type === "transit"
    ? [["空港・都市", d.airport], ["乗り継ぎ", d.layover ? d.layover + "時間" : ""]]
    : [["通貨", d.currency], ["言語", d.language], ["治安", d.safety], ["難易度", stars]];
  const costs = d.costs || {}, total = costTotalOf(d);
  const crow = COST_ITEMS.map((it) => [it.l, Number(costs[it.k] || 0)]).filter((c) => c[1] > 0).sort((a, b) => b[1] - a[1]);
  const days = d.days || [];
  const authors = [d.authorId, ...(d.coAuthorIds || [])].filter(Boolean);
  $("article").innerHTML = `<div style="position:relative"><div class="gal" id="gal">${imgs.map((u) => `<div style="background-image:url('${esc(u)}')"></div>`).join("")}</div><div class="gtop"></div>
    ${imgs.length > 1 ? `<div class="dots" id="dots">${imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}</div>
    <div class="sheet">
      <div class="meta">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
      <h1>${esc(titleOf(d))}</h1>${d.lead ? `<p class="lead">${esc(d.lead)}</p>` : ""}
      <div class="sau">${authors.map((u) => `<a href="/user.html?uid=${esc(u)}" style="display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none"><img src="${esc(avatarOf(u))}" alt=""><b>${esc((PROF[u] || {}).nickname || (u === d.authorId ? authorName(d) : "旅人"))}</b></a>`).join("")}<span>${esc(fmtPeriod(d.dateStart, d.dateEnd))}</span></div>
      ${facts.some((f) => f[1]) ? `<div class="facts" style="grid-template-columns:repeat(${facts.length},1fr)">${facts.map((f) => `<div><small>${f[0]}</small>${esc(f[1] || "—")}</div>`).join("")}</div>` : ""}
      ${total ? `<div class="cost"><div class="h"><span>この旅にかかった費用</span><b>${yen(total)}</b></div>
        <div class="bar" id="bar">${crow.map((c, i) => `<span style="flex:0.0001;background:${COL[i % COL.length]}" data-f="${c[1]}"></span>`).join("")}</div>
        <div class="lg">${crow.map((c, i) => `<button data-hl="${i}"><i style="background:${COL[i % COL.length]}"></i>${esc(c[0])}<b>${yen(c[1])}</b></button>`).join("")}</div><div class="pct" id="pct"></div></div>` : ""}
      ${d.type === "transit" && d.body ? `<div class="dh"><h2>トランジットの記録</h2></div><p class="ph2">${para(d.body)}</p>` : ""}
      ${days.length ? `<div class="dh"><h2>旅の記録</h2><small style="color:var(--muted);font-size:12px">${days.length}日間</small></div>
      <div class="days">${days.map((x, i) => {
        const ph = (x.photoUrls || [])[0];
        const more = (x.photoUrls || []).slice(0, 6);
        return `<div class="day"><button data-day><div class="th ${ph ? "" : "no"}" style="${ph ? `background-image:url('${esc(ph)}')` : ""}">${ph ? "" : i + 1}</div><div><small>DAY ${i + 1}${x.date ? "　" + esc(x.date) : ""}</small><p>${esc(x.summary || "")}</p></div><span class="pm">＋</span></button>
          <div class="body">${more.map((u) => `<img src="${esc(u)}" alt="" loading="lazy">`).join("")}${x.text ? `<p class="ph">${para(x.text)}</p>` : ""}</div></div>`;
      }).join("")}</div>` : ""}
      ${d.comment ? `<div class="dh"><h2>投稿者のコメント</h2></div><p class="ph2">${para(d.comment)}</p>` : ""}
      <p style="margin:26px 0 10px"><a href="/articles/view.html?id=${esc(d.id)}" style="font-size:12.5px;color:var(--muted)">サイト版で見る（地図・航空券・コメント）→</a></p>
    </div>`;
  $("artNav").innerHTML = `<div class="topnav" id="topnav">${esc(titleOf(d))}</div>
    <button class="fb" style="left:16px" id="artBack" aria-label="戻る"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1b2330" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
    <button class="fb" style="right:16px" id="artShare" aria-label="共有"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1b2330" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12v7.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V12"/></svg></button>`;
  $("artNav").classList.add("show");
  $("artBack").onclick = () => history.back();
  $("artShare").onclick = async () => {
    const url = location.origin + "/articles/view.html?id=" + d.id;
    try { if (navigator.share) await navigator.share({ title: titleOf(d), url }); else { await navigator.clipboard.writeText(url); toast("リンクをコピーしました"); } } catch (e) {}
  };
  const art = $("article");
  art.scrollTop = 0; art.classList.add("open"); $("act").classList.add("show"); $("tab").classList.add("hide");
  $("askBtn").href = "/ask.html";
  paintSave();
  art.onscroll = () => { const on = art.scrollTop > 360; $("topnav").classList.toggle("show", on); document.querySelectorAll("#artNav .fb").forEach((b) => b.classList.toggle("solid", on)); };
  const gal = $("gal");
  gal.onscroll = () => { const i = Math.round(gal.scrollLeft / gal.clientWidth); const ds = $("dots"); if (ds) [...ds.children].forEach((x, j) => x.classList.toggle("on", i === j)); };
  art.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { b.parentNode.classList.toggle("open"); haptic(); }));
  art.querySelectorAll("[data-hl]").forEach((b) => (b.onclick = () => {
    const i = +b.dataset.hl, c = crow[i]; haptic();
    [...$("bar").children].forEach((s, j) => (s.style.opacity = j === i ? 1 : 0.25));
    const p = $("pct"); p.style.display = "block"; p.textContent = `${c[0]}は全体の${Math.round((c[1] / total) * 100)}%（${yen(c[1])}）`;
    clearTimeout(b._t); b._t = setTimeout(() => { [...$("bar").children].forEach((s) => (s.style.opacity = 1)); p.style.display = "none"; }, 2600);
  }));
  setTimeout(() => { const bar = $("bar"); if (bar) [...bar.children].forEach((s) => (s.style.flex = s.dataset.f)); }, 350);
}
function closeArticle(silent) {
  $("artNav").classList.remove("show"); $("article").classList.remove("open"); $("act").classList.remove("show"); $("tab").classList.remove("hide");
  if (!silent && location.hash.startsWith("#a-")) history.replaceState(null, "", location.pathname);
}
// 左端からのスワイプで戻る
(function () {
  let sx = null; const el = $("article");
  el.addEventListener("touchstart", (e) => { const t = e.touches[0]; if (t.clientX < 30) sx = t.clientX; }, { passive: true });
  el.addEventListener("touchmove", (e) => { if (sx == null) return; const dx = e.touches[0].clientX - sx; if (dx > 0) { el.style.transition = "none"; el.style.transform = `translateX(${dx}px)`; } }, { passive: true });
  el.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; el.style.transition = ""; el.style.transform = ""; if (dx > 100) history.back(); sx = null; });
})();
// 記事は #a-<id> で開く（戻るボタン・スワイプで閉じられるように）
function route() {
  const m = location.hash.match(/^#a-(.+)$/);
  if (m) openArticle(decodeURIComponent(m[1]));
  else if ($("article").classList.contains("open")) closeArticle(true);
}
window.addEventListener("hashchange", route);

// ---------- 保存 ----------
async function toggleSave(id) {
  if (!me) { toast("保存するにはログインが必要です"); setTimeout(() => (location.href = "/account.html"), 900); return; }
  const ref = doc(db, "users", me, "saves", id);
  try {
    if (saved.has(id)) { await deleteDoc(ref); saved.delete(id); toast("保存を外しました"); }
    else { await setDoc(ref, { createdAt: serverTimestamp() }); saved.add(id); toast("保存しました"); }
  } catch (e) { toast("保存できませんでした"); }
  haptic(); paintSave();
  document.querySelectorAll(`[data-save="${CSS.escape(id)}"]`).forEach((b) => b.classList.toggle("on", saved.has(id)));
}
function paintSave() { const b = $("saveBtn"); if (b && cur) b.classList.toggle("on", saved.has(cur.id)); }
$("saveBtn").onclick = () => cur && toggleSave(cur.id);
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
      <div class="plist"><a class="pnew" href="/account.html"><span class="pt2"><b>ログイン・新規登録</b><small>サイトと同じアカウントで使えます</small></span><span class="pa">→</span></a></div>`;
    return;
  }
  const p = PROF[me] || {};
  const mine = ALL.filter((d) => d.authorId === me || (d.coAuthorIds || []).includes(me));
  box.innerHTML = `<div class="prof"><img src="${esc(p.photoURL || DEF_AV)}" alt=""><div><b>${esc(p.nickname || "旅人")}</b><small>${esc(p.bio || "")}</small></div></div>
    <div class="stats"><div><b>${mine.length}</b>投稿</div><div><b>${saved.size}</b>保存</div><div><b>—</b>フォロワー</div></div>
    <div class="grp"><button data-go="saved">保存した旅</button><a href="/account.html">プロフィール・通知の設定</a><a href="/dm.html">メッセージ</a></div>
    <h3 style="margin:30px 20px -16px;font-size:11px;color:var(--muted);font-weight:500;font-family:Manrope;letter-spacing:.14em">SUPPORT</h3>
    <div class="grp"><a href="/terms.html">利用規約</a><a href="/privacy.html">プライバシーポリシー</a><a href="https://www.instagram.com/tabistock/">お問い合わせ（Instagram）</a></div>
    <div class="grp"><a href="/account.html" style="color:#d4493f">アカウントの削除・ブロックしたユーザー</a></div>
    ${mine.length ? `<div class="sh" style="padding-top:30px"><h2>自分の投稿</h2></div><div class="ogrid">${mine.map(gridCard).join("")}</div>` : ""}`;
}

// ---------- その他のボタン ----------
$("dmBtn").onclick = () => (location.href = "/dm.html");
$("bellBtn").onclick = () => (location.href = "/account.html#notifications");

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
  paintSave();
});

renderTab();
loadAll().then(route);
