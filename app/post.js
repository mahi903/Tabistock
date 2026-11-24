// Tabistock アプリ版：旅程の投稿・編集（1画面1ステップ）
// 保存の中身はサイトと共通（../post-core.js）。保存されるデータの形はサイトの post.html と同じ。
import { auth, db } from "../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  COUNTRIES, STYLES, COST_ITEMS, PREF_GROUPS, MOVE_MODES, REGION_JP, COUNTRY_LL, COUNTRY_ISO, BUDGETS,
  esc, yen, cinfo, budgetFromYen, derivePrefs
} from "../tabistock-render.js";
import {
  SERVICE_CATS, COUNTRY_YOMI, acNorm, airlineMatches, daysVOf, nightsOf, currencyOf, languageOf, saveArticle, loadMyTransits, saveTransit, loadMyTrips
} from "../post-core.js";
import { collab, initCollabBox, loadCollabFrom, isMember, sameMembers, currentMembers, membersOf } from "../collab.js";
import { showPostThanks } from "../post-thanks.js";

let C = null;          // app.js から渡される道具（bar / back / toast / haptic / シート / Leaflet など）
let F = null;          // フォームの中身
let S = null;          // 画面の状態
let root = null;       // このページの要素

const SAFETY = ["とても安全", "比較的安全", "普通", "やや注意が必要", "注意が必要"];
const STYLE_HEADS = { solo: "誰と行くか", nature: "旅のスタイル" };
const WD = ["日", "月", "火", "水", "木", "金", "土"];
const AS_KEY = (uid, id, kind) => `tabistock-app-post-v1:${uid}:${id || (kind === "transit" ? "new-transit" : "new")}`;

const newLeg = () => ({ mode: "", trip: "oneway", from: "", to: "", transit: "", airline: "", price: "" });
const newDay = () => ({ summary: "", text: "", photos: [], places: [], open: false });
function blank() {
  return {
    countries: [], prefectures: [], notFromJapan: false, styles: [], dateStart: "", dateEnd: "",
    title: "", lead: "", safety: "", difficulty: 3, hero: [],
    costs: {}, legs: [newLeg()], flightWhen: "", flightSite: "",
    svc: {}, svcOther: {}, days: [newDay()], comment: "", agodaUrl: "", transitSel: null,
    // トランジット記事用
    airport: "", layover: "", body: "", places: [], parentId: null
  };
}
const isDom = () => F.countries.length > 0 && F.countries.every((v) => v === "japan");
const isLocal = () => !isDom() && !!F.notFromJapan;
const isMove = () => isDom() || isLocal();
const total = () => COST_ITEMS.reduce((t, it) => t + (Number(F.costs[it.k]) || 0), 0);
const legFilled = (l) => [l.from, l.to, l.transit, l.airline, l.price].some((x) => String(x || "").trim());

// 入力例（国内／旅の途中から／海外）
const EX = {
  title: ["例：京都・大阪2泊3日｜青春18きっぷで巡る学生旅", "例：ベルギー留学中にヘルシンキ3泊｜学生ひとり旅", "例：モンゴル5泊6日｜大学生ひとり旅"],
  lead: ["例：鈍行列車で古都と食い倒れの街を巡る節約旅", "例：ブリュッセルから格安便で。冬のフィンランドをサウナ巡り", "例：ゴビ砂漠、バヤンザグ、ゲル泊を巡る冒険旅"],
  when: ["例：出発の1週間前", "例：出発の3週間前", "例：出発の2ヶ月前"],
  site: ["例：えきねっと／EX予約", "例：Skyscanner／Omio", "例：Trip.com"],
  from: ["例：東京", "例：ブリュッセル", "例：大阪"],
  to: ["例：京都", "例：ヘルシンキ", "例：上海"],
  air: ["例：JR東海／WILLER", "例：Ryanair／FlixBus", "例：ANA／エミレーツ"],
  sum: ["例：新幹線で京都へ。伏見稲荷と清水寺", "例：ブリュッセルから飛行機でヘルシンキへ", "例：上海経由でウランバートルへ"],
  comment: ["例：紅葉シーズンの京都は朝早く動くのが正解。バスは混むので電車と徒歩がおすすめ…", "例：ヨーロッパ内はLCCとバスで安く動ける。預け荷物の追加料金には要注意…", "例：4月でも朝晩はかなり寒いので防寒着は必須です。英語はほとんど通じないので…"]
};
const ex = (k) => EX[k][isDom() ? 0 : isLocal() ? 1 : 2];

const TRIP_STEPS = [
  { k: "basic", t: () => "基本情報", h: () => "行った国と時期、記事の一番上に出るタイトルや写真です。" },
  { k: "cost", t: () => "費用", h: () => "実際にかかった金額（円）。合計から予算が自動で決まります。" },
  { k: "move", t: () => (isMove() ? "移動" : "航空券"), h: () => (isMove() ? "区間ごとに手段と値段を書けます。" : "周遊で何回か取った場合は航路を追加できます。") },
  { k: "svc", t: () => "利用サービス", h: () => "使ったサービスを選んでください。無いものは「その他」に。" },
  { k: "days", t: () => "日程", h: () => "各日を一言で（必須）。文章・写真・場所は「＋」から。" },
  { k: "finish", t: () => "仕上げ", h: () => "投稿者コメントを書いたら完成です。" }
];
// トランジット記事（乗り継ぎの記録）は3ステップ
const TRANSIT_STEPS = [
  { k: "t_basic", t: () => "基本情報", h: () => "経由した国・空港と、乗り継ぎの時間です。" },
  { k: "t_rec", t: () => "乗り継ぎの記録", h: () => "空港での過ごし方や、市内に出たならその様子を。写真と場所も残せます。" },
  { k: "t_finish", t: () => "仕上げ", h: () => "どの旅行のときの乗り継ぎかを紐付けると、旅程の記事にも表示されます。" }
];
let STEPS = TRIP_STEPS;

// ---------- チェック（サイトの validate と同じ項目） ----------
function checks() {
  if (S.kind === "transit") return [
    { s: 0, l: "経由した国", ok: F.countries.length > 0 },
    { s: 0, l: "空港名", ok: !!F.airport.trim() },
    { s: 0, l: "乗り継ぎ時間", ok: !!F.layover }
  ];
  const dom = isDom(), move = isMove();
  const legs = F.legs.filter(legFilled);
  const filled = F.days.filter((d) => d.summary.trim()).length;
  return [
    { s: 0, l: "国", ok: F.countries.length > 0 },
    ...(dom ? [{ s: 0, l: "都道府県", ok: F.prefectures.length > 0 }] : []),
    { s: 0, l: "旅行時期", ok: !!(F.dateStart && F.dateEnd && daysVOf(F.dateStart, F.dateEnd)) },
    { s: 0, l: "旅スタイル", ok: F.styles.length > 0 },
    { s: 0, l: "トップ写真", ok: F.hero.length > 0 },
    { s: 0, l: "タイトル", ok: !!F.title.trim() },
    { s: 0, l: "リード文", ok: !!F.lead.trim() },
    ...(!dom ? [{ s: 0, l: "治安", ok: !!F.safety }] : []),
    { s: 1, l: "費用", ok: total() > 0 },
    { s: 2, l: move ? "移動（1区間以上）" : "航空券（1航路以上）", ok: legs.length > 0 },
    ...(!move ? [{ s: 2, l: "予約時期", ok: !!F.flightWhen.trim() }, { s: 2, l: "予約サイト", ok: !!F.flightSite.trim() }] : []),
    { s: 4, l: `日程の一言（${filled}/${F.days.length}日）`, ok: F.days.length > 0 && filled === F.days.length },
    { s: 5, l: "投稿者コメント", ok: !!F.comment.trim() }
  ];
}
const stepOk = (i) => checks().filter((c) => c.s === i).every((c) => c.ok);

