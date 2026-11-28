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


// 共通：角のない「ふくらみ」（d＝中心からの距離÷半径。pが大きいほど、頭が平らで、ふちが切り立つ）
const bump = (d, p) => (d >= 1 ? 0 : Math.pow(1 - Math.pow(d, p), 1 / p * 1.4));
const stripe = (v, n) => 0.5 + 0.5 * Math.sin(v * n * Math.PI * 2);

// ---------------- アイスランド：プレートが離れて、新しい大地ができる ----------------
const RIFT = (() => {
  const MOSS = hex("#9aa884"), ROCKC = hex("#8c8377"), BASALT = hex("#4f5257"), LAVA = hex("#f0703a"), CRUST = hex("#cdbf9e"), MANTLE = hex("#f0c7a2");
  const gap = (t) => 0.13 * ss(0.1, 1, t) + 0.09 * ss(2.1, 3, t);          // 谷の幅の半分
  const mid = (y) => 0.5 + 0.025 * Math.sin(y * 7);                           // 割れ目の線（少し曲がる）
  const TOP = 0.3;
  const floor = (t) => TOP - 0.2 * ss(0.2, 1, t) + 0.13 * ss(2.2, 3, t);
  return {
    key: "rift", aria: "プレートが離れて新しい大地ができるまでの立体のモデル",
    steps: [
      ["①2つのプレートが、左右に引っぱられる", "西の北アメリカプレートと東のユーラシアプレートが、年に約2cmずつ離れていく。"],
      ["②地面が割れて、谷ができる", "引っぱられた地面に割れ目ができ、まん中が落ちこんで谷になる。シンクヴェトリルで歩けるのが、この谷。"],
      ["③下から、マグマが上がってくる", "すき間ができると、地下のマントルからマグマが上がってきて、割れ目から噴き出す。"],
      ["④固まって、新しい大地になる", "マグマは冷えて固まり、新しい大地に。これを何百万年もくり返して、島ができた。"],
    ],
    size: [2.4, 2.2, 1.3], base: -0.75, view: { yaw: -0.28, pitch: 0.62 }, scale: 4.3, center: [0.5, 0.5, -0.1],
    z: (x, y, t) => {
      const g = gap(t), d = Math.abs(x - mid(y));
      if (g < 0.004) return TOP + 0.012 * Math.sin(x * 23 + y * 9);
      const wall = ss(g, g + 0.035, d), fl = floor(t) + 0.018 * Math.sin(x * 40 + y * 13) * (1 - wall);
      const cone = 0.09 * ss(1.4, 2.1, t) * Math.exp(-((d / 0.035) ** 2)) * (0.6 + 0.4 * Math.sin(y * 19));   // 割れ目にそって盛り上がる溶岩
      return lerp(fl, TOP + 0.012 * Math.sin(x * 23 + y * 9), wall) + cone;
    },
    color: (x, y, z, t) => {
      const g = gap(t), d = Math.abs(x - mid(y)), inside = 1 - ss(g, g + 0.035, d);
      let c = mix(MOSS, ROCKC, 0.25 + 0.25 * Math.sin(x * 31 + y * 17));
      c = mix(c, ROCKC, inside * 0.8);
      c = mix(c, BASALT, inside * ss(2, 2.8, t));
      const hot = ss(1.3, 1.9, t) * (1 - ss(2.3, 3, t));
      c = mix(c, LAVA, hot * Math.exp(-((d / 0.03) ** 2)));
      return c;
    },
    cutAt: (x, y, zz, t) => {
      const d = Math.abs(x - mid(y)), g = gap(t);
      if (zz < -0.3 + 0.03 * Math.sin(x * 9)) return MANTLE;
      const w = 0.02 + 0.5 * g * ss(2.1, 3, t) + 0.02 * ss(-0.3, 0.3, -zz) ;
      if (t > 1.3 && d < w) return mix(LAVA, BASALT, ss(2.2, 3, t) * ss(-0.25, 0.1, zz));
      return CRUST;
    },
    lines: (t) => [
      { pts: [[0.3, 0.5, 0.5], [0.1, 0.5, 0.5]], c: INK, w: 2.6, arrow: true },
      { pts: [[0.7, 0.5, 0.5], [0.9, 0.5, 0.5]], c: INK, w: 2.6, arrow: true },
    ],
    labels: (t) => [
      { s: "北アメリカプレート", p: [0.21, 0.13, 0.34] }, { s: "ユーラシアプレート", p: [0.79, 0.87, 0.34] },
      { s: "西へ", p: [0.2, 0.5, 0.62] }, { s: "東へ", p: [0.8, 0.5, 0.62] },
      { s: "マントル（地下の熱い岩）", p: [0.5, 0, -0.55], c: "#9a4a22" },
      t > 0.5 && t < 1.5 && { s: "谷（ギャオ）", p: [0.5, 0.45, 0.2] },
      t >= 1.5 && t < 2.5 && { s: "マグマ", p: [0.5, 0, -0.2], c: "#fff", halo: "#c2552f", size: 12 },
      t >= 2.5 && { s: "新しい大地", p: [0.5, 0.45, 0.32], c: "#fff", halo: "#3b3f45", size: 12 },
    ],
  };
})();

