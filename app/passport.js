// Tabistock パスポート（マイページ）
// 自分の旅程記事から、記事1本＝見開き1つのパスポートを作る。
// 見開きの左：記事タイトル・旅の期間・トップの写真（最大3枚）／右：その旅のスタンプ
// 表紙をタップして開き、ページをめくって読む。スマホでは開いたら縮小して見開きを画面に収める。

const FONTS = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Shippori+Mincho:wght@600;800&family=Space+Mono:wght@400;700&display=swap";

const CSS = `
.ppw{display:flex;flex-direction:column;align-items:center;min-height:100%;padding-bottom:calc(30px + var(--sb))!important;overflow-x:hidden}
.pp-stage{flex:1;width:100%;display:grid;place-items:center;padding:34px 0 10px}
.pp{--W:min(320px,84vw);position:relative;width:var(--W);aspect-ratio:88/125;transition:transform .8s cubic-bezier(.3,.7,.2,1);perspective:1800px;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:pan-y;color:#1b2330}
.pp.shift{transform:scale(var(--pps,1)) translateX(50%)}
.pp .base{position:absolute;inset:0;border-radius:3px 10px 10px 3px;background:#17392f;box-shadow:1px 1px 0 #e9e2cf,2px 2px 0 #ddd4bf,3px 3px 0 #e9e2cf,4px 4px 0 #d6cdb7,5px 6px 0 #17392f,10px 18px 30px rgba(0,0,0,.28)}
.pp .base .face{inset:0 4px 0 0}
.pp .gut{position:absolute;top:0;bottom:0;left:-16px;width:32px;z-index:900;pointer-events:none;opacity:0;transition:opacity .4s;background:linear-gradient(90deg,rgba(40,30,10,0),rgba(40,30,10,.13) 42%,rgba(20,15,5,.28) 50%,rgba(40,30,10,.13) 58%,rgba(40,30,10,0))}
.pp.open .gut{opacity:1}
.pp .leaf{position:absolute;inset:0;transform-origin:left center;transform-style:preserve-3d}
.pp .leaf.anim{transition:transform .95s cubic-bezier(.35,.65,.2,1)}
.pp .leaf.on{transform:rotateY(-180deg)}
.pp .leaf.flat{transform:translateX(-100%)}
.pp .leaf.flat>.front{visibility:hidden}.pp .leaf.flat>.back{transform:none}
.pp .face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
.pp .back{transform:rotateY(180deg)}
.pp .face:after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .95s;background:linear-gradient(90deg,rgba(0,0,0,.22),rgba(0,0,0,0) 60%)}
.pp .leaf.turn .face:after{opacity:1}
.pp .leather{background:radial-gradient(120% 90% at 30% 20%,#245344,#163a2f 55%,#0f2a22)}
.pp .leather:before{content:"";position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");mix-blend-mode:multiply;opacity:.55}
.pp .cover{border-radius:3px 10px 10px 3px;display:flex;flex-direction:column;align-items:center;padding:12% 8% 9%}
.pp .cover:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.35),rgba(255,255,255,.06) 4%,transparent 9%),linear-gradient(160deg,rgba(255,255,255,.08),transparent 40%)}
.pp .gold{background:linear-gradient(170deg,#f6e3a6,#c39a45 45%,#f2d88f 60%,#a8812f);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 rgba(0,0,0,.45))}
.pp .ct1{font:800 25px/1 'Shippori Mincho',serif;letter-spacing:.42em;margin-right:-.42em;position:relative}
.pp .ct2{font:700 16px/1 'Cormorant Garamond',serif;letter-spacing:.3em;margin-right:-.3em;position:relative;text-align:center}
.pp .ct2 small{display:block;font-size:.78em;margin-top:7px;letter-spacing:.42em}
.pp .em{position:relative;width:56%;margin:11% 0 12%;filter:drop-shadow(0 1px 0 rgba(0,0,0,.5))}
.pp .ppchip{position:relative;margin-top:auto;width:14%}
.pp .hint{position:absolute;bottom:-34px;left:0;right:0;text-align:center;font-size:12px;color:var(--muted);animation:pphint 2s ease-in-out infinite}
@keyframes pphint{50%{opacity:.4}}
.pp .endp{border-radius:0 6px 6px 0}.pp .endp.back{border-radius:6px 0 0 6px}
.pp .wm{position:absolute;left:50%;top:40%;width:46%;transform:translate(-50%,-50%);opacity:.16}
.pp .endp p{position:absolute;inset:auto 10% 11%;margin:0;color:#d9bd73;font:600 9px/1.95 'Shippori Mincho',serif;letter-spacing:.08em;text-align:center;opacity:.9}
.pp .paper{background-color:#f5f0e2;background-image:var(--ppgl);background-size:100% 100%;border-radius:0 6px 6px 0;padding:9% 8% 8%}
.pp .paper.back{border-radius:6px 0 0 6px}
.pp .paper:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(60,45,20,.12),rgba(60,45,20,0) 8%)}
.pp .paper.back:before{background:linear-gradient(270deg,rgba(60,45,20,.12),rgba(60,45,20,0) 8%)}
.pp .micro{position:absolute;left:6%;right:6%;bottom:3.2%;font:400 5px/1 'Space Mono',monospace;letter-spacing:.05em;color:rgba(31,111,91,.5);white-space:nowrap;overflow:hidden}
.pp .pno{position:absolute;top:3.6%;right:7%;font:700 11px 'Cormorant Garamond',serif;color:#1f6f5b}
.pp .back .pno{right:auto;left:7%}
.pp .ph{font:700 9px/1.2 'Cormorant Garamond',serif;letter-spacing:.28em;color:#1f6f5b;display:flex;justify-content:space-between;align-items:baseline}
.pp .ph b{font:800 10px 'Shippori Mincho',serif;letter-spacing:.2em;margin-left:4px}
.pp .ph i{font:400 8px 'Space Mono',monospace;font-style:normal;letter-spacing:.05em;color:#5d6b63}
.pp .row{display:flex;gap:7%;margin-top:9%}
.pp .pic{position:relative;width:38%;aspect-ratio:3/4;background:var(--ppme) center/cover #ddd;filter:saturate(.8) contrast(1.05);flex:none}
.pp .pic:after{content:"";position:absolute;inset:0;background:conic-gradient(from 30deg,rgba(255,120,200,0),rgba(120,220,255,.35),rgba(255,240,120,.3),rgba(140,255,180,.3),rgba(255,120,200,0));mix-blend-mode:overlay;opacity:.6}
.pp .fs{display:grid;gap:7px;align-content:start;flex:1}
.pp .f{font:500 6.5px/1.2 'Noto Sans JP',sans-serif;color:#5d6b63;letter-spacing:.03em}
.pp .v{font:700 12px/1.25 'Cormorant Garamond','Shippori Mincho',serif;letter-spacing:.04em;overflow-wrap:anywhere}
.pp .v.j{font:800 10.5px/1.3 'Shippori Mincho',serif}
.pp .ghost{position:absolute;right:9%;top:50%;width:16%;aspect-ratio:3/4;background:var(--ppme) center/cover;filter:grayscale(1) contrast(1.4);opacity:.15;mix-blend-mode:multiply}
.pp .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:4%;margin-top:9%;padding-top:5%;border-top:1px solid rgba(31,111,91,.35)}
.pp .stats b{display:block;font:700 22px/1 'Cormorant Garamond',serif;color:#1f6f5b}.pp .stats span{font-size:7.5px;color:#5d6b63}
.pp .mrz{position:absolute;left:6%;right:6%;bottom:9%;font:400 9.4px/1.55 'Space Mono',monospace;letter-spacing:.02em;white-space:pre;overflow:hidden;color:#26312b}
.pp .lam{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 42%,transparent 52%)}
.pp .ttl{position:absolute;left:9%;right:9%;top:13%}
.pp .ttl h3{margin:0;font:800 19px/1.4 'Shippori Mincho',serif;letter-spacing:.04em;color:#1b2330;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pp .ttl p{margin:7px 0 0;font:800 11px/1 'Shippori Mincho',serif;letter-spacing:.08em;color:#4a5752}
.pp .snap{position:absolute;box-shadow:0 1px 1px rgba(0,0,0,.12),1px 4px 10px rgba(0,0,0,.12);background:#ddd}
.pp .snap i{display:block;aspect-ratio:1.3;background-size:cover;background-position:center}
.pp .tp{position:absolute;width:34%;height:12%;background:rgba(214,230,214,.78);box-shadow:0 1px 1px rgba(0,0,0,.05);mix-blend-mode:multiply}
.pp .tp.t1{top:-6%;left:-9%;transform:rotate(-34deg)}.pp .tp.t2{bottom:-6%;right:-9%;transform:rotate(-34deg)}
.pp .open-a{position:absolute;right:8%;bottom:7%;font:800 10px 'Shippori Mincho',serif;letter-spacing:.1em;color:#1f6f5b;border-bottom:1px solid currentColor;padding:6px 0 1px}
.pp .stz{position:absolute;inset:12% 4% 8%}
.pp .stamp{position:absolute;filter:url(#ppink);mix-blend-mode:multiply;opacity:.92;zoom:1.3}
.pp .stamp svg{display:block;overflow:visible}
.pp .stamp.wait{opacity:0}
.pp .stamp.press{animation:pppress .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes pppress{0%{opacity:0;transform:var(--r) scale(1.7)}60%{opacity:1;transform:var(--r) scale(.94)}100%{opacity:.92;transform:var(--r) scale(1)}}
.pp .slot{position:absolute;inset:30% 12% 34%;border:1.5px dashed rgba(31,111,91,.4);border-radius:6px;display:grid;place-items:center;text-align:center;font:700 11px/1.8 'Noto Sans JP',sans-serif;color:#1f6f5b;padding:10px}
.pp .slot a{display:inline-block;margin-top:8px;font:700 12px 'Noto Sans JP',sans-serif;background:#1f6f5b;color:#fff;border-radius:3px;padding:9px 14px;box-shadow:2px 2px 0 #1b2330}
.pp-ctl{display:flex;gap:10px;align-items:center;justify-content:center;padding:22px 16px 10px}
.pp-ctl button{min-width:44px;min-height:44px;border:1.5px solid var(--ink);background:transparent;color:var(--ink);border-radius:3px;font:700 14px 'Noto Sans JP',sans-serif;padding:0 14px}
.pp-ctl button:disabled{opacity:.3}
.pp-ctl span{font:700 12px Manrope,sans-serif;color:var(--muted);min-width:70px;text-align:center}
@media (prefers-reduced-motion:reduce){.pp .leaf.anim,.pp{transition-duration:.01s}.pp .stamp.press{animation:none;opacity:.92}.pp .hint{animation:none}}
`;

