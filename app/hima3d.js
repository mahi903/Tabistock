// ヒマラヤができるまで（3D）：インドとユーラシア大陸のあたりを立体の地図で見せる
// ステップのスライダーで「インドが北へ動く → ぶつかる → 山が押し上げられる → 湿った風をさえぎる」と進む。
// 指でドラッグすると向きを変えられる。地形は本物をごく単純にしたもの（高さは強調している）。
// 外部ライブラリは使わず、canvas 2D に自分で立体を描く（タイルを奥から順にぬる）。

const INK = "#1b2330";
const LON0 = 64, LON1 = 98, LAT0 = -8, LAT1 = 41;
// 山を描くタイルの細かさ（度）[東西, 南北]。斜面が急なので、南北を細かくする。動いている間は軽く、止まったら細かく
const MESH = [[0.3, 0.12], [0.2, 0.05]];
const DRIFT = 15;              // ステップ1でのインドの位置（今より何度南か）
const LAND = 0.35;             // 陸の高さ（海は0）

// インド（インドプレートの陸）。北のはしは、ヒマラヤのふもとの線
const INDIA0 = [[68, 23.7], [70, 21], [72.8, 19], [73.5, 15.5], [74.8, 12.8], [76.3, 9.5], [77.5, 8.1], [78.2, 9], [79.9, 10.3], [80.3, 13.1], [81, 16], [83, 17.8], [86.5, 20], [87, 21.6], [89, 21.9], [90.5, 22.3], [92, 22.5], [92.5, 25], [95.5, 27.6], [92, 26.9], [88, 26.6], [84, 27.2], [80, 28.6], [77, 30.6], [74.5, 32.6], [72, 33], [71, 30.5], [69.5, 28], [67.5, 25.5], [66.8, 24.8]];
const COAST_N = 18;            // INDIA0 のうち、海に面している点の数（0〜17）。残りは山のふもと
// ヒマラヤのふもとの線（経度ごとの緯度）
const FRONT = [[62, 30.5], [67.5, 31], [72, 33], [74.5, 32.6], [77, 30.6], [80, 28.6], [84, 27.2], [88, 26.6], [92, 26.9], [95.5, 27.6], [97, 28], [100, 28]];

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function front0(lon) {
  for (let i = 1; i < FRONT.length; i++) if (lon <= FRONT[i][0]) { const [a, p] = FRONT[i - 1], [b, q] = FRONT[i]; return lerp(p, q, (lon - a) / (b - a)); }
  return FRONT[FRONT.length - 1][1];
}
// 角が出ないように、前後をならした線
// はじめに細かい表をつくっておく（傾きが段々に変わると、山の光り方にしま模様が出るため）
const FT0 = 58, FTS = 0.05;
const FT = (() => {
  const T = [];
  for (let lon = FT0; lon <= 104; lon += FTS) {
    let t = 0, wsum = 0;
    for (let k = -40; k <= 40; k++) { const u = k * 0.1, w = Math.exp(-((u / 1.3) ** 2)); t += w * front0(lon + u); wsum += w; }
    T.push(t / wsum);
  }
  return T;
})();
const front = (lon) => { const x = clamp((lon - FT0) / FTS, 0, FT.length - 1.001), i = Math.floor(x); return lerp(FT[i], FT[i + 1], x - i); };
// 折れ線の角を丸める（Chaikin法）
function smooth(P, n, closed) {
  for (let r = 0; r < n; r++) {
    const Q = [], L = P.length;
    if (!closed) Q.push(P[0]);
    for (let i = 0; i < (closed ? L : L - 1); i++) {
      const a = P[i], b = P[(i + 1) % L];
      Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) Q.push(P[L - 1]);
    P = Q;
  }
  return P;
}
// インドの形：海岸はなめらかに、北のはしはふもとの線にそわせる
const INDIA_COAST = smooth([...INDIA0.slice(-2), ...INDIA0.slice(0, COAST_N)], 3, false);
const INDIA = (() => {
  const P = [...INDIA_COAST];
  const e = INDIA_COAST[INDIA_COAST.length - 1][0], w = INDIA_COAST[0][0];
  P.push([92.5, 25], [95.2, 27.4]);
  for (let lo = 95; lo >= 69; lo -= 0.5) P.push([lo, front(lo) - 0.15]);
  P.push([67.8, 27]);
  return P;
})();
// ユーラシア大陸の南のはし（海に面したところ）
const EURA = (() => {
  const P = [[LON0, LAT1], [LON0, 25.2], [66.6, 25.3], [67.4, 26.4], [67.9, 29.5]];
  for (let lo = 68.5; lo <= 92.5; lo += 0.5) P.push([lo, front(lo) + 0.1]);
  P.push(...smooth([[93, 27], [93.4, 24], [92.6, 21.2], [94, 19.5], [94.3, 16.4], [95.5, 15.8], [97.2, 16.4], [LON1, 15.6]], 2, false));
  P.push([LON1, LAT1]);
  return P;
})();