// ---------------- モニュメント・バレー：台地→メサ→ビュート→細い塔 ----------------
const BUTTE = (() => {
  const SHALE = hex("#c9937a"), SAND = hex("#c65f38"), CAP = hex("#7a6a5c"), PLAIN = hex("#dba377"), UNDER = hex("#e2c9a4");
  const R = (t) => (t < 1 ? lerp(1.4, 0.3, ss(0, 1, t)) : t < 2 ? lerp(0.3, 0.15, ss(1, 2, t)) : lerp(0.15, 0.055, ss(2, 3, t)));
  const dist = (x, y) => {   // 中心からの距離（角の丸い四角に近い形。ふちは少しでこぼこ）
    const dx = (x - 0.5) * 1.0, dy = (y - 0.52) * 1.25, a = Math.atan2(dy, dx);
    return Math.pow(Math.pow(Math.abs(dx), 3) + Math.pow(Math.abs(dy), 3), 1 / 3) * (1 + 0.07 * Math.sin(a * 5 + 1) + 0.04 * Math.sin(a * 11));
  };
  const strata = (zz) => (zz > 0.86 ? CAP : zz > 0.36 ? mix(SAND, hex("#b5522f"), stripe(zz, 9) * 0.35) : zz > 0.05 ? mix(SHALE, hex("#b98168"), stripe(zz, 14) * 0.3) : UNDER);
  return {
    key: "butte", aria: "メサやビュートができるまでの立体のモデル",
    steps: [
      ["①地層が積み重なった、平らな台地", "下はやわらかい頁岩、その上にかたい砂岩、いちばん上にさらにかたい岩。"],
      ["②雨と川が、割れ目を削る", "雨や川が少しずつ台地を削り、テーブルのような形の「メサ」が残る。"],
      ["③やわらかい層から先に削れる", "下のやわらかい層が削れると、上の砂岩が崩れて崖になる。かたい岩が帽子のように守る部分だけが、塔の形の「ビュート」として残る。"],
      ["④最後は、細い塔になる", "さらに削れると、細い塔（スパイア）に。帽子の岩がなくなれば、やがて崩れて消えていく。"],
    ],
    size: [2.4, 2.2, 1.35], base: -0.25, view: { yaw: -0.3, pitch: 0.5 }, scale: 4.3, center: [0.5, 0.5, 0.3],
    z: (x, y, t) => {
      const r = R(t), d = dist(x, y);
      if (d < r) return 0.95;
      const cliff = 1 - ss(r, r + 0.012, d), talus = 1 - ss(r + 0.01, r + 0.01 + 0.13, d);
      return Math.max(0.05 + 0.31 * talus * talus + 0.006 * Math.sin(x * 37 + y * 23), cliff > 0 ? 0.36 + 0.59 * cliff : 0);
    },
    color: (x, y, z) => (z <= 0.075 ? mix(PLAIN, hex("#cf9468"), 0.5 + 0.5 * Math.sin(x * 19 + y * 29)) : z > 0.94 ? CAP : strata(z)),
    cutAt: (x, y, zz) => strata(zz),
    labels: (t) => [
      t < 0.5 && { s: "かたい岩（帽子の岩）", p: [0.5, 0, 0.9], c: "#fff", halo: "#5b4e43" },
      t < 0.5 && { s: "砂岩（かたい）", p: [0.5, 0, 0.6], c: "#fff", halo: "#9a4526" },
      t < 0.5 && { s: "頁岩（やわらかい）", p: [0.5, 0, 0.2] },
      t >= 0.5 && t < 1.5 && { s: "メサ", p: [0.5, 0.52, 1.08], size: 13 },
      t >= 1.5 && t < 2.5 && { s: "ビュート", p: [0.5, 0.52, 1.08], size: 13 },
      t >= 2.5 && { s: "スパイア（細い塔）", p: [0.5, 0.52, 1.08], size: 12 },
      t >= 0.5 && { s: "削られて平原に", p: [0.2, 0.12, 0.12] },
    ],
  };
})();

// ---------------- ハロン湾：海の底→陸→とがった岩山→海に沈んで島に ----------------
const KARST = (() => {
  const LIME = hex("#d6d0c2"), LIME2 = hex("#c3bcab"), GREEN = hex("#7fa06a"), SEA = [70, 140, 170];
  const TW = [[0.2, 0.25, 0.1, 0.5], [0.42, 0.18, 0.085, 0.42], [0.68, 0.24, 0.11, 0.5], [0.84, 0.43, 0.09, 0.44], [0.3, 0.52, 0.11, 0.48], [0.55, 0.47, 0.09, 0.5], [0.76, 0.66, 0.11, 0.5], [0.15, 0.76, 0.1, 0.46], [0.45, 0.78, 0.1, 0.5], [0.62, 0.9, 0.08, 0.4], [0.85, 0.86, 0.09, 0.45], [0.11, 0.5, 0.07, 0.38]];
  const towers = (x, y) => { let h = 0; for (const [cx, cy, r, hh] of TW) { const d = Math.hypot(x - cx, (y - cy) * 1.05) / r; if (d < 1) h = Math.max(h, hh * bump(d, 2.6)); } return h; };
  const topZ = (t) => lerp(-0.45, 0.5, ss(0, 1, t));
  const sea = (t) => lerp(0, 0.17, ss(2, 3, t));
  return {
    key: "karst", aria: "ハロン湾の岩山ができるまでの立体のモデル",
    steps: [
      ["①海の底で、石灰岩ができる", "大昔の海の底に貝殻などが積もって、厚い石灰岩の層ができた。"],
      ["②持ち上がって、陸になる", "大地の動きで石灰岩が持ち上がり、陸に。表面には、たくさんの割れ目。"],
      ["③雨が割れ目を溶かす", "雨水は少しだけ酸性で、石灰岩を溶かしていく。割れ目が広がって谷になり、とがった岩山が並ぶ地形に。"],
      ["④海面が上がり、岩山が島になる", "海面が上がって谷に海が入り、岩山の頭だけが島として残った。足元には、波がえぐったくびれも。"],
    ],
    size: [2.4, 2.3, 1.3], base: -0.85, view: { yaw: -0.3, pitch: 0.6 }, scale: 4.4, center: [0.5, 0.5, -0.1],
    z: (x, y, t) => {
      const e = ss(1, 2, t);
      if (e <= 0) return topZ(t);
      return lerp(0.5, 0.03 + Math.min(0.5, towers(x, y) + 0.015 * Math.sin(x * 30 + y * 22)), e);
    },
    color: (x, y, z, t) => {
      const e = ss(1.2, 2, t);
      let c = mix(LIME, LIME2, 0.5 + 0.5 * Math.sin(x * 40) * Math.sin(y * 34));
      if (t > 0.5 && t < 1.6) { const cr = Math.min(Math.abs(Math.sin(x * 13 + y * 3)), Math.abs(Math.sin(y * 11 - x * 4))); c = mix(c, hex("#6f6a5f"), (1 - ss(0, 0.07, cr)) * ss(0.6, 1, t) * (1 - e)); }   // 割れ目
      c = mix(c, GREEN, e * Math.max(ss(0.3, 0.46, z) * 0.85, (1 - ss(0.04, 0.12, z)) * 0.7));   // 岩山の頭と、谷の底は緑
      return c;
    },
    cutAt: (x, y, zz, t) => { const v = zz - topZ(Math.min(t, 1)); return mix(LIME, LIME2, stripe(v, 5) > 0.5 ? 0.9 : 0.1); },
    layers: [{ top: (x, y, t) => sea(t), color: () => SEA, alpha: () => 1 }],
    labels: (t) => [
      t < 0.5 && { s: "海", p: [0.5, 0.5, 0.04], c: "#fff", halo: "#2f6f9a", size: 13 },
      t < 0.5 && { s: "石灰岩の層", p: [0.5, 0, -0.62] },
      t >= 0.5 && t < 1.5 && { s: "持ち上がった石灰岩（割れ目だらけ）", p: [0.5, 0.5, 0.6] },
      t >= 1.5 && t < 2.5 && { s: "雨に溶け残った岩山", p: [0.5, 0.47, 0.66] },
      t >= 2.5 && { s: "島になった岩山", p: [0.55, 0.47, 0.66] },
      t >= 2.5 && { s: "海に沈んだ谷", p: [0.43, 0.33, 0.2], c: "#fff", halo: "#2f6f9a" },
    ],
  };
})();