// ---------- 保存する形へ ----------
function toData() {
  const dom = isDom(), move = isMove(), t = total();
  const costs = {}; COST_ITEMS.forEach((it) => (costs[it.k] = Number(F.costs[it.k]) || 0));
  const flights = F.legs.filter(legFilled).map((l) => {
    const stops = l.transit ? l.transit.split(/[、,]/).map((s) => s.trim()).filter(Boolean) : [];
    const seq = [l.from.trim(), ...stops, l.to.trim()].filter(Boolean);
    return {
      route: seq.join(` ${l.trip === "round" ? "↔" : "→"} `), from: l.from.trim(), to: l.to.trim(), transit: l.transit.trim(),
      trip: l.trip, airline: l.airline.trim(), price: Number(l.price) || 0,
      mode: move ? (l.mode || (dom ? "shinkansen" : "plane")) : "plane"
    };
  });
  const services = [];
  SERVICE_CATS.forEach((cat) => {
    const items = [...(F.svc[cat.k] || [])];
    (F.svcOther[cat.k] || "").split(/[、,]/).map((s) => s.trim()).filter(Boolean).forEach((s) => items.push(s));
    if (items.length) services.push({ label: cat.k, items });
  });
  return {
    author: S.nickname,
    countries: F.countries.slice(), region: F.countries[0] ? (cinfo(F.countries[0]) || {}).r || "" : "",
    prefectures: dom ? F.prefectures.slice() : [], notFromJapan: isLocal(),
    budget: t > 0 ? budgetFromYen(t) : "", days_v: daysVOf(F.dateStart, F.dateEnd), styles: F.styles.slice(),
    title: F.title.trim(), lead: F.lead.trim(), dateStart: F.dateStart, dateEnd: F.dateEnd,
    currency: dom ? "" : currencyOf(F.countries), language: dom ? "" : languageOf(F.countries), safety: dom ? "" : F.safety,
    difficulty: F.difficulty,
    costs, flights, flightWhen: F.flightWhen.trim(), flightSite: F.flightSite.trim(),
    services, comment: F.comment.trim(), agodaUrl: (F.agodaUrl || "").trim(),
    heroPhotos: F.hero.slice(),
    days: F.days.map((d) => ({
      date: "", summary: d.summary.trim(), text: d.text.trim(), photos: d.photos.slice(),
      places: d.places.map((p) => ({ name: p.name || "", lat: p.lat, lng: p.lng, cc: p.cc || "" })),
      lat: d.places.length ? d.places[0].lat : null, lng: d.places.length ? d.places[0].lng : null
    }))
  };
}
// プレビュー用：入力中の内容を、記事ページがそのまま描ける形にする（写真はまだアップロードしていないので端末内のURLを使う）
function previewData() {
  const pv = (arr) => arr.map((it) => it.url || (it.file ? (it._full = it._full || URL.createObjectURL(it.file)) : "")).filter(Boolean);
  if (S.kind === "transit") {
    const t = toTransit();
    return { type: "transit", status: "draft", authorId: C.me, authorNickname: S.nickname, countries: t.country ? [t.country] : [], region: t.region,
      airport: t.airport, layover: t.layover, title: t.title, body: t.body, heroUrls: pv(F.hero), places: t.places };
  }
  const d = toData();
  return { ...d, status: "draft", authorId: C.me, authorNickname: S.nickname, heroUrls: pv(F.hero),
    days: d.days.map((x, i) => ({ ...x, date: dayDate(i), photoUrls: pv(F.days[i].photos) })) };
}
function toTransit() {
  const c = F.countries[0] || "";
  return {
    author: S.nickname, country: c, region: c ? (cinfo(c) || {}).r || "" : "",
    airport: F.airport.trim(), layover: F.layover, title: F.title.trim(), body: F.body.trim(),
    photos: F.hero.slice(), places: F.places.map((p) => ({ name: p.name || "", lat: p.lat, lng: p.lng })), parentId: F.parentId || null
  };
}
function fromTransit(a) {
  const f = blank();
  Object.assign(f, {
    countries: (a.countries || []).filter((v) => cinfo(v)).slice(0, 1), airport: a.airport || "", layover: a.layover ? String(a.layover) : "",
    title: a.title || "", body: a.body || "", hero: (a.heroUrls || []).map((url) => ({ url })),
    places: (a.places || []).filter((p) => p && typeof p.lat === "number" && typeof p.lng === "number").map((p) => ({ name: p.name || "", lat: p.lat, lng: p.lng })),
    parentId: a.parentId || null
  });
  return f;
}
// 記事（Firestore）→ フォーム
function fromDoc(a) {
  const f = blank();
  Object.assign(f, {
    countries: (a.countries || []).filter((v) => cinfo(v)), prefectures: derivePrefs(a).slice(), notFromJapan: !!a.notFromJapan,
    styles: (a.styles || []).slice(), dateStart: a.dateStart || "", dateEnd: a.dateEnd || "",
    title: a.title || "", lead: a.lead || "", safety: a.safety || "", difficulty: a.difficulty || 3,
    hero: (a.heroUrls || []).map((url) => ({ url })),
    flightWhen: a.flightWhen || "", flightSite: a.flightSite || "", comment: a.comment || "", agodaUrl: a.agodaUrl || ""
  });
  COST_ITEMS.forEach((it) => { const v = (a.costs || {})[it.k]; if (v) f.costs[it.k] = String(v); });
  f.legs = (a.flights || []).map((x) => {
    let from = x.from || "", to = x.to || "", trip = x.trip || "", transit = x.transit || "";
    if (!from && !to && !trip && x.route) {   // 旧形式（route の文字列だけ）
      trip = /↔|⇄|⇔/.test(x.route) ? "round" : "oneway";
      const parts = x.route.split(/\s*(?:↔|⇄|⇔|→|⇒|⇨)\s*/).filter(Boolean);
      from = parts[0] || ""; to = parts.length > 1 ? parts[parts.length - 1] : ""; transit = parts.slice(1, -1).join("、");
    }
    return { mode: x.mode || "", trip: trip === "round" ? "round" : "oneway", from, to, transit, airline: x.airline || "", price: x.price ? String(x.price) : "" };
  });
  if (!f.legs.length) f.legs = [newLeg()];
  (a.services || []).forEach((s) => {
    const cat = SERVICE_CATS.find((c) => c.k === s.label); if (!cat) return;
    const others = [];
    (s.items || []).forEach((it) => { if (cat.opts.includes(it)) (f.svc[cat.k] = f.svc[cat.k] || []).push(it); else others.push(it); });
    if (others.length) f.svcOther[cat.k] = others.join("、");
  });
  f.days = (a.days || []).map((d) => {
    let places = Array.isArray(d.places) ? d.places.filter((p) => p && typeof p.lat === "number" && typeof p.lng === "number").map((p) => ({ name: p.name || "", lat: p.lat, lng: p.lng, cc: p.cc || "" })) : [];
    if (!places.length && typeof d.lat === "number" && typeof d.lng === "number") places = [{ name: "", lat: d.lat, lng: d.lng, cc: "" }];
    const photos = (d.photoUrls || []).map((url) => ({ url }));
    return { summary: d.summary || "", text: d.text || "", photos, places, open: !!(d.text || photos.length || places.length) };
  });
  if (!f.days.length) f.days = [newDay()];
  return f;
}

// ---------- 自動保存（この端末だけ。写真ファイルは保存しない） ----------
function snap() {
  const strip = (arr) => arr.filter((it) => it.url).map((it) => ({ url: it.url }));
  return { ...F, hero: strip(F.hero), days: F.days.map((d) => ({ ...d, photos: strip(d.photos) })) };
}
const sig = () => JSON.stringify(snap());
let asTimer = null;
function dirty() {
  S.dirty = true;
  clearTimeout(asTimer);
  asTimer = setTimeout(autosave, 1200);
  drawProg();
}
function autosave() {
  clearTimeout(asTimer);
  if (!S || !S.uid || S.paused) return;
  try {
    const now = sig();
    if (now === S.base) localStorage.removeItem(S.asKey);
    else localStorage.setItem(S.asKey, JSON.stringify({ at: Date.now(), data: snap(), newPhotos: countNew() }));
  } catch (e) {}
}
const countNew = () => F.hero.filter((x) => x.file).length + F.days.reduce((t, d) => t + d.photos.filter((x) => x.file).length, 0);