const LOGO = `<path d="M606 411H888Q908 411 908 431V532Q908 552 889 560L606 678Z" style="fill:var(--s3)"/><path d="M606 370H835Q855 370 855 390V499Q855 519 836 527L606 612Z" style="fill:var(--s2)"/><path d="M606 328H782Q802 328 802 348V458Q802 478 783 486L606 552Z" style="fill:var(--s1)"/><path d="M364 488H606V784Q606 854 536 854H434Q364 854 364 784Z" style="fill:var(--st)"/><path d="M244 244H680Q742 244 742 306V426Q742 488 680 488H244A122 122 0 0 1 244 244Z" style="fill:var(--b)"/><path d="M648 244H680Q742 244 742 306V426Q742 488 680 488H380Z" style="fill:var(--d)"/>`;
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="ppink" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2.2" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="9" result="b"/><feColorMatrix in="b" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 1.9" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>
<linearGradient id="ppgd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3a6"/><stop offset=".5" stop-color="#b98f3c"/><stop offset="1" stop-color="#f0d58c"/></linearGradient>
<linearGradient id="ppgd2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9c7a34"/><stop offset="1" stop-color="#e9cf86"/></linearGradient>
<symbol id="pplogo" viewBox="120 240 792 618">${LOGO}</symbol></defs></svg>`;

const GL = (() => {
  const wmk = `<g transform='translate(62 150) scale(.2) translate(-120 -240)' fill='#1f6f5b'><path d='M606 411H888Q908 411 908 431V532Q908 552 889 560L606 678Z' fill-opacity='.012'/><path d='M606 370H835Q855 370 855 390V499Q855 519 836 527L606 612Z' fill-opacity='.018'/><path d='M606 328H782Q802 328 802 348V458Q802 478 783 486L606 552Z' fill-opacity='.024'/><path d='M364 488H606V784Q606 854 536 854H434Q364 854 364 784Z' fill-opacity='.03'/><path d='M244 244H680Q742 244 742 306V426Q742 488 680 488H244A122 122 0 0 1 244 244Z' fill-opacity='.03'/></g>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 426' preserveAspectRatio='none'><defs><pattern id='h' width='5' height='5' patternUnits='userSpaceOnUse' patternTransform='rotate(35)'><path d='M0 0v5' stroke='#1f6f5b' stroke-opacity='.06' stroke-width='.5'/></pattern><pattern id='k' width='7' height='7' patternUnits='userSpaceOnUse' patternTransform='rotate(-35)'><path d='M0 0v7' stroke='#b07a8c' stroke-opacity='.045' stroke-width='.5'/></pattern><radialGradient id='f'><stop offset='0' stop-color='#fff' stop-opacity='.5'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs><rect width='300' height='426' fill='url(#h)'/><rect width='300' height='426' fill='url(#k)'/><ellipse cx='150' cy='213' rx='150' ry='190' fill='url(#f)'/>${wmk}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

