// 立体の地形モデル（旅と地理）：地面のブロックを立体で見せ、ステップのスライダーでなめらかに形が変わる。
// 指でドラッグすると向きを変えられる。外部ライブラリは使わず、canvas 2D にタイルを奥から順にぬる（hima3d.js と同じ考え方）。
// モデルは MODELS に足していく。1つのモデルは「高さの式」「色の式」「上にのる層（氷・水など）」「名前」でできている。
//   座標：x＝左右（0〜1）、y＝手前から奥（0〜1）、z＝高さ（0 が海面）。t＝ステップ（0, 1, 2…のあいだを連続で動く）

const INK = "#1b2330";
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c, a = 1) => `rgba(${Math.round(clamp(c[0], 0, 255))},${Math.round(clamp(c[1], 0, 255))},${Math.round(clamp(c[2], 0, 255))},${a})`;

// ---------------- フィヨルドができるまで ----------------
// 谷を、海の出口（手前）から山の奥へ見ている。手前の切り口で、谷の形（V字→U字）がわかる。
const FJ = (() => {
  const ROCK = hex("#a99c88"), GREEN = hex("#8fae7c"), SNOW = hex("#f4f8fa"), CUT = hex("#d8cba5");
  const bend = (y) => 0.07 * Math.sin(y * 4.2 + 0.4) * ss(0.05, 0.5, y);          // 谷の曲がり
  const rough = (x, y) => 0.05 * Math.sin(x * 8 + y * 5) * Math.cos(y * 6 - x * 3);
  const vz = (x, y) => {   // 川がつくったV字の谷
    const d = Math.abs(x - 0.5 - bend(y)) / 0.5, fl = 0.03 + 0.2 * y;
    return fl + (1.05 - fl) * Math.pow(clamp(d), 1.15);
  };
  const uz = (x, y) => {   // 氷河がけずったU字の谷（底は海面より下）
    const d = Math.abs(x - 0.5 - bend(y)) / 0.5, fl = -0.42 + 0.3 * ss(0.55, 1, y);
    return fl + (1.05 - fl) * Math.pow(clamp(d * 1.02), 3.6);
  };
  const carve = (t) => ss(0.15, 1, t);
  const iceLv = (t) => (t <= 1 ? lerp(-0.6, 0.66, ss(0, 0.75, t)) : lerp(0.66, -0.7, ss(1, 1.75, t)));
  return {
    key: "fjord", aria: "フィヨルドができるまでの立体のモデル",
    steps: [
      ["①川が、V字の谷をつくる", "山から流れる川が、谷を少しずつ削っていく。ただし、川が削れるのは海面の高さまで。"],
      ["②氷河が、谷を深いU字に削る", "氷河期、谷は重い氷河で埋まる。氷は谷底も横もまとめて削り、海面より下まで深くえぐっていく。点線は、もとのV字の谷。"],
      ["③氷がとけて、海水が入る", "氷河期が終わって氷がとけると、海面より深い谷に海水が流れこむ。これがフィヨルド。"],
    ],
    size: [2, 2.6, 1.25], base: -0.75, view: { yaw: -0.3, pitch: 0.72 }, scale: 4.9, center: [0.5, 0.5, 0.12],
    cut: CUT,
    z: (x, y, t) => { const c = carve(t), e = ss(0.25, 0.9, Math.abs(x - 0.5 - bend(y)) / 0.5); return lerp(vz(x, y), uz(x, y), c) + rough(x, y) * e * ss(0, 0.3, y); },
    color: (x, y, z, t) => {
      const cold = t <= 1 ? ss(0.1, 0.8, t) : 1 - ss(1.1, 1.9, t);   // 氷河期は、山の上まで雪
      let c = mix(ROCK, GREEN, (1 - ss(0.25, 0.75, z)) * (1 - cold) * 0.9);
      c = mix(c, SNOW, Math.max(ss(0.82, 1.0, z) * 0.7, cold * ss(0.45, 0.8, z)));
      return c;
    },
    layers: [
      { top: (x, y, t) => iceLv(t) + 0.05 * (1 - Math.pow(Math.abs(x - 0.5 - bend(y)) / 0.5, 2)), color: () => [232, 243, 249], alpha: () => 1, line: true },
      { top: () => 0, color: () => [66, 136, 166], alpha: (t) => ss(1.25, 1.9, t) },
    ],
    // 手前の切り口に重ねる線：海面と、もとのV字
    front: (t, line, tag) => {
      line([[0, 0], [1, 0]], INK, 1.2, [5, 4]); tag("海面", 0.985, 0.07, INK, 10, "right");
      if (t > 0.5) line(Array.from({ length: 41 }, (_, i) => [i / 40, vz(i / 40, 0)]), "rgba(27,35,48,.55)", 1.3, [4, 4]);
    },
    // 地面の上に引く線：川
    lines: (t) => (t < 0.6 ? [{ pts: Array.from({ length: 41 }, (_, i) => [0.5 + bend(i / 40), i / 40, vz(0.5 + bend(i / 40), i / 40) + 0.01]), c: `rgba(59,130,160,${1 - ss(0.2, 0.6, t)})`, w: 3 }] : []),
    labels: (t) => [
      t < 0.5 && { s: "川", p: [0.5 + bend(0.35), 0.35, 0.16], c: "#2f6f9a" },
      t < 0.5 && { s: "V字の谷", p: [0.5, 0, 0.42] },
      t > 0.5 && t < 1.5 && { s: "氷河", p: [0.5 + bend(0.45), 0.45, 0.78], size: 13 },
      t > 0.5 && t < 1.5 && { s: "底と横を削る", p: [0.5, 0, -0.2], c: "#175243" },
      t >= 1.5 && { s: "海水が入る", p: [0.5 + bend(0.4), 0.4, 0.06], c: "#fff", halo: "#2f6f9a", size: 12 },
      t >= 1.5 && { s: "海面より深いU字の谷", p: [0.5, 0, -0.27], c: "#fff", halo: "#2f6f9a" },
    ],
  };
})();

