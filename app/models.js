// 旅の掲示板（旅と地理）の記事の中に入れる、手で動かせるモデル
// いまあるもの：hadley＝大気大循環（月をスライダーで動かすと、雨の帯と、乾燥の帯が南北に動く。行き先ごとの「いまの雨」が出る）
// 本物の気候を、ごく簡単にしたモデルです（目安）。細かい雨の量は、各地の観光局などの情報で確認してください。

const INK = "#1b2330", G = "#1f6f5b", T = "#e2683b";
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

// 行き先：lat＝だいたいの緯度（南がマイナス）
const PLACES = {
  atacama: { n: "アタカマ砂漠", lat: -23 },
  namib: { n: "ナミブ砂漠", lat: -24 },
  sahara: { n: "サハラ砂漠", lat: 23 },
  bali: { n: "バリ島", lat: -8.5 },
  nairobi: { n: "ナイロビ（ケニア）", lat: -1.3 },
};

// 太陽の真下の緯度（月の真ん中の日で計算。12月に南回帰線、6月に北回帰線）
const sunLat = (t) => -23.44 * Math.cos((2 * Math.PI * ((t - 0.5) * 30.4 + 10)) / 365);
// 雨の帯（熱帯収束帯）の中心。太陽より少しおそれて、動きもおだやか（目安）
const bandLat = (m) => 0.55 * sunLat(m - 1);

const X = (lat) => 20 + ((lat + 60) / 120) * 320;
const clampLat = (l) => Math.max(-60, Math.min(60, l));

function state(m, lat) {
  const b = bandLat(m);
  const wet = Math.exp(-(((lat - b) / 9) ** 2));
  if (Math.abs(lat) >= 18) return { k: "dry", t: "一年じゅう、ほぼ乾燥（高圧帯の下）" };
  if (wet > 0.55) return { k: "wet", t: "雨が多い時期（雨季）" };
  if (wet > 0.2) return { k: "mid", t: "雨がふえる・へる、まんなか" };
  return { k: "dry", t: "雨が少ない時期（乾季）" };
}

function svg(m, placeKey) {
  const b = bandLat(m), d = sunLat(m);
  const hs = -28 + 0.35 * b, hn = 28 + 0.35 * b;   // 亜熱帯高圧帯（乾燥しやすい帯）の中心。夏の半球のほうが、少し極がわにずれる
  const band = (c, w, fill, op) => {
    const x1 = X(clampLat(c - w)), x2 = X(clampLat(c + w));
    return x2 > x1 ? `<rect x="${x1.toFixed(1)}" y="26" width="${(x2 - x1).toFixed(1)}" height="118" fill="${fill}" opacity="${op}"/>` : "";
  };
  const arrow = (lat, up) => {
    if (lat < -56 || lat > 56) return "";
    const x = X(lat).toFixed(1), y1 = up ? 132 : 40, y2 = up ? 44 : 130, hd = up ? 52 : 122;
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${INK}" stroke-width="2.5"/><path d="M${(+x - 6).toFixed(1)} ${hd} L${x} ${up ? 42 : 134} L${(+x + 6).toFixed(1)} ${hd}" fill="none" stroke="${INK}" stroke-width="2.5"/>`;
  };
  const pins = Object.entries(PLACES).map(([k, p]) => {
    const x = X(p.lat).toFixed(1), on = k === placeKey;
    return `<g><line x1="${x}" y1="146" x2="${x}" y2="${on ? 164 : 158}" stroke="${INK}" stroke-width="${on ? 3 : 1.5}"/>${on ? `<circle cx="${x}" cy="168" r="6" fill="${T}" stroke="${INK}" stroke-width="2.5"/>` : `<circle cx="${x}" cy="160" r="3" fill="${INK}"/>`}</g>`;
  }).join("");
  const ticks = [[-23.4, "南回帰線"], [0, "赤道"], [23.4, "北回帰線"]].map(([l, n]) => `<line x1="${X(l).toFixed(1)}" y1="26" x2="${X(l).toFixed(1)}" y2="146" stroke="${INK}" stroke-width="1" stroke-dasharray="3 4" opacity=".45"/><text x="${X(l).toFixed(1)}" y="190" font-size="9" text-anchor="middle" fill="${INK}" opacity=".7">${n}</text>`).join("");
  const p = PLACES[placeKey];
  const lab = `<text x="${Math.max(48, Math.min(312, X(p.lat))).toFixed(1)}" y="205" font-size="11" font-weight="700" text-anchor="middle" fill="${INK}">${p.n}</text>`;
  return `<svg viewBox="0 0 360 212" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="大気大循環のモデル">
    <rect x="20" y="26" width="320" height="120" fill="#fbf9f4" stroke="${INK}" stroke-width="2.5"/>
    ${band(b, 9, G, 0.32)}${band(hs, 9, T, 0.28)}${band(hn, 9, T, 0.28)}
    ${ticks}
    ${arrow(b, true)}${arrow(hs, false)}${arrow(hn, false)}
    <rect x="20" y="146" width="320" height="6" fill="${INK}"/>
    <circle cx="${X(d).toFixed(1)}" cy="13" r="8" fill="${T}" stroke="${INK}" stroke-width="2.5"/>
    <text x="${Math.max(60, Math.min(300, X(d)) + 0).toFixed(1)}" y="12" dx="${X(d) > 250 ? -14 : 14}" font-size="9" text-anchor="${X(d) > 250 ? "end" : "start"}" fill="${INK}" dy="3">太陽が真上にくる緯度</text>
    <text x="24" y="40" font-size="9" fill="${INK}" opacity=".6">南緯60°</text><text x="336" y="40" font-size="9" text-anchor="end" fill="${INK}" opacity=".6">北緯60°</text>
    ${pins}${lab}
  </svg>`;
}