// ---------------- ピナクルズ：砂丘→石灰岩→雨で溶ける→柱が現れる ----------------
const PINN = (() => {
  const SANDC = hex("#ecd699"), LIMEC = hex("#dcc78c"), HARD = hex("#b89a5e"), LOOSE = hex("#f3e6bd"), GREEN = hex("#9fb07a");
  const PL = [[0.12, 0, 0.03, 0.42], [0.33, 0, 0.035, 0.5], [0.56, 0, 0.03, 0.46], [0.8, 0, 0.035, 0.52], [0.22, 0.2, 0.03, 0.4], [0.47, 0.24, 0.035, 0.5], [0.7, 0.2, 0.028, 0.38], [0.9, 0.3, 0.03, 0.44], [0.1, 0.42, 0.032, 0.48], [0.35, 0.46, 0.03, 0.42], [0.6, 0.45, 0.036, 0.52], [0.82, 0.55, 0.03, 0.4], [0.2, 0.66, 0.034, 0.5], [0.45, 0.7, 0.03, 0.44], [0.7, 0.72, 0.034, 0.5], [0.9, 0.8, 0.028, 0.4], [0.3, 0.88, 0.03, 0.46], [0.58, 0.9, 0.032, 0.42]];
  const pillars = (x, y) => { let h = 0; for (const [cx, cy, r, hh] of PL) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) h = Math.max(h, hh * bump(d, 3)); } return h; };
  const inPillar = (x, y) => { for (const [cx, cy, r] of PL) if (Math.hypot(x - cx, y - cy) < r * 0.8) return true; return false; };
  const dune = (x, y) => 0.3 + 0.3 * Math.exp(-(((x - 0.5) / 0.45) ** 2)) * (0.7 + 0.3 * Math.sin(y * 3 + 1)) + 0.04 * Math.sin(x * 14 + y * 6);
  const TOP = 0.56, FLOOR = 0.1;
  return {
    key: "pinnacle", aria: "ピナクルズの柱ができるまでの立体のモデル",
    steps: [
      ["①貝殻の砂が、風で砂丘になる", "海の貝殻が砕けてできた砂が、風で内陸へ運ばれて大きな砂丘に。"],
      ["②砂丘が固まって、石灰岩になる", "砂丘は長い時間をかけて固まり、石灰岩に。表面にはかたい層ができ、植物の根も入りこんだ。"],
      ["③雨水がしみこんで、溶かす", "しみこんだ雨水が、溶けやすいところから穴を広げていく。溶け残った部分は柱の形に。"],
      ["④砂が飛ばされて、柱が現れる", "まわりのくずれた砂が風で飛ばされ、溶け残った柱が地上に顔を出した。これがピナクルズ。"],
    ],
    size: [2.4, 2.2, 1.5], base: -0.3, view: { yaw: -0.28, pitch: 0.55 }, scale: 4.3, center: [0.5, 0.5, 0.15],
    z: (x, y, t) => {
      const a = ss(0.1, 1, t), e = ss(2.1, 3, t);
      const top = lerp(dune(x, y), TOP + 0.01 * Math.sin(x * 20 + y * 15), a);
      return e <= 0 ? top : lerp(top, FLOOR + 0.02 * Math.sin(x * 9 + y * 7) + Math.max(0, pillars(x, y) - 0.0), e);
    },
    color: (x, y, z, t) => {
      const a = ss(0.2, 1, t), e = ss(2.1, 3, t);
      let c = mix(SANDC, hex("#e3ca85"), 0.5 + 0.5 * Math.sin(x * 26 + y * 9));
      c = mix(c, mix(HARD, GREEN, 0.45 + 0.3 * Math.sin(x * 33) * Math.sin(y * 29)), a * (1 - e));
      if (e > 0) c = mix(c, z > FLOOR + 0.06 ? LIMEC : SANDC, e);
      return c;
    },
    cutAt: (x, y, zz, t) => {
      const a = ss(0.2, 1, t), d = ss(1.2, 2, t);
      if (zz < 0) return hex("#e6d4a6");
      let c = mix(SANDC, LIMEC, a);
      if (zz > TOP - 0.05 && t < 2.4) c = mix(c, HARD, a);                // 表面のかたい層
      else if (!inPillar(x, y)) c = mix(c, LOOSE, d);                      // 雨で溶けて、くずれた砂になったところ
      return c;
    },
    lines: (t) => [
      (t < 0.5 || t > 2.5) && { pts: [[0.15, 0.6, 1.0], [0.5, 0.6, 1.0]], c: INK, w: 2.6, arrow: true },
      ...(t > 1.5 && t < 2.5 ? [0.22, 0.45, 0.68, 0.9].map((x) => ({ pts: [[x, 0, 0.5], [x, 0, 0.2]], c: "#2f6f9a", w: 2.2, arrow: true, dash: [4, 4] })) : []),
    ],
    labels: (t) => [
      t < 0.5 && { s: "風", p: [0.33, 0.6, 1.12] }, t < 0.5 && { s: "砂丘", p: [0.5, 0.45, 0.75], size: 13 },
      t >= 0.5 && t < 1.5 && { s: "かたい層と、植物の根", p: [0.5, 0.5, 0.68] }, t >= 0.5 && t < 2.5 && { s: "石灰岩", p: [0.12, 0, 0.1] },
      t >= 1.5 && t < 2.5 && { s: "雨水がしみこむ", p: [0.5, 0.5, 0.68], c: "#2f6f9a" }, t >= 1.5 && t < 2.5 && { s: "溶け残った柱", p: [0.56, 0, 0.3] },
      t >= 2.5 && { s: "砂が飛ばされる", p: [0.33, 0.6, 1.12] }, t >= 2.5 && { s: "溶け残った柱（高さは最大5mほど）", p: [0.5, 0, -0.14] },
    ],
  };
})();