// ---- スタンプ ----
let uid = 0;
const ring = (c, a, b, d) => { const id = "ppr" + uid++; return `<svg width="100" height="100" viewBox="0 0 104 104"><defs><path id="${id}" d="M52 52 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0"/></defs><g fill="none" stroke="${c}"><circle cx="52" cy="52" r="49" stroke-width="2.6"/><circle cx="52" cy="52" r="44" stroke-width="1"/><circle cx="52" cy="52" r="28" stroke-width="1.4"/></g><text font-family="Cormorant Garamond,serif" font-weight="700" font-size="11.5" letter-spacing="2.2" fill="${c}"><textPath href="#${id}" startOffset="3%">${a} ★ TABISTOCK ★</textPath></text><text x="52" y="50" text-anchor="middle" font-family="Space Mono,monospace" font-weight="700" font-size="9" fill="${c}">${b}</text><text x="52" y="63" text-anchor="middle" font-family="Space Mono,monospace" font-size="7.5" fill="${c}">${d}</text></svg>`; };
const rect = (c, a, b, d) => `<svg width="118" height="72" viewBox="0 0 122 74"><g fill="none" stroke="${c}"><rect x="2" y="2" width="118" height="70" rx="7" stroke-width="2.6"/><rect x="7" y="7" width="108" height="60" rx="4" stroke-width="1"/></g><path d="M14 22 l10 -4 l-3 4 l3 4z M18 22h-8" fill="${c}" stroke="${c}"/><text x="64" y="27" text-anchor="middle" font-family="Cormorant Garamond,serif" font-weight="700" font-size="${a.length > 9 ? 13 : 17}" letter-spacing="1.5" fill="${c}">${a}</text><text x="61" y="44" text-anchor="middle" font-family="Space Mono,monospace" font-weight="700" font-size="9" fill="${c}">${b}</text><text x="61" y="58" text-anchor="middle" font-family="Space Mono,monospace" font-size="7.5" fill="${c}">${d}</text></svg>`;
const oval = (c, a, b, d) => `<svg width="120" height="82" viewBox="0 0 124 84"><g fill="none" stroke="${c}"><ellipse cx="62" cy="42" rx="59" ry="39" stroke-width="2.4"/><ellipse cx="62" cy="42" rx="53" ry="33" stroke-width="1"/></g><text x="62" y="38" text-anchor="middle" font-family="Cormorant Garamond,serif" font-weight="700" font-size="${a.length > 9 ? 12 : 16}" letter-spacing="1.5" fill="${c}">${a}</text><text x="62" y="52" text-anchor="middle" font-family="Space Mono,monospace" font-size="7.5" fill="${c}">${b}</text><text x="62" y="63" text-anchor="middle" font-family="Space Mono,monospace" font-weight="700" font-size="8" fill="${c}">${d}</text></svg>`;
const hexa = (c, a, b, d) => `<svg width="100" height="92" viewBox="0 0 104 96"><g fill="none" stroke="${c}"><path d="M28 3h48l25 45-25 45H28L3 48z" stroke-width="2.4"/><path d="M31 9h42l21 39-21 39H31L10 48z" stroke-width="1"/></g><text x="52" y="44" text-anchor="middle" font-family="Cormorant Garamond,serif" font-weight="700" font-size="${a.length > 9 ? 10.5 : 14}" letter-spacing="1" fill="${c}">${a}</text><text x="52" y="58" text-anchor="middle" font-family="Space Mono,monospace" font-size="7" fill="${c}">${b}</text><text x="52" y="70" text-anchor="middle" font-family="Space Mono,monospace" font-weight="700" font-size="7.5" fill="${c}">${d}</text></svg>`;
// 国内（都道府県）は駅スタンプ風
const eki = (c, a, b, d) => `<svg width="92" height="104" viewBox="0 0 96 110"><g fill="none" stroke="${c}"><rect x="3" y="3" width="90" height="104" rx="4" stroke-width="2.4"/><path d="M8 26h80M8 84h80" stroke-width="1"/></g><text x="48" y="19" text-anchor="middle" font-family="Cormorant Garamond,serif" font-weight="700" font-size="9" letter-spacing="2" fill="${c}">TABISTOCK</text><text x="48" y="${a.length > 2 ? 63 : 66}" text-anchor="middle" font-family="Shippori Mincho,serif" font-weight="800" font-size="${a.length > 3 ? 17 : a.length > 2 ? 22 : 28}" fill="${c}">${a}</text><text x="48" y="98" text-anchor="middle" font-family="Space Mono,monospace" font-size="7.5" fill="${c}">${d}</text></svg>`;
const SHAPES = [ring, rect, oval, hexa], INKS = ["#1f6f5b", "#c8492b", "#2f5fa8", "#6d4fa0", "#b8862a", "#2b6f7a"];
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };
function stampHtml(key, label, sub, date, kanji) {
  const h = hash(key), col = INKS[(h >>> 3) % INKS.length], r = ((h >>> 6) % 26) - 13;
  const fn = kanji ? eki : SHAPES[h % 4];
  return { html: fn(col, label, sub, date), r };
}

