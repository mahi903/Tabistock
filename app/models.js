// 旅の掲示板（旅と地理）の記事の中に入れる、手で動かせるモデル
// いまあるもの：hadley＝大気大循環の地球儀（月のスライダーで、雨の帯と、かわきやすい帯が南北に動く。指で地球をまわせる）
//             patagonia＝アンデス山脈の断面（スライダーで風を西から東へ進めると、雨や雪を降らせて乾いていく）
//             fjord＝フィヨルドができるまで（谷の断面。スライダーで「川の谷→氷河でけずる→海水が入る」と進む）
// 本物の気候を、ごく簡単にしたモデルです（目安）。

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const RAD = Math.PI / 180;
const SIZE = 360;   // 地球儀を描く絵のサイズ（正方形）

// 行き先（いまはアタカマだけ）
const PLACE = { n: "アタカマ砂漠", lat: -23, lon: -68.5 };

// 南アメリカの、ごくおおまかな海岸線（経度, 緯度）
const SA = [[-77, 8], [-72, 12], [-67, 11], [-62, 10.5], [-57, 6], [-52, 5], [-50, 0], [-45, -2], [-40, -3], [-35, -5], [-35, -9], [-38, -13], [-39, -18], [-41, -22], [-45, -24], [-48, -26], [-49, -29], [-53, -34], [-57, -35], [-58, -38], [-62, -39], [-65, -41], [-65, -45], [-67, -47], [-69, -51], [-68, -54], [-71, -54], [-74, -50], [-74, -45], [-73, -40], [-71, -33], [-71, -28], [-70, -20], [-71, -17], [-76, -14], [-79, -9], [-81, -5], [-80, -1], [-79, 2]];

// 太陽の真下の緯度（月の真ん中の日で計算。12月に南回帰線、6月に北回帰線）
const sunLat = (t) => -23.44 * Math.cos((2 * Math.PI * ((t - 0.5) * 30.4 + 10)) / 365);
// 雨の帯（熱帯収束帯）の中心。太陽より少しおそれて、動きもおだやか（目安）
const bandLat = (m) => 0.55 * sunLat(m - 1);
// かわきやすい帯（亜熱帯高圧帯）の中心。夏の半球のほうが、少し極がわにずれる
const dryLat = (m, sign) => sign * 28 + 0.35 * bandLat(m);

