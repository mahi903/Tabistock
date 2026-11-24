// Tabistock パスポート（マイページ）
// 自分の旅程記事から、記事1本＝見開き1つのパスポートを作る。
// 見開きの左：記事タイトル・旅の期間・トップの写真（最大3枚）／右：その旅のスタンプ
// 表紙をタップして開き、ページをめくって読む。スマホでは開いたら縮小して見開きを画面に収める。

const FONTS = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Shippori+Mincho:wght@500;600;800&family=Cinzel:wght@500&family=Space+Mono:wght@400;700&family=Pinyon+Script&display=swap";

const CSS = `
.ppw{display:flex;flex-direction:column;align-items:center;min-height:100%;padding-bottom:calc(30px + var(--sb))!important;overflow-x:hidden}
.pp-stage{flex:1;width:100%;display:grid;place-items:center;padding:30px 0 12px}
.pp{--W:min(320px,84vw);position:relative;width:var(--W);aspect-ratio:88/125;will-change:transform;transform:scale(1) translateX(0);transition:transform .95s cubic-bezier(.45,.05,.25,1);perspective:1800px;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:pan-y;color:#1b2330}
.pp.shift{transform:scale(var(--pps,1)) translateX(50%)}
.pp.one{transform:scale(1) translateX(0)}.pp.one.lft{transform:scale(1) translateX(100%)}
.ppw{overflow-x:hidden}
.pp .base{position:absolute;inset:0;border-radius:3px 10px 10px 3px;background:#17392f;box-shadow:1px 1px 0 #e9e2cf,2px 2px 0 #ddd4bf,3px 3px 0 #e9e2cf,4px 4px 0 #d6cdb7,5px 6px 0 #17392f,10px 18px 30px rgba(0,0,0,.28)}
.pp .base .face{inset:0 4px 0 0}
.pp .gut{position:absolute;top:0;bottom:0;left:-16px;width:32px;z-index:900;pointer-events:none;opacity:0;transition:opacity .4s;background:linear-gradient(90deg,rgba(40,30,10,0),rgba(40,30,10,.13) 42%,rgba(20,15,5,.28) 50%,rgba(40,30,10,.13) 58%,rgba(40,30,10,0))}
.pp.open .gut{opacity:1}
.pp .leaf{position:absolute;inset:0;transform-origin:left center;transform-style:preserve-3d}
.pp .leaf.anim{transition:transform .9s cubic-bezier(.35,.65,.2,1);will-change:transform}
.pp .ppfr{transform:translateZ(0)}
.pp .leaf.on{transform:rotateY(-180deg)}
.pp .leaf.flat{transform:translateX(-100%)}
.pp .leaf.flat>.ppfr{visibility:hidden}.pp .leaf.flat>.ppbk{transform:none}
.pp .face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;overflow:hidden}
.pp .ppbk{transform:rotateY(180deg)}
.pp .face:after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .95s;background:linear-gradient(90deg,rgba(60,45,20,.12),rgba(60,45,20,0) 60%)}
.pp .leaf.turn .face:after{opacity:1}
.pp .leather{background:radial-gradient(120% 90% at 30% 20%,#245344,#163a2f 55%,#0f2a22)}
.pp .leather:before{content:"";position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.3' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:.3}
.pp .cover{border-radius:3px 10px 10px 3px;display:flex;flex-direction:column;align-items:center;padding:12% 8% 9%}
.pp .cover:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,.35),rgba(255,255,255,.06) 4%,transparent 9%),linear-gradient(160deg,rgba(255,255,255,.08),transparent 40%)}
.pp .gold{background:linear-gradient(170deg,#f6e3a6,#c39a45 45%,#f2d88f 60%,#a8812f);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 rgba(0,0,0,.45))}
.pp .cover{display:block;padding:0}
.pp .cj{position:absolute;top:12%;height:12.5%;transform:translateX(-50%);filter:drop-shadow(0 1px 0 rgba(0,0,0,.45))}
.pp .cj svg{display:block;height:100%;width:auto}
.pp .em{position:absolute;left:50%;top:45%;width:36%;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 0 rgba(0,0,0,.5))}
.pp .ct2{position:absolute;left:50%;top:61%;width:56%;transform:translateX(-50%);filter:drop-shadow(0 1px 0 rgba(0,0,0,.45))}
.pp .ct2 svg{display:block;width:100%;height:auto;overflow:visible}
.pp .ppchip{position:absolute;left:50%;top:89%;width:12%;transform:translate(-50%,-50%)}
.pp .hint{position:absolute;bottom:-34px;left:0;right:0;text-align:center;font-size:12px;color:var(--muted);animation:pphint 2s ease-in-out infinite}
@keyframes pphint{50%{opacity:.4}}
.pp .endp{border-radius:0 6px 6px 0}.pp .endp.ppbk{border-radius:6px 0 0 6px}
.pp .ppwm{position:absolute;left:50%;top:40%;width:46%;transform:translate(-50%,-50%);opacity:.16}
.pp .endp p{position:absolute;inset:auto 10% 11%;margin:0;color:#d9bd73;font:600 9px/1.95 'Shippori Mincho',serif;letter-spacing:.08em;text-align:center;opacity:.9}
.pp .req{background:#f4f1e8;padding:0}
.pp .req>svg.frm{position:absolute;inset:0;width:100%;height:100%}
.pp .paper.req{background-image:none}
.pp .rq-ban{position:absolute;left:21%;right:21%;top:7.2%;height:6.4%;display:flex;justify-content:center;align-items:center;gap:7%}
.pp .rq-ban svg{height:72%;width:auto}
.pp .rq-jp{position:absolute;left:21%;right:21%;top:17.5%;margin:0;font:600 12.6px/1.95 'Shippori Mincho',serif;color:#1b2330}
.pp .rq-jp span{display:block;text-align:justify;text-align-last:justify}
.pp .rq-seal{position:absolute;left:50%;top:40%;width:15%;transform:translateX(-50%) rotate(-1.5deg);opacity:.9}
.pp .rq-by{position:absolute;left:0;right:0;top:47.5%;text-align:center;font:800 15px/1 'Shippori Mincho',serif;letter-spacing:.14em;color:#1b2330}
.pp .rq-en{position:absolute;left:19%;right:18%;top:62%;margin:0;font:400 12.4px/1.6 'Pinyon Script',cursive;color:#1b2330;text-align:justify}
.pp .rq-med{position:absolute;left:5%;bottom:3%;width:20%}
.pp .paper{background-color:#f5f0e2;background-image:var(--ppgl);background-size:100% 100%;border-radius:0 6px 6px 0;padding:9% 8% 8%}
.pp .paper.ppbk{border-radius:6px 0 0 6px}
.pp .paper:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(60,45,20,.12),rgba(60,45,20,0) 8%)}
.pp .paper.ppbk:before{background:linear-gradient(270deg,rgba(60,45,20,.12),rgba(60,45,20,0) 8%)}
.pp .micro{position:absolute;left:6%;right:6%;bottom:3.2%;font:400 5px/1 'Space Mono',monospace;letter-spacing:.05em;color:rgba(31,111,91,.5);white-space:nowrap;overflow:hidden}
.pp .pno{position:absolute;top:3.6%;right:7%;font:700 11px 'Cormorant Garamond',serif;color:#1f6f5b}
.pp .ppbk .pno{right:auto;left:7%}
.pp .pphd{font:700 9px/1.2 'Cormorant Garamond',serif;letter-spacing:.28em;color:#1f6f5b;display:flex;justify-content:space-between;align-items:baseline}
.pp .pphd b{font:800 10px 'Shippori Mincho',serif;letter-spacing:.2em;margin-left:4px}
.pp .pphd i{font:400 8px 'Space Mono',monospace;font-style:normal;letter-spacing:.05em;color:#5d6b63}
.pp .row{display:flex;gap:7%;margin-top:9%}
.pp .pic{position:relative;width:38%;aspect-ratio:3/4;background:var(--ppme) center/cover #ddd;filter:saturate(.8) contrast(1.05);flex:none}
.pp .pic:after{content:"";position:absolute;inset:0;background:conic-gradient(from 30deg,rgba(255,120,200,0),rgba(120,220,255,.35),rgba(255,240,120,.3),rgba(140,255,180,.3),rgba(255,120,200,0));opacity:.22}
.pp .fs{display:grid;gap:7px;align-content:start;flex:1}
.pp .f{font:500 6.5px/1.2 'Noto Sans JP',sans-serif;color:#5d6b63;letter-spacing:.03em}
.pp .v{font:700 12px/1.25 'Cormorant Garamond','Shippori Mincho',serif;letter-spacing:.04em;overflow-wrap:anywhere}
.pp .v.j{font:800 10.5px/1.3 'Shippori Mincho',serif}
.pp .ppst{display:grid;grid-template-columns:repeat(3,1fr);gap:4%;margin-top:9%;padding-top:5%;border-top:1px solid rgba(31,111,91,.35)}
.pp .ppst b{display:block;font:700 22px/1 'Cormorant Garamond',serif;color:#1f6f5b}.pp .ppst span{font-size:7.5px;color:#5d6b63}
.pp .mrz{position:absolute;left:6%;right:6%;bottom:9%;font:400 9.4px/1.55 'Space Mono',monospace;letter-spacing:.02em;white-space:pre;overflow:hidden;color:#26312b}
.pp .lam{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 42%,transparent 52%)}
.pp .ttl{position:absolute;left:9%;right:9%;top:13%}
.pp .ttl h3{margin:0;font:800 18px/1.4 'Shippori Mincho',serif;letter-spacing:.04em;color:#1b2330;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pp .ttl p{margin:7px 0 0;font:800 11px/1 'Shippori Mincho',serif;letter-spacing:.08em;color:#4a5752}
.pp .snap{position:absolute;box-shadow:0 1px 1px rgba(0,0,0,.12),1px 4px 10px rgba(0,0,0,.12);background:#ddd}
.pp .snap i{display:block;aspect-ratio:1.3;background-size:cover;background-position:center}
.pp .tp{position:absolute;width:34%;height:12%;background:rgba(206,226,210,.72);box-shadow:0 1px 1px rgba(0,0,0,.05)}
.pp .tp.t1{top:-6%;left:-9%;transform:rotate(-34deg)}.pp .tp.t2{bottom:-6%;right:-9%;transform:rotate(-34deg)}
.pp .open-a{margin-left:12px;font:800 10px 'Shippori Mincho',serif;letter-spacing:.1em;color:#1f6f5b;border-bottom:1px solid currentColor;padding:6px 0 1px}
.pp .stz{position:absolute;inset:0 5%;pointer-events:none}
.pp .stamp{position:absolute;opacity:.9}
.pp .stamp svg{display:block;overflow:visible}
.pp .stamp.wait{opacity:0}
.pp .stamp.press{animation:pppress .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes pppress{0%{opacity:0;transform:var(--r) scale(1.7)}60%{opacity:1;transform:var(--r) scale(.94)}100%{opacity:.9;transform:var(--r) scale(1)}}
.pp .slot{position:absolute;inset:26% 10% 30%;border:1.5px dashed rgba(31,111,91,.4);display:grid;place-items:center;text-align:center;font:800 13px/2 'Shippori Mincho',serif;letter-spacing:.06em;color:#1f6f5b;padding:10px}
.pp .slot small{display:block;font:600 10px/1.9 'Shippori Mincho',serif;color:#5d6b63}
.pp .slot a{display:inline-block;margin-top:10px;font:800 11px 'Shippori Mincho',serif;letter-spacing:.12em;color:#1f6f5b;border-bottom:1px solid currentColor;padding:6px 0 1px}
.pp .ppsig{cursor:pointer}
.pp .ppsv{height:30px;margin-top:1px;display:flex;align-items:flex-end}
.pp .ppsv svg{height:38px;width:auto;max-width:100%;margin-bottom:-4px}
.pp .ppsv em{font:600 9px 'Shippori Mincho',serif;font-style:normal;color:#8a948f;padding-bottom:6px}
.ppsign{position:absolute;inset:0;z-index:50;display:grid;place-items:center;background:rgba(20,25,22,.45);padding:20px;animation:ppfade .25s ease}
@keyframes ppfade{from{opacity:0}}
.ppsign>div{width:min(360px,100%);background:#f5f0e2;border:1.5px solid #1b2330;box-shadow:5px 5px 0 #1f6f5b;padding:20px 18px 16px;color:#1b2330}
.ppsign h3{margin:0;font:800 17px/1.4 'Shippori Mincho',serif;letter-spacing:.06em}
.ppsign p{margin:6px 0 14px;font:500 12px/1.7 'Noto Sans JP',sans-serif;color:#5d6b63}
.ppsign .pad{position:relative;background:#fffdf6;border:1px solid #d8cfbb;touch-action:none}
.ppsign canvas{display:block;width:100%;height:130px;touch-action:none}
.ppsign .pad i{position:absolute;left:12px;right:12px;bottom:30px;border-bottom:1px dashed #b9b1a0;pointer-events:none}
.ppsign .pad b{position:absolute;left:12px;bottom:34px;font:700 14px serif;color:#b9b1a0;pointer-events:none}
.ppsign .acts{display:flex;gap:8px;margin-top:14px;align-items:center}
.ppsign .acts button{min-height:42px;padding:0 14px;border:1.5px solid #1b2330;background:none;color:#1b2330;font:700 13px 'Noto Sans JP',sans-serif;border-radius:3px}
.ppsign .acts .go{margin-left:auto;background:#1f6f5b;color:#fff;border-color:#1b2330;box-shadow:2px 2px 0 #1b2330}
.ppsign .acts .go:disabled{opacity:.4}
.ppsign .skip{display:block;margin:12px auto 0;background:none;border:0;color:#6c7787;font:500 12px 'Noto Sans JP',sans-serif;text-decoration:underline}
.pp-stage{perspective:1400px}
.pp-in{transform-style:flat}
.pp .hint{transition:opacity .4s}.pp .hint.gone{opacity:0;animation:none}
.ppsh{margin-left:auto;background:none;border:0;color:var(--ink);padding:6px;display:grid;place-items:center}
.ppmk{position:absolute;left:50%;top:70px;transform:translateX(-50%);z-index:60;background:#1b2330;color:#fff;font:700 12.5px 'Noto Sans JP',sans-serif;padding:9px 14px;border-radius:3px;white-space:nowrap}
.ppsv2{position:absolute;inset:0;z-index:60;background:rgba(20,25,22,.6);display:grid;place-items:center;padding:20px;animation:ppfade .25s ease}
.ppsv2>div{display:flex;flex-direction:column;align-items:center;gap:12px;max-height:100%}
.ppsv2 img{max-height:70vh;max-width:100%;box-shadow:0 10px 30px rgba(0,0,0,.35);-webkit-touch-callout:default}
.ppsv2 p{margin:0;color:#fff;font:700 13px 'Noto Sans JP',sans-serif}
.ppsv2 button{min-height:42px;padding:0 22px;background:#f5f0e2;border:1.5px solid #1b2330;font:700 13px 'Noto Sans JP',sans-serif;border-radius:3px}
.pp-strip{display:flex;gap:8px;width:100%;overflow-x:auto;scrollbar-width:none;padding:8px calc(50% - 25px) calc(10px + var(--sb));scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.pp-strip::-webkit-scrollbar{display:none}
.pp-strip .th{flex:none;width:50px;display:flex;flex-direction:column;align-items:center;gap:4px;background:none;border:0;padding:0;scroll-snap-align:center;transform:scale(var(--s,1));transform-origin:50% 30%;opacity:var(--o,1);transition:transform .2s,opacity .2s}
.pp-strip .th i{display:block;width:38px;height:54px;background:#f5f0e2;border:1px solid #d8cfbb;position:relative;overflow:hidden;transition:transform .25s,box-shadow .25s}
.pp-strip .th b{font:700 9.5px Manrope,sans-serif;color:var(--muted)}
.pp-strip .th.on i{border-color:#1b2330;box-shadow:2px 2px 0 #1f6f5b}
.pp-strip .th.on b{color:#1f6f5b}
.pp-strip .th-art u{position:absolute;left:5px;right:5px;top:12px;height:18px;background:center/cover #ddd}
.pp-strip .th-art:before{content:"";position:absolute;left:5px;top:5px;width:16px;height:2px;background:#1b2330;opacity:.6}
.pp-strip .th-art:after{content:"";position:absolute;right:5px;bottom:5px;width:10px;height:10px;border:1.5px solid var(--tc);border-radius:50%}
.pp-strip .th-req{background:#f4f1e8}.pp-strip .th-req:after{content:"";position:absolute;inset:6px 5px;border:1.5px solid #1f6f5b;border-radius:2px 2px 40% 40%/2px 2px 12% 12%}
.pp-strip .th-id u{position:absolute;left:5px;top:9px;width:11px;height:15px;background:#d6dcd8}.pp-strip .th-id:after{content:"";position:absolute;left:19px;right:5px;top:10px;height:9px;border-top:2px solid #b9c2bd;border-bottom:2px solid #b9c2bd}
.pp-strip .th-nx{display:grid!important;place-items:center;font:700 14px sans-serif;color:#1f6f5b;border-style:dashed!important}
.pp-ctl{display:flex;gap:10px;align-items:center;justify-content:center;padding:10px 16px 8px}
.pp-ctl button{min-width:44px;min-height:44px;border:1.5px solid var(--ink);background:transparent;color:var(--ink);border-radius:3px;font:700 14px 'Noto Sans JP',sans-serif;padding:0 14px}
.pp-ctl button:disabled{opacity:.3}
.pp-ctl span{font:700 12px Manrope,sans-serif;color:var(--muted);min-width:56px;text-align:center}
.pp-ctl .md{font-size:12px}
@media (prefers-reduced-motion:reduce){.pp .leaf.anim,.pp{transition-duration:.01s}.pp .stamp.press{animation:none;opacity:.92}.pp .hint{animation:none}}
`;