// ---------- ページ ----------
// 投稿画面は重ねて開けるので（旅程の仕上げ → トランジットを追加 など）、
// 閉じたときに1つ前の投稿画面の状態に戻す
export async function pagePost(el, arg, ctx) {
  const prev = S ? { C, F, S, root, STEPS } : null;
  await openPost(el, arg, ctx);
  const mine = S;
  if (prev && mine) mine.stacked = true;
  return () => {
    if (S === mine) { clearTimeout(asTimer); autosave(); }
    if (prev) ({ C, F, S, root, STEPS } = prev);
    else S = null;
  };
}
async function openPost(el, arg, ctx) {
  C = ctx; root = el;
  // arg … ""（旅程の新規） / "記事ID"（編集） / "transit"・"transit~旅程ID"（トランジットの新規。旅程IDがあれば最初から紐付け）
  let editId = arg || null, kind = "trip", presetParent = null;
  if (/^transit(~|$)/.test(arg || "")) { kind = "transit"; presetParent = arg.split("~")[1] || null; editId = null; }
  S = { step: 0, kind, edit: null, uid: ctx.me, nickname: "", isAdmin: false, transits: [], trips: [], dirty: false, asKey: "", base: "", paused: false };
  F = blank();
  STEPS = kind === "transit" ? TRANSIT_STEPS : TRIP_STEPS;
  Object.assign(collab, { me: null, ownerId: null, ids: [], invites: [], origInvites: [], canManage: true });
  const T0 = kind === "transit" ? "トランジットを投稿" : "旅程を投稿";
  if (!ctx.me) { el.innerHTML = C.bar(T0) + '<div class="ps under2"><p class="fol-empty"><a href="#x-login">ログイン</a>すると投稿できます。</p></div>'; return; }
  el.innerHTML = C.bar(editId ? "投稿を編集" : T0) + '<div class="ps"><p class="loading" style="padding-top:140px">読み込み中…</p></div>';
  try {
    const u = await getDoc(doc(db, "users", ctx.me));
    S.nickname = (u.exists() && u.data().nickname) || (auth.currentUser && auth.currentUser.displayName) || "";
  } catch (e) {}
  try { S.isAdmin = (await getDoc(doc(db, "admins", ctx.me))).exists(); } catch (e) {}
  if (editId) {
    let a = null;
    try { const s = await getDoc(doc(db, "articles", editId)); if (s.exists()) a = s.data(); } catch (e) {}
    if (!a) { el.innerHTML = C.bar("投稿を編集") + '<div class="ps under2"><p class="empty">記事が見つかりませんでした</p></div>'; return; }
    if (!isMember(a, ctx.me) && !S.isAdmin) { el.innerHTML = C.bar("投稿を編集") + '<div class="ps under2"><p class="empty">この記事を編集する権限がありません</p></div>'; return; }
    if (a.type === "transit") { S.kind = "transit"; STEPS = TRANSIT_STEPS; F = fromTransit(a); }
    else F = fromDoc(a);
    S.edit = { id: editId, status: a.status || "pending", createdAt: a.createdAt || null, publishedAt: a.publishedAt || null, authorNickname: a.authorNickname || "" };
    collab.me = ctx.me;
    loadCollabFrom(a, { isAdmin: S.isAdmin });
  } else {
    collab.me = ctx.me; collab.ownerId = ctx.me;
    // 旅程から「トランジットを追加」で来たときは、その旅程に紐付け、共同投稿のメンバーもそろえておく
    if (presetParent) {
      try {
        const ps = await getDoc(doc(db, "articles", presetParent));
        if (ps.exists() && ps.data().type !== "transit" && isMember(ps.data(), ctx.me)) {
          F.parentId = presetParent;
          F.countries = [];
          collab.invites = membersOf(ps.data()).filter((u) => u !== ctx.me);
        }
      } catch (e) {}
    }
  }
  S.asKey = AS_KEY(ctx.me, S.edit && S.edit.id, S.kind);
  S.base = sig();
  shell();
  if (S.kind === "transit") loadMyTrips(ctx.me).then((l) => { S.trips = l; if (STEPS[S.step].k === "t_finish") drawStep(); }).catch(() => {});
  else loadMyTransits(ctx.me).then((l) => { S.transits = l; if (F.transitSel === null) F.transitSel = l.filter((t) => editId && t.parentId === editId).map((t) => t.id); S.base = sig(); if (STEPS[S.step].k === "finish") drawStep(); }).catch(() => {});
  // 前回の入力が残っていれば
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(S.asKey) || "null"); } catch (e) {}
  if (saved && saved.data && JSON.stringify(saved.data) !== S.base) { S.paused = true; banner(saved); }
  else if (saved) { try { localStorage.removeItem(S.asKey); } catch (e) {} }
}