const inPoly = (lon, lat) => {
  let c = false;
  for (let i = 0, j = SA.length - 1; i < SA.length; j = i++) {
    const [xi, yi] = SA[i], [xj, yj] = SA[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const soft = (d, w) => (d >= w ? 0 : d <= w * 0.6 ? 1 : 1 - (d - w * 0.6) / (w * 0.4));   // 帯のふちを、すこしぼかす
const mix = (a, b, t) => a + (b - a) * t;

// 地球儀を1回描く（絵のピクセルを、1つずつ、緯度・経度にもどして色をつける）
function draw(cv, m, lon0) {
  const ctx = cv.getContext("2d"), lat0 = -18 * RAD, l0 = lon0 * RAD;
  const img = ctx.createImageData(SIZE, SIZE), px = img.data;
  const b = bandLat(m), hs = dryLat(m, -1), hn = dryLat(m, 1);
  const sl = Math.sin(lat0), cl = Math.cos(lat0), R = SIZE / 2 - 6, cx = SIZE / 2, cy = SIZE / 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const nx = (x - cx) / R, ny = -(y - cy) / R, rho = Math.hypot(nx, ny), o = (y * SIZE + x) * 4;
      if (rho > 1) continue;
      const c = Math.asin(rho), sc = Math.sin(c), cc = Math.cos(c);
      const lat = rho === 0 ? lat0 : Math.asin(cc * sl + (ny * sc * cl) / rho);
      let lon = l0 + (rho === 0 ? 0 : Math.atan2(nx * sc, rho * cl * cc - ny * sl * sc));
      lon = ((((lon / RAD + 180) % 360) + 360) % 360) - 180;
      const la = lat / RAD;
      let r, g, bl;
      if (inPoly(lon, la)) { r = 208; g = 192; bl = 152; } else { r = 214; g = 230; bl = 232; }   // 陸と海
      const wr = soft(Math.abs(la - b), 10), wd = Math.max(soft(Math.abs(la - hs), 10), soft(Math.abs(la - hn), 10));
      if (wr > 0) { const t = wr * 0.62; r = mix(r, 31, t); g = mix(g, 111, t); bl = mix(bl, 91, t); }   // 雨の帯＝緑
      if (wd > 0) { const t = wd * 0.6; r = mix(r, 226, t); g = mix(g, 104, t); bl = mix(bl, 59, t); }   // かわきやすい帯＝オレンジ
      // 緯度・経度の線（30度ごと）
      const gl = Math.abs(((la + 15) % 30) - 15), gn = Math.abs((((lon + 15) % 30) + 30) % 30 - 15);
      if (gl < 0.35 || gn < 0.35) { r = mix(r, 27, 0.35); g = mix(g, 35, 0.35); bl = mix(bl, 48, 0.35); }
      const sh = 1 - 0.28 * rho * rho;   // ふちほど、すこし暗く
      px[o] = r * sh; px[o + 1] = g * sh; px[o + 2] = bl * sh; px[o + 3] = 255;
    }
  }
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.putImageData(img, 0, 0);
  // ふちの線
  ctx.strokeStyle = "#1b2330"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
  // アタカマの印（見えている向きのときだけ）
  const pl = PLACE.lat * RAD, dl = (PLACE.lon - lon0) * RAD;
  const vis = Math.sin(lat0) * Math.sin(pl) + Math.cos(lat0) * Math.cos(pl) * Math.cos(dl);
  if (vis > 0.05) {
    const px0 = cx + R * Math.cos(pl) * Math.sin(dl), py0 = cy - R * (Math.cos(lat0) * Math.sin(pl) - Math.sin(lat0) * Math.cos(pl) * Math.cos(dl));
    ctx.fillStyle = "#e2683b"; ctx.strokeStyle = "#1b2330"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(px0, py0, 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.font = "700 14px 'Noto Sans JP',sans-serif"; ctx.textAlign = "left"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(251,249,244,.95)";
    ctx.strokeText(PLACE.n, px0 + 11, py0 + 5); ctx.fillStyle = "#1b2330"; ctx.fillText(PLACE.n, px0 + 11, py0 + 5);
  }
}

const fmtLat = (l) => (l < 0 ? "南緯" : "北緯") + Math.abs(Math.round(l)) + "度";
function result(m) {
  const b = bandLat(m), hs = dryLat(m, -1), dist = Math.abs(PLACE.lat - hs);
  return `<span>${MONTHS[m - 1]}：雨の帯は${fmtLat(b)}あたり</span><b>${PLACE.n}（${fmtLat(PLACE.lat)}）は、かわきやすい帯${dist <= 10 ? "のなか" : "のふち"}</b>`;
}

// 記事の中に出す（b = { t: "model", k: "hadley", m: 最初の月, cap: 説明 }）
export function modelHtml(b) {
  if (b.k === "fjord") return fjordHtml(b);
  if (b.k === "patagonia") return patHtml(b);
  if (b.k !== "hadley") return "";
  const m = Math.min(12, Math.max(1, +b.m || 1));
  return `<figure class="bfig"><div class="mdl" data-mdl="hadley" data-m="${m}" data-lon="-68">
    <p class="mdl-h">手で動かしてみよう</p>
    <canvas class="mdl-cv" width="${SIZE}" height="${SIZE}" aria-label="大気大循環の地球儀"></canvas>
    <p class="mdl-hint">指を左右に動かすと、地球が回ります。</p>
    <div class="mdl-res">${result(m)}</div>
    <label class="mdl-sl"><span>月</span><input type="range" class="mdl-m" min="1" max="12" step="1" value="${m}" aria-label="月"><b>${MONTHS[m - 1]}</b></label>
    <p class="mdl-lg"><i class="g"></i>雨が多い帯　<i class="o"></i>かわきやすい帯</p>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}


// ---- フィヨルドができるまで ----
const FJ_STEPS = [
  { t: "①川が、V字の谷をつくる", d: "山から流れる川が、谷を削ります。ただし川は、海面より下を削れません。" },
  { t: "②氷河が、谷を深いU字に削る", d: "氷河期、重い氷河が谷をすべり落ちて、谷底と横を削り、海面より下まで深くします。" },
  { t: "③氷がとけて、海水が入る", d: "氷がとけて海面が上がると、深い谷に海水が入ります。入り口は、氷河が残した土砂で浅くなっています。" },
];
function fjordSvg(stage) {
  const INK = "#1b2330";
  const X = (x) => (180 + x * 160).toFixed(1), Y = (e) => (150 - e * 110).toFixed(1);
  const floor = stage === 0 ? 0 : -0.4, p = stage === 0 ? 1.15 : 3.6;
  const e = (x) => floor + (1 - floor) * Math.pow(Math.abs(x), p);
  const pts = []; for (let i = -50; i <= 50; i++) { const x = i / 50; pts.push([x, e(x)]); }
  const land = pts.map(([x, v], i) => `${i ? "L" : "M"}${X(x)} ${Y(v)}`).join(" ") + ` L${X(1)} 214 L${X(-1)} 214 Z`;
  const inner = (top) => pts.filter(([, v]) => v <= top).map(([x, v], i) => `${i ? "L" : "M"}${X(x)} ${Y(v)}`).join(" ");
  const cut = (top) => { const q = pts.filter(([, v]) => v <= top); if (!q.length) return ""; return `${inner(top)} L${X(q[q.length - 1][0])} ${Y(top)} L${X(q[0][0])} ${Y(top)} Z`; };
  const ice = stage === 1 ? `<path d="${cut(0.62)}" fill="#f2f8fb" stroke="${INK}" stroke-width="2"/><text x="180" y="${Y(0.2)}" font-size="11" text-anchor="middle" fill="${INK}" font-weight="700">氷河</text>` : "";
  const sea = stage === 2 ? `<path d="${cut(0)}" fill="#5fa3b8" opacity=".85"/><text x="180" y="${Y(-0.14)}" font-size="11" text-anchor="middle" fill="#fff" font-weight="700">海水</text>` : "";
  const river = stage === 0 ? `<path d="${cut(0.04)}" fill="#5fa3b8" opacity=".9"/>` : "";
  return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="谷の断面">
    <rect x="0" y="0" width="360" height="220" fill="#fbf9f4"/>
    <path d="${land}" fill="#d8cba5" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    ${river}${ice}${sea}
    <line x1="14" y1="${Y(0)}" x2="346" y2="${Y(0)}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="346" y="${(+Y(0) - 5).toFixed(1)}" font-size="10" text-anchor="end" fill="${INK}">海面</text>
  </svg>`;
}
function fjordHtml(b) {
  const st = Math.min(2, Math.max(0, (+b.m || 1) - 1));
  return `<figure class="bfig"><div class="mdl" data-mdl="fjord" data-st="${st}">
    <p class="mdl-h">手で動かしてみよう</p>
    <div class="mdl-fj">${fjordSvg(st)}</div>
    <div class="mdl-res"><span class="fj-n">${FJ_STEPS[st].t}</span><b class="fj-d">${FJ_STEPS[st].d}</b></div>
    <label class="mdl-sl"><span>ステップ</span><input type="range" class="mdl-m" min="1" max="3" step="1" value="${st + 1}" aria-label="ステップ"><b>${st + 1} / 3</b></label>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}
function initFjord(root) {
  const r = root.querySelector(".mdl-m");
  if (!r || r.dataset.on) return;
  r.dataset.on = "1";
  r.addEventListener("input", () => {
    const st = +r.value - 1;
    root.querySelector(".mdl-fj").innerHTML = fjordSvg(st);
    root.querySelector(".fj-n").textContent = FJ_STEPS[st].t;
    root.querySelector(".fj-d").textContent = FJ_STEPS[st].d;
    root.querySelector(".mdl-sl b").textContent = `${st + 1} / 3`;
  });
}


// ---- パタゴニア：山を越える西風 ----
const PT_LAND = [[60, 170], [100, 150], [140, 100], [170, 58], [200, 100], [230, 140], [260, 160], [360, 166]];
function ptTerrain(x) {
  if (x <= 60) return 170;
  for (let i = 1; i < PT_LAND.length; i++) {
    const [x1, y1] = PT_LAND[i - 1], [x2, y2] = PT_LAND[i];
    if (x <= x2) return y1 + (y2 - y1) * (x - x1) / (x2 - x1);
  }
  return 166;
}
const ptY = (x) => Math.max(30, ptTerrain(x) - 38);
const PT_STEPS = [
  { x: 32, mo: 100, t: "①太平洋の上", d: "海の上を渡るあいだに、西風は水分をたっぷり含みます。" },
  { x: 112, mo: 65, t: "②西の斜面をのぼる", d: "山にぶつかった風は斜面をはい上がり、冷やされて雲になって、雨を降らせます。チリ側に深い森が育つのはこのためです。" },
  { x: 170, mo: 35, t: "③山の上", d: "高いところでは、雨が雪に変わります。降り積もった雪が固まって、巨大な氷原ができました。" },
  { x: 228, mo: 12, t: "④東の斜面をくだる", d: "水分を落としきった風は、乾いたまま一気に吹きおろします。" },
  { x: 305, mo: 8, t: "⑤東の平原", d: "雨がほとんど届かないので、木の少ない草原が広がります。これがアルゼンチン側の景色です。" },
];
function patSvg(st) {
  const INK = "#1b2330", S = PT_STEPS[st], x = S.x, y = ptY(x);
  const pts = []; for (let px = 20; px <= 340; px += 5) pts.push([px, ptY(px)]);
  const line = (q) => q.map(([a, c], i) => `${i ? "L" : "M"}${a} ${c.toFixed(1)}`).join(" ");
  const done = pts.filter(([px]) => px <= x);
  let air = "";
  if (S.mo >= 30) {
    const s = 0.6 + 0.5 * S.mo / 100, e = (cx, cy, rx, ry) => `<ellipse cx="${(x + cx * s).toFixed(1)}" cy="${(y + cy * s).toFixed(1)}" rx="${(rx * s).toFixed(1)}" ry="${(ry * s).toFixed(1)}"/>`;
    air = `<g fill="#e3f0f4" stroke="${INK}" stroke-width="1.8">${e(-12, 2, 12, 9)}${e(2, -4, 15, 12)}${e(15, 2, 11, 8)}</g>`;
    if (st === 1) air += [-12, 0, 12].map((d, i) => `<line x1="${x + d}" y1="${y + 16 + i * 3}" x2="${x + d - 4}" y2="${y + 28 + i * 3}" stroke="#3b82a0" stroke-width="2.4" stroke-linecap="round"/>`).join("");
    if (st === 2) air += [[-12, 18], [0, 24], [12, 18], [-6, 30], [6, 31]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="2.6" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`).join("");
  } else {
    air = `<path d="M${x - 20} ${y - 4} Q${x - 6} ${y - 12} ${x + 4} ${y - 2} L${x + 16} ${y + 6}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M${x + 9} ${y + 7} L${x + 17} ${y + 7} L${x + 15} ${y - 1}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><text x="${x}" y="${y - 16}" font-size="10" text-anchor="middle" fill="${INK}" font-weight="700">乾いた風</text>`;
  }
  return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="アンデス山脈の断面">
    <rect width="360" height="220" fill="#fbf9f4"/>
    <rect x="0" y="170" width="60" height="50" fill="#5fa3b8" opacity=".85"/>
    <path d="M60 170 L100 150 L140 100 L170 58 L170 220 L60 220 Z" fill="#8fbf98"/>
    <path d="M170 58 L200 100 L230 140 L260 160 L360 166 L360 220 L170 220 Z" fill="#e3d3a6"/>
    <path d="M60 170 L100 150 L140 100 L170 58 L200 100 L230 140 L260 160 L360 166" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M151.4 84 L170 58 L188.6 84 L178 80 L170 86 L162 80 Z" fill="#fff" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <text x="30" y="196" font-size="10" text-anchor="middle" fill="#fff" font-weight="700">太平洋</text>
    <text x="112" y="186" font-size="11" text-anchor="middle" fill="${INK}" font-weight="700">森</text>
    <text x="170" y="104" font-size="10" text-anchor="middle" fill="${INK}" font-weight="700">氷原</text>
    <text x="300" y="190" font-size="11" text-anchor="middle" fill="${INK}" font-weight="700">乾いた草原</text>
    <text x="112" y="210" font-size="10" text-anchor="middle" fill="${INK}">チリ</text>
    <text x="300" y="210" font-size="10" text-anchor="middle" fill="${INK}">アルゼンチン</text>
    <text x="10" y="16" font-size="11" fill="${INK}" font-weight="700">西</text><text x="350" y="16" font-size="11" text-anchor="end" fill="${INK}" font-weight="700">東</text>
    <path d="${line(pts)}" fill="none" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 5" opacity=".45"/>
    <path d="${line(done)}" fill="none" stroke="#1f6f5b" stroke-width="3" stroke-linecap="round"/>
    <path d="M334 ${(ptY(340) - 5).toFixed(1)} L342 ${ptY(340).toFixed(1)} L334 ${(ptY(340) + 5).toFixed(1)}" fill="none" stroke="${INK}" stroke-width="1.4" opacity=".45"/>
    ${air}
  </svg>`;
}
function patRes(st) {
  const S = PT_STEPS[st];
  return `<span>${S.t}</span><b>${S.d}</b><span class="pt-lb">風に残っている水分</span><div class="pat-bar"><i style="width:${S.mo}%"></i></div>`;
}
function patHtml(b) {
  return `<figure class="bfig"><div class="mdl" data-mdl="patagonia">
    <p class="mdl-h">手で動かしてみよう</p>
    <div class="mdl-fj">${patSvg(0)}</div>
    <div class="mdl-res">${patRes(0)}</div>
    <label class="mdl-sl"><span>風を進める</span><input type="range" class="mdl-m" min="1" max="5" step="1" value="1" aria-label="風を進める"><b>1 / 5</b></label>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}