const LOGO = `<path d="M606 411H888Q908 411 908 431V532Q908 552 889 560L606 678Z" style="fill:var(--s3)"/><path d="M606 370H835Q855 370 855 390V499Q855 519 836 527L606 612Z" style="fill:var(--s2)"/><path d="M606 328H782Q802 328 802 348V458Q802 478 783 486L606 552Z" style="fill:var(--s1)"/><path d="M364 488H606V784Q606 854 536 854H434Q364 854 364 784Z" style="fill:var(--st)"/><path d="M244 244H680Q742 244 742 306V426Q742 488 680 488H244A122 122 0 0 1 244 244Z" style="fill:var(--b)"/><path d="M648 244H680Q742 244 742 306V426Q742 488 680 488H380Z" style="fill:var(--d)"/>`;
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<filter id="ppink" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="2.2" result="d"/><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="9" result="b"/><feColorMatrix in="b" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -2.2 1.9" result="m"/><feComposite in="d" in2="m" operator="in"/></filter>
<linearGradient id="ppgd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3a6"/><stop offset=".5" stop-color="#b98f3c"/><stop offset="1" stop-color="#f0d58c"/></linearGradient>
<linearGradient id="ppgs" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="80" y2="100"><stop offset="0" stop-color="#f6e3a6"/><stop offset=".5" stop-color="#c39a45"/><stop offset="1" stop-color="#f0d58c"/></linearGradient>
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
// スタンプのインクは国旗の色（その国らしい1色を、インクらしく少し沈めて）
const FLAG = {japan:"#bc002d",korea:"#23408f",china:"#c8261e",taiwan:"#1f3a8a",hongkong:"#c8261e",macau:"#1d7a4f",mongolia:"#c4272f",thai:"#2d2a6e",cambodia:"#1f3f9a",vietnam:"#c8261e",laos:"#1f3f8a",myanmar:"#b8901a",malaysia:"#1a2f7a",singapore:"#c8261e",indonesia:"#c8261e",philippines:"#1c3f9a",brunei:"#b8901a",india:"#d06a16",nepal:"#b0203a",srilanka:"#8d153a",bhutan:"#d4651b",maldives:"#1d7a45",pakistan:"#1d5a2e",bangladesh:"#1d6a4e",kazakhstan:"#1b8fae",kyrgyzstan:"#c8102e",uzbekistan:"#1a8fb3",tajikistan:"#1d7a3f",turkmenistan:"#1d7a3f",georgia:"#c8102e",armenia:"#d2461a",azerbaijan:"#1b8fae",turkey:"#c8102e",qatar:"#8a1538",oman:"#c8102e",saudi:"#1d6a3a",bahrain:"#b0203a",kuwait:"#1d7a3f",iran:"#1d7a3f",iraq:"#c8102e",jordan:"#1d7a3f",israel:"#1f4fa0",lebanon:"#1d7a3f",palestine:"#1d7a3f",egypt:"#c8102e",morocco:"#c1272d",tunisia:"#c8102e",algeria:"#1d7a3f",finland:"#1f4f8f",sweden:"#1f68a7",norway:"#ba0c2f",denmark:"#c8102e",iceland:"#1f52a0",estonia:"#1f6fc0",latvia:"#9e3039",lithuania:"#1d6a44",uk:"#1a2a6c",ireland:"#1d8a52",france:"#1f4fa0",germany:"#2b2b2b",netherlands:"#c8541a",belgium:"#b58c10",luxembourg:"#1f8fc0",switzerland:"#d52b1e",austria:"#c8102e",italy:"#1d7a45",vatican:"#b8901a","san-marino":"#3f8fc0",spain:"#aa151b",portugal:"#1d6a38",andorra:"#1f3f9a",monaco:"#c8102e",greece:"#1f5eaf",cyprus:"#c4701a",malta:"#c8102e",czech:"#1f457e",slovakia:"#1f4ea2",poland:"#dc143c",hungary:"#477050",slovenia:"#1f4fa0",croatia:"#c8102e",bosnia:"#1f3f9a",serbia:"#c6363c",montenegro:"#c8102e",albania:"#c8102e","north-macedonia":"#c8102e",kosovo:"#244aa5",bulgaria:"#1d8a5a",romania:"#1f3f8f",moldova:"#1f3f8f",ukraine:"#1f5bb5",russia:"#1f3f9a",liechtenstein:"#1f3f8f",usa:"#3c3b6e",canada:"#d52b1e",mexico:"#1d6847",cuba:"#1f3f9a",guatemala:"#3f8fc0",belize:"#1f3f8f",honduras:"#1f6fb0","el-salvador":"#1f4fa0",nicaragua:"#1f5fb0",costarica:"#1f2f7a",panama:"#c8102e",jamaica:"#1d8a3f",bahamas:"#1f8fa0","dominican-republic":"#1f2f6a","puerto-rico":"#c8102e",colombia:"#c4950a",ecuador:"#c4950a",peru:"#d91023",bolivia:"#1d7934",chile:"#1f39a6",argentina:"#4a90c8",uruguay:"#1f3f9a",paraguay:"#c8102e",brazil:"#1d8c3b",kenya:"#1d6600",tanzania:"#1d8a3f",ethiopia:"#1d8a3f",uganda:"#2b2b2b",rwanda:"#1f8fc0",ghana:"#1d6a3f",senegal:"#1d8a3f",namibia:"#1f3f9a",botswana:"#4f8fc0",zambia:"#1d7a3f",zimbabwe:"#1d7a3f",madagascar:"#1d7a3f",mauritius:"#c8102e","south-africa":"#1d7749",mozambique:"#1d7a5f",malawi:"#c8102e","cape-verde":"#1f3f9a",seychelles:"#1f3f9a",australia:"#1a2a6c","new-zealand":"#1a2a6c",fiji:"#4f9fc8",samoa:"#c8102e",tonga:"#c8102e",vanuatu:"#1d7a3f",palau:"#2f8fd0","papua-new-guinea":"#c8102e","new-caledonia":"#1f3f9a",tahiti:"#c8102e","cook-islands":"#1a2a6c",hawaii:"#1a3f8a",guam:"#1f3f8a",saipan:"#1f5fb0","timor-leste":"#c8102e",greenland:"#c8102e",antarctica:"#1f6fa0"};
const SHAPES = [ring, rect, oval, hexa], INKS = ["#1f6f5b", "#c8492b", "#2f5fa8", "#6d4fa0", "#b8862a", "#2b6f7a"];
const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };
const inkify = (h) => h.replace(/^<svg([^>]*)>/, '<svg$1><g filter="url(#ppink)">').replace(/<\/svg>$/, "</g></svg>");
function stampHtml(key, label, sub, date, kanji) {
  const h = hash(key), col = FLAG[key] || INKS[(h >>> 3) % INKS.length], r = ((h >>> 6) % 26) - 13;
  const fn = kanji ? eki : SHAPES[h % 4];
  return { html: fn(col, label, sub, date), r };
}