function shell() {
  const editing = !!S.edit;
  const title = editing ? (S.edit.status === "draft" ? "下書きを編集" : "投稿を編集") : S.kind === "transit" ? "トランジットを投稿" : "旅程を投稿";
  root.innerHTML = C.bar(title, '<button class="ppvw" id="pPv">プレビュー</button><button class="pstn" id="pStepBtn"></button>')
    + `<div class="pprog" id="pProg">${STEPS.map(() => "<i></i>").join("")}</div>`
    + '<div class="ps pform" id="pScroll"><div id="pBan"></div><div id="pAnim"><div class="phd" id="pHead"></div><div class="pbd" id="pBody"></div></div></div>'
    + `<div class="pfoot"><button class="pbk" id="pPrev" aria-label="前のステップへ"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>戻る</button><button class="pdr" id="pDraft">下書き保存</button><button class="pnx" id="pNext"></button></div>`;
  root.querySelector("#pStepBtn").onclick = stepSheet;
  root.querySelector("#pPv").onclick = () => C.preview(previewData());
  root.querySelector("#pDraft").onclick = () => submit("draft");
  root.querySelector("#pPrev").onclick = () => goStep(S.step - 1);
  root.querySelector("#pNext").onclick = () => { if (S.step < STEPS.length - 1) goStep(S.step + 1); else submit("publish"); };
  // 戻るボタン：この端末に保存してから閉じる
  root.querySelector("[data-back]").addEventListener("click", () => { if (S.dirty) { autosave(); if (!S.paused) C.toast("入力内容はこの端末に残しました"); } }, true);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  root.addEventListener("click", onClick);
  drawStep();
}
// ステップの切り替え：今の画面を進む方向へ流しながら消し、次の画面を反対側からゆっくり出す
let stepAnim = null;
function goStep(i) {
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  if (i === S.step) return;
  const dir = i > S.step ? 1 : -1;
  S.step = i; C.haptic();
  const box = root.querySelector("#pAnim"), sc = root.querySelector("#pScroll");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!box.animate || reduce) { drawStep(); sc.scrollTop = 0; return; }
  if (stepAnim) stepAnim.cancel();
  const ease = "cubic-bezier(.3,.7,.3,1)";
  stepAnim = box.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateX(${-28 * dir}px)` }], { duration: 170, easing: "ease-in", fill: "forwards" });
  const out = stepAnim;
  out.onfinish = () => {
    drawStep(); sc.scrollTop = 0;
    out.cancel();   // 消すときの「透明のまま」を外してから、次の画面を出す
    stepAnim = box.animate([{ opacity: 0, transform: `translateX(${36 * dir}px)` }, { opacity: 1, transform: "none" }], { duration: 380, easing: ease });
    stepAnim.onfinish = () => (stepAnim = null);
  };
}
function drawProg() {
  const p = root && root.querySelector("#pProg"); if (!p) return;
  [...p.children].forEach((x, i) => { x.className = (i === S.step ? "cur " : "") + (stepOk(i) ? "ok" : ""); });
  const b = root.querySelector("#pStepBtn"); if (b) b.innerHTML = `<span class="num">${S.step + 1}</span>/${STEPS.length}`;
}
function drawStep() {
  const st = STEPS[S.step];
  root.querySelector("#pHead").innerHTML = `<small class="num">STEP ${S.step + 1}</small><h2>${esc(st.t())}</h2><p>${esc(st.h())}</p>`;
  root.querySelector("#pBody").innerHTML = BODY[st.k]();
  requestAnimationFrame(() => root.querySelectorAll(".pfauto").forEach(fitAuto));
  const last = S.step === STEPS.length - 1;
  const nx = root.querySelector("#pNext");
  nx.textContent = last ? (!S.edit ? "投稿する" : ["published", "hidden"].includes(S.edit.status) ? "この内容で更新する" : "更新して申請する") : "次へ";
  nx.classList.toggle("go", last);
  // 一度承認された記事は、下書きにすると公開が外れるので下書き保存を出さない
  root.querySelector("#pDraft").hidden = !!(S.edit && ["published", "hidden"].includes(S.edit.status));
  root.querySelector("#pPrev").hidden = S.step === 0;
  if (["basic", "days", "t_rec"].includes(st.k)) drawAllPhotos();
  if (st.k === "finish") mountFinish();
  if (st.k === "t_finish") mountTransitFinish();
  drawProg();
}

// ---------- 各ステップ ----------
const fld = (label, inner, opt = "") => `<div class="pf"><label class="qlb">${label}${opt ? `<span class="po">${opt}</span>` : ""}</label>${inner}</div>`;
const pick = (id, vals, ph) => `<button class="ppk" id="${id}"><span class="${vals ? "" : "ph"}">${esc(vals || ph)}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>`;
const LAYOVERS = Array.from({ length: 48 }, (_, i) => i + 1);
const BODY = {
  t_basic() {
    const c = F.countries[0];
    return fld("経由した国", pick("pkCountry", c ? cinfo(c).jp : "", "国を選ぶ"))
      + fld("空港名", `<input class="pfi" data-f="airport" value="${esc(F.airport)}" placeholder="例：仁川空港（ICN）">`)
      + fld("乗り継ぎ時間", `<select class="pfi" data-f="layover"><option value="">選んでください</option>${LAYOVERS.map((h) => `<option value="${h}" ${String(F.layover) === String(h) ? "selected" : ""}>${h}時間</option>`).join("")}</select>`)
      + fld("タイトル", `<input class="pfi" data-f="title" value="${esc(F.title)}" placeholder="例：仁川で乗り継ぎ10時間｜市内に出てチムジルバンと食べ歩き">`, "任意");
  },
  t_rec() {
    const pins = F.places.length ? F.places.map((p) => esc(p.name || "名前なしのピン")).join("、") : "";
    return fld("本文", `<textarea class="pfi" data-f="body" rows="8" placeholder="例：トランジットビザ不要で入国できました。空港鉄道で市内へ約1時間。明洞を散歩してチムジルバンで仮眠…">${esc(F.body)}</textarea>`, "任意")
      + fld("写真", `<div class="pph" data-ph="hero"></div><p class="qhint">1枚目が一覧のサムネになります。</p>`, "任意")
      + fld("場所", `<button class="ppk" data-tmap><span class="${pins ? "" : "ph"}">${pins || "地図でピンを置く"}</span><b>${F.places.length ? F.places.length + "か所" : ""}</b></button>`, "任意");
  },
  t_finish() {
    const miss = checks().filter((c) => !c.ok);
    return `<div class="pf"><label class="qlb">どの旅行のときの乗り継ぎ？<span class="po">任意</span></label><div id="pPar"></div></div>`
      + `<div class="pf pcol" id="pCollab"></div>`
      + `<div class="pchk">${miss.length ? `<p class="qlb">投稿まであと${miss.length}項目</p>${miss.map((c) => `<button class="pmis" data-jump="${c.s}"><span>${esc(c.l)}</span><small>${esc(STEPS[c.s].t())}</small>›</button>`).join("")}` : '<p class="pready">投稿の準備ができました</p>'}</div>`;
  },
  basic() { return BODY.where() + '<div class="pdiv"></div>' + BODY.top(); },
  where() {
    const cs = F.countries.map((v) => cinfo(v).jp).join("、");
    const n = nightsOf(F.dateStart, F.dateEnd);
    return fld("国", pick("pkCountry", cs, "国を選ぶ（複数可）") + '<p class="qhint">周遊なら複数選べます。1つ目の国で地域が決まります。</p>')
      + (isDom() ? fld("都道府県", pick("pkPref", F.prefectures.join("、"), "都道府県を選ぶ（複数可）")) : "")
      + (!isDom() && F.countries.length ? `<label class="pck"><input type="checkbox" data-f="notFromJapan" ${F.notFromJapan ? "checked" : ""}><span class="bx"></span>出発地が日本以外（留学先や世界一周中など）</label>` : "")
      + fld("旅行時期", `<div class="pdt"><input type="date" data-f="dateStart" value="${esc(F.dateStart)}"><span>〜</span><input type="date" data-f="dateEnd" value="${esc(F.dateEnd)}"></div><p class="qhint" id="pNights">${n > 0 ? `${n - 1}泊${n}日・DAYを${n}日ぶん用意します` : n < 0 || (F.dateStart && F.dateEnd && n < 1) ? "終了日が開始日より前になっています" : "開始日と終了日を選ぶと、DAYが日数ぶん用意されます"}</p>`)
      + fld("旅スタイル", pick("pkStyle", F.styles.map((v) => (STYLES.find((s) => s.v === v) || {}).l).filter(Boolean).join("、"), "選ぶ（複数可）"));
  },
  top() {
    return fld("トップ写真", `<div class="pph" data-ph="hero"></div><p class="qhint">1枚目が表紙（サムネ）になります。タップで並べ替え・削除。</p>`)
      + fld("タイトル", `<input class="pfi" data-f="title" value="${esc(F.title)}" placeholder="${esc(ex("title"))}">`)
      + fld("リード文", `<textarea class="pfi pfauto" data-f="lead" rows="1" placeholder="${esc(ex("lead"))}">${esc(F.lead)}</textarea>`, "短い一言")
      + (!isDom() ? fld("治安", `<div class="prad">${SAFETY.map((v) => `<button class="frow ${F.safety === v ? "on" : ""}" data-safety="${esc(v)}"><span class="bx rd"></span><span class="nm">${v}</span></button>`).join("")}</div>`) : "")
      + fld("旅の難易度", `<div class="pstar">${[1, 2, 3, 4, 5].map((v) => `<button data-star="${v}" class="${v <= F.difficulty ? "on" : ""}" aria-label="${v}">★</button>`).join("")}<small>${["", "かんたん", "やや易しい", "ふつう", "やや難しい", "難しい"][F.difficulty]}</small></div>`);
  },
  cost() {
    const mv = isMove(), t = total();
    const lab = (it) => (mv && it.k === "flight" ? "移動" : mv && it.k === "transit" ? "現地の交通" : it.l);
    const b = t > 0 ? BUDGETS.find((x) => x.v === budgetFromYen(t)) : null;
    return `<div class="pcost">${COST_ITEMS.map((it) => `<label class="pcr"><span>${lab(it)}</span><span class="yen"><small>¥</small><input type="number" inputmode="numeric" min="0" step="1000" data-cost="${it.k}" value="${esc(F.costs[it.k] || "")}" placeholder="0"></span></label>`).join("")}</div>
      <div class="ptot"><span>合計</span><b class="num" id="pTotal">${yen(t)}</b></div><p class="qhint" id="pBudget">${b ? `予算の区分：${b.l}` : "0円の項目は空のままでOKです"}</p>`;
  },
  move() {
    const mv = isMove(), w = mv ? "区間" : "航路";
    return F.legs.map((l, i) => `<div class="pleg" data-leg="${i}">
        <div class="plh"><b>${w} ${i + 1}</b>${F.legs.length > 1 ? `<button class="pxs" data-legdel="${i}">削除</button>` : ""}</div>
        ${mv ? `<div class="pf"><label class="qlb">手段</label><select class="pfi" data-lf="mode">${MOVE_MODES.map((m) => `<option value="${m.v}" ${(l.mode || (isDom() ? "shinkansen" : "plane")) === m.v ? "selected" : ""}>${m.l}</option>`).join("")}</select></div>` : ""}
        <div class="ptrip"><button data-trip="oneway" class="${l.trip !== "round" ? "on" : ""}">片道</button><button data-trip="round" class="${l.trip === "round" ? "on" : ""}">往復</button></div>
        <div class="prt"><input class="pfi" data-lf="from" value="${esc(l.from)}" placeholder="${esc(ex("from"))}"><span>${l.trip === "round" ? "↔" : "→"}</span><input class="pfi" data-lf="to" value="${esc(l.to)}" placeholder="${esc(ex("to"))}"></div>
        ${fld("乗り継ぎ", `<input class="pfi" data-lf="transit" value="${esc(l.transit)}" placeholder="例：ソウル（複数は「、」で区切り）">`, "任意")}
        <div class="p2c">${fld(mv ? "会社・便名" : "航空会社", `<div class="pac"><input class="pfi" data-lf="airline" autocomplete="off" value="${esc(l.airline)}" placeholder="${esc(ex("air"))}"><div class="pacl" hidden></div></div>`, "任意")}
        ${fld("値段", `<span class="yen"><small>¥</small><input class="pfi" type="number" inputmode="numeric" min="0" step="1000" data-lf="price" value="${esc(l.price)}" placeholder="0"></span>`)}</div>
      </div>`).join("")
      + `<button class="padd2" data-legadd>＋ ${w}を追加</button>`
      + `<div class="p2c" style="margin-top:22px">${fld("予約時期", `<input class="pfi" data-f="flightWhen" value="${esc(F.flightWhen)}" placeholder="${esc(ex("when"))}">`, mv ? "任意" : "")}${fld("予約サイト", `<input class="pfi" data-f="flightSite" value="${esc(F.flightSite)}" placeholder="${esc(ex("site"))}">`, mv ? "任意" : "")}</div>`;
  },
  svc() {
    return SERVICE_CATS.map((cat) => `<div class="psv"><p class="qlb">${esc(cat.k)}</p><div class="fgrid">${cat.opts.map((o) => `<button class="frow ${(F.svc[cat.k] || []).includes(o) ? "on" : ""}" data-svc="${esc(cat.k)}" data-o="${esc(o)}"><span class="bx"></span><span class="nm">${esc(o)}</span></button>`).join("")}</div>
      <input class="pfi sm" data-svco="${esc(cat.k)}" value="${esc(F.svcOther[cat.k] || "")}" placeholder="その他（${esc(cat.ex)}）"></div>`).join("")
      + (S.isAdmin ? fld("宿泊ホテルのAgodaリンク", `<input class="pfi" data-f="agodaUrl" value="${esc(F.agodaUrl)}" placeholder="https://px.a8.net/...">`, "管理者のみ") : "");
  },
  days() {
    return `<div id="pDays">${F.days.map(dayHtml).join("")}</div><button class="padd2" data-dayadd>＋ 日を追加</button>
      <div class="pauto"><button class="btn-g" id="pAuto">本文から場所を自動検出</button><p class="qhint">各日の文章をAIが読んで観光地を推定し、地図にピンを置きます。</p><p class="qhint" id="pAutoMsg" style="white-space:pre-line"></p></div>`;
  },
  finish() {
    const miss = checks().filter((c) => !c.ok);
    return fld("投稿者コメント", `<textarea class="pfi" data-f="comment" rows="6" placeholder="${esc(ex("comment"))}">${esc(F.comment)}</textarea><p class="qhint">安く抑えた工夫・こうしておけばよかった点・持ち物・現地のリアルな本音を。</p>`)
      + `<div class="pf"><label class="qlb">トランジット記事を紐付け<span class="po">任意</span></label><div id="pTr"></div><a class="qhint lk" href="#p-transit${S.edit ? "~" + esc(S.edit.id) : ""}">＋ トランジット記事を新しく投稿する</a></div>`
      + `<div class="pf pcol" id="pCollab"></div>`
      + `<div class="pchk" id="pChk">${miss.length ? `<p class="qlb">投稿まであと${miss.length}項目</p>${miss.map((c) => `<button class="pmis" data-jump="${c.s}"><span>${esc(c.l)}</span><small>${esc(STEPS[c.s].t())}</small>›</button>`).join("")}` : '<p class="pready">投稿の準備ができました</p>'}</div>`;
  }
};

function dayDate(i) {
  if (!F.dateStart) return "";
  const d = new Date(F.dateStart + "T00:00:00"); d.setDate(d.getDate() + i);
  return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`;
}
function dayHtml(d, i) {
  const pins = d.places.length ? d.places.map((p) => esc(p.name || "名前なしのピン")).join("、") : "";
  return `<div class="pday" data-day="${i}">
    <div class="pdh"><b class="num">DAY ${i + 1}</b><small>${dayDate(i)}</small><button class="pdm" data-daymenu="${i}" aria-label="並べ替え・追加・削除">⋯</button></div>
    <input class="pfi" data-df="summary" value="${esc(d.summary)}" placeholder="${i === 0 ? esc(ex("sum")) : "この日を一言で"}">
    <button class="pdx ${d.open ? "on" : ""}" data-dayopen="${i}" aria-label="${d.open ? "閉じる" : "文章・写真・場所を追加"}"><span>${d.open ? "−" : "＋"}</span></button>
    <div class="pdmore" ${d.open ? "" : "hidden"}>
      ${fld("その日の文章", `<textarea class="pfi" data-df="text" rows="5" placeholder="観光地を挙げるだけでもOK">${esc(d.text)}</textarea>`, "任意")}
      ${fld("写真", `<div class="pph" data-ph="d${i}"></div>`, "任意")}
      ${fld("場所", `<button class="ppk" data-daymap="${i}"><span class="${pins ? "" : "ph"}">${pins || "地図でピンを置く"}</span><b>${d.places.length ? d.places.length + "か所" : ""}</b></button>`, "任意")}
    </div></div>`;
}

