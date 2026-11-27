// Tabistock アプリ版：航空券の相場（日本発・往復の月別最安値）
// データは /api/fares（記事を1本以上公開した人にだけ返す）。地図は探すの地図と同じ陸地の形で描く。
import { auth } from "../firebase-config.js";
import { esc, yen } from "../tabistock-render.js";

// 都市の一覧（flights.html と同じ。地域 → [コード, 都市, 国]）・都市→国・都市の座標 [経度, 緯度]
export const REG = [
 ['asia','アジア',[['SEL','ソウル','韓国'],['PUS','釜山','韓国'],['TPE','台北','台湾'],['HKG','香港','香港'],['SHA','上海','中国'],['BJS','北京','中国'],['BKK','バンコク','タイ'],['SGN','ホーチミン','ベトナム'],['HAN','ハノイ','ベトナム'],['DAD','ダナン','ベトナム'],['SIN','シンガポール','シンガポール'],['KUL','クアラルンプール','マレーシア'],['MNL','マニラ','フィリピン'],['CEB','セブ','フィリピン'],['DPS','バリ島','インドネシア'],['DEL','デリー','インド'],['KTM','カトマンズ','ネパール'],['ALA','アルマトイ','カザフスタン'],['TAS','タシケント','ウズベキスタン'],['DXB','ドバイ','UAE'],['IST','イスタンブール','トルコ']]],
 ['europe','ヨーロッパ',[['LON','ロンドン','イギリス'],['PAR','パリ','フランス'],['ROM','ローマ','イタリア'],['MIL','ミラノ','イタリア'],['BCN','バルセロナ','スペイン'],['MAD','マドリード','スペイン'],['LIS','リスボン','ポルトガル'],['AMS','アムステルダム','オランダ'],['FRA','フランクフルト','ドイツ'],['MUC','ミュンヘン','ドイツ'],['ZRH','チューリッヒ','スイス'],['VIE','ウィーン','オーストリア'],['PRG','プラハ','チェコ'],['BUD','ブダペスト','ハンガリー'],['HEL','ヘルシンキ','フィンランド'],['CPH','コペンハーゲン','デンマーク'],['STO','ストックホルム','スウェーデン'],['ATH','アテネ','ギリシャ']]],
 ['na','北米',[['HNL','ホノルル','アメリカ'],['LAX','ロサンゼルス','アメリカ'],['SFO','サンフランシスコ','アメリカ'],['SEA','シアトル','アメリカ'],['NYC','ニューヨーク','アメリカ'],['YVR','バンクーバー','カナダ'],['YTO','トロント','カナダ']]],
 ['la','中南米',[['MEX','メキシコシティ','メキシコ'],['CUN','カンクン','メキシコ'],['LIM','リマ','ペルー'],['SAO','サンパウロ','ブラジル'],['BUE','ブエノスアイレス','アルゼンチン']]],
 ['oc','オセアニア',[['SYD','シドニー','オーストラリア'],['MEL','メルボルン','オーストラリア'],['BNE','ブリスベン','オーストラリア'],['CNS','ケアンズ','オーストラリア'],['PER','パース','オーストラリア'],['AKL','オークランド','ニュージーランド']]],
 ['af','アフリカ',[['CAI','カイロ','エジプト'],['RAK','マラケシュ','モロッコ'],['JNB','ヨハネスブルグ','南アフリカ'],['CPT','ケープタウン','南アフリカ']]]
];
export const CK={"SEL": "korea", "PUS": "korea", "TPE": "taiwan", "HKG": "hongkong", "SHA": "china", "BJS": "china", "BKK": "thai", "SGN": "vietnam", "HAN": "vietnam", "DAD": "vietnam", "SIN": "singapore", "KUL": "malaysia", "MNL": "philippines", "CEB": "philippines", "DPS": "indonesia", "DEL": "india", "KTM": "nepal", "ALA": "kazakhstan", "TAS": "uzbekistan", "DXB": "UAE", "IST": "turkey", "LON": "uk", "PAR": "france", "ROM": "italy", "MIL": "italy", "BCN": "spain", "MAD": "spain", "LIS": "portugal", "AMS": "netherlands", "FRA": "germany", "MUC": "germany", "ZRH": "switzerland", "VIE": "austria", "PRG": "czech", "BUD": "hungary", "HEL": "finland", "CPH": "denmark", "STO": "sweden", "ATH": "greece", "CAI": "egypt", "RAK": "morocco", "JNB": "south-africa", "CPT": "south-africa", "HNL": "hawaii", "LAX": "usa", "SFO": "usa", "SEA": "usa", "NYC": "usa", "YVR": "canada", "YTO": "canada", "MEX": "mexico", "CUN": "mexico", "LIM": "peru", "SAO": "brazil", "BUE": "argentina", "SYD": "australia", "MEL": "australia", "BNE": "australia", "CNS": "australia", "PER": "australia", "AKL": "new-zealand"};
export const LL={"SEL": [126.98, 37.57], "PUS": [129.08, 35.18], "TPE": [121.56, 25.03], "HKG": [114.17, 22.32], "SHA": [121.47, 31.23], "BJS": [116.4, 39.9], "BKK": [100.5, 13.75], "SGN": [106.7, 10.78], "HAN": [105.85, 21.03], "DAD": [108.22, 16.05], "SIN": [103.82, 1.35], "KUL": [101.69, 3.14], "MNL": [120.98, 14.6], "CEB": [123.89, 10.32], "DPS": [115.17, -8.65], "DEL": [77.21, 28.61], "KTM": [85.32, 27.72], "ALA": [76.95, 43.24], "TAS": [69.24, 41.3], "DXB": [55.27, 25.2], "IST": [28.98, 41.01], "LON": [-0.13, 51.51], "PAR": [2.35, 48.86], "ROM": [12.5, 41.9], "MIL": [9.19, 45.46], "BCN": [2.17, 41.39], "MAD": [-3.7, 40.42], "LIS": [-9.14, 38.72], "AMS": [4.9, 52.37], "FRA": [8.68, 50.11], "MUC": [11.58, 48.14], "ZRH": [8.54, 47.38], "VIE": [16.37, 48.21], "PRG": [14.42, 50.08], "BUD": [19.04, 47.5], "HEL": [24.94, 60.17], "CPH": [12.57, 55.68], "STO": [18.07, 59.33], "ATH": [23.73, 37.98], "CAI": [31.24, 30.04], "RAK": [-7.99, 31.63], "JNB": [28.05, -26.2], "CPT": [18.42, -33.92], "HNL": [-157.86, 21.31], "LAX": [-118.24, 34.05], "SFO": [-122.42, 37.77], "SEA": [-122.33, 47.61], "NYC": [-74.0, 40.71], "YVR": [-123.12, 49.28], "YTO": [-79.38, 43.65], "MEX": [-99.13, 19.43], "CUN": [-86.85, 21.16], "LIM": [-77.04, -12.05], "SAO": [-46.63, -23.55], "BUE": [-58.38, -34.6], "SYD": [151.21, -33.87], "MEL": [144.96, -37.81], "BNE": [153.03, -27.47], "CNS": [145.77, -16.92], "PER": [115.86, -31.95], "AKL": [174.76, -36.85]};