// ---- シェア用の画像（インスタのストーリーと同じ 1080×1920）----
const STORY_FONTS = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Space+Mono:wght@400;700&display=swap";
let STAMP_CSS = null;
// スタンプの絵は画像として描くので、中の英字フォント（latin のみ）を埋め込んでおく
async function stampFontCss() {
  if (STAMP_CSS !== null) return STAMP_CSS;
  try {
    const css = await (await fetch(STORY_FONTS)).text();
    const blocks = css.split("/* ").filter((b) => b.startsWith("latin */"));
    const out = [];
    for (const b of blocks) {
      const m = /url\((https:[^)]+)\)/.exec(b); if (!m) continue;
      const buf = await (await fetch(m[1])).arrayBuffer();
      let bin = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      out.push(b.slice(b.indexOf("@font-face")).replace(m[1], "data:font/woff2;base64," + btoa(bin)));
    }
    STAMP_CSS = out.join("");
  } catch (e) { STAMP_CSS = ""; }
  return STAMP_CSS;
}
const loadImg = (src, cors) => new Promise((ok) => { const im = new Image(); if (cors) im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
const svgImg = (svg) => loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
const INK = DEFS.slice(DEFS.indexOf("<filter"), DEFS.indexOf("</filter>") + 9);
const LOGO_COLOR = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="120 240 792 618"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#244a3b"/><stop offset="1" stop-color="#44916f"/></linearGradient></defs><path d="M606 411H888Q908 411 908 431V532Q908 552 889 560L606 678Z" fill="#c0e6d4"/><path d="M606 370H835Q855 370 855 390V499Q855 519 836 527L606 612Z" fill="#92d3b2"/><path d="M606 328H782Q802 328 802 348V458Q802 478 783 486L606 552Z" fill="#5bbd8a"/><path d="M364 488H606V784Q606 854 536 854H434Q364 854 364 784Z" fill="url(#s)"/><path d="M244 244H680Q742 244 742 306V426Q742 488 680 488H244A122 122 0 0 1 244 244Z" fill="#49976f"/><path d="M648 244H680Q742 244 742 306V426Q742 488 680 488H380Z" fill="#1f3b2e"/></svg>`;
// 字間をあけて1文字ずつ描く（canvas の letterSpacing は iPhone で効かないことがある）
function spaced(c, text, cx, y, sp) {
  const ch = [...text], w = ch.reduce((a, t) => a + c.measureText(t).width, 0) + sp * (ch.length - 1);
  let x = cx - w / 2; ch.forEach((t) => { c.fillText(t, x, y); x += c.measureText(t).width + sp; });
}
async function makeStory(o) {
  await document.fonts.ready;
  const W = 1080, H = 1920, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const c = cv.getContext("2d"); c.textBaseline = "alphabetic";
  c.fillStyle = "#f5f0e2"; c.fillRect(0, 0, W, H);
  const bg = await svgImg(decodeURIComponent(GL.slice(GL.indexOf(",") + 1, -2)));
  if (bg) c.drawImage(bg, 0, 0, W, H);
  // 中身は少し引きで（周りに余白）。ロゴだけはいちばん下に置く
  const S = 0.82; c.save(); c.translate((W * (1 - S)) / 2, 170); c.scale(S, S);
  // 見出し
  c.fillStyle = "#1f6f5b"; c.font = "500 39px Cinzel, serif"; spaced(c, "TABISTOCK PASSPORT", W / 2, 150, 12);
  c.fillStyle = "#1b2330"; c.font = "800 80px 'Shippori Mincho', serif"; c.textAlign = "center";
  const ttl = `${o.name}の旅券`; let fs = 80; while (c.measureText(ttl).width > 900 && fs > 44) { fs -= 4; c.font = `800 ${fs}px 'Shippori Mincho', serif`; }
  c.fillText(ttl, W / 2, 278); c.textAlign = "left";
  // 身分事項
  c.fillStyle = "#fbf8ee"; c.fillRect(84, 354, 912, 396); c.strokeStyle = "#d8cfbb"; c.lineWidth = 3; c.strokeRect(84, 354, 912, 396);
  // Firebase Storage の画像はそのままだと描き込めないので、同じドメインの /api/img を通して読み込む
  const src = /^https:\/\/(firebasestorage\.googleapis\.com|lh3\.googleusercontent\.com)\//.test(o.photo || "") ? "/api/img?u=" + encodeURIComponent(o.photo) : o.photo;
  const ph = src ? await loadImg(src, true) : null;
  c.fillStyle = "#cfd6d2"; c.fillRect(132, 402, 222, 296);
  if (ph) { const r = Math.max(222 / ph.width, 296 / ph.height), w = ph.width * r, h = ph.height * r; c.save(); c.beginPath(); c.rect(132, 402, 222, 296); c.clip(); c.drawImage(ph, 132 + (222 - w) / 2, 402 + (296 - h) / 2, w, h); c.restore(); }
  const lab = (t, y) => { c.fillStyle = "#5d6b63"; c.font = "500 20px 'Noto Sans JP', sans-serif"; c.fillText(t, 402, y); };
  lab("氏名 / Name", 438); c.fillStyle = "#1b2330"; c.font = "800 42px 'Shippori Mincho', serif"; c.fillText(o.name, 402, 488);
  lab("発行年月日 / Date of issue", 542); c.font = "700 44px 'Cormorant Garamond', serif"; c.fillText(o.issued, 402, 590);
  lab("所持人自署 / Signature", 640);
  if (o.sig) { c.save(); c.translate(396, 636); c.scale(1.2, 1.2); c.strokeStyle = "#1b2330"; c.lineWidth = 3.2; c.lineCap = c.lineJoin = "round"; c.stroke(new Path2D(o.sig)); c.restore(); }
  // 数字
  c.strokeStyle = "rgba(31,111,91,.35)"; c.lineWidth = 3; [786, 1044].forEach((y) => { c.beginPath(); c.moveTo(84, y); c.lineTo(996, y); c.stroke(); });
  [[o.countries, "COUNTRIES"], [o.days, "DAYS"], [o.trips, "TRIPS"]].forEach(([n, l], i) => {
    const cx = 84 + 152 + i * 304;
    c.textAlign = "center"; c.fillStyle = "#1f6f5b"; c.font = "700 104px 'Cormorant Garamond', serif"; c.fillText(String(n), cx, 930);
    c.textAlign = "left"; c.fillStyle = "#5d6b63"; c.font = "600 27px Cinzel, serif"; spaced(c, l, cx, 992, 5);
  });
  // スタンプ（国ごとに1つ。多いときは小さく、たくさん並べる）
  const css = await stampFontCss();
  const items = o.stamps, n = items.length;
  if (n) {
    const cols = n <= 4 ? 2 : n <= 9 ? 3 : n <= 16 ? 4 : 5, rows = Math.ceil(n / cols);
    const top = 1080, areaH = 600, cw = 1000 / cols, rh = areaH / rows, sc = Math.min(2.5, (cw / 125) * 1.05, (rh / 100) * 1.1);
    const imgs = await Promise.all(items.map((it) => svgImg(it.html.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/^(<svg[^>]*>)/, `$1<defs><style>${css}</style>${INK}</defs><g filter="url(#ppink)">`).replace(/<\/svg>$/, "</g></svg>"))));
    imgs.forEach((im, i) => {
      if (!im) return; const h = hash(o.seed + i), col = i % cols, row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols);
      const cx = 40 + (1000 / inRow) * (col + 0.5) + ((h % 40) - 20), cy = top + rh * (row + 0.5) + (((h >>> 5) % 30) - 15);
      const w = im.width * sc, hh = im.height * sc;
      c.save(); c.globalAlpha = 0.9; c.translate(cx, cy); c.rotate((items[i].r * Math.PI) / 180); c.drawImage(im, -w / 2, -hh / 2, w, hh); c.restore();
    });
  }
  // 身分事項の右に、表紙裏と同じ朱色の「旅券」の印を1つ押す
  if (o.seal) {
    const si = await svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 120" width="60" height="120"><defs>${INK}</defs>${o.seal}</svg>`);
    if (si) [[868, 560, -4, 2.3, 0.88]].forEach(([x, y, r, k, a]) => {
      const w = 60 * k, h = 120 * k; c.save(); c.globalAlpha = a; c.translate(x, y); c.rotate((r * Math.PI) / 180); c.drawImage(si, -w / 2, -h / 2, w, h); c.restore();
    });
  }
  c.restore();
  // ロゴ（Tのマーク＋Tabistock）
  const [lg, wm] = await Promise.all([svgImg(LOGO_COLOR), loadImg("./img/wordmark.png")]);
  const lh = 66, lw = lh * (792 / 618), wh = 54, ww = wm ? wm.width * (wh / wm.height) : 0, gap = 20, tot = lw + gap + ww, x0 = (W - tot) / 2;
  if (lg) c.drawImage(lg, x0, 1830 - lh, lw, lh);
  if (wm) c.drawImage(wm, x0 + lw + gap, 1830 - wh - 2, ww, wh);
  return await new Promise((ok) => cv.toBlob(ok, "image/png"));
}