function initPat(root) {
  const r = root.querySelector(".mdl-m");
  if (!r || r.dataset.on) return;
  r.dataset.on = "1";
  r.addEventListener("input", () => {
    const st = +r.value - 1;
    root.querySelector(".mdl-fj").innerHTML = patSvg(st);
    root.querySelector(".mdl-res").innerHTML = patRes(st);
    root.querySelector(".mdl-sl b").textContent = `${st + 1} / 5`;
  });
}

// 画面に出てきたモデルを、動くようにする（画面全体で、1回だけつなぐ）
let wired = false;
function init(root) {
  if (root.dataset.mdl === "fjord") return initFjord(root);
  if (root.dataset.mdl === "patagonia") return initPat(root);
  const cv = root.querySelector("canvas");
  if (!cv || cv.dataset.on) return;
  cv.dataset.on = "1";
  const paint = () => draw(cv, +root.dataset.m, +root.dataset.lon);
  paint();
  let drag = null;
  cv.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, lon: +root.dataset.lon }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const w = cv.getBoundingClientRect().width || SIZE;
    root.dataset.lon = String(drag.lon - ((e.clientX - drag.x) / w) * 200);   // 指を右に動かすと、地球が右にまわる
    paint();
  });
  const up = () => { drag = null; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  root.querySelector(".mdl-m").addEventListener("input", (e) => {
    const m = +e.target.value; root.dataset.m = String(m);
    root.querySelector(".mdl-sl b").textContent = MONTHS[m - 1];
    root.querySelector(".mdl-res").innerHTML = result(m);
    paint();
  });
}
export function wireModels() {
  if (wired) return;
  wired = true;
  const scan = () => document.querySelectorAll(".mdl[data-mdl]").forEach(init);
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
}