const MODELS = { fjord: FJ };
export const hasTerrain = (k) => !!MODELS[k];

// ---------------- 描く ----------------
function build(M, t, fine) {
  const nx = fine ? 92 : 46, ny = fine ? 104 : 52, row = nx + 1;
  const z = new Float32Array(row * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) z[j * row + i] = M.z(i / nx, j / ny, t);
  const L = (M.layers || []).map((ly) => {
    const a = ly.alpha(t);
    if (a <= 0.01) return null;
    const top = new Float32Array(z.length);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) top[j * row + i] = ly.top(i / nx, j / ny, t);
    return { top, a, ly };
  }).filter(Boolean);
  return { t, nx, ny, row, z, L };
}

function draw(cv, M, S, view) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = cv.clientWidth || 340, H = Math.round(W * 0.8);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px"; }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#fbf6ee"; g.fillRect(0, 0, W, H);
  g.lineJoin = "round"; g.lineCap = "round";

  const [SX, SY, SZ] = M.size, [CX, CY, CZ] = M.center;
  const cy0 = Math.cos(view.yaw), sy0 = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  const s = W / M.scale;
  const P = (x, y, z) => {
    const a = (x - CX) * SX, b = (y - CY) * SY, X = a * cy0 - b * sy0, Y = a * sy0 + b * cy0;
    return [W / 2 + X * s, H * 0.5 - (Y * sp + (z - CZ) * SZ * cp) * s];
  };
  const { t, nx, ny, row, z, L } = S;
  const shade = (dx, dy) => 1 + 0.17 * Math.tanh(dx * 0.5) - 0.07 * Math.tanh(dy * 0.5);   // 光は左手前の上から

  // 1. 地面と、その上の層（奥の列から手前へ）
  const quad = (p, q, r, u, st) => { g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.lineTo(r[0], r[1]); g.lineTo(u[0], u[1]); g.closePath(); g.fillStyle = st; g.fill(); g.strokeStyle = st; g.lineWidth = 0.6; g.stroke(); };
  for (let j = ny - 1; j >= 0; j--) {
    const y0 = j / ny, y1 = (j + 1) / ny;
    for (let n = 0; n < nx; n++) {
      const i = sy0 > 0 ? nx - 1 - n : n, a = j * row + i, b = a + 1, c = a + row + 1, d = a + row;
      const x0 = i / nx, x1 = (i + 1) / nx, zm = (z[a] + z[b] + z[c] + z[d]) / 4;
      const dx = ((z[b] + z[c]) - (z[a] + z[d])) / 2 * nx * SZ / SX, dy = ((z[c] + z[d]) - (z[a] + z[b])) / 2 * ny * SZ / SY;
      const col = M.color((x0 + x1) / 2, (y0 + y1) / 2, zm, t).map((v) => v * shade(dx, dy));
      quad(P(x0, y0, z[a]), P(x1, y0, z[b]), P(x1, y1, z[c]), P(x0, y1, z[d]), rgb(col));
      for (const { top, a: al, ly } of L) {
        const dA = top[a] - z[a], dB = top[b] - z[b], dC = top[c] - z[c], dD = top[d] - z[d];
        if (dA <= 0 && dB <= 0 && dC <= 0 && dD <= 0) continue;
        // 層が地面より上にあるところだけをぬる（ふちは、タイルの辺の上で高さがそろう点をつなぐ）
        const vs = [[x0, y0, top[a], dA], [x1, y0, top[b], dB], [x1, y1, top[c], dC], [x0, y1, top[d], dD]], pts = [];
        for (let k = 0; k < 4; k++) {
          const u = vs[k], v = vs[(k + 1) % 4];
          if (u[3] > 0) pts.push(P(u[0], u[1], u[2]));
          if ((u[3] > 0) !== (v[3] > 0)) { const f = u[3] / (u[3] - v[3]); pts.push(P(lerp(u[0], v[0], f), lerp(u[1], v[1], f), lerp(u[2], v[2], f))); }
        }
        if (pts.length < 3) continue;
        const st = rgb(ly.color((x0 + x1) / 2, (y0 + y1) / 2, t), al);
        g.beginPath(); pts.forEach((q, k) => (k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath();
        g.fillStyle = st; g.fill();
        if (al > 0.99) { g.strokeStyle = st; g.lineWidth = 0.6; g.stroke(); }
      }
    }
  }

  // 2. 切り口（手前と、見えている横の面）
  const face = (pt, n, zAt, topsAt) => {
    // 地面の中
    g.beginPath();
    for (let k = 0; k <= n; k++) { const p = P(...pt(k / n), zAt(k)); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
    let p = P(...pt(1), M.base); g.lineTo(p[0], p[1]); p = P(...pt(0), M.base); g.lineTo(p[0], p[1]); g.closePath();
    g.fillStyle = rgb(M.cut); g.fill();
    // 層（氷・水）
    L.forEach(({ a: al, ly }, li) => {
      const lc = ly.color(0.5, 0, t);
      for (let k = 0; k < n; k++) {
        const z0 = zAt(k), z1 = zAt(k + 1), t0 = topsAt(li, k), t1 = topsAt(li, k + 1), d0 = t0 - z0, d1 = t1 - z1;
        if (d0 <= 0 && d1 <= 0) continue;
        let u0 = k / n, u1 = (k + 1) / n, a0 = z0, a1 = z1, b0 = t0, b1 = t1;
        if (d0 <= 0) { const f = d0 / (d0 - d1); u0 = lerp(u0, u1, f); a0 = b0 = lerp(z0, z1, f); }
        if (d1 <= 0) { const f = d0 / (d0 - d1); u1 = lerp(k / n, u1, f); a1 = b1 = lerp(z0, z1, f); }
        const st = rgb(lc, al), q = [P(...pt(u0), a0), P(...pt(u1), a1), P(...pt(u1), b1), P(...pt(u0), b0)];
        g.beginPath(); q.forEach((v, m) => (m ? g.lineTo(v[0], v[1]) : g.moveTo(v[0], v[1]))); g.closePath();
        g.fillStyle = st; g.fill();
        if (al > 0.99) { g.strokeStyle = st; g.lineWidth = 0.6; g.stroke(); }
      }
    });
    // ふちの線
    g.beginPath();
    for (let k = 0; k <= n; k++) { const q = P(...pt(k / n), zAt(k)); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
    p = P(...pt(1), M.base); g.lineTo(p[0], p[1]); p = P(...pt(0), M.base); g.lineTo(p[0], p[1]); g.closePath();
    g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
  };
  const sideI = sy0 > 0 ? 0 : nx;   // 見えている横の面
  face((u) => [sideI / nx, u, 0].slice(0, 2), ny, (k) => z[k * row + sideI], (li, k) => L[li].top[k * row + sideI]);
  face((u) => [u, 0], nx, (k) => z[k], (li, k) => L[li].top[k]);

  // 3. 線と名前
  const tagAt = (str, x, y, c = INK, size = 11, al = "center", halo = "#fbf6ee") => {
    g.font = `800 ${size}px "Noto Sans JP", sans-serif`; g.textAlign = al; g.textBaseline = "middle";
    g.lineWidth = 3.5; g.strokeStyle = halo; g.strokeText(str, x, y); g.fillStyle = c; g.fillText(str, x, y);
  };
  for (const ln of (M.lines ? M.lines(t) : [])) {
    g.beginPath(); ln.pts.forEach((q, k) => { const p = P(...q); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
    g.strokeStyle = ln.c; g.lineWidth = ln.w; g.stroke();
  }
  if (M.front) {
    const line = (pts, c, wd, dash) => {
      g.beginPath(); pts.forEach(([x, zz], k) => { const p = P(x, 0, Math.max(zz, M.base)); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); });
      g.setLineDash(dash || []); g.strokeStyle = c; g.lineWidth = wd; g.stroke(); g.setLineDash([]);
    };
    M.front(t, line, (str, x, zz, c, size, al) => { const p = P(x, 0, zz); tagAt(str, p[0], p[1], c, size, al); });
  }
  for (const lb of M.labels(t)) {
    if (!lb) continue;
    const p = P(...lb.p);
    tagAt(lb.s, p[0], p[1], lb.c || INK, lb.size || 11, "center", lb.halo || "#fbf6ee");
  }
}

// ---------------- 記事の中に置く ----------------
const res = (M, st) => `<span>${M.steps[st][0]}</span><b>${M.steps[st][1]}</b>`;

export function terrainHtml(b) {
  const M = MODELS[b.k], n = M.steps.length;
  return `<figure class="bfig"><div class="mdl" data-mdl="t3d" data-k="${M.key}">
    <p class="mdl-h">手で動かしてみよう</p>
    <canvas class="mdl-3d" aria-label="${M.aria}"></canvas>
    <p class="mdl-hint">指でドラッグすると、向きを変えられます</p>
    <div class="mdl-res">${res(M, 0)}</div>
    <label class="mdl-sl"><span>ステップ</span><input type="range" class="mdl-m" min="1" max="${n}" step="1" value="1" aria-label="ステップ"><b>1 / ${n}</b></label>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}

export function initTerrain(root) {
  const cv = root.querySelector("canvas"), r = root.querySelector(".mdl-m"), M = MODELS[root.dataset.k];
  if (!cv || !M || cv.dataset.on) return;
  cv.dataset.on = "1";
  const view = { ...M.view };
  let t = 0, goal = 0, S = build(M, 0, true), raf = 0, idle = 0, drag = null;
  const paint = () => draw(cv, M, S, view);
  const settle = () => { clearTimeout(idle); idle = setTimeout(() => { if (!raf && !drag) { S = build(M, t, true); paint(); } }, 120); };
  const tick = () => {
    const dt = goal - t;
    t = Math.abs(dt) < 0.004 ? goal : t + clamp(dt * 0.06, -0.03, 0.03);   // ゆっくり、同じくらいの速さで近づく
    S = build(M, t, t === goal); paint();
    raf = t !== goal ? requestAnimationFrame(tick) : 0;
  };
  paint();
  r.addEventListener("input", () => {
    const st = +r.value - 1;
    goal = st;
    root.querySelector(".mdl-res").innerHTML = res(M, st);
    root.querySelector(".mdl-sl b").textContent = `${st + 1} / ${M.steps.length}`;
    if (!raf) raf = requestAnimationFrame(tick);
  });
  cv.addEventListener("pointerdown", (e) => { if (!raf) S = build(M, t, false); drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; cv.style.cursor = "grabbing"; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const w = cv.clientWidth || 340;
    view.yaw = clamp(drag.yaw - ((e.clientX - drag.x) / w) * 2.2, -0.9, 0.9);
    view.pitch = clamp(drag.pitch + ((e.clientY - drag.y) / w) * 1.6, 0.25, 1.2);
    if (!raf) requestAnimationFrame(paint);
  });
  const up = () => { drag = null; cv.style.cursor = "grab"; settle(); };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  window.addEventListener("resize", paint);
}