// ---------- 入力 ----------
// 1行の入力欄を、書いた長さに合わせてのばす
function fitAuto(t) { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }
function onInput(e) {
  if (e.target.classList && e.target.classList.contains("pfauto")) fitAuto(e.target);   // 書いた分だけ縦にのびる
  const t = e.target;
  if (t.dataset.f) { F[t.dataset.f] = t.type === "checkbox" ? t.checked : t.value; dirty(); return; }
  if (t.dataset.cost) {
    F.costs[t.dataset.cost] = t.value;
    const tt = total(), b = tt > 0 ? BUDGETS.find((x) => x.v === budgetFromYen(tt)) : null;
    root.querySelector("#pTotal").textContent = yen(tt);
    root.querySelector("#pBudget").textContent = b ? `予算の区分：${b.l}` : "0円の項目は空のままでOKです";
    dirty(); return;
  }
  const lw = t.closest("[data-leg]");
  if (lw && t.dataset.lf) {
    F.legs[+lw.dataset.leg][t.dataset.lf] = t.value;
    if (t.dataset.lf === "airline") acShow(t);
    dirty(); return;
  }
  const dw = t.closest("[data-day]");
  if (dw && t.dataset.df) { F.days[+dw.dataset.day][t.dataset.df] = t.value; dirty(); return; }
  if (t.dataset.svco) { F.svcOther[t.dataset.svco] = t.value; dirty(); }
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.f === "dateStart" || t.dataset.f === "dateEnd") { syncDays(); drawStep(); return; }
  if (t.dataset.f === "notFromJapan") { drawStep(); return; }
  if (t.dataset.phin) { addFiles(t.dataset.phin, [...t.files]); t.value = ""; }
}
// 旅行時期の日数ぶんDAYを用意（多すぎるときは後ろの空のDAYだけ消す）
function syncDays() {
  const n = nightsOf(F.dateStart, F.dateEnd);
  if (n < 1 || n > 60) return;
  while (F.days.length < n) F.days.push(newDay());
  const empty = (d) => !d.summary.trim() && !d.text.trim() && !d.photos.length && !d.places.length;
  while (F.days.length > n && F.days.length > 1 && empty(F.days[F.days.length - 1])) F.days.pop();
  dirty();
}
function onClick(e) {
  const t = e.target.closest("button,a"); if (!t) return;
  const d = t.dataset;
  if (t.id === "pkCountry") return countrySheet(S.kind === "transit");
  if (t.id === "pkPref") return prefSheet();
  if (t.id === "pkStyle") return styleSheet();
  if (t.id === "pAuto") return autoDetect();
  if (d.safety) { F.safety = d.safety; root.querySelectorAll("[data-safety]").forEach((b) => b.classList.toggle("on", b === t)); C.haptic(); dirty(); return; }
  if (d.star) { F.difficulty = +d.star; drawStep(); dirty(); return; }
  if (d.trip) { const i = +t.closest("[data-leg]").dataset.leg; F.legs[i].trip = d.trip; drawStep(); dirty(); return; }
  if (d.legadd !== undefined) { F.legs.push(newLeg()); drawStep(); dirty(); return; }
  if (d.legdel !== undefined) { F.legs.splice(+d.legdel, 1); drawStep(); dirty(); return; }
  if (d.svc) {
    const arr = (F.svc[d.svc] = F.svc[d.svc] || []); const j = arr.indexOf(d.o);
    if (j >= 0) arr.splice(j, 1); else arr.push(d.o);
    t.classList.toggle("on", j < 0); C.haptic(); dirty(); return;
  }
  if (d.dayadd !== undefined) { F.days.push(newDay()); drawStep(); dirty(); return; }
  if (d.dayopen !== undefined) { const x = F.days[+d.dayopen]; x.open = !x.open; drawStep(); return; }
  if (d.daymenu !== undefined) return dayMenu(+d.daymenu);
  if (d.daymap !== undefined) return mapPage(F.days[+d.daymap].places, `DAY ${+d.daymap + 1} の場所`);
  if (d.tmap !== undefined) return mapPage(F.places, "乗り継ぎで行った場所");
  if (d.jump !== undefined) return goStep(+d.jump);
  if (d.th !== undefined) return photoMenu(t.closest("[data-ph]").dataset.ph, +d.th);
  if (d.ac !== undefined) {
    const inp = t.closest(".pac").querySelector("input");
    inp.value = d.ac; F.legs[+t.closest("[data-leg]").dataset.leg].airline = d.ac;
    t.closest(".pacl").hidden = true; dirty(); return;
  }
}
// 航空会社の候補
function acShow(inp) {
  const list = inp.parentElement.querySelector(".pacl");
  const m = airlineMatches(inp.value);
  if (!m.length || m.some((a) => a.name === inp.value)) { list.hidden = true; return; }
  list.innerHTML = m.map((a) => `<button data-ac="${esc(a.name)}">${esc(a.name)}</button>`).join("");
  list.hidden = false;
}
document.addEventListener("focusout", (e) => { if (e.target.dataset && e.target.dataset.lf === "airline") setTimeout(() => { const l = e.target.parentElement && e.target.parentElement.querySelector(".pacl"); if (l) l.hidden = true; }, 200); });