// ---------------- カッパドキア：火山灰→凝灰岩とかたい岩→削られて妖精の煙突 ----------------
const CAPPA = (() => {
  const ASH = hex("#efe4cf"), TUFF = hex("#ead9bd"), CAPC = hex("#6f665d"), VOLC = hex("#8a7f74"), FLOORC = hex("#e3d0ac");
  const CH = [[0.16, 0.14, 0.07, 0.46], [0.38, 0.1, 0.06, 0.4], [0.6, 0.16, 0.075, 0.5], [0.28, 0.34, 0.07, 0.48], [0.5, 0.36, 0.06, 0.42], [0.74, 0.36, 0.07, 0.46], [0.14, 0.52, 0.06, 0.4], [0.4, 0.58, 0.07, 0.48], [0.62, 0.58, 0.06, 0.42], [0.86, 0.14, 0.055, 0.38]];
  const chim = (x, y) => { let h = 0; for (const [cx, cy, r, hh] of CH) { const d = Math.hypot(x - cx, y - cy) / r; if (d < 1) h = Math.max(h, hh * Math.pow(1 - d, 0.55) * (d < 0.3 ? 1 : 1)); } return h; };
  const capAt = (x, y) => { for (const [cx, cy, r] of CH) if (Math.hypot(x - cx, y - cy) < r * 0.3) return true; return false; };
  const volcano = (x, y) => { const d = Math.hypot(x - 0.78, (y - 0.86) * 1.1) / 0.3; return d < 1 ? 1.0 * Math.pow(1 - d, 1.3) - 0.12 * Math.exp(-((d / 0.12) ** 2)) : 0; };
  const PLAT = 0.5;
  return {
    key: "cappa", aria: "カッパドキアの妖精の煙突ができるまでの立体のモデル",
    steps: [
      ["①火山が噴火して、灰が積もる", "近くの火山が何度も噴火して、厚い火山灰が大地をおおった。"],
      ["②灰が固まり、上にかたい岩がのる", "積もった灰は固まって、やわらかい凝灰岩に。その上を、溶岩が固まったかたい岩がおおった。"],
      ["③雨や風が、割れ目から削る", "雨や雪どけの水、風が、割れ目からやわらかい凝灰岩を少しずつ削っていく。"],
      ["④かたい岩が帽子になって残る", "かたい岩がのった部分だけが、帽子をかぶった柱として残った。これが「妖精の煙突」。やわらかい岩は掘りやすく、人は中に家や教会をつくった。"],
    ],
    size: [2.4, 2.3, 1.4], base: -0.25, view: { yaw: -0.3, pitch: 0.55 }, scale: 4.4, center: [0.5, 0.5, 0.25],
    z: (x, y, t) => {
      const fill = lerp(0.14, PLAT, ss(0, 1, t)), e = ss(1.1, 3, t);
      const ground = e <= 0 ? fill : lerp(PLAT, 0.08 + Math.min(PLAT - 0.08, chim(x, y) * 1.0) + 0.012 * Math.sin(x * 25 + y * 19), e);
      return Math.max(ground + 0.01 * Math.sin(x * 17 + y * 11) * (1 - ss(0.5, 1, t)), volcano(x, y) + 0.1);
    },
    color: (x, y, z, t) => {
      if (volcano(x, y) + 0.1 > z - 0.002 && volcano(x, y) > 0.05) return mix(VOLC, hex("#5e554d"), ss(0.7, 1.0, z));
      const a = ss(0.5, 1, t), e = ss(1.1, 3, t);
      let c = mix(ASH, hex("#e3d8c2"), 0.5 + 0.5 * Math.sin(x * 21 + y * 13));
      c = mix(c, CAPC, a * (e <= 0 ? 1 : capAt(x, y) && z > 0.3 ? 1 : 1 - ss(0, 0.35, e)));   // 上をおおう、かたい岩
      if (e > 0.3 && !(capAt(x, y) && z > 0.3)) c = mix(c, z < 0.14 ? FLOORC : mix(TUFF, hex("#dcc7a4"), stripe(z, 9) * 0.5), ss(0.3, 0.6, e));
      return c;
    },
    cutAt: (x, y, zz, t) => (zz < 0.08 ? hex("#d9c8a8") : zz > PLAT - 0.05 && t > 0.5 ? mix(ASH, CAPC, ss(0.5, 1, t)) : mix(ASH, TUFF, ss(0.3, 1, t))),
    labels: (t) => [
      { s: "火山", p: [0.78, 0.86, 1.22] },
      t < 0.5 && { s: "火山灰が積もる", p: [0.35, 0.35, 0.3] },
      t >= 0.5 && t < 1.5 && { s: "かたい岩（溶岩が固まったもの）", p: [0.42, 0.3, 0.62], c: "#fff", halo: "#4d463f" },
      t >= 0.5 && t < 1.5 && { s: "やわらかい凝灰岩", p: [0.5, 0, 0.25] },
      t >= 1.5 && t < 2.5 && { s: "割れ目から削られる", p: [0.4, 0.3, 0.72] },
      t >= 2.5 && { s: "妖精の煙突", p: [0.4, 0.34, 0.74], size: 13 },
      t >= 2.5 && { s: "帽子（かたい岩）", p: [0.2, 0.06, 0.66], c: "#fff", halo: "#4d463f", size: 10 },
    ],
  };
})();