export function pagePassport(el, ctx) {
  const { esc, bar, haptic, cinfo, fmtPeriod, profile: p = {}, arts: all = [], created } = ctx;
  if (!document.getElementById("ppcss")) {
    const st = document.createElement("style"); st.id = "ppcss"; st.textContent = CSS; document.head.appendChild(st);
    const lk = document.createElement("link"); lk.rel = "stylesheet"; lk.href = FONTS; document.head.appendChild(lk);
  }
  // 公開中の記事を、旅の日付の古い順に
  const tkey = (d) => d.dateStart || (d.createdAt && new Date(d.createdAt.seconds * 1000).toISOString().slice(0, 10)) || "";
  const arts = all.filter((d) => d.status === "published").sort((a, b) => tkey(a).localeCompare(tkey(b)));
  const dot = (s) => (s ? s.replace(/-/g, ".") : "");
  const period = (d) => (d.dateStart && d.dateEnd ? fmtPeriod(d.dateStart, d.dateEnd).replace(" - ", " – ") : dot(d.dateStart));
  const daysOf = (d) => { if (d.dateStart && d.dateEnd) { const n = Math.round((new Date(d.dateEnd) - new Date(d.dateStart)) / 864e5) + 1; if (n > 0 && n < 400) return n; } return (d.days || []).length || 0; };
  const micro = "TABISTOCK·旅券·PASSPORT·".repeat(14);
  const foot = `<div class="micro">${micro}</div>`;
  const wm = `<svg class="wm" viewBox="0 0 100 78"><use href="#pplogo" width="100" height="78" style="--b:#d9bd73;--d:#b39445;--st:#c9aa5c;--s1:rgba(217,189,115,.7);--s2:rgba(217,189,115,.45);--s3:rgba(217,189,115,.25)"/></svg>`;
  const emblem = `<svg class="em" viewBox="0 0 140 140"><defs><path id="ppring" d="M70 70 m-52 0 a52 52 0 1 1 104 0 a52 52 0 1 1 -104 0"/></defs><g fill="none" stroke="url(#ppgd)"><circle cx="70" cy="70" r="67" stroke-width="2.2"/><circle cx="70" cy="70" r="62" stroke-width=".8"/><circle cx="70" cy="70" r="43" stroke-width="1.2"/></g><text font-family="Cormorant Garamond,serif" font-weight="700" font-size="9.6" letter-spacing="3.2" fill="url(#ppgd)"><textPath href="#ppring">TABISTOCK ✦ TRAVEL RECORD ✦ SINCE 2025 ✦</textPath></text><use href="#pplogo" x="38" y="44" width="64" height="50" style="--b:url(#ppgd);--d:#6e511d;--st:url(#ppgd2);--s1:rgba(226,196,120,.8);--s2:rgba(226,196,120,.5);--s3:rgba(226,196,120,.28)"/></svg>`;
  const chip = `<svg viewBox="0 0 60 40"><g fill="none" stroke="#d9bd73" stroke-width="2.4"><rect x="2" y="2" width="56" height="36" rx="3"/><circle cx="30" cy="20" r="9"/><path d="M2 20h19M39 20h19"/></g></svg>`;

  // 見開きの左：タイトル・期間・トップの写真（最大3枚、枠なしでテープ留め）
  const PH = { 1: [[14, 40, 72, -3]], 2: [[4, 36, 60, -5], [38, 60, 58, 4]], 3: [[4, 34, 54, -5], [44, 44, 52, 5], [10, 64, 50, 2]] };
  function leftPage(d, k, pno) {
    const imgs = (d.heroUrls && d.heroUrls.length ? d.heroUrls : [d.thumbUrl]).filter(Boolean).slice(0, 3);
    const P = PH[imgs.length] || [];
    const phs = imgs.map((u, i) => { const [x, y, w, r] = P[i]; return `<div class="snap" style="left:${x}%;top:${y}%;width:${w}%;transform:rotate(${r}deg)"><i style="background-image:url('${esc(u)}')"></i><span class="tp t1"></span><span class="tp t2"></span></div>`; }).join("");
    return `<div class="face back paper"><div class="pno">${pno}</div><div class="ph"><span>VISA<b>査証</b></span><i>No.${String(k + 1).padStart(2, "0")}</i></div>
      <div class="ttl"><h3>${esc(d.title || "")}</h3><p>${esc(period(d))}</p></div>${phs}<a class="open-a" href="#a-${esc(d.id)}">記事を見る</a>${foot}</div>`;
  }
  // 見開きの右：スタンプ（国ごと。国内は都道府県ごとの駅スタンプ風）
  const SP = [[[6, 4], [30, 50]], [[30, 2], [2, 40], [34, 66]], [[4, 0], [44, 18], [2, 46], [42, 64]]];
  function rightPage(d, k, pno) {
    const date = dot(d.dateStart) || "";
    const n = daysOf(d);
    const cs = (d.countries || []).filter((v) => v !== "japan");
    const prefs = (d.prefectures || []);
    let items = cs.map((v) => { const c = cinfo(v) || {}; return stampHtml(v, String(c.en || v).toUpperCase(), n ? `${n} DAYS` : "", date); });
    if (!cs.length) items = (prefs.length ? prefs : ["日本"]).map((x) => stampHtml(x, x, "", date, true));
    items = items.slice(0, 4);
    const pos = items.length === 1 ? [[6, 4]] : SP[items.length - 2];
    let html = items.map((s, i) => { const [x, y] = pos[i] || [20, 20]; return `<div class="stamp" style="left:${x}%;top:${y}%;--r:rotate(${s.r}deg);transform:rotate(${s.r}deg)">${s.html}</div>`; }).join("");
    if (items.length === 1 && cs.length) html += `<div class="stamp" style="left:30%;top:40%;--r:rotate(-4deg);transform:rotate(-4deg)">${rect("#3a4a5c", "DEPARTED", "JAPAN", date)}</div>`;
    return `<div class="face front paper"><div class="pno">${pno}</div><div class="ph"><span>VISAS<b>査証</b></span><i>No.${String(k + 1).padStart(2, "0")}</i></div><div class="stz">${html}</div>${foot}</div>`;
  }

  const ascii = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
  const name = ascii(p.nameEn || p.nickname) || "TRAVELER";
  const no = "TS" + ascii(ctx.me).slice(0, 7).padEnd(7, "0");
  const mrz = (`P<JPN${name}<<`).padEnd(44, "<").slice(0, 44) + "\n" + (`${no}<0JPN${(created || "").replace(/-/g, "").slice(2, 8) || "000000"}<`).padEnd(42, "<") + "04";
  const issued = created ? new Date(created + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "—";
  const countries = new Set(arts.flatMap((d) => (d.countries || []).filter((v) => v !== "japan")));
  const totalDays = arts.reduce((s, d) => s + daysOf(d), 0);
  const tags = Array.isArray(p.tags) ? p.tags.slice(0, 3).join("・") : "";

  const faces = [
    `<div class="face front leather cover"><div class="ct1 gold">旅券</div>${emblem}<div class="ct2 gold">TABISTOCK<small>PASSPORT</small></div><div class="ppchip">${chip}</div><div class="hint">タップして開く</div></div>`,
    `<div class="face back leather endp">${wm}<p>この旅券の所持人が<br>世界のどこへでも気ままに旅をし<br>出会った景色と人を記録できるよう<br>関係の諸君に要請する。<br><br>TABISTOCK</p></div>`,
    `<div class="face front paper"><div class="pno">1</div><div class="ph"><span>PASSPORT<b>旅券</b></span><i>${esc(no)}</i></div><div class="row"><div class="pic"></div><div class="fs">
      <div><div class="f">型 / Type　　発行 / Issuing</div><div class="v">P　　TABISTOCK</div></div>
      <div><div class="f">氏名 / Name</div><div class="v j">${esc(p.nickname || "旅人")}</div></div>
      ${tags ? `<div><div class="f">旅のスタイル / Style</div><div class="v j">${esc(tags)}</div></div>` : ""}
      <div><div class="f">発行年月日 / Date of issue</div><div class="v">${esc(issued)}</div></div></div></div>
      <div class="ghost"></div>
      <div class="stats"><div><b>${countries.size}</b><span>行った国</span></div><div><b>${totalDays}</b><span>旅した日数</span></div><div><b>${arts.length}</b><span>旅の記録</span></div></div>
      <div class="mrz">${esc(mrz)}</div><div class="lam"></div>${foot}</div>`
  ];
  arts.forEach((d, k) => faces.push(leftPage(d, k, 2 + k * 2), rightPage(d, k, 3 + k * 2)));
  const np = 2 + arts.length * 2;
  faces.push(`<div class="face back paper"><div class="pno">${np}</div><div class="ph"><span>VISA<b>査証</b></span><i>No.${String(arts.length + 1).padStart(2, "0")}</i></div>
      <div class="slot"><div>次の旅はここに<br><span style="font-weight:500;color:#5d6b63">記事を投稿すると<br>この見開きが埋まります</span><br><a href="#p">旅程を投稿する</a></div></div>${foot}</div>`,
    `<div class="face front paper"><div class="pno">${np + 1}</div><div class="ph"><span>VISAS<b>査証</b></span></div>${foot}</div>`,
    `<div class="face back leather endp">${wm}</div>`);
  const N = faces.length / 2;
  let leavesHtml = "";
  for (let i = 0; i < N; i++) leavesHtml += `<div class="leaf" style="z-index:${100 - i}">${faces[i * 2]}${faces[i * 2 + 1]}</div>`;

  el.innerHTML = bar("パスポート") + `<div class="ps under2 ppw">${DEFS}
    <div class="pp-stage"><div class="pp" id="ppBook" style="--ppgl:${GL.replace(/"/g, "&quot;")};--ppme:url('${esc(p.photoURL || "")}')"><div class="base"><div class="face leather endp">${wm}</div></div><div class="gut"></div>${leavesHtml}</div></div>
    <div class="pp-ctl"><button id="ppPrev" aria-label="前のページ">‹</button><span id="ppPos">表紙</span><button id="ppNext" aria-label="次のページ">›</button><button id="ppClose">閉じる</button></div></div>`;

  const book = el.querySelector("#ppBook");
  const leaves = [...book.querySelectorAll(".leaf")];
  book.querySelectorAll(".paper .stamp").forEach((s) => s.classList.add("wait"));
  let idx = 0, busy = false;
  const buzz = () => { try { haptic && haptic(); } catch (e) {} };
  const fit = () => { const W = book.offsetWidth || 320; book.style.setProperty("--pps", Math.min(1, (innerWidth - 20) / (2 * W)).toFixed(3)); };
  const label = () => (idx === 0 ? "表紙" : idx === N ? "裏表紙" : idx === 1 ? "1" : `${idx * 2 - 2}–${idx * 2 - 1}`);
  const visible = () => { const v = []; if (idx < N) v.push(leaves[idx].children[0]); if (idx > 0) v.push(leaves[idx - 1].children[1]); return v; };
  const pressVisible = () => { let k = 0; visible().forEach((f) => f.querySelectorAll(".stamp.wait").forEach((s) => { const d = 150 + 220 * k++; setTimeout(() => { s.classList.remove("wait"); s.classList.add("press"); buzz(); }, d); })); };
  const render = () => { fit(); book.classList.toggle("shift", idx > 0 && idx < N); book.classList.toggle("open", idx > 0 && idx < N); el.querySelector("#ppPos").textContent = label(); el.querySelector("#ppPrev").disabled = idx === 0; el.querySelector("#ppNext").disabled = idx === N; };
  function go(dir) {
    if (busy) return; const i = dir > 0 ? idx : idx - 1; if (i < 0 || i >= N) return; busy = true; const l = leaves[i];
    if (dir < 0) { l.classList.remove("flat"); void l.offsetWidth; }
    l.style.zIndex = 300; l.classList.add("anim", "turn");
    requestAnimationFrame(() => l.classList.toggle("on", dir > 0));
    idx += dir; render(); buzz();
    setTimeout(() => { l.classList.remove("anim", "turn"); if (dir > 0) l.classList.add("flat"); l.style.zIndex = dir > 0 ? 200 + i : 100 - i; busy = false; pressVisible(); }, 980);
  }
  let sx = 0, sy = 0;
  book.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
  book.addEventListener("pointerup", (e) => {
    if (e.target.closest("a,button")) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); return; }
    const r = book.getBoundingClientRect();
    if (idx === 0) go(1); else if (idx === N) go(-1); else go(e.clientX < r.left ? -1 : 1);
  });
  el.querySelector("#ppPrev").onclick = () => go(-1);
  el.querySelector("#ppNext").onclick = () => go(1);
  el.querySelector("#ppClose").onclick = () => { const t = setInterval(() => { if (idx === 0) { clearInterval(t); return; } if (!busy) go(-1); }, 120); };
  addEventListener("resize", render);
  render();
  return () => removeEventListener("resize", render);
}