// ---------- 写真 ----------
const phArr = (key) => (key === "hero" ? F.hero : F.days[+key.slice(1)].photos);
async function preview(file) {
  if (file._pv) return file._pv;
  try {
    const bmp = await createImageBitmap(file, { resizeWidth: 360, resizeQuality: "low", imageOrientation: "from-image" });
    const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext("2d").drawImage(bmp, 0, 0); bmp.close();
    const blob = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.7));
    file._pv = URL.createObjectURL(blob);
  } catch (e) { file._pv = URL.createObjectURL(file); }
  return file._pv;
}
function drawPhotos(box) {
  const key = box.dataset.ph, arr = phArr(key);
  box.innerHTML = arr.map((it, i) => `<button class="pth" data-th="${i}" ${it.url ? `style="background-image:url('${esc(it.url)}')"` : ""}>${key === "hero" && i === 0 ? "<em>表紙</em>" : ""}<span class="num">${i + 1}</span></button>`).join("")
    + `<label class="pth add"><input type="file" accept="image/jpeg,image/png" multiple hidden data-phin="${key}"><span>＋</span><small>写真を追加</small></label>`;
  arr.forEach(async (it, i) => {
    if (!it.file) return;
    const u = await preview(it.file);
    const b = box.querySelector(`[data-th="${i}"]`); if (b) b.style.backgroundImage = `url('${u}')`;
  });
}
function drawAllPhotos() { root.querySelectorAll("[data-ph]").forEach(drawPhotos); }
function addFiles(key, files) {
  const ok = files.filter((f) => /^image\/(jpeg|png)$/.test(f.type) || /\.(jpe?g|png)$/i.test(f.name));
  if (ok.length < files.length) C.toast("JPEG・PNGの写真だけ追加できます（HEICは変換してください）");
  phArr(key).push(...ok.map((file) => ({ file })));
  const box = root.querySelector(`[data-ph="${key}"]`); if (box) drawPhotos(box);
  dirty();
}
function photoMenu(key, i) {
  const arr = phArr(key);
  const rows = [];
  if (i > 0) rows.push(`<button class="srow" data-pm="first">${key === "hero" ? "表紙にする" : "先頭にする"}</button>`, '<button class="srow" data-pm="left">1つ前へ</button>');
  if (i < arr.length - 1) rows.push('<button class="srow" data-pm="right">1つ後ろへ</button>');
  rows.push('<button class="srow red" data-pm="del">削除</button>');
  C.sheet(`<div class="shs mmenu"><h3 style="font-size:15px">写真 ${i + 1}/${arr.length}</h3>${rows.join("")}</div>`, (bs) => {
    bs.querySelectorAll("[data-pm]").forEach((b) => (b.onclick = () => {
      const a = b.dataset.pm;
      if (a === "del") arr.splice(i, 1);
      else if (a === "first") arr.unshift(arr.splice(i, 1)[0]);
      else { const j = i + (a === "left" ? -1 : 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
      C.closeSheet(); drawPhotos(root.querySelector(`[data-ph="${key}"]`)); dirty();
    }));
  });
}

// ---------- 選ぶシート（国・都道府県・スタイル） ----------
const frow = (attr, v, label, on, sub = "") => `<button class="frow ${on ? "on" : ""}" ${attr}="${esc(v)}"><span class="bx"></span><span class="nm">${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
function pickSheet(title, bodyFn, wire, onDone) {
  const draw = (bs) => {
    const st = bs.querySelector(".bsb") ? bs.querySelector(".bsb").scrollTop : 0;
    bs.innerHTML = `<div class="grab"></div><div class="bsh"><h3>${title}</h3><button id="pkDone" style="color:var(--green);font-weight:700;font-size:14px">完了</button></div><div class="bsb">${bodyFn()}<div style="height:16px"></div></div>`;
    bs.querySelector(".bsb").scrollTop = st;
    bs.querySelector("#pkDone").onclick = () => C.closeSheet();   // 閉じると onDone が呼ばれる
    wire(bs, () => draw(bs));
  };
  C.sheet("", draw, onDone);
}
function countrySheet(single) {
  let q = "";
  const toKata = (t) => t.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  const hit = (c) => { if (!q) return true; const qk = toKata(q), ql = q.toLowerCase(); return c.jp.includes(qk) || c.en.toLowerCase().includes(ql) || c.v.toLowerCase().includes(ql) || toKata(COUNTRY_YOMI[c.v] || "").includes(qk); };
  const list = () => {
    const regions = [...new Set(COUNTRIES.map((c) => c.r))];
    const html = regions.map((r) => { const cs = COUNTRIES.filter((c) => c.r === r && hit(c)); return cs.length ? `<div class="fsec"><div class="fhead"><b>${esc(REGION_JP[r] || r)}</b></div><div class="fgrid">${cs.map((c) => frow("data-c", c.v, c.jp, F.countries.includes(c.v))).join("")}</div></div>` : ""; }).join("");
    return html || '<p class="qhint" style="padding:20px 0">見つかりませんでした</p>';
  };
  const selHtml = () => F.countries.length ? F.countries.map((v, i) => `<button class="psel" data-c="${v}">${i === 0 ? "<em>地域</em>" : ""}${esc(cinfo(v).jp)}<span>×</span></button>`).join("") : '<span class="qhint">まだ選んでいません</span>';
  pickSheet(single ? "経由した国" : "国を選ぶ", () => `<input class="pfi psr" id="pkQ" placeholder="国名で検索（例：トルコ／turkey）" autocomplete="off">${single ? "" : `<div class="pselw" id="pkSel">${selHtml()}</div>`}<div id="pkList">${list()}</div>`,
    (bs) => {
      const qi = bs.querySelector("#pkQ"); qi.value = q;
      qi.oninput = () => { q = qi.value.trim(); bs.querySelector("#pkList").innerHTML = list(); };
      bs.querySelector(".bsb").onclick = (e) => {
        const b = e.target.closest("[data-c]"); if (!b) return;
        const v = b.dataset.c, j = F.countries.indexOf(v);
        if (single) { F.countries = [v]; dirty(); C.closeSheet(); return; }
        if (j >= 0) F.countries.splice(j, 1); else F.countries.push(v);
        C.haptic(); dirty();
        if (bs.querySelector("#pkSel")) bs.querySelector("#pkSel").innerHTML = selHtml();
        bs.querySelectorAll(`[data-c="${v}"].frow`).forEach((x) => x.classList.toggle("on", j < 0));
      };
    }, () => drawStep());
}
function prefSheet() {
  pickSheet("都道府県を選ぶ", () => PREF_GROUPS.map((g) => `<div class="fsec"><div class="fhead"><b>${esc(g.r)}</b></div><div class="fgrid">${g.list.map((p) => frow("data-p", p, p, F.prefectures.includes(p))).join("")}</div></div>`).join(""),
    (bs) => (bs.querySelector(".bsb").onclick = (e) => {
      const b = e.target.closest("[data-p]"); if (!b) return;
      const j = F.prefectures.indexOf(b.dataset.p);
      if (j >= 0) F.prefectures.splice(j, 1); else F.prefectures.push(b.dataset.p);
      b.classList.toggle("on", j < 0); C.haptic(); dirty();
    }), () => drawStep());
}
function styleSheet() {
  pickSheet("旅スタイル", () => STYLES.map((s) => (STYLE_HEADS[s.v] ? `${s.v === "solo" ? "" : "</div></div>"}<div class="fsec"><div class="fhead"><b>${STYLE_HEADS[s.v]}</b></div><div class="fgrid">` : "") + frow("data-s", s.v, s.l, F.styles.includes(s.v))).join("") + "</div></div>",
    (bs) => (bs.querySelector(".bsb").onclick = (e) => {
      const b = e.target.closest("[data-s]"); if (!b) return;
      const j = F.styles.indexOf(b.dataset.s);
      if (j >= 0) F.styles.splice(j, 1); else F.styles.push(b.dataset.s);
      b.classList.toggle("on", j < 0); C.haptic(); dirty();
    }), () => drawStep());
}
function stepSheet() {
  C.sheet(`<div class="shs mmenu"><h3 style="font-size:15px">ステップ</h3>${STEPS.map((s, i) => { const miss = checks().filter((c) => c.s === i && !c.ok).length; return `<button class="srow pss ${i === S.step ? "cur" : ""}" data-go-step="${i}"><span class="num">${i + 1}</span>${esc(s.t())}<small>${miss ? `あと${miss}` : "✓"}</small></button>`; }).join("")}</div>`,
    (bs) => bs.querySelectorAll("[data-go-step]").forEach((b) => (b.onclick = () => { C.closeSheet(); goStep(+b.dataset.goStep); })));
}
function dayMenu(i) {
  const n = F.days.length;
  const rows = [];
  if (i > 0) rows.push('<button class="srow" data-dm="up">↑ 上へ移動</button>');
  if (i < n - 1) rows.push('<button class="srow" data-dm="down">↓ 下へ移動</button>', '<button class="srow" data-dm="ins">＋ この後に1日追加</button>');
  if (n > 1) rows.push('<button class="srow red" data-dm="del">この日を削除</button>');
  C.sheet(`<div class="shs mmenu"><h3 style="font-size:15px">DAY ${i + 1}</h3>${rows.join("")}</div>`, (bs) => bs.querySelectorAll("[data-dm]").forEach((b) => (b.onclick = () => {
    const a = b.dataset.dm;
    if (a === "up") [F.days[i - 1], F.days[i]] = [F.days[i], F.days[i - 1]];
    else if (a === "down") [F.days[i + 1], F.days[i]] = [F.days[i], F.days[i + 1]];
    else if (a === "ins") F.days.splice(i + 1, 0, newDay());
    else if (a === "del") { const d = F.days[i]; if ((d.summary || d.text || d.photos.length) && !confirm(`DAY ${i + 1} を削除しますか？`)) return; F.days.splice(i, 1); }
    C.closeSheet(); drawStep(); dirty();
  })));
}

// ---------- 場所（地図でピン） ----------
async function reverseCountry(lat, lng) {
  try { const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=3&lat=${lat}&lon=${lng}`, { headers: { Accept: "application/json" } }); if (!r.ok) return ""; const j = await r.json(); return (j && j.address && j.address.country_code) || ""; } catch (e) { return ""; }
}
async function mapPage(places, label) {
  const day = { places };
  const ov = document.createElement("div");
  ov.className = "pmap";
  ov.innerHTML = `<div class="bar2"><b>${esc(label)}</b><button class="mo" id="pmDone" style="font-size:15px;font-weight:700;color:var(--green)">完了</button></div>
    <div class="pms"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="pmQ" type="search" enterkeyhint="search" autocomplete="off" placeholder="場所を検索（例：ウユニ塩湖）"><div class="pmres" id="pmRes" hidden></div></div><div class="pmm" id="pmMap"></div><div class="pml"><p class="qhint" id="pmHint">地図をタップするとピンを置けます（複数OK）</p><div id="pmList"></div></div>`;
  root.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("open"));
  const close = () => { ov.classList.remove("open"); setTimeout(() => ov.remove(), 300); drawStep(); };
  ov.querySelector("#pmDone").onclick = close;
  try { await C.loadLeaflet(); } catch (e) { ov.querySelector("#pmMap").innerHTML = '<p class="loading">地図を読み込めませんでした</p>'; return; }
  const L = window.L;
  let center = [20, 0], zoom = 2;
  if (day.places.length) { center = [day.places[0].lat, day.places[0].lng]; zoom = 7; }
  else if (F.countries[0] && COUNTRY_LL[F.countries[0]]) { center = COUNTRY_LL[F.countries[0]]; zoom = 5; }
  const m = L.map(ov.querySelector("#pmMap"), { worldCopyJump: true, minZoom: 2, zoomControl: false, attributionControl: false }).setView(center, zoom);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(m);
  let mk = [];
  const draw = () => {
    mk.forEach((x) => m.removeLayer(x));
    mk = day.places.map((p, k) => L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<div class="ppin">${k + 1}</div>`, iconSize: [24, 24], iconAnchor: [12, 24] }) }).addTo(m));
    ov.querySelector("#pmList").innerHTML = day.places.map((p, k) => `<div class="pmr"><span class="num">${k + 1}</span><input class="pfi sm" data-pn="${k}" value="${esc(p.name)}" placeholder="地点の名前（任意）"><button data-px="${k}" aria-label="削除">×</button></div>`).join("");
    ov.querySelector("#pmHint").textContent = day.places.length ? `ピン${day.places.length}個（地図をタップで追加）` : "地図をタップするとピンを置けます（複数OK）";
  };
  m.on("click", (e) => {
    const p = { name: "", lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5), cc: "" };
    day.places.push(p); draw(); dirty(); C.haptic();
    reverseCountry(p.lat, p.lng).then((cc) => { if (cc) p.cc = cc; });
    const inp = ov.querySelector(`[data-pn="${day.places.length - 1}"]`); if (inp) inp.focus({ preventScroll: true });
  });
  // 場所の検索：候補をタップするとピンを置いて、その場所へ移動する
  const q = ov.querySelector("#pmQ"), res = ov.querySelector("#pmRes");
  let qt = 0, qn = 0, hits = [];
  const ccs = (F.countries || []).map((c) => COUNTRY_ISO[c]).filter(Boolean);
  const search = async (text, seq) => {
    const run = async (cc) => {
      const u = `https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=ja&addressdetails=1&q=${encodeURIComponent(text)}${cc ? "&countrycodes=" + cc : ""}`;
      try { const r = await fetch(u, { headers: { Accept: "application/json" } }); return r.ok ? await r.json() : []; } catch (e) { return []; }
    };
    let a = ccs.length ? await run(ccs.join(",")) : [];   // まず記事の国の中から探し、なければ世界中から
    if (!a.length) a = await run("");
    if (seq !== qn) return;
    hits = a.map((x) => { const parts = String(x.display_name || "").split(",").map((t) => t.trim()); return { name: x.name || parts[0] || text, sub: parts.slice(1, 4).join("、"), lat: +(+x.lat).toFixed(5), lng: +(+x.lon).toFixed(5), cc: (x.address || {}).country_code || "" }; });
    res.innerHTML = hits.length ? hits.map((h, k) => `<button data-hit="${k}"><b>${esc(h.name)}</b><small>${esc(h.sub)}</small></button>`).join("") : '<p class="none">見つかりませんでした。地図をタップしてピンを置くこともできます</p>';
    res.hidden = false;
  };
  q.oninput = () => {
    clearTimeout(qt); const text = q.value.trim(); const seq = ++qn;
    if (text.length < 2) { res.hidden = true; return; }
    res.hidden = false; res.innerHTML = '<p class="none">検索中…</p>';
    qt = setTimeout(() => search(text, seq), 450);
  };
  q.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(qt); const text = q.value.trim(); if (text.length >= 1) search(text, ++qn); } };
  res.onclick = (e) => {
    const b = e.target.closest("[data-hit]"); if (!b) return;
    const h = hits[+b.dataset.hit];
    day.places.push({ name: h.name, lat: h.lat, lng: h.lng, cc: h.cc }); draw(); dirty(); C.haptic();
    m.flyTo([h.lat, h.lng], Math.max(m.getZoom(), 12), { duration: 0.7 });
    q.value = ""; res.hidden = true; q.blur();
  };
  ov.querySelector("#pmList").oninput = (e) => { const k = e.target.dataset.pn; if (k !== undefined) { day.places[+k].name = e.target.value; dirty(); } };
  ov.querySelector("#pmList").onclick = (e) => { const b = e.target.closest("[data-px]"); if (b) { day.places.splice(+b.dataset.px, 1); draw(); dirty(); } };
  draw();
  setTimeout(() => { m.invalidateSize(); if (day.places.length > 1) m.fitBounds(L.latLngBounds(day.places.map((p) => [p.lat, p.lng])).pad(0.3)); }, 320);
}
async function geocode(q) {
  if (!q) return null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&addressdetails=1&q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const a = await r.json();
    if (a && a.length) return [parseFloat(a[0].lat), parseFloat(a[0].lon), (a[0].address || {}).country_code || ""];
  } catch (e) {}
  return null;
}
async function autoDetect() {
  const msg = root.querySelector("#pAutoMsg"), btn = root.querySelector("#pAuto");
  const ces = F.countries.map((v) => (cinfo(v) || {}).en).filter(Boolean);
  let tok; try { tok = await auth.currentUser.getIdToken(); } catch (e) { msg.textContent = "ログインを確認できませんでした"; return; }
  btn.disabled = true;
  let pins = 0, hitDays = 0, miss = 0, empty = 0;
  for (let i = 0; i < F.days.length; i++) {
    msg.textContent = `解析中…（${i + 1}/${F.days.length}）`;
    const day = F.days[i], text = day.text.trim();
    if (!text) { empty++; continue; }
    try {
      const r = await fetch("/api/extractPlaces", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok}` }, body: JSON.stringify({ text, country: ces[0] || "", countries: ces }) });
      if (!r.ok) throw 0;
      const places = ((await r.json()) || {}).places || [];
      const got = [];
      for (const p of places) { const ll = await geocode((p && p.query) || (p && p.name)); if (ll) got.push({ name: p.name || "", lat: +ll[0].toFixed(5), lng: +ll[1].toFixed(5), cc: ll[2] || "" }); }
      if (got.length) { day.places = got; day.open = true; hitDays++; pins += got.length; } else miss++;
    } catch (e) { miss++; }
  }
  btn.disabled = false;
  dirty();
  drawStep();
  root.querySelector("#pAutoMsg").textContent = `完了：${hitDays}日・合計${pins}個のピンを置きました。` + (miss ? `\n${miss}日は場所を特定できませんでした（地図で追加できます）。` : "") + (empty ? `\n${empty}日は文章が空でした。` : "");
}