// パスポートで使うフォントを先に読み込む（開いた瞬間に文字がズレないように）
let FONT_P = null;
export function warmFonts() {
  if (FONT_P) return FONT_P;
  FONT_P = new Promise((ok) => {
    const lk = document.createElement("link"); lk.rel = "stylesheet"; lk.href = FONTS;
    lk.onload = () => {
      const F = ["500 26px Cinzel", "600 12px 'Shippori Mincho'", "800 18px 'Shippori Mincho'", "500 30px 'Shippori Mincho'", "700 12px 'Cormorant Garamond'", "400 14px 'Pinyon Script'", "400 9px 'Space Mono'", "700 9px 'Space Mono'"];
      Promise.all(F.map((f) => document.fonts.load(f, "TABISTOCK PASSPORT 旅券 査証 0123"))).then(ok, ok);
    };
    lk.onerror = ok;
    document.head.appendChild(lk);
  });
  return FONT_P;
}

export function pagePassport(el, ctx) {
  const { esc, bar, haptic, cinfo, fmtPeriod, profile: p = {}, arts: all = [], created, loadSig, saveSig } = ctx;
  if (!document.getElementById("ppcss")) { const st = document.createElement("style"); st.id = "ppcss"; st.textContent = CSS; document.head.appendChild(st); }
  const fontsReady = warmFonts();
  // 公開中の記事を、旅の日付の古い順に
  const tkey = (d) => d.dateStart || (d.createdAt && new Date(d.createdAt.seconds * 1000).toISOString().slice(0, 10)) || "";
  const arts = all.filter((d) => d.status === "published").sort((a, b) => tkey(a).localeCompare(tkey(b)));
  const dot = (s) => (s ? s.replace(/-/g, ".") : "");
  const period = (d) => (d.dateStart && d.dateEnd ? fmtPeriod(d.dateStart, d.dateEnd).replace(" - ", " – ") : dot(d.dateStart));
  const daysOf = (d) => { if (d.dateStart && d.dateEnd) { const n = Math.round((new Date(d.dateEnd) - new Date(d.dateStart)) / 864e5) + 1; if (n > 0 && n < 400) return n; } return (d.days || []).length || 0; };
  const micro = "TABISTOCK·旅券·PASSPORT·".repeat(14);
  const foot = `<div class="micro">${micro}</div>`;
  const wm = `<svg class="ppwm" viewBox="0 0 100 78"><use href="#pplogo" width="100" height="78" style="--b:#d9bd73;--d:#b39445;--st:#c9aa5c;--s1:rgba(217,189,115,.7);--s2:rgba(217,189,115,.45);--s3:rgba(217,189,115,.25)"/></svg>`;
  // 表紙の「旅」「券」：日本のパスポートの篆書を写真からトレースしたもの
  const G_RYO = { vb: "0 0 342 408", d: "M317.5 402.1C313.4 399.6 311.4 397.2 309.2 392.0C307.1 387.1 306.9 382.8 305.5 266.0C304.6 194.0 302.9 171.7 297.5 159.4C295.4 154.7 294.8 154.0 292.2 154.0C285.6 154.0 285.1 156.1 284.4 187.0C283.7 218.3 283.7 209.0 284.4 303.4C285.1 399.4 285.6 393.1 276.4 399.0C270.7 402.6 269.0 402.7 263.3 399.9C253.7 395.3 253.9 396.9 253.5 315.0C253.3 276.2 252.9 228.5 252.6 209.0C251.6 144.3 252.3 149.8 244.4 143.4C236.6 137.0 234.9 130.2 239.3 122.6C244.1 114.2 250.3 112.7 278.7 113.2C296.9 113.5 297.7 113.6 302.5 116.2C305.2 117.7 309.1 119.4 311.0 120.1C314.8 121.5 328.4 134.0 330.5 138.0C334.4 145.5 336.0 171.4 336.5 234.0C337.8 387.2 337.7 393.6 335.4 396.7C330.3 403.5 323.3 405.7 317.5 402.1ZM214.0 401.7C209.4 400.1 206.5 395.4 205.0 387.3C203.7 380.1 203.5 368.1 202.5 253.6C202.0 188.2 201.8 183.4 200.0 178.3C197.0 169.8 194.8 166.5 192.0 166.5C187.3 166.5 187.0 168.7 186.4 212.7C185.7 260.8 185.7 262.6 185.8 284.0C185.9 293.1 185.9 302.5 185.9 305.0C185.9 307.5 186.0 319.6 186.1 332.0C186.4 356.7 185.3 383.4 183.8 389.3C182.1 396.3 172.1 399.3 164.0 395.2C157.9 392.2 157.7 391.1 156.9 353.5C156.4 334.8 155.8 315.4 155.5 310.5C155.2 305.6 154.7 276.5 154.4 246.0C154.0 215.5 153.7 183.1 153.6 174.0C153.3 153.5 152.7 151.4 145.0 145.5C133.7 136.8 132.7 121.8 143.0 116.5C147.8 114.0 182.7 113.2 190.1 115.4C207.1 120.3 222.2 136.9 226.8 155.5C229.7 167.1 234.0 212.1 233.7 227.5C233.7 229.7 234.0 256.5 234.5 287.0C235.0 317.5 235.4 343.9 235.4 345.7C235.4 347.4 234.8 352.0 234.0 355.9C232.9 361.6 232.9 364.3 233.9 369.9C237.7 391.1 227.9 406.7 214.0 401.7ZM110.5 396.7C108.0 395.3 105.8 393.0 104.5 390.5C102.3 386.1 102.3 388.0 101.5 250.0C101.2 185.6 100.8 176.2 98.0 168.3C94.2 157.5 74.6 130.9 69.4 129.6C63.1 128.0 51.3 138.3 45.9 150.0C44.7 152.5 42.0 158.1 39.9 162.5C34.3 174.0 34.0 176.8 34.9 209.4C35.3 225.8 35.3 240.3 34.8 242.9C34.3 245.4 34.2 249.5 34.6 252.0C35.9 260.4 35.8 384.2 34.5 387.5C31.6 395.0 21.2 399.7 15.2 396.4C7.1 392.0 5.0 383.9 5.6 359.8C6.3 334.0 6.3 276.3 5.6 267.0C4.2 249.1 4.2 189.9 5.5 178.5C8.2 155.3 20.6 129.4 38.0 110.4C52.8 94.3 56.5 85.4 50.7 80.4C47.8 77.9 46.8 77.7 31.0 76.0C16.6 74.5 13.7 73.6 10.1 69.5C1.0 59.1 8.7 46.2 24.0 46.0C46.6 45.7 49.8 43.3 53.1 23.7C55.0 12.3 59.3 8.0 68.8 8.0C77.3 8.0 81.0 12.0 82.0 22.6C82.5 27.0 83.5 32.2 84.3 34.1C85.6 37.2 91.1 43.0 92.8 43.0C93.2 43.0 98.8 43.7 105.2 44.4C121.8 46.4 127.0 50.1 127.0 60.0C127.0 69.1 122.7 72.5 108.7 74.6C94.9 76.7 91.4 80.0 91.6 90.8C91.7 95.8 92.4 98.4 95.0 103.3C98.8 110.5 111.1 129.2 117.3 137.2C123.2 144.7 128.0 156.4 129.6 167.3C130.9 176.1 132.6 274.7 132.2 315.0C132.1 320.2 132.1 327.2 132.2 330.5C132.3 333.8 132.2 339.6 132.0 343.5C131.8 347.4 132.0 356.6 132.4 364.0C134.0 391.0 133.4 393.5 125.7 397.1C120.2 399.6 115.4 399.5 110.5 396.7ZM152.7 80.8C147.7 79.4 142.4 74.2 141.6 69.6C139.6 59.2 150.9 51.1 165.4 52.4C168.7 52.8 178.2 52.7 186.4 52.2C201.2 51.4 201.2 51.4 204.1 48.2C207.7 44.2 208.9 39.6 209.1 29.2C209.5 12.8 211.4 8.6 219.6 5.4C230.4 1.3 240.7 7.8 241.1 19.1C241.2 21.5 241.2 27.6 241.0 32.7C240.7 43.1 241.7 45.7 247.3 48.7C250.1 50.3 253.9 50.5 279.7 50.7C310.6 50.9 312.1 51.1 316.4 55.8C318.8 58.5 319.7 69.4 317.8 72.9C313.6 80.9 305.1 81.7 223.0 81.8C179.6 81.8 155.2 81.5 152.7 80.8Z" };
  const G_KEN = { vb: "0 0 362 408", d: "M18.0 402.2C11.6 399.0 10.4 395.4 11.0 380.0C11.5 364.0 11.6 337.1 11.0 324.5C10.8 319.6 10.7 310.8 10.8 305.0C10.8 299.2 10.8 292.7 10.8 290.5C10.6 250.8 11.3 231.6 13.2 220.0C16.2 201.2 17.3 199.0 38.6 167.8C47.4 154.8 48.9 150.6 50.0 135.0C51.4 116.5 52.2 113.8 61.8 96.8C69.7 82.6 80.0 73.0 94.7 65.8C100.6 63.0 108.4 58.7 111.9 56.3C123.4 48.7 131.3 48.1 137.7 54.5C144.4 61.2 141.7 69.6 130.8 75.5C127.9 77.1 123.3 79.9 120.6 81.7C118.0 83.5 115.2 85.0 114.6 85.0C113.0 85.0 102.6 92.3 97.6 96.9C92.5 101.6 88.0 108.7 88.0 112.0C88.0 115.3 91.8 119.0 95.2 119.0C99.3 119.0 110.5 114.5 116.7 110.3C119.9 108.2 129.2 103.8 137.3 100.5C161.2 90.9 166.6 85.3 168.5 68.0C168.8 65.0 169.5 58.9 170.1 54.5C170.9 48.9 170.9 44.8 170.2 41.0C166.7 22.6 177.3 -0.2 187.0 5.0C190.1 6.7 192.4 14.2 191.1 18.3C190.1 21.4 190.3 23.0 192.5 30.4C194.9 38.1 195.1 40.2 194.7 50.3C193.8 71.5 196.4 82.3 204.4 89.8C208.5 93.8 237.1 113.0 244.1 116.5C247.0 118.0 250.8 120.3 252.5 121.6C254.2 122.8 258.0 124.9 261.0 126.3C264.0 127.6 270.4 131.6 275.1 135.2C288.1 145.0 299.9 149.0 304.8 145.3C308.0 142.9 310.0 137.6 309.2 133.5C308.4 129.1 290.3 112.1 280.0 106.0C277.0 104.3 271.7 100.4 268.2 97.5C264.6 94.6 260.6 91.9 259.3 91.5C257.9 91.2 255.2 89.8 253.1 88.5C251.1 87.1 247.0 85.3 244.1 84.4C237.3 82.4 227.0 72.9 227.0 68.7C227.0 61.2 232.6 55.0 239.3 55.0C247.8 55.0 284.3 75.5 296.5 87.1C300.0 90.5 305.2 94.1 309.2 95.9C318.0 100.1 328.9 111.5 333.6 121.5C337.8 130.3 338.9 147.8 335.7 153.8C334.7 155.6 333.4 161.1 332.9 166.0C331.7 176.5 332.2 178.2 339.8 188.5C345.4 196.3 348.1 203.3 350.3 216.0C351.2 220.7 352.6 226.2 353.4 228.2C355.3 232.6 355.5 240.4 353.9 248.2C352.9 252.9 353.0 254.6 354.5 258.9C356.3 264.3 357.7 323.5 357.0 366.9C356.8 385.0 356.7 385.4 353.7 391.9C348.2 404.0 342.8 407.1 337.7 401.0C331.8 394.0 330.7 381.7 334.0 358.5C335.0 351.3 335.0 347.4 334.0 339.0C333.2 332.5 332.8 319.3 332.9 304.5C333.1 291.3 333.2 278.7 333.2 276.5C333.2 261.7 330.8 234.1 329.0 229.9C328.0 227.4 326.6 222.4 326.0 218.7C324.3 207.8 322.5 204.7 314.7 199.5C307.9 194.9 303.8 194.9 295.7 199.4C287.7 203.8 275.1 206.5 266.4 205.5C258.8 204.7 233.3 192.2 220.6 183.1C216.1 179.9 209.3 175.4 205.5 173.0C190.5 164.0 186.2 155.7 192.6 148.1C198.1 141.5 208.2 143.0 222.7 152.7C228.1 156.3 233.8 160.5 235.5 162.0C243.1 169.1 257.8 173.0 262.7 169.3C266.5 166.6 266.6 164.9 263.4 161.1C259.4 156.4 241.7 143.4 237.3 142.0C230.3 139.7 220.6 133.6 215.5 128.3C212.8 125.5 207.6 121.5 204.0 119.4C200.4 117.4 195.5 114.5 193.0 113.1C184.0 107.9 173.0 110.1 158.5 120.0C152.7 124.0 144.8 127.8 137.0 130.4C133.3 131.7 128.7 133.9 126.9 135.3C125.0 136.7 119.0 140.1 113.4 142.9C95.9 151.7 88.4 162.3 95.8 168.0C101.6 172.6 112.8 168.9 133.0 155.5C149.3 144.7 153.1 143.1 158.9 144.9C167.4 147.4 171.8 155.4 168.5 162.3C164.1 171.6 140.4 187.2 116.5 196.5C105.5 200.8 104.6 201.0 94.7 201.0C83.6 201.0 84.1 201.2 69.5 193.1C58.7 187.1 49.7 194.3 42.0 215.0C38.9 223.2 38.8 224.0 38.5 241.5C38.4 251.4 38.8 264.6 39.3 270.8C40.1 279.1 40.0 284.9 39.2 292.3C38.5 297.9 38.0 308.8 38.1 316.5C38.3 356.1 37.6 386.6 36.3 390.6C32.4 402.1 26.0 406.2 18.0 402.2ZM90.5 401.1C85.9 399.0 84.4 396.9 83.0 390.3C81.6 384.4 83.4 364.9 86.1 356.8C87.1 353.6 89.3 345.9 91.0 339.6C95.8 321.3 105.0 300.7 114.9 286.2C135.0 256.7 135.3 248.2 115.9 246.8C106.2 246.0 101.6 242.1 101.6 234.6C101.6 223.3 115.0 217.0 134.8 219.0C140.1 219.6 161.8 220.2 183.0 220.3C227.0 220.7 229.6 221.1 246.7 229.5C262.1 237.1 272.3 247.5 275.0 258.3C275.6 260.6 277.0 265.8 278.1 269.9C279.6 274.9 280.1 278.9 279.7 282.4C279.4 285.4 279.8 289.5 280.7 292.4C281.5 295.1 281.9 298.7 281.6 300.2C281.3 301.8 281.5 305.2 282.0 307.7C282.6 310.2 283.0 316.8 282.9 322.4C282.6 338.7 282.6 343.1 282.8 349.5C283.7 369.9 283.0 387.3 281.2 391.4C274.7 406.1 259.3 404.5 255.0 388.8C254.3 386.5 254.0 373.3 254.2 355.3C254.8 286.3 254.6 283.7 249.2 273.0C240.1 254.8 233.3 250.8 209.7 249.3C184.3 247.7 183.4 248.1 166.2 265.8C159.4 272.8 151.6 281.9 148.7 286.0C145.9 290.1 142.0 295.5 140.1 298.0C138.1 300.5 135.6 304.6 134.6 307.0C133.6 309.5 129.6 318.2 125.8 326.5C119.1 341.3 114.0 356.6 114.0 362.5C114.0 364.1 113.1 369.3 112.0 374.0C110.9 378.7 109.7 384.6 109.4 387.2C108.2 398.2 98.8 405.0 90.5 401.1ZM9.0 79.5C-0.1 74.6 4.0 60.8 16.9 52.6C20.6 50.2 24.7 47.9 26.1 47.5C31.2 45.9 45.1 37.7 49.9 33.4C54.8 29.0 60.9 25.8 70.6 22.6C73.4 21.7 78.5 18.9 82.0 16.5C95.3 7.1 106.0 10.4 106.0 23.9C106.0 30.0 103.1 33.9 95.6 37.7C92.8 39.1 88.7 41.5 86.5 43.0C84.3 44.4 74.0 49.9 63.5 55.0C53.0 60.1 42.5 66.0 40.0 68.1C35.1 72.2 17.0 81.0 13.6 81.0C12.4 80.9 10.4 80.3 9.0 79.5ZM335.5 65.3C333.0 64.7 317.7 58.0 308.5 53.5C300.9 49.7 290.3 45.6 285.5 44.5C283.9 44.2 280.9 42.9 279.0 41.6C277.1 40.4 269.6 37.5 262.4 35.2C255.2 32.9 248.6 30.2 247.6 29.2C242.7 23.7 244.2 15.4 250.8 11.6C254.1 9.7 254.1 9.7 265.8 14.5C272.2 17.2 280.4 20.4 284.0 21.7C287.6 23.1 291.3 24.9 292.3 25.8C293.4 26.8 296.1 27.4 299.3 27.5C303.8 27.7 306.0 28.6 315.5 34.3C321.6 38.0 327.3 41.0 328.2 41.0C336.5 41.0 350.0 50.1 350.0 55.7C350.0 63.3 344.0 67.3 335.5 65.3Z" };
  const glyph = (g) => `<svg viewBox="${g.vb}"><path d="${g.d}" fill="url(#ppgd)" fill-rule="evenodd"/></svg>`;
  const glyphC = (g, c) => `<svg viewBox="${g.vb}"><path d="${g.d}" fill="${c}" fill-rule="evenodd"/></svg>`;
  // ---- 表紙の裏（日本の旅券の「要請文」のページを Tabistock 風に） ----
  const G1 = "#1f6f5b", G2 = "#174f41";
  const curl = (x, y, sx, sy) => `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="${G2}" stroke-linecap="round"><path d="M0 0C14 -2 26 6 26 18C26 28 16 32 10 26C5 21 9 14 15 16" stroke-width="2.2"/><path d="M4 6C12 6 19 11 19 18" stroke-width=".9"/><path d="M0 0C-2 14 6 26 18 28" stroke-width="1.6"/><path d="M26 18C34 14 42 16 46 24C40 22 34 24 32 30" stroke-width="1.3"/><path d="M18 28C16 36 20 44 28 46C26 40 28 34 34 32" stroke-width="1.3"/><circle cx="13" cy="20" r="2.2" fill="${G2}" stroke="none"/></g>`;
  // 壺のような形の枠（上が広く、中ほどでくびれ、下でまた広がる）
  const VASE = "M34 40H266Q268 150 242 188Q224 212 242 238Q268 272 268 400H32Q32 272 58 238Q76 212 58 188Q32 150 34 40Z";
  const REQ_FRAME = `<svg class="frm" viewBox="0 0 300 426" preserveAspectRatio="none"><defs><pattern id="pphat" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3" stroke="${G1}" stroke-width=".9" stroke-opacity=".55"/></pattern><clipPath id="ppvase"><path d="${VASE}"/></clipPath></defs>
    <path d="${VASE}" fill="none" stroke="url(#pphat)" stroke-width="12"/>
    <path d="${VASE}" fill="none" stroke="${G2}" stroke-width="1.1" transform="translate(150 220) scale(1.03 1.012) translate(-150 -220)"/>
    <path d="${VASE}" fill="none" stroke="${G2}" stroke-width=".7" transform="translate(150 220) scale(.965 .988) translate(-150 -220)"/>
    <rect x="62" y="30" width="176" height="27" rx="13.5" fill="url(#pphat)"/><rect x="62" y="30" width="176" height="27" rx="13.5" fill="none" stroke="${G2}" stroke-width="1"/><rect x="74" y="34" width="152" height="19" rx="9.5" fill="#f4f1e8" stroke="${G2}" stroke-width=".6"/>
    <path d="M70 61H230" stroke="${G2}" stroke-width=".6" stroke-dasharray="2 2"/>
    ${curl(30, 34, 1, 1)}${curl(270, 34, -1, 1)}${curl(270, 400, -1, -1)}
  </svg>`;
  // 朱印：縦長の枠に「旅」「券」
  const SEAL = `<g filter="url(#ppink)"><rect x="3" y="3" width="54" height="114" rx="4" fill="none" stroke="#d65a2e" stroke-width="4"/><g transform="translate(10 12) scale(${40 / 342})"><path d="${G_RYO.d}" fill="#d65a2e" fill-rule="evenodd"/></g><g transform="translate(9 64) scale(${42 / 362})"><path d="${G_KEN.d}" fill="#d65a2e" fill-rule="evenodd"/></g></g>`;
  // 左下のメダル（ロゴの透かし入り）
  const MEDAL = `<g><circle cx="50" cy="50" r="47" fill="none" stroke="${G2}" stroke-width="1.4"/>${Array.from({ length: 72 }, (_, i) => { const a = i * 5 * Math.PI / 180; return `<path d="M${(50 + 40 * Math.cos(a)).toFixed(1)} ${(50 + 40 * Math.sin(a)).toFixed(1)}L${(50 + 46 * Math.cos(a)).toFixed(1)} ${(50 + 46 * Math.sin(a)).toFixed(1)}" stroke="${G1}" stroke-width=".8"/>`; }).join("")}<circle cx="50" cy="50" r="39" fill="url(#pphat)" stroke="${G2}" stroke-width="1"/><circle cx="50" cy="50" r="30" fill="#f4f1e8" stroke="${G2}" stroke-width=".8"/><use href="#pplogo" x="30" y="35" width="40" height="31" style="--b:${G1};--d:${G2};--st:${G1};--s1:rgba(31,111,91,.6);--s2:rgba(31,111,91,.4);--s3:rgba(31,111,91,.22)"/></g>`;
  const emblem = `<svg class="em" viewBox="0 0 100 78"><use href="#pplogo" width="100" height="78" style="--b:url(#ppgd);--d:#6e511d;--st:url(#ppgd2);--s1:rgba(226,196,120,.8);--s2:rgba(226,196,120,.5);--s3:rgba(226,196,120,.28)"/></svg>`;
  const chip = `<svg viewBox="0 0 60 40"><g fill="none" stroke="#d9bd73" stroke-width="2.4"><rect x="2" y="2" width="56" height="36" rx="3"/><circle cx="30" cy="20" r="9"/><path d="M2 20h19M39 20h19"/></g></svg>`;

  // 見開きの左：タイトル・期間・トップの写真（最大3枚、枠なしでテープ留め）
  // 記事1本＝1ページ：タイトル・期間・トップの写真（最大3枚、テープ留め）・その旅のスタンプ
  const PH = { 1: [[18, 32, 60, -3]], 2: [[7, 32, 46, -5], [48, 36, 45, 4]], 3: [[8, 31, 40, -5], [52, 32, 40, 5], [29, 43, 40, 2]] };
  function stampsOf(d) {
    const date = dot(d.dateStart) || "";
    const n = daysOf(d);
    const cs = (d.countries || []).filter((v) => v !== "japan");
    const prefs = (d.prefectures || []);
    let items = cs.map((v) => { const c = cinfo(v) || {}; return stampHtml(v, String(c.en || v).toUpperCase(), n ? `${n} DAYS` : "", date); });
    if (!cs.length) items = (prefs.length ? prefs : ["日本"]).map((x) => stampHtml(x, x, "", date, true));
    if (items.length === 1 && cs.length) items.push({ html: rect("#3a4a5c", "DEPARTED", "JAPAN", date), r: -4 });
    return items;
  }
  // スタンプはページの下の方に、少し重なるくらいに散らして押す
  function stampLayer(items, seed) {
    const n = items.length, cols = n <= 2 ? 2 : 3, rows = Math.ceil(n / cols);
    const z = n <= 2 ? 1.02 : n <= 3 ? 0.9 : Math.max(0.56, 0.9 - (rows - 1) * 0.18);
    const top0 = 66, band = 26;
    return items.map((it, i) => {
      const h = hash(seed + i), row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
      const x = (100 / inRow) * col + (inRow === 1 ? 26 : 2) + (h % 7) - 3;
      const y = top0 + (band / rows) * row + ((h >>> 4) % 6) - 3;
      return `<div class="stamp" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;zoom:${z.toFixed(2)};--r:rotate(${it.r}deg);transform:rotate(${it.r}deg)">${inkify(it.html)}</div>`;
    }).join("");
  }
  function artPage(d, k, pno) {
    const imgs = (d.heroUrls && d.heroUrls.length ? d.heroUrls : [d.thumbUrl]).filter(Boolean).slice(0, 3);
    const P = PH[imgs.length] || [];
    const phs = imgs.map((u, i) => { const [x, y, w, r] = P[i]; return `<div class="snap" style="left:${x}%;top:${y}%;width:${w}%;transform:rotate(${r}deg)"><i style="background-image:url('${esc(u)}')"></i><span class="tp t1"></span><span class="tp t2"></span></div>`; }).join("");
    const cs0 = (d.countries || []).find((v) => v !== "japan");
    return { pno, kind: "art", img: imgs[0] || "", col: (cs0 && FLAG[cs0]) || "#1f6f5b", html: `<div class="pphd"><span>VISA<b>査証</b></span><i>No.${String(k + 1).padStart(2, "0")}</i></div>
      <div class="ttl"><h3>${esc(d.title || "")}</h3><p>${esc(period(d))}<a class="open-a" href="#a-${esc(d.id)}">記事を見る</a></p></div>${phs}<div class="stz">${stampLayer(stampsOf(d), d.id || String(k))}</div>${foot}` };
  }

  const ascii = (s) => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
  const name = ascii(p.nameEn || p.nickname) || "TRAVELER";
  const no = "TS" + ascii(ctx.me).slice(0, 7).padEnd(7, "0");
  const mrz = (`P<JPN${name}<<`).padEnd(44, "<").slice(0, 44) + "\n" + (`${no}<0JPN${(created || "").replace(/-/g, "").slice(2, 8) || "000000"}<`).padEnd(42, "<") + "04";
  const issued = created ? new Date(created + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "—";
  const countries = new Set(arts.flatMap((d) => d.countries || [])); // 日本もひとつの国として数える
  const totalDays = arts.reduce((s, d) => s + daysOf(d), 0);
  const tags = Array.isArray(p.tags) ? p.tags.slice(0, 3).join("・") : "";

  // 表紙（0）、表紙の裏（1）のあとは、ページを左右交互に並べる
  const PAGES = [];
  PAGES.push({ pno: "1", kind: "id", html: `<div class="pphd"><span>PASSPORT<b>旅券</b></span><i>${esc(no)}</i></div><div class="row"><div class="pic"></div><div class="fs">
      <div><div class="f">型 / Type　　発行 / Issuing</div><div class="v">P　　TABISTOCK</div></div>
      <div><div class="f">氏名 / Name</div><div class="v j">${esc(p.nickname || "旅人")}</div></div>
      ${tags ? `<div><div class="f">旅のスタイル / Style</div><div class="v j">${esc(tags)}</div></div>` : ""}
      <div><div class="f">発行年月日 / Date of issue</div><div class="v">${esc(issued)}</div></div><div class="ppsig" data-sig><div class="f">所持人自署 / Signature</div><div class="ppsv"></div></div></div></div>
      <div class="ppst"><div><b>${countries.size}</b><span>行った国</span></div><div><b>${totalDays}</b><span>旅した日数</span></div><div><b>${arts.length}</b><span>旅の記録</span></div></div>
      <div class="mrz">${esc(mrz)}</div><div class="lam"></div>${foot}` });
  arts.forEach((d, k) => PAGES.push(artPage(d, k, String(2 + k))));
  PAGES.push({ pno: String(2 + arts.length), kind: "next", html: `<div class="pphd"><span>VISA<b>査証</b></span><i>No.${String(arts.length + 1).padStart(2, "0")}</i></div>
      <div class="slot"><div>次の旅は、ここに。<small>記事を投稿すると<br>新しいページが増えていきます</small><a href="#p">旅程を投稿する</a></div></div>${foot}` });
  const faces = [
    `<div class="face ppfr leather cover"><div class="cj" style="left:35%" aria-label="旅">${glyph(G_RYO)}</div><div class="cj" style="left:65%" aria-label="券">${glyph(G_KEN)}</div>${emblem}<div class="ct2" aria-label="TABISTOCK PASSPORT"><svg viewBox="0 0 168 66"><g fill="url(#ppgd)" font-family="Cinzel,'Cormorant Garamond',serif" font-weight="500"><text x="0" y="22" font-size="26" textLength="168" lengthAdjust="spacing">TABISTOCK</text><text x="0" y="62" font-size="23" textLength="168" lengthAdjust="spacing">PASSPORT</text></g></svg></div><div class="ppchip">${chip}</div><div class="hint">タップして開く</div></div>`,
    `<div class="face ppbk paper req">${REQ_FRAME}
      <div class="rq-ban">${glyphC(G_RYO, G2)}${glyphC(G_KEN, G2)}</div>
      <p class="rq-jp"><span>旅を愛する本旅券の所持人を</span><span>通路故障なく旅行させ、かつ、</span><span>出会った景色と人を記録できる</span><span>よう、関係の諸君に要請する。</span></p>
      <svg class="rq-seal" viewBox="0 0 60 120">${SEAL}</svg>
      <div class="rq-by">Tabistock 旅券局</div>
      <p class="rq-en">Tabistock requests all those whom it may concern to allow the bearer, a curious traveler, to pass freely and without hindrance, and to keep every landscape and encounter.</p>
      <svg class="rq-med" viewBox="0 0 100 100">${MEDAL}</svg></div>`,
  ];
  PAGES.forEach((pg, i) => { const side = faces.length % 2 ? "ppbk" : "ppfr"; faces.push(`<div class="face ${side} paper"><div class="pno">${pg.pno}</div>${pg.html}</div>`); });
  const K = faces.length - 1; // 中身のある最後の面
  faces.push(`<div class="face ${faces.length % 2 ? "ppbk" : "ppfr"} leather endp">${wm}</div>`);
  if (faces.length % 2) faces.push(`<div class="face ppbk leather endp"></div>`);
  const N = faces.length / 2, LAST = Math.floor((K + 1) / 2);
  let leavesHtml = "";
  for (let i = 0; i < N; i++) leavesHtml += `<div class="leaf" style="z-index:${100 - i}">${faces[i * 2]}${faces[i * 2 + 1]}</div>`;

  // 下に並べる全ページの小さな一覧（タップでそのページへ）
  const THUMBS = [`<button class="th" data-f="1" aria-label="表紙の裏"><i class="th-req"></i><b>表紙裏</b></button>`]
    .concat(PAGES.map((pg, i) => {
      const f = 2 + i;
      const inner = pg.kind === "art" ? `<i class="th-art" style="--tc:${pg.col}">${pg.img ? `<u style="background-image:url('${esc(pg.img)}')"></u>` : ""}</i>`
        : pg.kind === "id" ? `<i class="th-id"><u></u></i>` : `<i class="th-nx">＋</i>`;
      return `<button class="th" data-f="${f}" aria-label="${pg.pno}ページ">${inner}<b>${pg.kind === "next" ? "次の旅" : pg.pno}</b></button>`;
    })).join("");
  el.innerHTML = bar("Tabistock パスポート", `<button class="ppsh" id="ppShare" aria-label="シェア"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-6.5"/></svg></button>`) + `<div class="ps under2 ppw">${DEFS}
    <div class="pp-stage"><div class="pp-in" id="ppIn"><div class="pp" id="ppBook" style="--ppgl:${GL.replace(/"/g, "&quot;")};--ppme:url('${esc(p.photoURL || "")}')"><div class="base"><div class="face leather endp">${wm}</div></div><div class="gut"></div>${leavesHtml}</div></div></div>
    <div class="pp-strip" id="ppStrip">${THUMBS}</div></div>`;

  const book = el.querySelector("#ppBook");
  const leaves = [...book.querySelectorAll(".leaf")];
  const inner = el.querySelector("#ppIn"), hint = book.querySelector(".hint");
  // 写真は最初にまとめて読み込んでデコードしておく（めくった瞬間に読み込みで止まらないように）
  book.querySelectorAll(".snap i").forEach((i) => { const m = /url\('?([^')]+)'?\)/.exec(i.style.backgroundImage); if (m) { const im = new Image(); im.src = m[1]; if (im.decode) im.decode().catch(() => {}); } });
  // 登場：フォントがそろってから、手前に傾いた状態でふわっと置かれる（読み込みが遅くても2秒で出す）
  const START = "translateY(55vh) rotateX(16deg) scale(.94)";
  inner.style.opacity = "0"; inner.style.transform = START;
  Promise.all([Promise.race([fontsReady, new Promise((r) => setTimeout(r, 2000))]), new Promise((r) => setTimeout(r, el.classList.contains("ppg") ? 1050 : 480))]).then(() => {
    // 1度だけ見えない位置で描かせてから動かす（最初のコマで描画が詰まってカクつくのを防ぐ）
    inner.style.opacity = "0.01";
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const an = inner.animate([{ transform: START, opacity: 0 }, { transform: "translateY(-10px) rotateX(-2deg) scale(1.01)", opacity: 1, offset: 0.72 }, { transform: "none", opacity: 1 }], { duration: 2100, easing: "cubic-bezier(.2,.75,.25,1)", fill: "forwards" });
      an.onfinish = () => { inner.style.opacity = ""; inner.style.transform = ""; an.cancel(); };
    }));
  });

  book.querySelectorAll(".paper .stamp").forEach((s) => s.classList.add("wait"));
  let idx = 0, zoom = false, sd = "L", busy = false;
  const buzz = () => { try { haptic && haptic(); } catch (e) {} };
  const fit = () => { const W = book.offsetWidth || 320; book.style.setProperty("--pps", Math.min(1, (innerWidth - 20) / (2 * W)).toFixed(3)); };
  const pnoOf = (f) => (f && f.querySelector(".pno") ? f.querySelector(".pno").textContent : "");
  const rightContent = () => 2 * idx <= K;
  // 寄っているのは左ページか右ページか（最後に右が裏表紙なら左だけ）
  const side = () => (idx === LAST && !rightContent() ? "L" : sd);
  const pageL = () => (idx > 0 ? leaves[idx - 1].children[1] : null);
  const pageR = () => (idx < N ? leaves[idx].children[0] : null);
  const label = () => {
    if (idx === 0) return "表紙";
    const L = pnoOf(pageL()), R = rightContent() ? pnoOf(pageR()) : "";
    if (zoom) return side() === "L" ? L : R;
    return [L, R].filter(Boolean).join("–");
  };
  // 一覧：横にスクロールでき、真ん中から離れるほど小さく薄く見える
  let stripLock = 0, fluttering = false;
  function stripLook() {
    const st = el.querySelector("#ppStrip"); if (!st) return;
    const mid = st.scrollLeft + st.clientWidth / 2;
    st.querySelectorAll(".th").forEach((b) => { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid) / 58; b.style.setProperty("--s", Math.max(0.5, 1 - d * 0.17).toFixed(3)); b.style.setProperty("--o", Math.max(0.12, 1 - d * 0.3).toFixed(3)); });
  }
  function centerStrip(f) {
    const st = el.querySelector("#ppStrip"); if (!st) return;
    const b = st.querySelector(`.th[data-f="${f}"]`); if (!b) return;
    stripLock = Date.now();
    st.scrollTo({ left: b.offsetLeft + b.offsetWidth / 2 - st.clientWidth / 2, behavior: "smooth" });
  }
  const render = () => {
    fit();
    // 次にめくる・見えてくるページを先にGPUへ載せておく（めくり始めの引っかかりを防ぐ）
    // 前後のページだけGPUに載せ、離れたページは描かない（重なって見えないので、描くだけ無駄）
    if (!fluttering) leaves.forEach((l, i) => { l.style.willChange = i >= idx - 1 && i <= idx + 1 ? "transform" : ""; l.style.visibility = i >= idx - 2 && i <= idx + 2 ? "" : "hidden"; });
    book.classList.toggle("shift", idx > 0 && !zoom);
    book.classList.toggle("open", idx > 0 && !zoom);
    book.classList.toggle("one", idx > 0 && zoom);
    book.classList.toggle("lft", idx > 0 && zoom && side() === "L");
    // 下の一覧：今のページを真ん中までスクロールして、印を付ける
    const cur = idx === 0 ? [] : zoom ? [side() === "L" ? 2 * idx - 1 : 2 * idx] : [2 * idx - 1, 2 * idx].filter((f) => f <= K);
    el.querySelectorAll("#ppStrip .th").forEach((b) => b.classList.toggle("on", cur.includes(+b.dataset.f)));
    centerStrip(cur.length ? cur[0] : 1);
  };
  // 寄ったページのスタンプを1つずつ押す
  const press = (f) => { let k = 0; if (f) f.querySelectorAll(".stamp.wait").forEach((s) => { const d = 250 + 320 * k++; setTimeout(() => { s.classList.remove("wait"); s.classList.add("press"); buzz(); }, d); }); return k; };
  // ---- 署名：初めて開くときに指で署名してもらい、身分事項ページに載せる ----
  let sig = null, sigAsked = false;
  const sigSvg = (d) => `<svg viewBox="0 0 300 110" preserveAspectRatio="xMinYMid meet"><path d="${esc(d)}" fill="none" stroke="#1b2330" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const showSig = () => { const v = el.querySelector(".ppsv"); if (v) v.innerHTML = sig ? sigSvg(sig) : "<em>タップして署名する</em>"; };
  Promise.resolve(loadSig ? loadSig() : "").then((d) => { sig = d || ""; showSig(); }).catch(() => { sig = ""; showSig(); });
  function openSign(after) {
    sigAsked = true;
    const ov = document.createElement("div"); ov.className = "ppsign";
    ov.innerHTML = `<div><h3>パスポートに署名してください</h3><p>この署名は、パスポートの身分事項のページに載ります。指で書いてください。</p>
      <div class="pad"><canvas></canvas><i></i><b>×</b></div>
      <div class="acts"><button class="re" type="button">書き直す</button><button class="go" type="button" disabled>署名する</button></div>
      <button class="skip" type="button">あとで</button></div>`;
    el.querySelector(".ppw").appendChild(ov);
    const cv = ov.querySelector("canvas"), cx = cv.getContext("2d"), go = ov.querySelector(".go");
    const dpr = Math.min(3, devicePixelRatio || 1); const R = cv.getBoundingClientRect();
    cv.width = R.width * dpr; cv.height = R.height * dpr; cx.scale(dpr, dpr);
    cx.lineCap = cx.lineJoin = "round"; cx.strokeStyle = "#1b2330"; cx.lineWidth = 2.6;
    const SX = 300 / R.width, SY = 110 / R.height; let strokes = [], cur = null;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener("pointerdown", (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [pt(e)]; strokes.push(cur); });
    cv.addEventListener("pointermove", (e) => { if (!cur) return; const q = pt(e), l = cur[cur.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 1.5) return; cur.push(q); cx.beginPath(); cx.moveTo(l[0], l[1]); cx.lineTo(q[0], q[1]); cx.stroke(); go.disabled = false; });
    const end = () => { if (cur && cur.length === 1) { const [x, y] = cur[0]; cx.beginPath(); cx.arc(x, y, 1.3, 0, 7); cx.fillStyle = "#1b2330"; cx.fill(); go.disabled = false; } cur = null; };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    const toPath = () => strokes.map((s) => { const P = s.map(([x, y]) => [+(x * SX).toFixed(1), +(y * SY).toFixed(1)]); if (P.length === 1) return `M${P[0][0]} ${P[0][1]}l.1 0`; let d = `M${P[0][0]} ${P[0][1]}`; for (let i = 1; i < P.length - 1; i++) { const m = [((P[i][0] + P[i + 1][0]) / 2).toFixed(1), ((P[i][1] + P[i + 1][1]) / 2).toFixed(1)]; d += `Q${P[i][0]} ${P[i][1]} ${m[0]} ${m[1]}`; } const L = P[P.length - 1]; return d + `L${L[0]} ${L[1]}`; }).join("");
    const close = () => { ov.remove(); if (after) after(); };
    ov.querySelector(".re").onclick = () => { strokes = []; cx.clearRect(0, 0, R.width, R.height); go.disabled = true; };
    ov.querySelector(".skip").onclick = close;
    go.onclick = async () => { const d = toPath(); if (!d) return; go.disabled = true; sig = d; showSig(); buzz(); try { if (saveSig) await saveSig(d); } catch (e) {} close(); };
  }
  // 1枚めくる（dir=1で次、-1で前）。ページが少し浮き上がりながら、ゆっくり回る
  const FT = 1350, FT_COVER = 1800, ZT = 950;
  function flip(dir, done, dur = FT, lift = 18) {
    const i = dir > 0 ? idx : idx - 1; const l = leaves[i];
    if (dir < 0) { l.classList.remove("flat"); l.classList.add("on"); void l.offsetWidth; }
    l.style.zIndex = 300; l.classList.add("turn");
    const A = "rotateY(0deg)", B = "rotateY(-180deg)";
    const k = dir > 0
      ? [{ transform: A }, { transform: `rotateY(-35deg) translateZ(${lift * 0.7}px)`, offset: 0.25 }, { transform: `rotateY(-95deg) translateZ(${lift}px)`, offset: 0.55 }, { transform: B }]
      : [{ transform: B }, { transform: `rotateY(-145deg) translateZ(${lift * 0.7}px)`, offset: 0.25 }, { transform: `rotateY(-85deg) translateZ(${lift}px)`, offset: 0.55 }, { transform: A }];
    const an = l.animate(k, { duration: dur, easing: "cubic-bezier(.45,.05,.3,1)", fill: "forwards" });
    idx += dir; render(); buzz();
    an.onfinish = () => {
      l.classList.toggle("on", dir > 0); if (dir > 0) l.classList.add("flat");
      l.classList.remove("turn"); l.style.zIndex = dir > 0 ? 200 + i : 100 - i;
      an.cancel(); // 最後の形をクラスに引き継いでから外す（1コマだけ元に戻るガタつきを防ぐ）
      if (done) done();
    };
  }
  const zoomIn = (to, done) => { sd = to; zoom = true; render(); setTimeout(() => { busy = false; if (done) done(); }, ZT); };
  const ZT_OUT = 1500; // 引くときは、ゆっくり
  const zoomOut = (done) => { if (!zoom) return done(); book.style.transitionDuration = ZT_OUT + "ms"; zoom = false; render(); setTimeout(() => { book.style.transitionDuration = ""; done(); }, ZT_OUT); };
  // 次へ：左に寄っている → 右に寄る／右に寄っている → 引いて見開き → めくる → 左に寄る（寄ったらスタンプが押される）
  function next() {
    if (busy) return;
    if (idx === 0) {
      if (sig === "" && !sigAsked) return openSign(() => next());
      busy = true; hint.classList.add("gone");
      // 表紙を開く：少し持ち上げてから、ゆっくり開いて見開き → 左ページに寄る
      inner.animate([{ transform: "none" }, { transform: "translateY(-6px) scale(1.02)" }, { transform: "none" }], { duration: 900, easing: "ease-in-out" });
      return setTimeout(() => flip(1, () => setTimeout(() => zoomIn("L", () => press(pageL())), 650), FT_COVER, 34), 280);
    }
    if (zoom && side() === "L" && rightContent()) { busy = true; buzz(); return zoomIn("R", () => press(pageR())); }
    if (idx >= LAST) return;
    busy = true;
    zoomOut(() => flip(1, () => setTimeout(() => zoomIn("L", () => press(pageL())), 380)));
  }
  // 前へ：右に寄っている → 左に寄る／左に寄っている → 引いてめくり戻す → 右に寄る（表紙なら閉じたまま）
  function prev() {
    if (busy || idx === 0) return;
    if (zoom && side() === "R") { busy = true; buzz(); return zoomIn("L"); }
    busy = true;
    zoomOut(() => flip(-1, () => { if (idx === 0) { busy = false; hint.classList.remove("gone"); render(); } else setTimeout(() => zoomIn(rightContent() ? "R" : "L"), 380); }, idx === 1 ? FT_COVER : FT));
  }
  // 閉じる：引きの見開きにしてから、パラパラっとページが戻って表紙が閉じる
  // パラパラめくる：from → to の見開きまで、ページを少しずつずらして一気にめくる
  function flutter(to, done) {
    const dir = to > idx ? 1 : -1; let list = [];
    if (dir > 0) for (let i = idx; i < to; i++) list.push(i); else for (let i = idx - 1; i >= to; i--) list.push(i);
    // パラパラ中は、ページの下準備（GPUへの載せ替え）を切り替えない。途中で切り替えると写真が残像のように残る
    fluttering = true;
    // 通り過ぎるページと、着いた先で左右に見えるページを先に表示しておく（あとから出ると一瞬遅れて見える）
    for (let i = Math.max(0, Math.min(idx, to) - 2); i <= Math.min(N - 1, Math.max(idx, to) + 2); i++) leaves[i].style.visibility = "";
    // ページが多いときは、めくって見せるのは最後の8枚まで（ほかは先にそっと移しておく）
    const MAXA = 8, skip = list.length > MAXA ? list.slice(0, list.length - MAXA) : [];
    skip.forEach((i) => { const l = leaves[i]; if (dir > 0) { l.classList.add("on", "flat"); l.style.zIndex = 200 + i; } else { l.classList.remove("on", "flat"); l.style.zIndex = 100 - i; } });
    list = list.slice(skip.length);
    // 1枚がちょうど半分（真横）まで来たら次の1枚をめくり始める。重なって見えないので、ページがちゃんと1枚ずつ送られて見える
    const D = 640, DC = 1300, ease = "cubic-bezier(.45,0,.55,1)";
    let t = 0;
    list.forEach((i, k) => {
      const cover = i === 0, dur = cover ? DC : D;
      setTimeout(() => {
        const l = leaves[i];
        if (dir < 0) { l.classList.remove("flat"); l.classList.add("on"); }
        l.style.zIndex = 400 + k;
        if (cover && to === 0) { idx = 0; render(); }
        const A = "rotateY(0deg)", B = "rotateY(-180deg)";
        const an = l.animate([{ transform: dir > 0 ? A : B }, { transform: `rotateY(-90deg) translateZ(${cover ? 26 : 12}px)` }, { transform: dir > 0 ? B : A }], { duration: dur, easing: ease, fill: "forwards" });
        an.onfinish = () => { if (dir > 0) { l.classList.add("on", "flat"); l.style.zIndex = 200 + i; } else { l.classList.remove("on"); l.style.zIndex = 100 - i; } an.cancel(); };
        buzz();
      }, t);
      if (k < list.length - 1) t += dur * 0.5;
      else t += dur;
    });
    if (to !== 0) { idx = to; render(); }
    setTimeout(() => { fluttering = false; render(); done(); }, t + 40);
  }

  // 閉じる：引きの見開きにしてから、パラパラっとページが戻って表紙が閉じる
  function closeAll(after) {
    if (busy || idx === 0) return; busy = true;
    zoomOut(() => flutter(0, () => { busy = false; hint.classList.remove("gone"); if (after) setTimeout(after, 250); }));
  }
  // 一覧からページへ：引いて、パラパラめくって、そのページに寄る
  function jumpTo(f) {
    if (busy) return;
    const t = Math.ceil(f / 2), sideT = f % 2 ? "L" : "R";
    if (t === idx) { if (!(zoom && sd === sideT)) { busy = true; zoomIn(sideT, () => press(sideT === "L" ? pageL() : pageR())); } return; }
    if (idx === 0 && sig === "" && !sigAsked) return openSign(() => jumpTo(f));
    busy = true; hint.classList.add("gone");
    zoomOut(() => flutter(t, () => setTimeout(() => zoomIn(sideT, () => press(sideT === "L" ? pageL() : pageR())), 300)));
  }
  // シェア：ストーリー用の画像を作って、共有シート（使えないときは保存用の画面）を出す
  el.querySelector("#ppShare").onclick = async (e) => {
    const b = e.currentTarget; if (b.disabled) return; b.disabled = true; buzz();
    const toastEl = document.createElement("div"); toastEl.className = "ppmk"; toastEl.textContent = "シェア用の画像を作っています…"; el.appendChild(toastEl);
    try {
      const stamps = [...countries].map((v) => { const ci = cinfo(v) || {}; const first = arts.find((d) => (d.countries || []).includes(v)); return stampHtml(v, String(ci.en || v).toUpperCase(), "", dot(first && first.dateStart) || ""); });
      if (!stamps.length) { const prefs = [...new Set(arts.flatMap((d) => d.prefectures || []))]; prefs.forEach((x) => stamps.push(stampHtml(x, x, "", "", true))); }
      const blob = await makeStory({ name: p.nickname || "旅人", photo: p.photoURL || "", issued, sig, countries: countries.size, days: totalDays, trips: arts.length, stamps, seed: ctx.me || "", seal: SEAL });
      toastEl.remove();
      const file = new File([blob], "tabistock-passport.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch (er) {} }
      else {
        const url = URL.createObjectURL(blob), ov = document.createElement("div"); ov.className = "ppsv2";
        ov.innerHTML = `<div><img src="${url}" alt="シェア用の画像"><p>画像を長押しして保存してください</p><button type="button">閉じる</button></div>`;
        ov.querySelector("button").onclick = () => { ov.remove(); URL.revokeObjectURL(url); };
        el.querySelector(".ppw").appendChild(ov);
      }
    } catch (er) { toastEl.textContent = "画像を作れませんでした"; setTimeout(() => toastEl.remove(), 1800); }
    b.disabled = false;
  };
  el.querySelector("#ppStrip").addEventListener("click", (e) => { const b = e.target.closest(".th"); if (b) jumpTo(+b.dataset.f); });
  { const st = el.querySelector("#ppStrip"); let raf = 0; st.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; stripLook(); }); }, { passive: true }); requestAnimationFrame(stripLook); }
  // 「‹ パスポート」で戻るときは、閉じるアニメーションのあとでマイページへ
  el.addEventListener("click", (e) => {
    if (!e.target.closest("[data-back]") || idx === 0) return;
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    closeAll(() => history.back());
  }, true);
  let sx = 0, sy = 0;
  book.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; });
  book.addEventListener("pointerup", (e) => {
    if (e.target.closest("a,button")) return;
    if (e.target.closest("[data-sig]") && idx > 0 && !busy) { openSign(); return; }
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { dx < 0 ? next() : prev(); return; }
    if (idx === 0) next(); else if (e.clientX < innerWidth / 2) prev(); else next();
  });
  addEventListener("resize", render);
  render();
  return () => removeEventListener("resize", render);
}