// ---------------- イグアスの滝：溶岩の段→滝→足元をえぐる→上流へ下がって峡谷 ----------------
const IGU = (() => {
  const BAS = hex("#6b6862"), BAS2 = hex("#55534e"), JUNGLE = hex("#6f9a5c"), WATER = hex("#4a93b5"), FOAM = hex("#f2f7f9"), POOL = hex("#3b7c9c");
  const H2 = 0.75, H1 = 0.42, H0 = 0.1;
  const chan = (x) => 1 - ss(0.2, 0.26, Math.abs(x - 0.5));            // 川の流れているところ
  const edge = (x, t, k) => {                                              // 段のふち（y）。kは上の段=1、下の段=0。滝は上流（奥）へ下がる
    const back = 0.3 * ss(2, 3, t) * Math.pow(Math.max(0, 1 - ((x - 0.5) / 0.24) ** 2), 0.5);
    return (k ? 0.42 : 0.26) + back + 0.012 * Math.sin(x * 33 + k * 2);
  };
  const ground = (x, y, t) => {
    const e1 = edge(x, t, 1), e0 = edge(x, t, 0);
    return H0 + (H1 - H0) * ss(e0 - 0.008, e0 + 0.008, y) + (H2 - H1) * ss(e1 - 0.008, e1 + 0.008, y);
  };
  const wet = (t) => ss(0.3, 1, t);
  return {
    key: "iguazu", aria: "イグアスの滝ができるまでの立体のモデル",
    steps: [
      ["①溶岩が何度も流れ、段ができる", "大昔、大量の溶岩が何度も流れ出て、玄武岩が階段のように重なった。"],
      ["②川が段差から落ちて、滝になる", "川が玄武岩の段差にさしかかり、2段の滝になって流れ落ちる。"],
      ["③落ちた水が、足元をえぐる", "落ちる水が、崖の下や岩と岩のさかいめを削っていく。支えを失った上の岩は、やがて崩れ落ちる。"],
      ["④滝は上流へ下がり、峡谷ができる", "崩れるたびに滝は少しずつ上流へ下がり、そのあとに峡谷が残った。いちばん奥が「悪魔の喉笛」。"],
    ],
    size: [2.4, 2.4, 1.3], base: -0.3, view: { yaw: -0.3, pitch: 0.62 }, scale: 4.5, center: [0.5, 0.5, 0.15],
    z: (x, y, t) => {
      const g = ground(x, y, t), e0 = edge(x, t, 0), e1 = edge(x, t, 1);
      const pool = 0.07 * ss(1.2, 2, t) * chan(x) * (Math.exp(-(((y - e0 + 0.04) / 0.035) ** 2)) + Math.exp(-(((y - e1 + 0.04) / 0.03) ** 2)) * 0.6);   // 滝つぼ
      return g - pool + 0.006 * Math.sin(x * 40 + y * 31);
    },
    color: (x, y, z, t) => {
      const w = wet(t) * chan(x), e0 = edge(x, t, 0), e1 = edge(x, t, 1);
      let c = mix(mix(BAS, BAS2, stripe(z, 6) * 0.6), JUNGLE, (1 - chan(x)) * (0.75 - 0.25 * ss(H1 - 0.02, H1 + 0.3, z) + 0.2 * Math.sin(x * 37 + y * 23)) * (Math.abs(z - H2) < 0.02 || Math.abs(z - H1) < 0.02 || z < H0 + 0.03 ? 1 : 0.15));
      if (w > 0) {
        const fall = Math.max(Math.exp(-(((y - e0) / 0.02) ** 2)), Math.exp(-(((y - e1) / 0.02) ** 2)));
        c = mix(c, mix(y < e0 - 0.03 ? POOL : WATER, FOAM, Math.min(1, fall + 0.5 * Math.exp(-(((y - e0 + 0.04) / 0.03) ** 2)) + 0.5 * Math.exp(-(((y - e1 + 0.035) / 0.025) ** 2)))), w);
      }
      return c;
    },
    cutAt: (x, y, zz) => (zz < -0.1 ? hex("#8a6a4a") : mix(BAS, BAS2, zz < H0 ? 0.9 : zz < H1 ? 0.5 : 0.1)),
    lines: (t) => [t > 2.5 && { pts: [[0.5, 0.36, 0.95], [0.5, 0.6, 0.95]], c: INK, w: 2.4, arrow: true }],
    labels: (t) => [
      t < 0.5 && { s: "玄武岩（溶岩が固まった岩）の段", p: [0.5, 0.6, 0.86] },
      t >= 0.5 && t < 2.5 && { s: "川", p: [0.5, 0.8, 0.82], c: "#fff", halo: "#2f6f9a", size: 13 },
      t >= 0.5 && t < 1.5 && { s: "2段の滝", p: [0.5, 0.34, 0.72] },
      t >= 1.5 && t < 2.5 && { s: "滝つぼが、足元をえぐる", p: [0.5, 0.12, 0.3] },
      t >= 2.5 && { s: "滝が上流へ下がる", p: [0.5, 0.48, 1.08] },
      t >= 2.5 && { s: "あとに残った峡谷", p: [0.5, 0.3, 0.3], c: "#fff", halo: "#2f6f9a" },
      t >= 2.5 && { s: "悪魔の喉笛", p: [0.5, 0.92, 0.9] },
    ],
  };
})();