let C = null, root = null;
let FARES = null, SKY = null, UPDATED = "";
const V = { origin: "JP", region: "asia", city: "SEL" };
let MAP = null, LAY = null;
const ZOOM_ALL = 4;   // この拡大率から、全部の都市に名前と値段を出す

// 今月から12か月
function months() {
  const n = new Date(Date.now() + 9 * 3600e3);   // 日本時間
  return Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() + i, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
}
const man = (n) => (n / 10000).toFixed(1).replace(/\.0$/, "") + "万";
const md = (d) => { const [, m, dd] = d.split("-"); return Number(m) + "/" + Number(dd); };
const nights = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const trTxt = (n) => (n === 0 ? "直行" : `乗継${n}回`);
const legs = (x) => (x.tr == null ? "月別の最安値" : x.tr === x.rtr ? trTxt(x.tr) : `行き${trTxt(x.tr)}・帰り${trTxt(x.rtr)}`);
const when = (x) => (x.dep ? `${md(x.dep)}〜${md(x.ret)}（${nights(x.dep, x.ret)}泊）` : "");
const mLabel = (m) => Number(m.split("-")[1]) + "月";

// 各月の最安値（東京・大阪それぞれ Aviasales と Skyscanner の安い方。「日本」は東京・大阪の安い方）
function series(code) {
  return months().map((m) => {
    const best = (o) => { const a = ((FARES[o] || {})[code] || {})[m], k = ((SKY[o] || {})[code] || {})[m]; if (a && (!k || a[0] <= k)) return a; if (k) return [k, null, null, null, null]; return null; };
    const t = best("TYO"), o = best("OSA");
    const mk = (x, f) => ({ p: x[0], tr: x[1], rtr: x[2], dep: x[3], ret: x[4], from: f });
    let pick = null;
    if (V.origin === "TYO" && t) pick = mk(t, "東京");
    else if (V.origin === "OSA" && o) pick = mk(o, "大阪");
    else if (V.origin === "JP") { if (t && (!o || t[0] <= o[0])) pick = mk(t, "東京"); else if (o) pick = mk(o, "大阪"); }
    return { m, ...(pick || {}) };
  });
}
const minOf = (code) => { const h = series(code).filter((x) => x.p); return h.length ? Math.min(...h.map((x) => x.p)) : null; };