// ---------- トランジットの仕上げ：旅程への紐付け・共同投稿者 ----------
function mountTransitFinish() {
  initCollabBox(root.querySelector("#pCollab"), { me: S.uid, onChange: drawParents });
  drawParents();
}
function drawParents() {
  const box = root.querySelector("#pPar"); if (!box) return;
  const items = S.trips.filter(sameMembers);
  if (F.parentId && !items.some((t) => t.id === F.parentId)) { const cur = S.trips.find((t) => t.id === F.parentId); if (cur) items.unshift(cur); }
  if (!items.length) { box.innerHTML = `<p class="qhint">${currentMembers().length > 1 ? "この記事と同じメンバーの旅程がありません。" : "紐付けできる旅程がまだありません。"}</p>`; return; }
  box.innerHTML = items.map((t) => `<button class="frow ptr ${F.parentId === t.id ? "on" : ""}" data-par="${esc(t.id)}"><span class="bx rd"></span><span class="tpi" style="background-image:url('${esc(t.thumbUrl || (t.heroUrls || [])[0] || "")}')"></span><span class="nm">${esc(t.title || "（無題）")}<small>${esc((t.countries || []).map((c) => (cinfo(c) || {}).jp).filter(Boolean).join("・"))}${t.status === "draft" ? "　下書き" : ""}</small></span></button>`).join("");
  box.onclick = (e) => {
    const b = e.target.closest("[data-par]"); if (!b) return;
    F.parentId = F.parentId === b.dataset.par ? null : b.dataset.par;   // もう一度押すと解除
    box.querySelectorAll("[data-par]").forEach((x) => x.classList.toggle("on", x.dataset.par === F.parentId));
    C.haptic(); dirty();
  };
}

