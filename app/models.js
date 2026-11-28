import { himaHtml, initHima } from "./hima3d.js?v=202611282100";
import { euHtml, initEu } from "./eurowind.js?v=202611282100";
import { auroraHtml, initAurora } from "./aurora.js?v=202611282100";
import { hasTerrain, terrainHtml, initTerrain } from "./terrain3d.js?v=202611282100";
// 旅の掲示板（旅と地理）の記事の中に入れる、手で動かせるモデル
// いまあるもの：hadley＝大気大循環の地球儀（月のスライダーで、太陽と、雨の帯・乾きやすい帯が南北に動く。指で地球を回せる）
//             circ＝大気大循環の断面（月のスライダーで、雨の帯と空気の流れが南北に動き、バンコクとバリ島の雨季・乾季が変わる）
//             立体の地形（terrain3d.js。ステップでなめらかに形が変わり、指で向きを変えられる）：
//               fjord＝フィヨルド／rift＝アイスランド（プレートが離れる）／butte＝モニュメント・バレー／karst＝ハロン湾
//               pinnacle＝ピナクルズ／cappa＝カッパドキア／iguazu＝イグアスの滝／canyon＝グランド・キャニオン
//               uluru＝ウルル／flat＝オーストラリアの平らさ／patagonia＝アンデスを越える西風／uyuni＝ウユニ塩湖（月のスライダー）
//             aurora＝オーロラが光るまで（粒が流れるモデル。aurora.js）
//             himalaya＝ヒマラヤができるまで（立体の地図。hima3d.js。指で向きを変えられる）
//             europe＝ヨーロッパの冬が暖かい理由（風が流れる地図。eurowind.js）
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
  const sun = s > 8 ? "太陽は北半球の真上。雨の帯も北へ寄っている。" : s < -8 ? "太陽は南半球の真上。雨の帯も南へ寄っている。" : "太陽はほぼ赤道の真上。雨の帯も赤道のあたり。";
  return `<span>${MONTHS[m - 1]}：${sun}</span><b>アタカマ（${fmtLat(PLACE.lat)}）は、乾きやすい帯の${dist <= 10 ? "中" : "ふち"}で、雨はほとんど降らない。</b>`;
}

// 記事の中に出す（b = { t: "model", k: "hadley", m: 最初の月, cap: 説明 }）
export function modelHtml(b) {
  if (hasTerrain(b.k)) return terrainHtml(b);   // 立体の地形モデル（terrain3d.js）
  if (b.k === "circ") return circHtml(b);
  if (b.k === "himalaya") return himaHtml(b);   // ヒマラヤは立体の地図（hima3d.js）
  if (b.k === "aurora") return auroraHtml(b);   // オーロラは、粒が流れるモデル（aurora.js）
  if (b.k === "europe") return euHtml(b);       // ヨーロッパの冬は、風が流れる地図（eurowind.js）
  if (b.k !== "hadley") return "";
  const m = Math.min(12, Math.max(1, +b.m || 1));
  return `<figure class="bfig"><div class="mdl" data-mdl="hadley" data-m="${m}" data-lon="-68">
    <p class="mdl-h">手で動かしてみよう</p>
    <canvas class="mdl-cv" width="${SIZE}" height="${SIZE}" aria-label="大気大循環の地球儀"></canvas>
    <p class="mdl-hint">月を動かすと、太陽といっしょに帯も南北へ。地球儀は指で回せる。</p>
    <div class="mdl-res">${result(m)}</div>
    <label class="mdl-sl"><span>月</span><input type="range" class="mdl-m" min="1" max="12" step="1" value="${m}" aria-label="月"><b>${MONTHS[m - 1]}</b></label>
    <p class="mdl-lg"><i class="g"></i>雨の帯（雲ができやすい）　<i class="o"></i>乾きやすい帯（空気が下りてくる）</p>
  </div>${b.cap ? `<figcaption>${String(b.cap).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</figcaption>` : ""}</figure>`;
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
    // 空気のつぶが、輪にそって回りつづける（雨の帯で上がり、上空を流れ、乾く帯で下りて、地表をもどる）
    const dots = [0, 1, 2, 3, 4, 5].map((k) => `<circle r="3.4" fill="#1b2330"><animateMotion dur="9s" begin="${-k * 1.5}s" repeatCount="indefinite" path="${p}"/></circle>`).join("");
    return `<path d="${p}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="round" opacity=".45"/>${dots}`
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
  const tip = !bkk && !bali ? "どちらも乾季。" : bkk && !bali ? "行くならバリ島がちょうどいい時期。" : !bkk && bali ? "行くならタイがちょうどいい時期。" : "どちらも雨の多い時期。";
  return `<span>${MONTHS[m - 1]}：雨の帯は${where}。</span><b>バンコクは${bkk ? "雨季" : "乾季"}、バリ島は${bali ? "雨季" : "乾季"}。${tip}</b><span>サハラ砂漠とオーストラリアの砂漠は、どの月も「乾く」帯の中。</span>`;
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

// 画面に出てきたモデルを、動くようにする（画面全体で、1回だけつなぐ）
let wired = false;
function init(root) {
  if (root.dataset.mdl === "t3d") return initTerrain(root);
  if (root.dataset.mdl === "circ") return initCirc(root);
  if (root.dataset.mdl === "hima3d") return initHima(root);
  if (root.dataset.mdl === "euwind") return initEu(root);
  if (root.dataset.mdl === "aurora2") return initAurora(root);
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
