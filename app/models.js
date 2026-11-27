// 旅の掲示板（旅と地理）の記事の中に入れる、手で動かせるモデル
// いまあるもの：hadley＝大気大循環の地球儀（月のスライダーで、太陽と、雨の帯・乾きやすい帯が南北に動く。指で地球を回せる）
//             patagonia＝アンデス山脈の断面（スライダーで風を西から東へ進めると、雨や雪を降らせて乾いていく）
//             circ＝大気大循環の断面（月のスライダーで、雨の帯と空気の流れが南北に動き、バンコクとバリ島の雨季・乾季が変わる）
//             uyuni＝ウユニ塩湖（月のスライダーで、雨の量と、塩原が「鏡」と「白い大地」に変わる）
//             pinnacle＝ピナクルズ（砂丘→石灰岩→雨で溶ける→柱が現れる）
//             butte＝モニュメント・バレー（台地→メサ→ビュート→細い塔）／karst＝ハロン湾（海の底→持ち上がる→雨で溶ける→海に沈む）
//             rift＝プレートが離れる断面（スライダーで「離れる→割れ目→マグマ→新しい大地」と進む）
//             fjord＝フィヨルドができるまで（谷の断面。スライダーで「川の谷→氷河でけずる→海水が入る」と進む）
// 本物の気候を、ごく簡単にしたモデルです（目安）。

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const RAD = Math.PI / 180;
const SIZE = 360;   // 地球儀を描く絵のサイズ（正方形）
const GR = 140;     // 地球儀の半径（まわりに、太陽と帯の名前を書く余白をとる）

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
  const sl = Math.sin(lat0), cl = Math.cos(lat0), R = GR, cx = SIZE / 2, cy = SIZE / 2;
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
      if (gl < 0.3 || gn < 0.3) { r = mix(r, 27, 0.2); g = mix(g, 35, 0.2); bl = mix(bl, 48, 0.2); }
      if (Math.abs(la) < 0.6) { r = mix(r, 27, 0.75); g = mix(g, 35, 0.75); bl = mix(bl, 48, 0.75); }   // 赤道は、太めにはっきり
      const sh = 1 - 0.28 * rho * rho;   // ふちほど、すこし暗く
      px[o] = r * sh; px[o + 1] = g * sh; px[o + 2] = bl * sh; px[o + 3] = 255;
    }
  }
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.putImageData(img, 0, 0);
  // ふちの線
  ctx.strokeStyle = "#1b2330"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
  // 地球儀の上の点を、絵の座標に（vis > 0 なら、こちら側に見えている）
  const proj = (la, lo) => {
    const p = la * RAD, d = (lo - lon0) * RAD;
    return { x: cx + R * Math.cos(p) * Math.sin(d), y: cy - R * (Math.cos(lat0) * Math.sin(p) - Math.sin(lat0) * Math.cos(p) * Math.cos(d)), vis: Math.sin(lat0) * Math.sin(p) + Math.cos(lat0) * Math.cos(p) * Math.cos(d) };
  };
  const label = (t, x, y, col, al) => {
    ctx.font = "700 13px 'Noto Sans JP',sans-serif"; ctx.textAlign = al; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
  };
  // 太陽（右がわ）：いま、どの緯度の真上にあるか
  const sp = proj(sunLat(m - 1), lon0 + 88), sx = cx + R + 22, sy = sp.y;
  ctx.setLineDash([3, 4]); ctx.strokeStyle = "#e2683b"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sp.x + 2, sp.y); ctx.lineTo(sx - 12, sy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#f6b23c"; ctx.strokeStyle = "#1b2330"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 10, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
  label("太陽", sx, sy - 16, "#1b2330", "center");
  // 赤道と、帯の名前（左がわ）
  const eq = proj(0, lon0 - 80); label("赤道", eq.x - 6, eq.y + 4, "#1b2330", "right");
  const rb = proj(b, lon0 - 62); label("雨の帯", rb.x - 4, rb.y + 5, "#175243", "right");
  const db = proj(hs, lon0 - 50); label("乾きやすい帯", db.x - 4, db.y + 5, "#b4471f", "right");
  // アタカマの印（見えている向きのときだけ）
  const pa = proj(PLACE.lat, PLACE.lon);
  if (pa.vis > 0.05) {
    ctx.fillStyle = "#e2683b"; ctx.strokeStyle = "#1b2330"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(pa.x, pa.y, 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    label("アタカマ", pa.x + 11, pa.y + 5, "#1b2330", "left");
  }
}

const fmtLat = (l) => (l < 0 ? "南緯" : "北緯") + Math.abs(Math.round(l)) + "度";
function result(m) {
  const s = sunLat(m - 1), hs = dryLat(m, -1), dist = Math.abs(PLACE.lat - hs);
  const sun = s > 8 ? "太陽が北半球の真上にあるので、雨の帯も北へ寄っています。" : s < -8 ? "太陽が南半球の真上にあるので、雨の帯も南へ寄っています。" : "太陽はほぼ赤道の真上。雨の帯も赤道のあたりにあります。";
  return `<span>${MONTHS[m - 1]}：${sun}</span><b>アタカマ（${fmtLat(PLACE.lat)}）は、乾きやすい帯の${dist <= 10 ? "中" : "ふち"}。雨はほとんど降りません。</b>`;
}

// 記事の中に出す（b = { t: "model", k: "hadley", m: 最初の月, cap: 説明 }）
export function modelHtml(b) {
  if (b.k === "fjord") return fjordHtml(b);
  if (b.k === "patagonia") return patHtml(b);
  if (b.k === "rift") return riftHtml(b);
  if (b.k === "circ") return circHtml(b);
  if (b.k === "uyuni") return uyHtml(b);
  if (b.k === "butte" || b.k === "karst" || b.k === "pinnacle") return stepHtml(b);
  if (b.k !== "hadley") return "";
  const m = Math.min(12, Math.max(1, +b.m || 1));
  return `<figure class="bfig"><div class="mdl" data-mdl="hadley" data-m="${m}" data-lon="-68">
    <p class="mdl-h">手で動かしてみよう</p>
    <canvas class="mdl-cv" width="${SIZE}" height="${SIZE}" aria-label="大気大循環の地球儀"></canvas>
    <p class="mdl-hint">月を動かすと、太陽といっしょに帯が南北に動きます。地球儀は指で回せます。</p>
    <div class="mdl-res">${result(m)}</div>
    <label class="mdl-sl"><span>月</span><input type="range" class="mdl-m" min="1" max="12" step="1" value="${m}" aria-label="月"><b>${MONTHS[m - 1]}</b></label>
    <p class="mdl-lg"><i class="g"></i>雨の帯（雲ができやすい）　<i class="o"></i>乾きやすい帯（空気が下りてくる）</p>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}


// ---- フィヨルドができるまで ----
const FJ_STEPS = [
  { t: "①川が、V字の谷をつくる", d: "山から流れる川が、谷を少しずつ削ります。ただし川が削れるのは、海面の高さまでです。" },
  { t: "②氷河が、谷を深いU字に削る", d: "氷河期になると、谷を重い氷河が埋めます。氷は谷底と横をまとめて削り、海面より下まで深くえぐります。点線は、もとのV字の谷です。" },
  { t: "③氷がとけて、海水が入る", d: "氷河期が終わって氷がとけると、海面より深い谷に海水が流れこみます。これがフィヨルドです。" },
];
function fjordSvg(stage) {
  const INK = "#1b2330";
  const X = (x) => (180 + x * 160).toFixed(1), Y = (e) => (150 - e * 110).toFixed(1);
  const prof = (st) => { const floor = st === 0 ? 0 : -0.4, p = st === 0 ? 1.15 : 3.6; return (x) => floor + (1 - floor) * Math.pow(Math.abs(x), p); };
  const e = prof(stage);
  const pts = []; for (let i = -50; i <= 50; i++) { const x = i / 50; pts.push([x, e(x)]); }
  const path = (q) => q.map(([x, v], i) => `${i ? "L" : "M"}${X(x)} ${Y(v)}`).join(" ");
  const land = path(pts) + ` L${X(1)} 214 L${X(-1)} 214 Z`;
  const cut = (top) => { const q = pts.filter(([, v]) => v <= top); if (!q.length) return ""; return `${path(q)} L${X(q[q.length - 1][0])} ${Y(top)} L${X(q[0][0])} ${Y(top)} Z`; };
  const arrow = (x1, y1, x2, y2, c) => { const a = Math.atan2(y2 - y1, x2 - x1), h = 7; return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/><path d="M${(x2 - h * Math.cos(a - 0.5)).toFixed(1)} ${(y2 - h * Math.sin(a - 0.5)).toFixed(1)} L${x2} ${y2} L${(x2 - h * Math.cos(a + 0.5)).toFixed(1)} ${(y2 - h * Math.sin(a + 0.5)).toFixed(1)}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`; };
  const tag = (t, x, y, c = INK, al = "middle") => `<text x="${x}" y="${y}" font-size="11" text-anchor="${al}" fill="${c}" font-weight="700" paint-order="stroke" stroke="#fbf9f4" stroke-width="3">${t}</text>`;
  let over = "";
  if (stage === 0) {
    over = `<path d="${cut(0.05)}" fill="#3b82a0"/>` + tag("川", 180, 136) + tag("川はここより下を削れない", 180, 176, INK) + arrow(180, 166, 180, 154, INK);
  }
  if (stage >= 1) {
    const v = prof(0), q = []; for (let i = -50; i <= 50; i++) { const x = i / 50; q.push([x, v(x)]); }
    over += `<path d="${path(q)}" fill="none" stroke="${INK}" stroke-width="1.5" stroke-dasharray="4 4" opacity=".5"/>`;
  }
  if (stage === 1) {
    over += `<path d="${cut(0.62)}" fill="#eef6fa" stroke="${INK}" stroke-width="2"/>` + tag("氷河", 180, 96)
      + arrow(180, 160, 180, 182, "#1f6f5b") + arrow(112, 120, 92, 132, "#1f6f5b") + arrow(248, 120, 268, 132, "#1f6f5b") + tag("重い氷が、底と横を削る", 180, 128, "#175243");
  }
  if (stage === 2) {
    over += `<path d="${cut(0)}" fill="#3b82a0" opacity=".9"/>` + tag("海水", 150, 176, "#fff").replace('stroke="#fbf9f4"', 'stroke="#3b82a0"')
      + arrow(232, 154, 232, 189, INK) + arrow(232, 189, 232, 154, INK) + tag("海面より深い", 240, 176, INK, "start");
  }
  return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="谷の断面">
    <rect x="0" y="0" width="360" height="220" fill="#fbf9f4"/>
    <path d="${land}" fill="#d8cba5" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M20 40 L36 40 L28 32 Z M324 40 L340 40 L332 32 Z" fill="#fff" opacity="0"/>
    ${over}
    <line x1="10" y1="${Y(0)}" x2="350" y2="${Y(0)}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="5 4"/>
    ${tag("海面", 348, +Y(0) - 6, INK, "end")}
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

// ---- アイスランド：離れていくプレート ----
const RF_STEPS = [
  { g: 0, t: "①2つのプレートが、左右に引っぱられる", d: "西の北アメリカプレートと、東のユーラシアプレートが、年に約2cmずつ離れていきます。" },
  { g: 34, t: "②地面が割れて、谷ができる", d: "引っぱられた地面に割れ目ができ、まん中が落ちこんで谷になります。シンクヴェトリルで歩けるのが、この谷です。" },
  { g: 34, t: "③下から、マグマが上がってくる", d: "すき間ができると、地下のマントルからマグマが上がってきて、割れ目から噴き出します。" },
  { g: 56, t: "④固まって、新しい大地になる", d: "マグマが冷えて固まり、新しい大地になります。これを何百万年もくり返して、島ができました。" },
];
function riftSvg(st) {
  const INK = "#1b2330", S = RF_STEPS[st], g = S.g, L = 180 - g / 2, R = 180 + g / 2, top = 92, bot = 150, sag = st >= 1 ? 14 : 0;
  const tag = (t, x, y, c = INK, al = "middle", sz = 11) => `<text x="${x}" y="${y}" font-size="${sz}" text-anchor="${al}" fill="${c}" font-weight="700" paint-order="stroke" stroke="#fbf9f4" stroke-width="3">${t}</text>`;
  const arr = (x1, x2, y) => { const d = Math.sign(x2 - x1); return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M${x2 - d * 8} ${y - 6} L${x2} ${y} L${x2 - d * 8} ${y + 6}" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`; };
  const lp = `M0 ${top} L${L - 30} ${top} L${L} ${top + sag} L${L} ${bot} L0 ${bot} Z`;
  const rp = `M360 ${top} L${R + 30} ${top} L${R} ${top + sag} L${R} ${bot} L360 ${bot} Z`;
  let mid = "";
  if (st === 2) mid = `<path d="M${L} ${bot + 30} L${L} ${top + sag} L${R} ${top + sag} L${R} ${bot + 30} Z" fill="#e2683b"/>` + [[-10, 14], [0, 26], [10, 16], [-4, 38], [6, 34]].map(([dx, dy]) => `<circle cx="${180 + dx}" cy="${top + sag - dy}" r="${dy > 30 ? 3 : 4}" fill="#e2683b" stroke="${INK}" stroke-width="1.2"/>`).join("") + tag("マグマ", 180, bot - 10, "#fff").replace('stroke="#fbf9f4"', 'stroke="#e2683b"');
  if (st === 1) mid = `<path d="M${L} ${top + sag + 8} L${R} ${top + sag + 8} L${R} ${bot} L${L} ${bot} Z" fill="#d8cba5" stroke="${INK}" stroke-width="2"/><path d="M${L} ${top + sag + 8} L${R} ${top + sag + 8}" stroke="#5e9a6b" stroke-width="4"/>`;
  if (st === 3) mid = `<path d="M${L} ${top + sag} L${R} ${top + sag} L${R} ${bot} L${L} ${bot} Z" fill="#5b5f66" stroke="${INK}" stroke-width="2"/>` + tag("新しい大地", 180, top + sag - 8);
  return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="プレートが離れる断面">
    <rect width="360" height="220" fill="#fbf9f4"/>
    <rect x="0" y="${bot}" width="360" height="${220 - bot}" fill="#f3d2b3"/>
    ${tag("マントル（地下の熱い岩）", 180, 205, INK, "middle", 10.5)}
    ${st === 2 ? `<path d="M150 214 Q165 180 ${L + 4} ${bot + 2} M210 214 Q195 180 ${R - 4} ${bot + 2}" fill="none" stroke="#e2683b" stroke-width="2.4" stroke-dasharray="4 4"/>` : ""}
    ${mid}
    <path d="${lp}" fill="#d8cba5" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="${rp}" fill="#d8cba5" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M0 ${top} L${L - 30} ${top} L${L} ${top + sag}" fill="none" stroke="#5e9a6b" stroke-width="4"/>
    <path d="M360 ${top} L${R + 30} ${top} L${R} ${top + sag}" fill="none" stroke="#5e9a6b" stroke-width="4"/>
    ${tag("北アメリカプレート", 70, 124, INK, "middle", 10.5)}${tag("ユーラシアプレート", 290, 124, INK, "middle", 10.5)}
    ${arr(110, 40, 50)}${arr(250, 320, 50)}
    ${tag("西へ", 75, 40)}${tag("東へ", 285, 40)}
    ${tag("年に約2cm", 180, 30)}
    ${st === 1 ? tag("谷", 180, top + sag - 4) : ""}
  </svg>`;
}
function riftRes(st) { const S = RF_STEPS[st]; return `<span>${S.t}</span><b>${S.d}</b>`; }
function riftHtml(b) {
  return `<figure class="bfig"><div class="mdl" data-mdl="rift">
    <p class="mdl-h">手で動かしてみよう</p>
    <div class="mdl-fj">${riftSvg(0)}</div>
    <div class="mdl-res">${riftRes(0)}</div>
    <label class="mdl-sl"><span>ステップ</span><input type="range" class="mdl-m" min="1" max="4" step="1" value="1" aria-label="ステップ"><b>1 / 4</b></label>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}
function initRift(root) {
  const r = root.querySelector(".mdl-m");
  if (!r || r.dataset.on) return;
  r.dataset.on = "1";
  r.addEventListener("input", () => {
    const st = +r.value - 1;
    root.querySelector(".mdl-fj").innerHTML = riftSvg(st);
    root.querySelector(".mdl-res").innerHTML = riftRes(st);
    root.querySelector(".mdl-sl b").textContent = `${st + 1} / 4`;
  });
}

// ---- 大気大循環：赤道をはさんだ空気の流れ（東南アジアの目安） ----
// 雨の帯の中心（緯度）。東南アジアあたりの目安で、太陽より1〜2か月おくれて動く
const CC_BAND = [-12, -13, -10, 2, 6, 10, 14, 15, 12, 7, -2, -8];
const CC_SUN = (m) => sunLat(m - 1);
const CC_PL = [{ n: "バリ島", lat: -8 }, { n: "バンコク", lat: 14 }];
const CC_DS = [{ n: "オーストラリアの砂漠", s: "オーストラリア", lat: -25 }, { n: "サハラ砂漠", s: "サハラ砂漠", lat: 27 }];   // 乾きやすい帯に、一年中かかる
const ccRain = (lat, m) => Math.abs(lat - CC_BAND[m - 1]) <= 9;
function circSvg(m) {
  const INK = "#1b2330", X = (l) => 180 + l * 4, b = CC_BAND[m - 1], bx = X(b), xn = X(28 + 0.35 * b), xs = X(-28 + 0.35 * b);
  const tag = (t, x, y, c = INK, al = "middle", sz = 11) => `<text x="${x}" y="${y}" font-size="${sz}" text-anchor="${al}" fill="${c}" font-weight="700" paint-order="stroke" stroke="#fbf9f4" stroke-width="3">${t}</text>`;
  const head = (x, y, dir, c) => { const d = { r: [-7, -5, -7, 5], l: [7, -5, 7, 5], u: [-5, 7, 5, 7], d: [-5, -7, 5, -7] }[dir]; return `<path d="M${x + d[0]} ${y + d[1]} L${x} ${y} L${x + d[2]} ${y + d[3]}" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`; };
  const loop = (x2) => {
    const s = Math.sign(x2 - bx), top = 64, low = 182;
    const p = `M${bx} ${low} L${bx} ${top} L${x2} ${top} L${x2} ${low} Z`;
    return `<path d="${p}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" opacity=".75"/>`
      + head(bx, 150, "u", "#1f6f5b") + head((bx + x2) / 2, top, s > 0 ? "r" : "l", INK) + head(x2, 130, "d", "#e2683b") + head((bx + x2) / 2, low, s > 0 ? "l" : "r", INK);
  };
  const sx = X(CC_SUN(m));
  const rain = [-10, 0, 10].map((d, i) => `<line x1="${bx + d}" y1="${96 + i * 4}" x2="${bx + d - 3}" y2="${108 + i * 4}" stroke="#3b82a0" stroke-width="2.2" stroke-linecap="round"/>`).join("");
  const pins = CC_PL.map((p) => { const x = X(p.lat), r = ccRain(p.lat, m); return `<circle cx="${x}" cy="200" r="6" fill="${r ? "#1f6f5b" : "#e2683b"}" stroke="${INK}" stroke-width="2"/>` + tag(p.n, x, 220) + tag(r ? "雨季" : "乾季", x, 235, r ? "#175243" : "#b4471f"); }).join("");
  const dunes = CC_DS.map((p) => { const x = X(p.lat); return `<path d="M${x - 11} 206 Q${x - 4} 192 ${x} 197 Q${x + 5} 190 ${x + 11} 206 Z" fill="#e9b872" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` + tag(p.s, x, 220) + tag("いつも乾燥", x, 235, "#b4471f"); }).join("");
  return `<svg viewBox="0 0 360 244" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="大気大循環の断面">
    <rect width="360" height="244" fill="#fbf9f4"/>
    <rect x="${bx - 30}" y="40" width="60" height="160" fill="#1f6f5b" opacity=".13"/>
    <rect x="${xn - 26}" y="40" width="52" height="160" fill="#e2683b" opacity=".13"/>
    <rect x="${xs - 26}" y="40" width="52" height="160" fill="#e2683b" opacity=".13"/>
    <line x1="180" y1="40" x2="180" y2="200" stroke="${INK}" stroke-width="1.2" stroke-dasharray="3 4" opacity=".5"/>
    ${loop(xn)}${loop(xs)}
    <g fill="#fff" stroke="${INK}" stroke-width="1.6"><ellipse cx="${bx - 10}" cy="88" rx="12" ry="8"/><ellipse cx="${bx + 4}" cy="83" rx="14" ry="10"/><ellipse cx="${bx + 16}" cy="89" rx="9" ry="7"/></g>${rain}
    ${tag("雨の帯", bx, 56, "#175243")}
    ${tag("乾く", xn, 56, "#b4471f")}${tag("乾く", xs, 56, "#b4471f")}
    <circle cx="${sx}" cy="20" r="9" fill="#f6b23c" stroke="${INK}" stroke-width="2"/>${tag("太陽が真上", sx + (sx > 250 ? -14 : 14), 24, INK, sx > 250 ? "end" : "start", 10.5)}
    <rect x="0" y="200" width="360" height="44" fill="#e8dfc8"/>
    <line x1="0" y1="200" x2="360" y2="200" stroke="${INK}" stroke-width="2"/>
    ${tag("南", 12, 194, INK, "start", 10.5)}${tag("北", 348, 194, INK, "end", 10.5)}${tag("赤道", 180, 194, INK, "middle", 10.5)}
    ${pins}${dunes}
  </svg>`;
}
function circRes(m) {
  const [bali, bkk] = CC_PL.map((p) => ccRain(p.lat, m));
  const where = CC_BAND[m - 1] > 3 ? "赤道の北" : CC_BAND[m - 1] < -3 ? "赤道の南" : "赤道のあたり";
  const tip = !bkk && !bali ? "どちらも乾季です。" : bkk && !bali ? "行くならバリ島がちょうどいい時期です。" : !bkk && bali ? "行くならタイがちょうどいい時期です。" : "どちらも雨が多い時期です。";
  return `<span>${MONTHS[m - 1]}：雨の帯は${where}にあります。</span><b>バンコクは${bkk ? "雨季" : "乾季"}、バリ島は${bali ? "雨季" : "乾季"}。${tip}</b><span>サハラ砂漠とオーストラリアの砂漠は、どの月も「乾く」帯の中にあります。</span>`;
}
function circHtml(b) {
  const m = Math.min(12, Math.max(1, +b.m || 7));
  return `<figure class="bfig"><div class="mdl" data-mdl="circ">
    <p class="mdl-h">手で動かしてみよう</p>
    <div class="mdl-fj">${circSvg(m)}</div>
    <div class="mdl-res">${circRes(m)}</div>
    <label class="mdl-sl"><span>月</span><input type="range" class="mdl-m" min="1" max="12" step="1" value="${m}" aria-label="月"><b>${MONTHS[m - 1]}</b></label>
    <p class="mdl-lg"><i class="g"></i>空気がのぼって雨が降る　<i class="o"></i>空気がおりて乾く</p>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}
function initCirc(root) {
  const r = root.querySelector(".mdl-m");
  if (!r || r.dataset.on) return;
  r.dataset.on = "1";
  r.addEventListener("input", () => {
    const m = +r.value;
    root.querySelector(".mdl-fj").innerHTML = circSvg(m);
    root.querySelector(".mdl-res").innerHTML = circRes(m);
    root.querySelector(".mdl-sl b").textContent = MONTHS[m - 1];
  });
}

// ---- ウユニ塩湖：月ごとの雨と、鏡張り ----
const UY_RAIN = [42, 37, 27, 1, 1, 1, 1, 1, 2, 1, 10, 22];   // 月ごとの雨の量（mm、目安）
const uyState = (m) => ([12, 1, 2, 3].includes(m) ? 2 : m === 11 || m === 4 ? 1 : 0);   // 0 乾いた白い大地 / 1 水が少しある / 2 鏡張りのチャンス
const UY_TXT = [
  ["乾季：白い塩の大地", "水が干上がって、六角形の塩の模様が地平線まで続きます。車で塩原の奥まで走れる時期です。"],
  ["季節の変わり目", "ところどころに水たまりがある時期です。鏡張りになるかは、その年の雨しだいです。"],
  ["雨季：鏡張りのチャンス", "雨の帯が南へ下りてきて、ウユニにも雨が降ります。平らな塩の上に浅く水がたまり、風がなければ空を映す鏡になります。"],
];
function uySvg(m) {
  const INK = "#1b2330", st = uyState(m), H = 112;
  const person = (x, y, s = 1, op = 1) => `<g opacity="${op}" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" fill="none"><circle cx="${x}" cy="${y - 34 * s}" r="${5 * s}" fill="#fbf9f4"/><line x1="${x}" y1="${y - 29 * s}" x2="${x}" y2="${y - 13 * s}"/><line x1="${x}" y1="${y - 13 * s}" x2="${x - 6 * s}" y2="${y}"/><line x1="${x}" y1="${y - 13 * s}" x2="${x + 6 * s}" y2="${y}"/><line x1="${x - 9 * s}" y1="${y - 24 * s}" x2="${x + 9 * s}" y2="${y - 24 * s}"/></g>`;
  const cloud = (x, y, k) => `<g fill="#fff" stroke="${INK}" stroke-width="1.5"><ellipse cx="${x - 12 * k}" cy="${y}" rx="${13 * k}" ry="${8 * k}"/><ellipse cx="${x + 4 * k}" cy="${y - 5 * k}" rx="${15 * k}" ry="${10 * k}"/><ellipse cx="${x + 18 * k}" cy="${y + 1}" rx="${10 * k}" ry="${7 * k}"/></g>`;
  const k = (180 - H) / H, mir = (svg) => `<g transform="translate(0 ${H + H * k}) scale(1 ${-k})" opacity=".6">${svg}</g>`;
  const sky = cloud(90, 40, 1) + cloud(270, 30, 0.8) + (st ? cloud(190, 58, 0.7) : "");
  let ground;
  if (st === 2) ground = `<rect x="0" y="${H}" width="360" height="${180 - H}" fill="#cfe3ec"/>` + mir(sky) + `<g transform="translate(0 280) scale(1 -1)" opacity=".45">${person(180, 140, 0.85)}</g>`;
  else {
    let hex = "";
    for (let r = 0; r < 6; r++) {
      const w = 14 + r * 9, h = 2 + r * 1.6, y = H + 4 + r * r * 1.9 + r * 4;
      for (let x = -w + (r % 2) * w * 0.75; x < 370; x += w * 1.5) hex += `<path d="M${x - w / 2} ${y} L${x - w / 4} ${y - h} L${x + w / 4} ${y - h} L${x + w / 2} ${y} L${x + w / 4} ${y + h} L${x - w / 4} ${y + h} Z" fill="none" stroke="#c9c3b3" stroke-width="1.2"/>`;
    }
    ground = `<rect x="0" y="${H}" width="360" height="${180 - H}" fill="#f8f6f0"/>${hex}`;
    if (st === 1) ground += `<ellipse cx="90" cy="150" rx="46" ry="7" fill="#cfe3ec" stroke="${INK}" stroke-width="1"/><ellipse cx="275" cy="135" rx="34" ry="5" fill="#cfe3ec" stroke="${INK}" stroke-width="1"/>`;
  }
  const bars = UY_RAIN.map((v, i) => { const h = Math.max(1.5, v * 1.15), x = 22 + i * 27; return `<rect x="${x}" y="${246 - h}" width="17" height="${h}" fill="${i === m - 1 ? "#1f6f5b" : "#c9d6cf"}" stroke="${INK}" stroke-width="${i === m - 1 ? 1.5 : 0}"/><text x="${x + 8.5}" y="258" font-size="9.5" text-anchor="middle" fill="${INK}" font-weight="${i === m - 1 ? 800 : 400}">${i + 1}</text>`; }).join("");
  return `<svg viewBox="0 0 360 264" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ウユニ塩湖">
    <rect width="360" height="${H}" fill="#e4f0f5"/>${sky}
    ${ground}
    <line x1="0" y1="${H}" x2="360" y2="${H}" stroke="${INK}" stroke-width="1.5"/>
    ${person(180, 140, 0.85)}
    ${st === 2 ? `<text x="352" y="${H + 16}" font-size="11" text-anchor="end" fill="${INK}" font-weight="700" paint-order="stroke" stroke="#cfe3ec" stroke-width="3">空が映る</text>` : ""}
    <rect x="0" y="180" width="360" height="84" fill="#fbf9f4"/>
    <line x1="0" y1="180" x2="360" y2="180" stroke="${INK}" stroke-width="1.5"/>
    <text x="12" y="196" font-size="10.5" fill="${INK}" font-weight="700">ウユニの月ごとの雨の量（目安）</text>
    <text x="348" y="196" font-size="10.5" text-anchor="end" fill="#175243" font-weight="800">${MONTHS[m - 1]}：約${UY_RAIN[m - 1]}mm</text>
    ${bars}
  </svg>`;
}
function uyRes(m) { const [t, d] = UY_TXT[uyState(m)]; return `<span>${MONTHS[m - 1]}：${t}</span><b>${d}</b>`; }
function uyHtml(b) {
  const m = Math.min(12, Math.max(1, +b.m || 1));
  return `<figure class="bfig"><div class="mdl" data-mdl="uyuni">
    <p class="mdl-h">手で動かしてみよう</p>
    <div class="mdl-fj">${uySvg(m)}</div>
    <div class="mdl-res">${uyRes(m)}</div>
    <label class="mdl-sl"><span>月</span><input type="range" class="mdl-m" min="1" max="12" step="1" value="${m}" aria-label="月"><b>${MONTHS[m - 1]}</b></label>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}
function initUy(root) {
  const r = root.querySelector(".mdl-m");
  if (!r || r.dataset.on) return;
  r.dataset.on = "1";
  r.addEventListener("input", () => {
    const m = +r.value;
    root.querySelector(".mdl-fj").innerHTML = uySvg(m);
    root.querySelector(".mdl-res").innerHTML = uyRes(m);
    root.querySelector(".mdl-sl b").textContent = MONTHS[m - 1];
  });
}

// ---- ステップで進む断面モデル（モニュメント・バレー／ハロン湾） ----
const STEP_TXT = {
  butte: [
    ["①地層が積み重なった、平らな台地", "下はやわらかい頁岩、その上にかたい砂岩、いちばん上にさらにかたい岩がのっています。"],
    ["②雨と川が、割れ目を削る", "雨や川が少しずつ台地を削り、テーブルのような形の「メサ」が残ります。"],
    ["③やわらかい層から先に削れる", "下のやわらかい層が削れると、上の砂岩が崩れて崖になります。かたい岩が帽子のように守っている部分だけが、塔の形の「ビュート」として残ります。"],
    ["④最後は、細い塔になる", "さらに削れると、細い塔（スパイア）になります。帽子の岩がなくなると、やがて崩れて消えていきます。"],
  ],
  karst: [
    ["①海の底で、石灰岩ができる", "大昔の海の底に、貝殻などが積もって、厚い石灰岩の層ができました。"],
    ["②持ち上がって、陸になる", "大地の動きで石灰岩が持ち上がり、陸になります。表面には、たくさんの割れ目があります。"],
    ["③雨が割れ目を溶かす", "雨水は少しだけ酸性で、石灰岩を溶かします。割れ目が広がって谷になり、とがった岩山が並ぶ地形になりました。"],
    ["④海面が上がり、岩山が島になる", "海面が上がって谷に海が入り、岩山の頭だけが島として残りました。波が足元をえぐって、くびれもできます。"],
  ],
  pinnacle: [
    ["①貝殻の砂が、風で砂丘になる", "海の貝殻が砕けてできた砂が、風で内陸へ運ばれ、大きな砂丘になりました。"],
    ["②砂丘が固まって、石灰岩になる", "砂丘は長い時間をかけて固まり、石灰岩になります。表面にはかたい層ができ、植物の根も入りこみました。"],
    ["③雨水がしみこんで、溶かす", "雨水がしみこむと、溶けやすいところから穴が広がっていきます。溶け残った部分が、柱の形になりました。"],
    ["④砂が飛ばされて、柱が現れる", "まわりのくずれた砂が風で飛ばされ、溶け残った柱が地上に顔を出しました。これがピナクルズです。"],
  ],
};
function pinnSvg(st) {
  const INK = "#1b2330", tag = (t, x, y, al = "middle") => `<text x="${x}" y="${y}" font-size="10.5" text-anchor="${al}" fill="${INK}" font-weight="700" paint-order="stroke" stroke="#fbf6ee" stroke-width="3">${t}</text>`;
  const wind = (y, t) => `<line x1="24" y1="${y}" x2="96" y2="${y}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M88 ${y - 6} L96 ${y} L88 ${y + 6}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` + tag(t, 104, y + 4, "start");
  const cols = [40, 100, 160, 220, 280, 330];
  let g = "";
  if (st === 0) g = `<path d="M0 200 Q120 70 230 120 Q300 150 360 190 L360 220 L0 220 Z" fill="#f0d9a0" stroke="${INK}" stroke-width="2"/>` + [70, 150, 250].map((x) => `<path d="M${x} 168 q6 -9 12 0 z" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`).join("") + wind(36, "風") + tag("砂丘", 180, 150);
  else if (st === 1 || st === 2) {
    g = `<rect x="0" y="90" width="360" height="130" fill="#e3cf9a" stroke="${INK}" stroke-width="2"/><rect x="0" y="90" width="360" height="12" fill="#b99d63" stroke="${INK}" stroke-width="2"/>`;
    g += cols.map((x) => `<path d="M${x} 102 q-4 16 2 30 q5 14 -2 30" fill="none" stroke="#7a5a3a" stroke-width="1.6"/>`).join("");
    if (st === 1) g += tag("かたい層", 300, 84) + tag("石灰岩", 180, 190) + tag("植物の根", 60, 84);
    else {
      g += cols.slice(0, 5).map((x) => `<path d="M${x + 22} 90 L${x + 38} 90 L${x + 34} 200 L${x + 26} 200 Z" fill="#f8efd8" stroke="${INK}" stroke-width="1.6"/>`).join("");
      g += [0, 1, 2, 3].map((i) => `<line x1="${80 + i * 60}" y1="${40 + (i % 2) * 6}" x2="${76 + i * 60}" y2="${54 + (i % 2) * 6}" stroke="#3b82a0" stroke-width="2.2" stroke-linecap="round"/>`).join("") + tag("雨水が溶かした穴", 180, 30);
    }
  } else {
    g = cols.map((x, i) => { const h = 50 + ((i * 37) % 4) * 14, w = 16 + (i % 3) * 4; return `<path d="M${x - w / 2} 200 L${x - w / 2 + 2} ${170 - h + 8} Q${x} ${170 - h - 4} ${x + w / 2 - 2} ${170 - h + 8} L${x + w / 2} 200 Z" fill="#e3cf9a" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`; }).join("");
    g += `<rect x="0" y="170" width="360" height="50" fill="#f0d9a0" stroke="${INK}" stroke-width="2"/>` + wind(36, "砂が飛ばされる") + tag("溶け残った柱（高さは最大5mほど）", 180, 206);
  }
  return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ピナクルズができるまで"><rect width="360" height="220" fill="#fbf6ee"/>${g}</svg>`;
}
function butteSvg(st) {
  const INK = "#1b2330", W = [360, 210, 96, 30][st], c = 180, base = 196, sh = 160, ss = 86, cap = 74;
  const L = c - W / 2, R = c + W / 2, sl = st === 0 ? 0 : 36 + st * 6;
  const tag = (t, x, y, al = "start") => `<text x="${x}" y="${y}" font-size="10.5" text-anchor="${al}" fill="${INK}" font-weight="700" paint-order="stroke" stroke="#fbf9f4" stroke-width="3">${t}</text>`;
  const capW = st === 3 ? 18 : W;
  return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ビュートができるまで">
    <rect width="360" height="220" fill="#fbf6ee"/>
    ${st ? `<rect x="0" y="${cap}" width="360" height="${base - cap}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-dasharray="4 4" opacity=".45"/>` : ""}
    <path d="M${L - sl} ${base} L${L} ${sh} L${R} ${sh} L${R + sl} ${base} Z" fill="#c98f74" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="${L}" y="${ss}" width="${W}" height="${sh - ss}" fill="#c8603a" stroke="${INK}" stroke-width="2"/>
    <rect x="${c - capW / 2}" y="${cap}" width="${capW}" height="${ss - cap}" fill="#8f7d6a" stroke="${INK}" stroke-width="2"/>
    <rect x="0" y="${base}" width="360" height="24" fill="#e7c9a0"/><line x1="0" y1="${base}" x2="360" y2="${base}" stroke="${INK}" stroke-width="2"/>
    ${st === 0 ? tag("かたい岩（帽子の岩）", 12, cap + 9) + tag("砂岩（かたい）", 12, 126) + tag("頁岩（やわらかい）", 12, 182) : ""}
    ${st > 0 ? tag(["", "メサ", "ビュート", "スパイア（細い塔）"][st], c, cap - 8, "middle") : ""}
    ${st === 2 ? tag("帽子の岩が守る", R + 6, cap + 9) : ""}
    ${st === 1 ? tag("削られた", 14, 60) : ""}
  </svg>`;
}
function karstSvg(st) {
  const INK = "#1b2330", tag = (t, x, y, c = INK, al = "middle") => `<text x="${x}" y="${y}" font-size="10.5" text-anchor="${al}" fill="${c}" font-weight="700" paint-order="stroke" stroke="#fbf9f4" stroke-width="3">${t}</text>`;
  const sea = [40, 175, 175, 148][st], top = st === 0 ? 150 : 70, bot = 210;
  const towers = [[30, 70], [92, 52], [156, 74], [214, 58], [276, 80], [330, 62]];
  let rock;
  if (st <= 1) {
    rock = `<rect x="${st ? 24 : 0}" y="${top}" width="${st ? 312 : 360}" height="${bot - top}" fill="#d9d4c3" stroke="${INK}" stroke-width="2"/>` + [40, 60, 80, 100].map((d) => `<line x1="${st ? 24 : 0}" y1="${top + d * (bot - top) / 120}" x2="${st ? 336 : 360}" y2="${top + d * (bot - top) / 120}" stroke="#b9b29c" stroke-width="1.2"/>`).join("");
    if (st === 1) rock += [62, 124, 186, 246, 304].map((x) => `<path d="M${x} ${top} L${x + 3} ${top + 30} L${x - 2} ${top + 55}" fill="none" stroke="${INK}" stroke-width="1.6"/>`).join("");
  } else {
    const pts = [`M0 ${bot}`];
    towers.forEach(([x, w], i) => { const h = 62 + (i % 3) * 14; pts.push(`L${x - 22} 178 Q${x - 26} ${178 - h * 0.6} ${x - 12} ${178 - h} Q${x} ${168 - h} ${x + 12} ${178 - h} Q${x + 26} ${178 - h * 0.6} ${x + 22} 178`); });
    pts.push(`L360 178 L360 ${bot} Z`);
    rock = `<path d="${pts.join(" ")}" fill="#d9d4c3" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` + towers.map(([x], i) => `<path d="M${x - 10} ${178 - 62 - (i % 3) * 14 + 6} q10 -8 20 0" fill="none" stroke="#5e9a6b" stroke-width="5" stroke-linecap="round"/>`).join("");
    if (st === 2) rock += [0, 1, 2].map((i) => `<line x1="${110 + i * 70}" y1="${28 + i * 3}" x2="${106 + i * 70}" y2="${42 + i * 3}" stroke="#3b82a0" stroke-width="2.2" stroke-linecap="round"/>`).join("") + tag("雨（少し酸性）", 180, 20);
  }
  const seaRect = `<rect x="0" y="${sea}" width="360" height="${bot - sea}" fill="#3b82a0" opacity="${st === 0 ? 0.55 : 0.75}"/>`;
  const shells = st === 0 ? [40, 100, 170, 240, 300].map((x) => `<path d="M${x} 146 q6 -9 12 0 z" fill="#fff" stroke="${INK}" stroke-width="1.2"/>`).join("") : "";
  return `<svg viewBox="0 0 360 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ハロン湾ができるまで">
    <rect width="360" height="220" fill="#eef4f6"/>
    ${st === 3 ? rock + seaRect : seaRect + rock}
    ${shells}
    <line x1="0" y1="${sea}" x2="360" y2="${sea}" stroke="${INK}" stroke-width="1.5" stroke-dasharray="5 4"/>
    ${tag("海面", 352, sea - 5, INK, "end")}
    ${st === 0 ? tag("石灰岩の層", 180, 186) : ""}
    ${st === 1 ? tag("割れ目", 124, top - 6) : ""}
    ${st === 3 ? tag("島になった岩山", 92, 70) + tag("海に沈んだ谷", 250, sea + 26, "#fff").replace('stroke="#fbf9f4"', 'stroke="#3b82a0"') : ""}
  </svg>`;
}
const STEP_SVG = { butte: butteSvg, karst: karstSvg, pinnacle: pinnSvg };
function stepRes(k, st) { const [t, d] = STEP_TXT[k][st]; return `<span>${t}</span><b>${d}</b>`; }
function stepHtml(b) {
  const k = b.k, n = STEP_TXT[k].length;
  return `<figure class="bfig"><div class="mdl" data-mdl="${k}">
    <p class="mdl-h">手で動かしてみよう</p>
    <div class="mdl-fj">${STEP_SVG[k](0)}</div>
    <div class="mdl-res">${stepRes(k, 0)}</div>
    <label class="mdl-sl"><span>ステップ</span><input type="range" class="mdl-m" min="1" max="${n}" step="1" value="1" aria-label="ステップ"><b>1 / ${n}</b></label>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}
function initStep(root) {
  const r = root.querySelector(".mdl-m"), k = root.dataset.mdl, n = STEP_TXT[k].length;
  if (!r || r.dataset.on) return;
  r.dataset.on = "1";
  r.addEventListener("input", () => {
    const st = +r.value - 1;
    root.querySelector(".mdl-fj").innerHTML = STEP_SVG[k](st);
    root.querySelector(".mdl-res").innerHTML = stepRes(k, st);
    root.querySelector(".mdl-sl b").textContent = `${st + 1} / ${n}`;
  });
}

// 画面に出てきたモデルを、動くようにする（画面全体で、1回だけつなぐ）
let wired = false;
function init(root) {
  if (root.dataset.mdl === "fjord") return initFjord(root);
  if (root.dataset.mdl === "patagonia") return initPat(root);
  if (root.dataset.mdl === "rift") return initRift(root);
  if (root.dataset.mdl === "circ") return initCirc(root);
  if (root.dataset.mdl === "uyuni") return initUy(root);
  if (root.dataset.mdl === "butte" || root.dataset.mdl === "karst" || root.dataset.mdl === "pinnacle") return initStep(root);
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
