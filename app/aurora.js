// オーロラが光るまで：太陽風の粒が流れ、地球の磁場にはね返され、一部が極へ流れこんで光るようすを動きで見せる
// ステップ：①太陽風 → ②磁場がはね返す → ③一部が極へ → ④空の上で光る。粒は、画面に見えているあいだ流れつづける。
// 大きさや距離は、わかりやすいように変えてある（本物の縮尺ではない）。

const INK = "#1b2330", SKY = "#161d29", GOLD = "#f2c14e", GREEN = "#7fe3a6", LINE = "#9bb8c9";
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// 太陽風の粒（たての位置と、はじまりのずれ）
const PARTS = [];
for (let k = 0; k < 34; k++) PARTS.push({ y: (k * 0.6180339) % 1, ph: (k * k * 0.1371 + 0.31) % 1, sp: 0.85 + ((k * 7) % 5) / 16 });

function draw(cv, state, now) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = cv.clientWidth || 340, H = Math.round(W * 0.64);
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + "px"; }
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.lineJoin = "round"; g.lineCap = "round";
  g.fillStyle = SKY; g.fillRect(0, 0, W, H);
  const st = state.st, f = state.f;   // f：それぞれの要素の出かた（0〜1。なめらかに切りかわる）
  const ex = W * 0.7, ey = H * 0.5, R = W * 0.095, t = now / 1000;
  const tag = (s, x, y, c = "#fbf6ee", size = 11, al = "center", halo = SKY) => {
    g.font = `800 ${size}px "Noto Sans JP", sans-serif`; g.textAlign = al; g.textBaseline = "middle";
    g.lineWidth = 3.5; g.strokeStyle = halo; g.strokeText(s, x, y); g.fillStyle = c; g.fillText(s, x, y);
  };

  // 星
  g.fillStyle = "rgba(255,255,255,.5)";
  for (let k = 0; k < 26; k++) g.fillRect(((k * 97) % 331) / 331 * W, ((k * 57) % 211) / 211 * H, 1.2, 1.2);

  // 太陽
  const sx = -W * 0.1, sr = W * 0.2;
  const gl = g.createRadialGradient(sx, ey, sr * 0.8, sx, ey, sr * 1.7);
  gl.addColorStop(0, "rgba(242,193,78,.45)"); gl.addColorStop(1, "rgba(242,193,78,0)");
  g.fillStyle = gl; g.fillRect(0, 0, W * 0.4, H);
  g.fillStyle = GOLD; g.strokeStyle = "#e2683b"; g.lineWidth = 3; g.beginPath(); g.arc(sx, ey, sr, 0, 7); g.fill(); g.stroke();
  tag("太陽", W * 0.045, ey, INK, 12, "center", GOLD);

  // 磁力の線（太陽の側はおしつぶされ、反対側はのびる）
  if (f.field > 0.01) {
    g.globalAlpha = f.field;
    [1.5, 2.2, 3.0].forEach((w, i) => {
      g.strokeStyle = LINE; g.lineWidth = 1.3; g.globalAlpha = f.field * (0.85 - i * 0.2);
      g.beginPath();
      g.moveTo(ex, ey - R * 0.96); g.bezierCurveTo(ex - R * w, ey - R * (0.9 + w * 0.75), ex - R * w, ey + R * (0.9 + w * 0.75), ex, ey + R * 0.96);
      g.moveTo(ex, ey - R * 0.96); g.bezierCurveTo(ex + R * w * 1.9, ey - R * (0.9 + w * 0.8), ex + R * w * 1.9, ey + R * (0.9 + w * 0.8), ex, ey + R * 0.96);
      g.stroke();
    });
    g.globalAlpha = 1;
  }

  // 太陽風の粒。磁場があるときは、地球のまわりをよけて流れる
  const x0 = W * 0.1, x1 = W * 1.04, Rm = R * 2.1;
  for (const p of PARTS) {
    const u = (p.ph + t * 0.11 * p.sp) % 1;
    let x = x0 + u * (x1 - x0), y = H * (0.06 + 0.88 * p.y);
    const dx = x - ex, dy = y - ey, d = Math.hypot(dx * 0.75, dy);
    let a = ss(0, 0.06, u) * (1 - ss(0.92, 1, u));
    if (f.field > 0.01) {
      // 地球に近づく粒は、上下に押しのけられて、後ろへ流れていく
      const near = ss(-Rm * 2.6, -Rm * 0.9, dx) * f.field, sgn = dy >= 0 ? 1 : -1, ady = Math.abs(dy);
      const want = dx < 0 ? Rm * Math.sqrt(Math.max(0.2, 1 - (dx / (Rm * 1.15)) ** 2)) : Rm * (1 + 0.12 * ss(0, Rm * 3, dx));
      if (ady < want + R * 0.7) y = ey + sgn * (ady + (want + (ady / (want + R * 0.7)) * R * 0.7 - ady) * near);
    } else if (d < R * 1.05) a = 0;   // 磁場がなければ、そのまま地球にぶつかる
    if (a <= 0.01) continue;
    g.globalAlpha = a;
    g.strokeStyle = GOLD; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 11, y); g.lineTo(x - 4, y); g.stroke();
    g.fillStyle = GOLD; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
  }
  g.globalAlpha = 1;
  if (st === 1 && f.field > 0.5) {
    g.strokeStyle = GOLD; g.lineWidth = 2.2;
    g.beginPath(); g.arc(ex + R * 0.3, ey, Rm * 1.3, Math.PI * 0.72, Math.PI * 1.28); g.stroke();
  }

  // 極のほうへ流れこむ粒（上と下の、じょうごのような道）
  if (f.cusp > 0.01) {
    for (const sgn of [-1, 1]) {
      const pts = [[ex - R * 2.9, ey + sgn * R * 1.7], [ex - R * 1.7, ey + sgn * R * 2.4], [ex - R * 0.7, ey + sgn * R * 1.8], [ex - R * 0.15, ey + sgn * R * 0.97]];
      const bz = (u) => { const v = 1 - u; return [v * v * v * pts[0][0] + 3 * v * v * u * pts[1][0] + 3 * v * u * u * pts[2][0] + u * u * u * pts[3][0], v * v * v * pts[0][1] + 3 * v * v * u * pts[1][1] + 3 * v * u * u * pts[2][1] + u * u * u * pts[3][1]]; };
      g.globalAlpha = 0.55 * f.cusp; g.strokeStyle = GOLD; g.lineWidth = 1.4; g.setLineDash([4, 4]);
      g.beginPath(); for (let k = 0; k <= 20; k++) { const q = bz(k / 20); k ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); } g.stroke(); g.setLineDash([]);
      for (let k = 0; k < 5; k++) {
        const u = (k / 5 + t * 0.28) % 1, q = bz(u);
        g.globalAlpha = f.cusp * ss(0, 0.1, u) * (1 - ss(0.9, 1, u));
        g.fillStyle = "#ffe9a8"; g.beginPath(); g.arc(q[0], q[1], 2.8, 0, 7); g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  // 地球
  g.fillStyle = "#3b82a0"; g.strokeStyle = "#fbf6ee"; g.lineWidth = 2; g.beginPath(); g.arc(ex, ey, R, 0, 7); g.fill(); g.stroke();
  g.save(); g.beginPath(); g.arc(ex, ey, R - 1, 0, 7); g.clip();
  g.fillStyle = "#1f6f5b";
  g.beginPath(); g.ellipse(ex - R * 0.3, ey - R * 0.15, R * 0.42, R * 0.3, 0.5, 0, 7); g.fill();
  g.beginPath(); g.ellipse(ex + R * 0.4, ey + R * 0.35, R * 0.28, R * 0.2, -0.4, 0, 7); g.fill();
  g.fillStyle = "rgba(10,14,22,.38)"; g.fillRect(ex + R * 0.15, ey - R, R, R * 2);   // 夜の側
  g.restore();

  // オーロラの輪（オーバル）：ゆらゆら光る
  if (f.glow > 0.01) {
    for (const sgn of [-1, 1]) {
      const oy = ey + sgn * R * 0.86, pul = 0.75 + 0.25 * Math.sin(t * 2.4 + sgn);
      for (let k = -4; k <= 4; k++) {   // 光のカーテン
        const x = ex + k * R * 0.085, h = R * (0.28 + 0.12 * Math.sin(t * 3 + k * 1.7)), gr = g.createLinearGradient(0, oy, 0, oy - sgn * h);
        gr.addColorStop(0, `rgba(127,227,166,${0.75 * f.glow * pul})`); gr.addColorStop(1, "rgba(127,227,166,0)");
        g.strokeStyle = gr; g.lineWidth = R * 0.07; g.beginPath(); g.moveTo(x, oy); g.lineTo(x, oy - sgn * h); g.stroke();
      }
      g.globalAlpha = f.glow * pul; g.strokeStyle = GREEN; g.lineWidth = 3.4;
      g.beginPath(); g.ellipse(ex, oy, R * 0.42, R * 0.13, 0, 0, 7); g.stroke(); g.globalAlpha = 1;
    }
  }

  // 名前
  if (st === 0) tag("太陽風（電気を帯びた粒）", W * 0.36, H * 0.1);
  if (st === 1) { tag("はね返す", ex - R * 3.9, ey - R * 0.2); tag("地球の磁場", W - 8, H - 12, LINE, 11, "right"); }
  if (st === 2) { tag("極のほうへ流れこむ", ex - R * 3.6, ey - R * 3.0); tag("地球の磁場", W - 8, H - 12, LINE, 11, "right"); }
  if (st === 3) { tag("オーロラの輪（オーバル）", ex, ey - R * 1.75, GREEN); tag("南にも輪ができる", ex, ey + R * 1.75, GREEN); }
  if (st < 3) tag("地球", ex, ey + R + 13, "#fbf6ee", 10);
}

export const AU_TXT = [
  ["①太陽から、電気を帯びた粒が飛んでくる", "太陽からは、電気を帯びた小さな粒（太陽風）が、いつも吹き出している。"],
  ["②地球の磁場が、粒をはね返す", "地球は大きな磁石のようなもの。磁場が太陽風の多くをはね返し、地球を守っている。"],
  ["③一部の粒が、極のほうへ流れこむ", "はね返されなかった粒は、磁力の線にそって、北と南の極のほうへ流れこむ。"],
  ["④空の上で、空気とぶつかって光る", "粒が地上100km以上の空で酸素などにぶつかり、光を出す。光るのは、磁極を囲む輪のような地域の空。"],
];
const res = (st) => `<span>${AU_TXT[st][0]}</span><b>${AU_TXT[st][1]}</b>`;

export function auroraHtml(b) {
  const n = AU_TXT.length;
  return `<figure class="bfig"><div class="mdl" data-mdl="aurora2">
    <p class="mdl-h">手で動かしてみよう</p>
    <canvas class="mdl-3d" style="touch-action:pan-y;cursor:default" aria-label="オーロラが光るまでのモデル"></canvas>
    <div class="mdl-res">${res(0)}</div>
    <label class="mdl-sl"><span>ステップ</span><input type="range" class="mdl-m" min="1" max="${n}" step="1" value="1" aria-label="ステップ"><b>1 / ${n}</b></label>
  </div>${b && b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
}

export function initAurora(root) {
  const cv = root.querySelector("canvas"), r = root.querySelector(".mdl-m");
  if (!cv || cv.dataset.on) return;
  cv.dataset.on = "1";
  const state = { st: 0, f: { field: 0, cusp: 0, glow: 0 } };
  let raf = 0, seen = true;
  const still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frame = (now) => {
    raf = 0;
    if (!cv.isConnected) return;
    const want = { field: state.st >= 1 ? 1 : 0, cusp: state.st >= 2 ? 1 : 0, glow: state.st >= 3 ? 1 : 0 };
    for (const k in want) state.f[k] = still ? want[k] : state.f[k] + (want[k] - state.f[k]) * 0.07;   // ゆっくり切りかわる
    draw(cv, state, still ? 0 : now);
    if (seen && !still) raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  kick();
  r.addEventListener("input", () => {
    const st = +r.value - 1;
    state.st = st;
    root.querySelector(".mdl-res").innerHTML = res(st);
    root.querySelector(".mdl-sl b").textContent = `${st + 1} / ${AU_TXT.length}`;
    kick();
  });
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => { seen = es[0].isIntersecting; if (seen) kick(); }).observe(cv);
  window.addEventListener("resize", kick);
}