const taper = (lon) => ss(69, 73, lon) * (1 - ss(96, 99, lon));
const wave = (lon, lat) => Math.sin(lon * 0.55 + lat * 0.5) * Math.cos(lat * 0.8 - lon * 0.3);
// ユーラシア側の高さ（m＝山の育ち具合 0〜1）
function height(lon, lat, m) {
  const f = front(lon);
  if (m <= 0 || lat <= f) return LAND;
  const r = f + 1.7, tp = taper(lon) * ss(f, f + 1.1, lat);   // ふもとの線から、なめらかに立ち上がる
  const ridge = Math.exp(-(((lat - r) / 1.2) ** 2));
  const tibet = ss(r - 0.3, r + 1.6, lat) * (1 - ss(36.5, 39.5, lat));
  const peaks = 0.55 * Math.sin(lon * 1.9 + 1) * Math.sin(lon * 0.63) + 0.25 * Math.sin(lon * 3.3);   // 尾根にならぶ峰
  const h = LAND + m * tp * ((5.2 + peaks) * ridge + 2.2 * tibet * (1 - ridge * 0.5) + 0.5 * wave(lon, lat) * (0.7 * ridge + 0.5 * tibet));
  return Math.max(h, LAND);
}

// t：0〜3（0＝インドが南にある、1＝ぶつかった、2＝山が高くなった、3＝風と雨）
function build(t, fine) {
  const d = DRIFT * (1 - ss(0, 1, t)), m = ss(1, 2, t), w = ss(2, 3, t);
  // 山のところだけ、細かい高さの表をつくる
  const [sx, sy] = MESH[fine ? 1 : 0];
  const ML0 = 68.5, MA0 = 25.5;
  const nx = Math.ceil((LON1 - ML0) / sx), ny = Math.ceil((LAT1 - MA0) / sy);
  const z = new Float32Array((nx + 1) * (ny + 1));
  if (m > 0) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) z[j * (nx + 1) + i] = height(Math.min(ML0 + i * sx, LON1), Math.min(MA0 + j * sy, LAT1), m);
  return { d, m, w, z, nx, ny, sx, sy, ML0, MA0 };
}

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgb = (c) => "rgb(" + c.map((v) => Math.round(clamp(v, 0, 255))).join(",") + ")";
const C = { sea: hex("#9fc9dd"), shore: hex("#c8e1ec"), india: hex("#d8b98a"), eura: hex("#b9a58a"), rock: hex("#a8988a"), strata: hex("#8fa3ad"), snow: hex("#ffffff"), wet: hex("#8fb878"), dry: hex("#d9a873"), side: hex("#7a6652"), cliff: hex("#9c8466") };

function euraColor(h, lat, lon, S) {
  let c = C.eura;
  if (h > 0.5) {
    const r = front(lon) + 1.7;
    c = mix(c, C.rock, clamp((h - 0.5) / 1.5));
    if (h > 1.4) c = mix(c, C.strata, 0.85 * clamp((h - 1.4) / 1.0) * (1 - S.w));   // 押し上げられた海の底の地層
    if (h > 3.9) c = mix(c, C.snow, clamp((h - 3.9) / 0.7) * (0.35 + 0.65 * S.w));
    if (S.w > 0) {
      c = mix(c, C.dry, 0.55 * S.w * ss(r + 0.3, r + 1.6, lat) * (1 - ss(3.6, 4.2, h)));                 // 北側（チベット）は乾く
      c = mix(c, C.wet, 0.6 * S.w * (1 - ss(r - 0.9, r - 0.1, lat)) * clamp(1 - (h - 0.5) / 3));    // 南側のふもとは雨で緑に
    }
  }
  return c;
}

// 光は西から。東西の傾きだけで明るさを決める
// （南北の傾きまで使うと、とがった尾根でタイルの明るさが交互に変わり、しま模様になる）
const shade = (dx) => 1 + 0.2 * Math.tanh(dx * 0.55);