// ---------- 仕上げ：トランジット・共同投稿者 ----------
function mountFinish() {
  initCollabBox(root.querySelector("#pCollab"), { me: S.uid, onChange: drawTransits });
  drawTransits();
}
function drawTransits() {
  const box = root.querySelector("#pTr"); if (!box) return;
  const items = S.transits.filter(sameMembers);
  S.shownTransits = items;
  if (!items.length) { box.innerHTML = `<p class="qhint">${currentMembers().length > 1 ? "この旅程と同じメンバーのトランジット記事がありません。" : "まだトランジット記事がありません。"}</p>`; return; }
  const sel = F.transitSel || [];
  box.innerHTML = items.map((t) => {
    const other = t.parentId && (!S.edit || t.parentId !== S.edit.id);
    return `<button class="frow ptr ${sel.includes(t.id) ? "on" : ""}" data-tr="${esc(t.id)}"><span class="bx"></span><span class="tpi" style="background-image:url('${esc((t.heroUrls || [])[0] || "")}')"></span><span class="nm">${esc(t.title || "トランジット記事")}<small>${esc([t.airport, t.layover ? `乗り継ぎ${t.layover}時間` : ""].filter(Boolean).join("・"))}${other ? "　※別の旅程に紐付け中" : ""}</small></span></button>`;
  }).join("");
  box.onclick = (e) => {
    const b = e.target.closest("[data-tr]"); if (!b) return;
    F.transitSel = F.transitSel || [];
    const j = F.transitSel.indexOf(b.dataset.tr);
    if (j >= 0) F.transitSel.splice(j, 1); else F.transitSel.push(b.dataset.tr);
    b.classList.toggle("on", j < 0); C.haptic(); dirty();
  };
}

// ---------- 前回の入力 ----------
function banner(saved) {
  const b = root.querySelector("#pBan");
  const t = new Date(saved.at), p = (n) => String(n).padStart(2, "0");
  b.innerHTML = `<div class="pban"><div><b>${S.edit ? "保存していない変更が残っています" : "前回の入力が残っています"}</b><small>${t.getMonth() + 1}/${t.getDate()} ${t.getHours()}:${p(t.getMinutes())} にこの端末に保存</small></div><button class="btn-s" id="pbYes">続きから</button><button class="btn-g" id="pbNo">消す</button></div>`;
  b.querySelector("#pbYes").onclick = () => {
    const keepTr = F.transitSel;
    F = { ...blank(), ...saved.data };
    if (F.transitSel === null) F.transitSel = keepTr;
    S.paused = false; b.innerHTML = saved.newPhotos ? '<p class="pban2">続きから再開しました。まだ保存していなかった写真は残らないので、選び直してください。</p>' : "";
    drawStep(); dirty();
  };
  b.querySelector("#pbNo").onclick = () => { try { localStorage.removeItem(S.asKey); } catch (e) {} S.paused = false; b.innerHTML = ""; };
}

// ---------- 保存 ----------
async function submit(mode) {
  if (S.saving) return;
  if (S.kind === "transit" && mode === "draft" && !F.countries.length) { C.toast("下書きでも経由した国は必要です"); goStep(0); return; }
  if (S.kind !== "transit" && mode === "draft" && !F.title.trim()) { C.toast("下書きでもタイトルは必要です"); goStep(0); return; }
  if (mode === "publish") {
    const miss = checks().filter((c) => !c.ok);
    if (miss.length) {
      C.sheet(`<div class="shs mmenu"><h3 style="font-size:15px">あと${miss.length}項目で投稿できます</h3>${miss.map((c) => `<button class="srow" data-j="${c.s}">${esc(c.l)}<small style="margin-left:auto;color:var(--muted)">${esc(STEPS[c.s].t())} ›</small></button>`).join("")}</div>`,
        (bs) => bs.querySelectorAll("[data-j]").forEach((b) => (b.onclick = () => { C.closeSheet(); goStep(+b.dataset.j); })));
      return;
    }
  }
  S.saving = true;
  const ov = document.createElement("div");
  ov.className = "psave"; ov.innerHTML = '<div class="spin"></div><p id="psvMsg">保存の準備中…</p>';
  root.appendChild(ov);
  try {
    const progress = (t) => { const m = ov.querySelector("#psvMsg"); if (m) m.textContent = t; };
    const r = S.kind === "transit"
      ? await saveTransit({ d: toTransit(), mode, nickname: S.nickname, edit: S.edit, progress })
      : await saveArticle({
          d: toData(), mode, nickname: S.nickname, edit: S.edit,
          transits: { selected: F.transitSel || [], shown: S.shownTransits || S.transits.filter(sameMembers) },
          progress
        });
    // 次の保存で同じ写真を二重にアップロードしないよう、保存済みのURLに置き換える
    F.hero = r.heroUrls.map((url) => ({ url }));
    if (r.days) F.days.forEach((d, i) => (d.photos = ((r.days[i] || {}).photoUrls || []).map((url) => ({ url }))));
    try { localStorage.removeItem(S.asKey); localStorage.removeItem(AS_KEY(S.uid, r.id, S.kind)); } catch (e) {}
    S.edit = { ...(S.edit || { createdAt: null, publishedAt: null, authorNickname: S.nickname }), id: r.id, status: r.status };
    S.asKey = AS_KEY(S.uid, r.id, S.kind); S.base = sig(); S.dirty = false;
    ov.remove(); S.saving = false;
    C.haptic();
    C.onSaved(r.id);
    { const tb = root.querySelector(".bar2 b"); if (tb) tb.textContent = r.status === "draft" ? "下書きを編集" : "投稿を編集"; }
    if (mode === "draft") { C.toast("下書きを保存しました"); drawStep(); return; }
    // 旅程の投稿画面から開いたトランジットは、保存したら旅程の画面に戻り、その旅程に紐付け済みにする
    const finish = (S.stacked && S.kind === "transit") ? () => {
      const newId = r.id;
      C.back();
      setTimeout(() => {
        if (!S || S.kind !== "trip") return;
        loadMyTransits(S.uid).then((l) => {
          S.transits = l; F.transitSel = F.transitSel || [];
          if (!F.transitSel.includes(newId)) F.transitSel.push(newId);
          dirty(); if (STEPS[S.step].k === "finish") drawStep();
        }).catch(() => {});
      }, 450);
    } : () => C.done(r.id);
    if (r.firstSubmit) { showPostThanks({ onDone: finish, goLabel: (S.stacked && S.kind === "transit") ? "旅程の編集に戻る" : "マイページへ" }); return; }
    C.toast(r.status === "published" ? "記事を更新しました" : "更新しました。承認後に公開されます");
    finish();
  } catch (err) {
    console.error(err);
    ov.remove(); S.saving = false;
    C.toast("保存できませんでした：" + ((err && err.message) || err));
  }
}