export async function pageFares(el, ctx) {
  C = ctx; root = el;
  el.innerHTML = C.bar("航空券の相場") + '<div class="ps under2 nb" id="fScroll"><p class="loading" style="padding-top:60px">読み込み中…</p></div>';
  if (!C.me) return lock("login");
  try {
    const res = await fetch("/api/fares", { method: "POST", headers: { Authorization: "Bearer " + (await auth.currentUser.getIdToken()) } });
    if (res.status === 401) return lock("login");
    if (res.status === 403) return lock("noarticle");
    if (!res.ok) throw new Error("status " + res.status);
    const d = await res.json();
    FARES = d.fares || {}; SKY = d.sky || {}; UPDATED = d.updated || "";
  } catch (e) { console.warn(e); return lock("error"); }
  shell();
  return () => { if (MAP) { try { MAP.remove(); } catch (e) {} MAP = null; } };
}

function lock(kind) {
  const box = root.querySelector("#fScroll");
  const head = '<div class="fhero"><small class="num">FLIGHT COST CALENDAR</small><h2>航空券、何月が安い？</h2><p>日本発・往復の最安値を、61都市・12か月ぶん。</p></div>';
  const msg = {
    login: ['ログインすると見られます', '記事を1本公開した人に、ひと足先に公開している機能です。', '<a class="fcta" href="#x-login">ログインする</a>'],
    noarticle: ['記事を1本公開すると、全61都市の相場が見られます', '開発中の機能を、旅の記事を書いてくれた人にひと足先に公開しています。', '<a class="fcta" href="#p">旅程を投稿する</a>'],
    error: ['読み込めませんでした', '通信状況を確認して、もう一度開いてください。', '<button class="fcta" id="fRetry">もう一度読み込む</button>']
  }[kind];
  box.innerHTML = head + `<div class="flock"><b>${msg[0]}</b><p>${msg[1]}</p>${msg[2]}</div>`;
  const r = box.querySelector("#fRetry"); if (r) r.onclick = () => pageFares(root, C);
}

function shell() {
  const box = root.querySelector("#fScroll");
  const up = UPDATED ? (() => { const [y, m, d] = UPDATED.split("-"); return `${Number(m)}月${Number(d)}日`; })() : "";
  box.innerHTML = `<div class="fhero"><small class="num">FLIGHT COST CALENDAR</small><h2>航空券、何月が安い？</h2><p>日本発・往復の最安値を、61都市・12か月ぶん。${up ? `<br>${up}時点の価格です。` : ""}</p></div>
    <div class="forg" id="fOrg">${[["JP", "日本"], ["TYO", "東京発"], ["OSA", "大阪発"]].map(([v, l]) => `<button data-o="${v}">${l}</button>`).join("")}</div>
    <div class="freg" id="fReg">${REG.map((r) => `<button data-r="${r[0]}">${r[1]}</button>`).join("")}</div>
    <div class="fmw" id="fMw"><div class="fmap" id="fMap"></div><div class="fzm"><button data-z="1" aria-label="拡大">＋</button><button data-z="-1" aria-label="縮小">−</button><button data-z="full" aria-label="地図を大きく"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div></div>
    <div id="fDetail"></div>
    <div class="fsh"><h3>都市を選ぶ</h3><small>安い順</small></div>
    <div id="fList"></div>
    <div id="fReal"></div>
    <p class="fnote">複数の航空券比較サイトで直近に見つかった往復の最安値（安い方）をもとにした目安です。日程が出ているものは具体的な旅程の最安値、「月別の最安値」は月ごとの最安値のみの目安です。最新の価格・空席は予約サイトで確認してください。</p>`;
  box.querySelector("#fOrg").onclick = (e) => { const b = e.target.closest("[data-o]"); if (b) { V.origin = b.dataset.o; C.haptic(); draw(); } };
  box.querySelector("#fReg").onclick = (e) => { const b = e.target.closest("[data-r]"); if (b) { V.region = b.dataset.r; V.city = cheapest(); C.haptic(); draw(true); } };
  box.querySelector("#fMw .fzm").onclick = (e) => {
    const b = e.target.closest("[data-z]"); if (!b || !MAP) return;
    C.haptic();
    if (b.dataset.z === "full") {
      const on = root.querySelector("#fMw").classList.toggle("full");
      b.innerHTML = on ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>';
      setTimeout(() => MAP.invalidateSize(), 320);
      return;
    }
    MAP.setZoom(MAP.getZoom() + Number(b.dataset.z));
  };
  box.querySelector("#fList").onclick = (e) => { const b = e.target.closest("[data-c]"); if (b) pick(b.dataset.c, true); };
  draw(true);
}
const R = () => REG.find((r) => r[0] === V.region);
function cheapest() { const l = R()[2].map(([c]) => [c, minOf(c)]).filter((x) => x[1]).sort((a, b) => a[1] - b[1]); return (l[0] || [R()[2][0][0]])[0]; }
function pick(c, scroll) {
  V.city = c; C.haptic(); draw();
  if (scroll) { const sc = root.querySelector("#fScroll"), d = root.querySelector("#fDetail"); sc.scrollTo({ top: d.offsetTop - 120, behavior: "smooth" }); }
}