function draw(cv, S, view) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = cv.clientWidth || 340, H = Math.round(W * 0.9);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px"; }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#fbf6ee"; g.fillRect(0, 0, W, H);
  g.lineJoin = "round";

  const cy0 = Math.cos(view.yaw), sy0 = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const s = W / 38, KX = Math.cos(20 * Math.PI / 180);
  const cx = W / 2, cy = H * 0.54;
  const P = (lon, lat, h) => {
    const x = (lon - 81) * KX, y = lat - 19;
    const X = x * cy0 - y * sy0, Y = x * sy0 + y * cy0;
    return [cx + X * s, cy - (Y * sp + h * cp) * s, Y];   // 3つ目は奥行き（北ほど奥）
  };
  const poly = (pts, lat0, h, fill, stroke, lw) => {
    g.beginPath();
    pts.forEach(([lo, la], n) => { const p = P(lo, la + lat0, h); n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  };

  // 1. 地面の厚み（側面）と海
  const edgeH = (lo, la) => (la >= 25.2 && (la > front(lo) || lo < 66.6)) ? height(lo, la, S.m) : 0;
  const sideSeg = [];
  const pushEdge = (lo0, la0, lo1, la1) => {
    const p0 = P(lo0, la0, edgeH(lo0, la0)), p1 = P(lo1, la1, edgeH(lo1, la1)), q1 = P(lo1, la1, -1.4), q0 = P(lo0, la0, -1.4);
    sideSeg.push([(p0[2] + p1[2]) / 2, [p0, p1, q1, q0]]);
  };
  for (let lo = LON0; lo < LON1 - 1e-6; lo += 0.5) { pushEdge(lo, LAT0, lo + 0.5, LAT0); pushEdge(lo, LAT1, lo + 0.5, LAT1); }
  for (let la = LAT0; la < LAT1 - 1e-6; la += 0.5) { pushEdge(LON0, la, LON0, la + 0.5); pushEdge(LON1, la, LON1, la + 0.5); }
  sideSeg.sort((p, q) => q[0] - p[0]).forEach(([, pts]) => {
    g.beginPath(); pts.forEach(([x, y], n) => (n ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.fillStyle = rgb(C.side); g.fill(); g.strokeStyle = rgb(C.side); g.lineWidth = 0.8; g.stroke();
  });
  poly([[LON0, LAT0], [LON1, LAT0], [LON1, LAT1], [LON0, LAT1]], 0, 0, rgb(C.sea));

  // 2. 陸（はじめに海面の高さに、少し濃い色で。その上に陸の高さで。ふちが小さな崖に見える）
  const euraC = rgb(C.eura);
  poly(EURA, 0, 0, rgb(C.shore)); poly(EURA, 0, 0.0, null, rgb(C.shore), 5);
  poly(EURA, 0, 0, rgb(C.cliff)); poly(EURA, 0, LAND, euraC);
  let indiaC = C.india;
  if (S.w > 0) indiaC = mix(indiaC, C.wet, 0.32 * S.w);
  poly(INDIA, -S.d, 0, null, rgb(C.shore), 5);
  poly(INDIA, -S.d, 0, rgb(C.cliff)); poly(INDIA, -S.d, LAND, rgb(indiaC));
  // インドの北のほうは、雨で緑に（ふもとに近いほど）
  if (S.w > 0.01) {
    const band = INDIA.filter(([, la]) => la > 21);
    g.save(); poly(INDIA, -S.d, LAND); g.clip();
    const a = P(80, 21, LAND), b = P(80, 28, LAND), gr = g.createLinearGradient(a[0], a[1], b[0], b[1]);
    gr.addColorStop(0, "rgba(143,184,120,0)"); gr.addColorStop(1, `rgba(143,184,120,${0.7 * S.w})`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore();
    void band;
  }
  poly(INDIA_COAST.concat([]), -S.d, LAND, null, null);
  g.beginPath(); INDIA_COAST.forEach(([lo, la], n) => { const p = P(lo, la - S.d, LAND); n ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
  g.strokeStyle = "rgba(27,35,48,.5)"; g.lineWidth = 1; g.stroke();

  // 3. 山とチベット高原（北の列から順に。高さのあるタイルだけ描く）
  if (S.m > 0.001) {
    const { z, nx, ny, sx, sy, ML0, MA0 } = S, row = nx + 1;
    const lonAt = (i) => Math.min(ML0 + i * sx, LON1), latAt = (j) => Math.min(MA0 + j * sy, LAT1);
    const vx = new Float32Array(z.length), vy = new Float32Array(z.length);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const k = j * row + i, p = P(lonAt(i), latAt(j), z[k]); vx[k] = p[0]; vy[k] = p[1]; }
    // 奥（北）から手前へ。向きを変えたときは、列の向きも合わせる
    for (let j = ny - 1; j >= 0; j--) for (let n = 0; n < nx; n++) {
      const i = sy0 > 0 ? nx - 1 - n : n;   // 東が奥のときは、東の列から
      const a = j * row + i, b = a + 1, c = a + row + 1, d = a + row;
      if (Math.max(z[a], z[b], z[c], z[d]) <= LAND + 0.005) continue;
      const lon = (lonAt(i) + lonAt(i + 1)) / 2, lat = (latAt(j) + latAt(j + 1)) / 2, h = (z[a] + z[b] + z[c] + z[d]) / 4;
      const dx = ((z[b] + z[c]) - (z[a] + z[d])) / 2 / (sx * KX);
      const st = rgb(euraColor(h, lat, lon, S).map((v) => v * shade(dx)));
      g.beginPath(); g.moveTo(vx[a], vy[a]); g.lineTo(vx[b], vy[b]); g.lineTo(vx[c], vy[c]); g.lineTo(vx[d], vy[d]); g.closePath();
      g.fillStyle = st; g.fill(); g.strokeStyle = st; g.lineWidth = 0.5; g.stroke();
    }
  }

  // ---- 上に重ねるもの（矢印・雨・名前） ----
  const tag = (t, x, y, c = INK, size = 11, al = "center") => {
    g.font = `800 ${size}px "Noto Sans JP", sans-serif`; g.textAlign = al; g.textBaseline = "middle";
    g.lineWidth = 3.5; g.strokeStyle = "#fbf6ee"; g.strokeText(t, x, y); g.fillStyle = c; g.fillText(t, x, y);
  };
  const arrow = (pts, c, wd = 2.6) => {
    g.strokeStyle = c; g.lineWidth = wd; g.lineCap = "round"; g.beginPath();
    pts.forEach(([x, y], n) => (n ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    const [x1, y1] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 2], an = Math.atan2(y1 - y0, x1 - x0);
    g.beginPath(); g.moveTo(x1 - 8 * Math.cos(an - 0.5), y1 - 8 * Math.sin(an - 0.5)); g.lineTo(x1, y1); g.lineTo(x1 - 8 * Math.cos(an + 0.5), y1 - 8 * Math.sin(an + 0.5)); g.stroke();
  };
  const at = (lon, lat, h) => { const p = P(lon, lat, h); return [p[0], p[1]]; };
  // インドが北へ動く矢印
  if (S.d > 1) {
    g.globalAlpha = clamp(S.d / 6);
    arrow([at(78, 19 - S.d, 1.2), at(78, 28 - S.d, 1.2)], INK, 3);
    g.globalAlpha = 1;
  }
  // 湿った風と雨
  if (S.w > 0.02) {
    g.globalAlpha = S.w;
    [74, 81, 88].forEach((lo) => {
      const r = front(lo) + 1.7;
      arrow([0, 0.25, 0.5, 0.75, 1].map((u) => at(lo, lerp(10, r - 1.6, u), lerp(1.4, 4, u * u))), "#2f6f9a", 2.6);
      for (let n = 0; n < 4; n++) {
        const q = at(lo + 1.2 + n * 0.8, r - 2.2 + n * 0.2, 4.2);
        g.strokeStyle = "#2f6f9a"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] - 2.5, q[1] + 13); g.stroke();
      }
    });
    g.globalAlpha = 1;
  }
  let [x, y] = at(78.5, 19 - S.d, LAND);
  tag("インド", x, y, INK, 13); tag("インドプレート", x, y + 15, "#6b5a44", 10);
  [x, y] = at(65, 39.6, LAND);
  tag("ユーラシア大陸", x, y, INK, 12, "left"); tag("ユーラシアプレート", x, y + 14, "#6b5a44", 10, "left");
  if (S.d > 4) { [x, y] = at(84, (front(84) + 22 - S.d) / 2 + 1, 0.1); tag("テチス海", x, y, "#2f6f9a", 12); }
  if (S.m > 0.4 && S.w < 0.5) { [x, y] = at(83, front(83) + 1.7, 6.4 * S.m); tag("押し上げられた海の底の地層", x, y - 12, "#3d5a66", 11); }
  if (S.w > 0.5) {
    [x, y] = at(81.5, front(81.5) + 1.7, 6.4); tag("ヒマラヤ山脈", x, y - 10, INK, 11);
    [x, y] = at(91.5, 23.5, LAND); tag("南側に大雨", x, y, "#2f6f9a", 11);
    [x, y] = at(90.5, 37.2, 2.8); tag("乾いたチベット高原", x, y, "#b4562c", 11);
  }
  const n0 = at(95.5, LAT0 + 9, 0), n1 = at(95.5, LAT0 + 13, 0);
  arrow([n0, n1], INK, 2); tag("北", n1[0] + (n1[0] - n0[0]) * 0.6, n1[1] + (n1[1] - n0[1]) * 0.6, INK, 11);
}

export const HIMA_TXT = [
  ["①インドが北へ動いていく", "大昔、インドは南の大陸から分かれて北へ動いていた。ユーラシア大陸とのあいだには、テチス海が広がっていた。"],
  ["②海が閉じ、大陸どうしがぶつかる", "5,000万〜6,000万年前、テチス海が閉じて、インドがユーラシア大陸にぶつかった。"],
  ["③海の底の地層が、押し上げられる", "陸どうしはどちらも下にもぐりこめず、ぶつかったところが押し上げられて山脈に。エベレストの山頂は、海の底でできた石灰岩。"],
  ["④山脈が、湿った風をさえぎる", "南からの湿った風が山にぶつかり、南側に大雨を降らせる。山をこえた北側のチベット高原は乾いている。"],
];
const res = (st) => `<span>${HIMA_TXT[st][0]}</span><b>${HIMA_TXT[st][1]}</b>`;

export function himaHtml(b) {
  const n = HIMA_TXT.length;
  return `<figure class="bfig"><div class="mdl" data-mdl="hima3d">
    <p class="mdl-h">手で動かしてみよう</p>
    <canvas class="mdl-3d" aria-label="ヒマラヤができるまでの立体の地図"></canvas>
    <p class="mdl-hint">指でドラッグすると、向きを変えられます</p>
    <div class="mdl-res">${res(0)}</div>
    <label class="mdl-sl"><span>ステップ</span><input type="range" class="mdl-m" min="1" max="${n}" step="1" value="1" aria-label="ステップ"><b>1 / ${n}</b></label>
  </div>${b && b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}

export function initHima(root) {
  const cv = root.querySelector("canvas"), r = root.querySelector(".mdl-m");
  if (!cv || cv.dataset.on) return;
  cv.dataset.on = "1";
  const view = { yaw: -0.1, pitch: 0.78 };
  let t = 0, goal = 0, S = build(0, true), raf = 0, idle = 0, drag = null;
  const paint = () => draw(cv, S, view);
  // 動きが止まったら、細かいタイルで描き直す
  const settle = () => { clearTimeout(idle); idle = setTimeout(() => { if (!raf && !drag) { S = build(t, true); paint(); } }, 120); };
  const tick = () => {
    const dt = goal - t;
    t = Math.abs(dt) < 0.004 ? goal : t + dt * 0.07;   // ゆっくり近づく
    S = build(t, t === goal); paint();
    raf = t !== goal ? requestAnimationFrame(tick) : 0;
  };
  paint();
  r.addEventListener("input", () => {
    const st = +r.value - 1;
    goal = st;
    root.querySelector(".mdl-res").innerHTML = res(st);
    root.querySelector(".mdl-sl b").textContent = `${st + 1} / ${HIMA_TXT.length}`;
    if (!raf) raf = requestAnimationFrame(tick);
  });
  cv.addEventListener("pointerdown", (e) => { if (!raf) S = build(t, false); drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; cv.style.cursor = "grabbing"; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const w = cv.clientWidth || 340;
    view.yaw = clamp(drag.yaw - ((e.clientX - drag.x) / w) * 2.2, -1.0, 1.0);
    view.pitch = clamp(drag.pitch + ((e.clientY - drag.y) / w) * 1.6, 0.45, 1.35);
    if (!raf) requestAnimationFrame(paint);
  });
  const up = () => { drag = null; cv.style.cursor = "grab"; settle(); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  window.addEventListener("resize", paint);
}