// ---------------- グランド・キャニオン：地層→持ち上がる→川が削る→深く広い谷 ----------------
const CANYON = (() => {
  const LAY = ["#4a4650", "#8d8a86", "#b5553a", "#d8a468", "#c9794f", "#e6cf9c"].map(hex);   // 下から上へ
  const up = (t) => 0.5 * ss(0, 1, t);                                   // 持ち上がった高さ
  const TOP0 = 0.4;
  const layer = (zz, t) => { const v = (zz - up(t) + 0.2) / (TOP0 + 0.2); return v <= 0 ? LAY[0] : LAY[Math.min(5, Math.floor(clamp(v, 0, 0.999) * 6))]; };
  const river = (y) => 0.5 + 0.11 * Math.sin(y * 5.2 + 0.6) + 0.04 * Math.sin(y * 11);
  const cut = (x, y, t) => {
    const d = Math.abs(x - river(y)), dep = 0.16 * ss(1.1, 2, t) + 0.62 * ss(2, 3, t), wid = 0.04 + 0.34 * ss(2, 3, t);
    if (dep <= 0) return 0;
    const u = clamp(d / wid), prof = 1 - Math.pow(u, 0.8);              // 中心ほど深い
    const stepd = Math.round(prof * 5) / 5;                               // かたい層は崖、やわらかい層は斜面（階段のような谷の壁）
    return dep * lerp(prof, stepd, 0.55 * ss(2, 3, t)) * (1 + 0.1 * Math.sin(y * 23 + x * 9));
  };
  return {
    key: "canyon", aria: "グランド・キャニオンができるまでの立体のモデル",
    steps: [
      ["①地層が積み重なる", "海や砂漠、川の時代をくり返しながら、何億年もかけて地層が積み重なった。いちばん下の岩は約20億年前のもの。"],
      ["②大地が持ち上がる", "約7,000万〜3,000万年前、プレートの動きで、この一帯が平らなまま高く持ち上がった。これがコロラド高原。"],
      ["③コロラド川が削り始める", "約500〜600万年前、コロラド川が高原を下へ下へと削り始めた。"],
      ["④谷が深く、広くなる", "川が谷を深くし、流れこむ支流が谷を広げて、深さ約1.8kmの大峡谷に。いまも少しずつ削られ続けている。"],
    ],
    size: [2.4, 2.3, 1.35], base: -0.3, view: { yaw: -0.3, pitch: 0.6 }, scale: 4.4, center: [0.5, 0.5, 0.3],
    z: (x, y, t) => TOP0 + up(t) - cut(x, y, t),
    color: (x, y, z, t) => {
      const c = cut(x, y, t), d = Math.abs(x - river(y));
      if (t > 1.1 && d < 0.013) return hex("#4a93b5");
      return c < 0.012 ? mix(LAY[5], hex("#d9c08c"), 0.5 + 0.5 * Math.sin(x * 23 + y * 31)) : layer(z, t);
    },
    cutAt: (x, y, zz, t) => layer(zz, t),
    lines: (t) => [t > 0.4 && t < 1.5 && { pts: [[0.9, 0, 0.0], [0.9, 0, 0.45]], c: INK, w: 2.6, arrow: true }],
    labels: (t) => [
      t < 0.5 && { s: "積み重なった地層", p: [0.5, 0, 0.28], c: "#fff", halo: "#7a4a35" },
      { s: "いちばん下は約20億年前の岩", p: [0.5, 0, -0.2], c: "#fff", halo: "#3a3740", size: 10 },
      t >= 0.5 && t < 1.5 && { s: "コロラド高原", p: [0.5, 0.5, 1.0], size: 13 }, t >= 0.5 && t < 1.5 && { s: "持ち上がる", p: [0.78, 0, 0.25] },
      t >= 1.5 && t < 2.5 && { s: "コロラド川", p: [0.5, 0.5, 1.0], c: "#2f6f9a" },
      t >= 2.5 && { s: "深さ約1.8km", p: [0.5, 0.5, 1.04], size: 12 }, t >= 2.5 && { s: "コロラド川", p: [river(0.2), 0.2, 0.36], c: "#fff", halo: "#2f6f9a", size: 10 },
    ],
  };
})();