// 1つ分のモデルの中身（スライダーと行き先のボタンは、そのまま。図と文字だけ入れかえる）
function inner(m, placeKey) {
  const p = PLACES[placeKey], st = state(m, p.lat);
  return `<div class="mdl-fig">${svg(m, placeKey)}</div>
    <div class="mdl-res ${st.k}"><span>${MONTHS[m - 1]}の${p.n}</span><b>${st.t}</b></div>`;
}

// 記事の中に出す（b = { t: "model", k: "hadley", p: 最初の行き先, m: 最初の月, cap: 説明 }）
export function modelHtml(b) {
  if (b.k !== "hadley") return "";
  const place = PLACES[b.p] ? b.p : "atacama", m = Math.min(12, Math.max(1, +b.m || 1));
  return `<figure class="bfig"><div class="mdl" data-mdl="hadley" data-m="${m}" data-p="${place}">
    <p class="mdl-h">手で動かしてみよう</p>
    <div class="mdl-body">${inner(m, place)}</div>
    <label class="mdl-sl"><span>月</span><input type="range" class="mdl-m" min="1" max="12" step="1" value="${m}" aria-label="月"><b>${MONTHS[m - 1]}</b></label>
    <div class="mdl-ps">${Object.entries(PLACES).map(([k, q]) => `<button type="button" class="mdl-p${k === place ? " on" : ""}" data-pk="${k}">${q.n}</button>`).join("")}</div>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}

// 動かしたとき（スライダー・行き先のボタン）。画面全体で、1回だけつなぐ
let wired = false;
export function wireModels() {
  if (wired) return;
  wired = true;
  const redraw = (root) => {
    const m = +root.dataset.m, p = root.dataset.p;
    root.querySelector(".mdl-body").innerHTML = inner(m, p);
    root.querySelector(".mdl-sl b").textContent = MONTHS[m - 1];
    root.querySelectorAll(".mdl-p").forEach((x) => x.classList.toggle("on", x.dataset.pk === p));
  };
  document.addEventListener("input", (e) => {
    const r = e.target.closest && e.target.closest(".mdl .mdl-m");
    if (!r) return;
    const root = r.closest(".mdl"); root.dataset.m = r.value; redraw(root);
  });
  document.addEventListener("click", (e) => {
    const bt = e.target.closest && e.target.closest(".mdl-p");
    if (!bt) return;
    const root = bt.closest(".mdl"); root.dataset.p = bt.dataset.pk; redraw(root);
  });
}