function draw(refit) {
  root.querySelectorAll("#fOrg [data-o]").forEach((b) => b.classList.toggle("on", b.dataset.o === V.origin));
  root.querySelectorAll("#fReg [data-r]").forEach((b) => b.classList.toggle("on", b.dataset.r === V.region));
  const items = R()[2].map(([c, n, k]) => ({ c, n, k, mn: minOf(c) })).sort((a, b) => (a.mn || 1e9) - (b.mn || 1e9));
  if (!items.some((x) => x.c === V.city)) V.city = items[0].c;
  const vals = items.filter((x) => x.mn).map((x) => x.mn);
  const cheapLine = vals[Math.floor(vals.length * 0.3)] || 0;
  root.querySelector("#fList").innerHTML = items.map((x) => `<button class="fcity ${x.c === V.city ? "on" : ""}" data-c="${x.c}"><span class="n"><b>${esc(x.n)}</b><small>${esc(x.k)}</small></span><span class="p num ${x.mn && x.mn <= cheapLine ? "lo" : ""}">${x.mn ? yen(x.mn) + "〜" : "集計中"}</span></button>`).join("");
  detail(items.find((x) => x.c === V.city));
  real(items.find((x) => x.c === V.city));
  drawMap(items, cheapLine, refit);
}

function detail(meta) {
  const s = series(meta.c), have = s.filter((x) => x.p);
  const mn = have.length ? Math.min(...have.map((x) => x.p)) : null, mx = have.length ? Math.max(...have.map((x) => x.p)) : 1;
  const best = have.find((x) => x.p === mn);
  const oName = { JP: "東京・大阪の安い方", TYO: "東京発", OSA: "大阪発" }[V.origin];
  const top3 = have.slice().sort((a, b) => a.p - b.p).slice(0, 3);
  root.querySelector("#fDetail").innerHTML = `<div class="fdt">
    <div class="fdh"><h3>${esc(meta.n)}</h3><small>${esc(meta.k)}・${oName}・往復</small></div>
    ${best ? `<div class="fbest"><small>いちばん安い月</small><b class="num">${yen(best.p)}</b><p>${mLabel(best.m)}${best.dep ? "・" + when(best) : ""}・${best.from}発・${legs(best)}</p></div>` : '<p class="qhint" style="padding:14px 0">まだデータがありません</p>'}
    <div class="fch">${s.map((x) => `<div class="fc"><span class="v num ${x.p === mn ? "min" : ""}">${x.p ? man(x.p) : "-"}</span><i class="${x.p ? (x.p === mn ? "min" : "") : "none"}" style="height:${x.p ? Math.max(10, Math.round((x.p / mx) * 110)) : 6}px"></i><span class="m">${mLabel(x.m)}${x.m.endsWith("-01") ? `<br><em>${x.m.slice(2, 4)}年</em>` : ""}</span></div>`).join("")}</div>
    ${top3.length ? `<div class="ftop">${top3.map((x, i) => `<div class="ftr"><span class="num">${i + 1}</span><span class="t"><b>${mLabel(x.m)}</b><small>${x.dep ? when(x) + "・" : ""}${x.from}発・${legs(x)}</small></span><b class="num">${yen(x.p)}</b></div>`).join("")}</div>` : ""}
  </div>`;
}