// ---------------- ウルル：砂や小石→海の底で岩に→地層が立ち上がる→ウルルだけが残る ----------------
const ULURU = (() => {
  const RED = hex("#c0562f"), RED2 = hex("#a8482a"), SANDC = hex("#d9a273"), MTN = hex("#8a8076"), SEA = [150, 188, 205], PLAIN = hex("#d6a071");
  const tilt = (t) => ss(1.15, 2, t) * 1.45;                               // 地層の傾き（ラジアン。最後はほぼ垂直）
  const beds = (x, zz, t) => { const a = tilt(t); return stripe(zz * Math.cos(a) + (x - 0.5) * Math.sin(a), 8); };
  const dome = (x, y) => { const d = Math.hypot((x - 0.52) / 0.3, (y - 0.5) / 0.2); return d < 1 ? 0.52 * bump(d, 3) : 0; };
  const mtn = (x, y) => 0.95 * Math.exp(-((x / 0.2) ** 2)) * (0.8 + 0.2 * Math.sin(y * 9));
  const fan = (x, y) => 0.12 + 0.3 * Math.exp(-(x / 0.55)) * (1 - 0.3 * Math.abs(y - 0.5));
  return {
    key: "uluru", aria: "ウルルができるまでの立体のモデル",
    steps: [
      ["①山から砂や小石が流れ出る", "約5億5,000万年前、西にあった高い山脈が削られ、砂や小石がふもとに扇のように積もった。"],
      ["②海に沈み、岩になる", "やがて海の底に沈み、上に積もったものの重みで押し固められて岩に。これがアルコースという砂岩。"],
      ["③地層が立ち上がる", "約4億〜3億年前、大地が横から押されて地層が折れ曲がった。ウルルの地層は、ほぼ垂直に。"],
      ["④まわりが削られ、ウルルだけが残る", "3億年ほどかけて、まわりのやわらかい岩が削られ、かたいウルルが平原に残った。赤いのは、岩にふくまれる鉄がさびた色。"],
    ],
    size: [2.5, 2.2, 1.3], base: -0.35, view: { yaw: -0.28, pitch: 0.58 }, scale: 4.5, center: [0.5, 0.5, 0.15],
    z: (x, y, t) => {
      const a = ss(0, 1, t), e = ss(2.1, 3, t);
      const z0 = Math.max(fan(x, y), mtn(x, y) + 0.1), flat = 0.4 + 0.008 * Math.sin(x * 21 + y * 17);
      const z2 = lerp(z0, flat, a);
      return e <= 0 ? z2 : lerp(flat, 0.08 + 0.008 * Math.sin(x * 21 + y * 17) + dome(x, y), e);
    },
    color: (x, y, z, t) => {
      const a = ss(0.2, 1, t), e = ss(2.1, 3, t);
      let c = mtn(x, y) + 0.1 > fan(x, y) && t < 0.6 ? MTN : mix(SANDC, hex("#cf9466"), 0.5 + 0.5 * Math.sin(x * 30 + y * 11));
      c = mix(c, mix(RED, RED2, beds(x, 0.4, t) * 0.5), a * ss(1.3, 1.9, t));       // 陸に出ると、赤い岩の地層が見える
      if (e > 0) c = mix(c, z > 0.12 ? mix(RED, RED2, beds(x, z, t) * 0.5) : mix(PLAIN, hex("#cc9364"), 0.5 + 0.5 * Math.sin(x * 23 + y * 37)), e);
      return c;
    },
    cutAt: (x, y, zz, t) => {
      const a = ss(0.3, 1, t), e = ss(2.1, 3, t);
      if (zz < -0.2) return hex("#c9b08c");
      let c = mix(SANDC, mix(RED, RED2, beds(x, zz, t) * 0.6), a);
      if (e > 0 && Math.abs(x - 0.52) > 0.3) c = mix(c, hex("#d8b48e"), e * 0.7);   // まわりは、やわらかい岩
      return c;
    },
    layers: [{ top: (x, y, t) => 0.62, color: () => SEA, alpha: (t) => ss(0.4, 1, t) * (1 - ss(1.2, 1.7, t)) }],
    lines: (t) => [
      t < 0.5 && { pts: [[0.2, 0.5, 0.75], [0.5, 0.5, 0.42]], c: INK, w: 2.4, arrow: true, dash: [5, 4] },
      t > 1.5 && t < 2.5 && { pts: [[0.02, 0, 0.72], [0.2, 0, 0.72]], c: INK, w: 2.6, arrow: true }, t > 1.5 && t < 2.5 && { pts: [[0.98, 0, 0.72], [0.8, 0, 0.72]], c: INK, w: 2.6, arrow: true },
    ],
    labels: (t) => [
      t < 0.5 && { s: "高い山脈", p: [0.06, 0.5, 1.2] }, t < 0.5 && { s: "砂や小石が流れ出る", p: [0.55, 0.5, 0.52] },
      t >= 0.5 && t < 1.5 && { s: "海", p: [0.5, 0.5, 0.66], c: "#fff", halo: "#2f6f9a", size: 13 }, t >= 0.5 && t < 1.5 && { s: "押し固められて岩に（アルコース）", p: [0.5, 0, 0.12], c: "#fff", halo: "#8a3d20", size: 10 },
      t >= 1.5 && t < 2.5 && { s: "横から押されて、地層が立つ", p: [0.5, 0.5, 0.95] },
      t >= 2.5 && { s: "ウルル（高さ348m）", p: [0.52, 0.5, 0.78], size: 13 }, t >= 2.5 && { s: "まわりは削られて平原に", p: [0.5, 0, -0.08] },
    ],
  };
})();

