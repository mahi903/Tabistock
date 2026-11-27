// 旅の掲示板（旅と地理）の記事の中に入れる、手で動かせるモデル
// いまあるもの：hadley＝大気大循環の地球儀（月のスライダーで、雨の帯と、かわきやすい帯が南北に動く。指で地球をまわせる）
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
  if (b.k !== "hadley") return "";
  const m = Math.min(12, Math.max(1, +b.m || 1));
  return `<figure class="bfig"><div class="mdl" data-mdl="hadley" data-m="${m}" data-lon="-68">
    <p class="mdl-h">手で動かしてみよう</p>
    <canvas class="mdl-cv" width="${SIZE}" height="${SIZE}" aria-label="大気大循環の地球儀"></canvas>
    <p class="mdl-hint">指を左右に動かすと、地球がまわります</p>
    <div class="mdl-res">${result(m)}</div>
    <label class="mdl-sl"><span>月</span><input type="range" class="mdl-m" min="1" max="12" step="1" value="${m}" aria-label="月"><b>${MONTHS[m - 1]}</b></label>
    <p class="mdl-lg"><i class="g"></i>雨が多い帯　<i class="o"></i>かわきやすい帯</p>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}

// 画面に出てきたモデルを、動くようにする（画面全体で、1回だけつなぐ）
let wired = false;
function init(root) {
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