// Tabistock の記事で、実際にいくらで行ったか
function real(meta) {
  const key = CK[meta.c], rows = [];
  (C.all() || []).forEach((a) => {
    if (a.type === "transit" || a.notFromJapan || !(a.countries || []).includes(key)) return;
    const fl = (a.flights || []).filter((f) => f && Number(f.price) > 0 && (!f.mode || f.mode === "plane"));
    if (!fl.length) return;
    const total = fl.reduce((t, f) => t + Number(f.price), 0);
    const routes = fl.map((f) => f.route || [f.from, f.to].filter(Boolean).join(" → "));
    rows.push({ a, total, routes, hit: routes.join(" ").includes(meta.n) ? 1 : 0 });
  });
  rows.sort((x, y) => y.hit - x.hit || x.total - y.total);
  root.querySelector("#fReal").innerHTML = `<div class="fsh"><h3>Tabistockの実例</h3><small>${esc(meta.k)}・航空券の合計</small></div>` + (rows.length
    ? rows.slice(0, 4).map(({ a, total, routes }) => `<a class="freal" href="#a-${esc(a.id)}"><span class="fi" style="background-image:url('${esc(C.thumb(a))}')"></span><span class="t"><b>${esc(a.title || "")}</b><small>${esc(routes.length > 2 ? routes[0] + " ほか" + (routes.length - 1) + "区間" : routes.join(" ／ "))}${a.flightWhen ? "・予約：" + esc(a.flightWhen) : ""}</small></span><b class="num">${yen(total)}</b></a>`).join("")
    : '<p class="fempty">まだこの国の航空券の記録はありません。行ったことがあれば、ぜひ投稿してください。</p>');
}

async function drawMap(items, cheapLine, refit) {
  const box = root.querySelector("#fMap"); if (!box) return;
  const L0 = await (async () => { try { await C.loadLeaflet(); return window.L; } catch (e) { return null; } })();
  if (!L0) { box.innerHTML = '<p class="loading">地図を読み込めませんでした</p>'; return; }
  const L = L0;
  if (!MAP) {
    MAP = L.map(box, { zoomControl: false, attributionControl: false, worldCopyJump: false, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, preferCanvas: true });
    MAP.setView([30, 120], 2);
    try {
      const shapes = await C.shapes();
      Object.keys(shapes).forEach((iso) => L.polygon(C.rings(iso), { fillColor: "#e7e0d1", fillOpacity: 1, color: "#d8d0bf", weight: 0.5, interactive: false }).addTo(MAP));
    } catch (e) {}
    // 拡大・縮小で文字の出し方が変わるので描き直す
    MAP.on("zoomend", () => { const z = MAP.getZoom() >= ZOOM_ALL; if (z !== MAP._fz) { MAP._fz = z; draw(); } });
    L.circleMarker([35.68, 139.7], { radius: 4, color: "#fff", weight: 1.5, fillColor: "#1b2330", fillOpacity: 1, interactive: false }).addTo(MAP);
  }
  if (LAY) MAP.removeLayer(LAY);
  LAY = L.layerGroup().addTo(MAP);
  const zoomed = MAP.getZoom() >= ZOOM_ALL;
  // 選んだ都市は最後に描いて、いちばん上に出す
  items.slice().sort((a, b) => (a.c === V.city) - (b.c === V.city)).forEach((x) => {
    const [lng, lat] = LL[x.c]; const on = x.c === V.city, lo = x.mn && x.mn <= cheapLine;
    const mk = L.circleMarker([lat, lng], { radius: on ? 7 : lo ? 5 : 4, color: "#fff", weight: 1.5, fillColor: on ? "#e2683b" : lo ? "#1f6f5b" : "#8a94a3", fillOpacity: 1 }).addTo(LAY);
    // 値段の文字は「選んだ都市」と「安い都市」だけ（ほかは点のみ）。拡大すると全部の都市に出す
    if (on || lo || zoomed) mk.bindTooltip(on ? `<b>${esc(x.n)}</b>${x.mn ? man(x.mn) + "〜" : "集計中"}` : `${esc(x.n)} ${man(x.mn)}`, { permanent: true, direction: on ? "top" : "right", offset: on ? [0, -8] : [6, 0], className: "fpl" + (on ? " on" : "") + (lo ? " lo" : ""), interactive: false });
    else mk.bindTooltip(`${esc(x.n)} ${x.mn ? man(x.mn) : "集計中"}`, { direction: "top", className: "fpl tip" });
    mk.on("click", () => pick(x.c));
  });
  if (refit) {
    const pts = items.map((x) => { const [lng, lat] = LL[x.c]; return [lat, lng]; }).concat(["asia", "oc"].includes(V.region) ? [[35.68, 139.7]] : []);
    setTimeout(() => { MAP.invalidateSize(); MAP.fitBounds(L.latLngBounds(pts).pad(0.12), { animate: false }); }, 30);
  }
}