// ---------------- オーストラリアの平らさ：山ができる→境目から遠くなる→削られる→低く平らに ----------------
const FLAT = (() => {
  const ROCKC = hex("#a98a6c"), LOW = hex("#d2a878"), GREEN = hex("#a9b386"), SNOW = hex("#f4f6f7");
  // 高さは、最後のステップで同じ縮尺になるようにしている（1万m＝1.0。海面が0）
  const keep = (t) => 1 - ss(1, 3, t);                                    // 山がどれくらい残っているか
  const ridge = (x, y) => {
    const r = 0.55 * Math.exp(-(((x - 0.5 - 0.06 * Math.sin(y * 5)) / 0.2) ** 2)) + 0.28 * Math.exp(-(((x - 0.22) / 0.12) ** 2)) + 0.3 * Math.exp(-(((x - 0.8) / 0.13) ** 2));
    return 1.45 * r * (0.72 + 0.28 * Math.sin(y * 13 + x * 5) * Math.cos(y * 7 - x * 11));
  };
  const low = (x, y) => 0.033 + 0.012 * Math.sin(x * 9 + y * 7) * Math.cos(y * 5) + 0.19 * Math.exp(-(((x - 0.36) / 0.13) ** 2) - (((y - 0.3) / 0.2) ** 2));   // 低い平原と、コジオスコ山
  return {
    key: "flat", aria: "オーストラリアが平らになるまでの立体のモデル",
    steps: [
      ["①大陸がぶつかり、山ができる", "大昔、大陸どうしがぶつかって、高い山脈が押し上げられた。"],
      ["②プレートの境目から遠くなる", "オーストラリアはプレートの真ん中に。山を押し上げる力が届かず、新しい山がほとんどできなくなった。"],
      ["③何億年も削られ続ける", "雨や風、川が山を少しずつ削り、削られた砂や泥が低い土地を埋めていく。"],
      ["④低く、平らな大陸に", "平均の標高は約330m。いちばん高いコジオスコ山でも2,228mで、富士山より1,500mほど低い。"],
    ],
    size: [2.5, 2.2, 1.5], base: -0.22, view: { yaw: -0.28, pitch: 0.5 }, scale: 4.5, center: [0.5, 0.5, 0.2],
    z: (x, y, t) => lerp(low(x, y), 0.1 + ridge(x, y), keep(t)) + 0.004 * Math.sin(x * 31 + y * 27),
    color: (x, y, z) => { const c = mix(mix(LOW, GREEN, 0.4 + 0.3 * Math.sin(x * 17 + y * 23)), ROCKC, ss(0.12, 0.4, z)); return mix(c, SNOW, ss(0.62, 0.8, z)); },
    cutAt: (x, y, zz) => (zz < 0 ? hex("#c7a986") : hex("#b99873")),
    front: (t, line, tag) => {
      if (t > 2.5) {
        line([[0, 0], [1, 0]], INK, 1.2, [5, 4]); tag("海面", 0.985, -0.06, INK, 10, "right");
        line([[0.62, 0.033], [0.78, 0.378], [0.94, 0.033]], INK, 1.4, [4, 4]); tag("富士山 3,776m", 0.78, 0.46, INK, 10);
      }
    },
    lines: (t) => [
      t < 0.5 && { pts: [[0.02, 0.5, 0.9], [0.22, 0.5, 0.9]], c: INK, w: 2.6, arrow: true }, t < 0.5 && { pts: [[0.98, 0.5, 0.9], [0.78, 0.5, 0.9]], c: INK, w: 2.6, arrow: true },
    ],
    labels: (t) => [
      t < 0.5 && { s: "ぶつかる", p: [0.12, 0.5, 1.02] }, t < 0.5 && { s: "ぶつかる", p: [0.88, 0.5, 1.02] }, t < 1.5 && { s: "高い山脈", p: [0.5, 0.5, 1.02], size: 13 },
      t >= 0.5 && t < 1.5 && { s: "プレートの境目は、ずっと遠く", p: [0.5, 0, -0.1] },
      t >= 1.5 && t < 2.5 && { s: "雨や風、川に削られる", p: [0.5, 0.5, 1.02] },
      t >= 2.5 && { s: "コジオスコ山 2,228m", p: [0.36, 0.3, 0.32] }, t >= 2.5 && { s: "平均の標高 約330m", p: [0.75, 0.8, 0.1] }, t >= 2.5 && { s: "（高さは同じ縮尺）", p: [0.3, 0, -0.14], size: 10 },
    ],
  };
})();

const MODELS = { fjord: FJ, rift: RIFT, butte: BUTTE, karst: KARST, pinnacle: PINN, cappa: CAPPA, iguazu: IGU, canyon: CANYON, uluru: ULURU, flat: FLAT };
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
  return { t, nx, ny, row, z, L, fine };
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
    // 地面の中（cutAt があれば、地層などの色を場所ごとにぬる）
    if (M.cutAt) {
      const nz = S.fine ? 18 : 10, kn = S.fine ? 1 : 2;
      let zmax = M.base; for (let k = 0; k <= n; k++) zmax = Math.max(zmax, zAt(k));
      const dz = (zmax - M.base) / nz;
      for (let k = 0; k < n; k += kn) {
        const k1 = Math.min(n, k + kn), z0 = zAt(k), z1 = zAt(k1), u0 = k / n, u1 = k1 / n, um = (u0 + u1) / 2;
        for (let m = 0; m < nz; m++) {
          const za = M.base + m * dz, zb = za + dz;
          if (z0 <= za && z1 <= za) break;
          const [fx, fy] = pt(um);
          quad(P(...pt(u0), Math.min(za, z0)), P(...pt(u1), Math.min(za, z1)), P(...pt(u1), Math.min(zb, z1)), P(...pt(u0), Math.min(zb, z0)), rgb(M.cutAt(fx, fy, Math.min((za + zb) / 2, (z0 + z1) / 2), t)));
        }
      }
    } else {
      g.beginPath();
      for (let k = 0; k <= n; k++) { const p = P(...pt(k / n), zAt(k)); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
      let p = P(...pt(1), M.base); g.lineTo(p[0], p[1]); p = P(...pt(0), M.base); g.lineTo(p[0], p[1]); g.closePath();
      g.fillStyle = rgb(M.cut); g.fill();
    }
    // 層（氷・水）
    L.forEach(({ a: al, ly }, li) => {
      const lc = ly.color(0.5, 0, t).map((v) => v * 0.84);   // 切り口は少し暗く
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
    let p = P(...pt(1), M.base); g.lineTo(p[0], p[1]); p = P(...pt(0), M.base); g.lineTo(p[0], p[1]); g.closePath();
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
    if (!ln) continue;
    const q = ln.pts.map((v) => P(...v));
    g.beginPath(); q.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.setLineDash(ln.dash || []); g.strokeStyle = ln.c; g.lineWidth = ln.w; g.stroke(); g.setLineDash([]);
    if (ln.arrow) {
      const [x1, y1] = q[q.length - 1], [x0, y0] = q[q.length - 2], an = Math.atan2(y1 - y0, x1 - x0), h = 8;
      g.beginPath(); g.moveTo(x1 - h * Math.cos(an - 0.5), y1 - h * Math.sin(an - 0.5)); g.lineTo(x1, y1); g.lineTo(x1 - h * Math.cos(an + 0.5), y1 - h * Math.sin(an + 0.5)); g.stroke();
    }
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
