// 投稿（申請）した直後に出す「ありがとう」演出（post.html / post-transit.html から使う）
// 1. 投稿ありがとうございます！承認後に公開されます
// 2. スマホの見本で「共有 → ストーリー画像を作成 → Instagram → ストーリーズ」の操作を見せる
// 全員同じ内容。動画ファイルは使わず HTML/CSS の動きだけで作っている。

const CSS = `
.pt{position:fixed;inset:0;z-index:3000;background:#fbf9f4;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px calc(24px + env(safe-area-inset-bottom));font-family:"Noto Sans JP",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;color:#1b2330;opacity:0;transition:opacity .3s ease;overflow:hidden}
.pt.on{opacity:1}
.pt-skip{position:absolute;top:calc(env(safe-area-inset-top) + 12px);right:14px;border:none;background:none;font:inherit;font-size:13px;font-weight:700;color:#6c7787;padding:8px;cursor:pointer}

/* 1. ありがとう */
.pt-thanks{display:flex;flex-direction:column;align-items:center;text-align:center;transition:opacity .4s ease,transform .5s cubic-bezier(.2,.7,.2,1)}
.pt-check{width:76px;height:76px}
.pt-check circle{fill:none;stroke:#1f6f5b;stroke-width:4;stroke-dasharray:226;stroke-dashoffset:226;animation:ptDraw .7s .15s ease forwards}
.pt-check path{fill:none;stroke:#1f6f5b;stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:60;animation:ptDraw .4s .75s ease forwards}
.pt-thanks h2{margin:18px 0 6px;font-size:22px;font-weight:900;opacity:0;animation:ptUp .5s .9s ease forwards}
.pt-thanks p{margin:0;font-size:13.5px;color:#4b5563;line-height:1.7;opacity:0;animation:ptUp .5s 1.1s ease forwards}
.pt.step2 .pt-thanks{transform:translateY(-6px) scale(.86);margin-bottom:6px}
.pt.step2 .pt-check{width:44px;height:44px}
.pt.step2 .pt-thanks h2{font-size:17px;margin-top:8px}
.pt.step2 .pt-thanks p{display:none}

/* 2. スマホの見本 */
.pt-demo{display:none;flex-direction:column;align-items:center;opacity:0;transition:opacity .4s ease}
.pt.step2 .pt-demo{display:flex}
.pt.step2.show .pt-demo{opacity:1}
.pt-lead{margin:0 0 12px;font-size:13px;font-weight:800;color:#1f6f5b;letter-spacing:.02em}
.pt-phone{position:relative;width:216px;height:432px;border-radius:34px;background:#1b2330;padding:9px;box-shadow:0 18px 40px rgba(27,35,48,.22)}
.pt-screen{position:relative;width:100%;height:100%;border-radius:26px;overflow:hidden;background:#fbf9f4}
.pt-notch{position:absolute;top:7px;left:50%;transform:translateX(-50%);width:62px;height:16px;border-radius:10px;background:#1b2330;z-index:9}
.pt-cap{margin:14px 0 0;min-height:42px;font-size:13.5px;font-weight:700;text-align:center;line-height:1.55;transition:opacity .25s}
.pt-cap b{display:inline-block;min-width:20px;height:20px;line-height:20px;border-radius:6px;background:#1f6f5b;color:#fff;font-size:11.5px;margin-right:6px;vertical-align:1px}

/* 画面の中身（記事ページ） */
.pt-art{position:absolute;inset:0;padding:30px 12px 0}
.pt-hero{height:118px;border-radius:10px;background:linear-gradient(150deg,#2f9e7f,#1f6f5b 55%,#e2683b);position:relative}
.pt-hero::after{content:"";position:absolute;left:12px;bottom:12px;width:62%;height:10px;border-radius:3px;background:rgba(255,255,255,.85)}
.pt-line{height:8px;border-radius:3px;background:#e9dcc6;margin-top:10px}
.pt-line.s{width:70%}.pt-line.t{width:45%}
.pt-acts{position:absolute;left:12px;right:12px;bottom:58px;display:flex;justify-content:center;gap:6px}
.pt-acts span{flex:1;height:30px;border-radius:7px;border:1px solid #e9dcc6;background:#fff;font-size:10px;font-weight:800;color:#4b5563;display:flex;align-items:center;justify-content:center}
.pt-acts .share{background:#1f6f5b;border-color:#1f6f5b;color:#fff}

/* 下から出るメニュー（Tabistockの共有メニュー） */
.pt-sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:16px 16px 0 0;padding:8px 10px 18px;box-shadow:0 -6px 20px rgba(0,0,0,.15);transform:translateY(105%);transition:transform .35s cubic-bezier(.2,.7,.2,1);z-index:3}
.pt-sheet.on{transform:none}
.pt-grip{width:30px;height:3px;border-radius:2px;background:#e0d8c7;margin:2px auto 8px}
.pt-row{display:flex;align-items:center;gap:8px;padding:10px 8px;border-radius:8px;font-size:10.5px;font-weight:700;color:#1b2330}
.pt-row i{width:16px;height:16px;border-radius:4px;background:#eaf4f0;flex:none}
.pt-row.hl{background:#eaf4f0}
.pt-dim{position:absolute;inset:0;background:rgba(15,20,18,.4);opacity:0;transition:opacity .3s;z-index:2}
.pt-dim.on{opacity:1}

/* スマホの共有画面（アプリを選ぶ） */
.pt-os{position:absolute;left:0;right:0;bottom:0;background:#f2f2f4;border-radius:16px 16px 0 0;padding:10px 10px 20px;transform:translateY(105%);transition:transform .35s cubic-bezier(.2,.7,.2,1);z-index:5}
.pt-os.on{transform:none}
.pt-os-prev{display:flex;align-items:center;gap:8px;padding:2px 2px 10px;border-bottom:1px solid #e1e1e6}
.pt-os-prev .img{width:30px;height:52px;border-radius:5px;background:linear-gradient(170deg,#2f9e7f,#1f6f5b 60%,#e2683b)}
.pt-os-prev .tx{font-size:9.5px;font-weight:700;color:#1b2330;line-height:1.4}
.pt-os-prev .tx small{display:block;font-weight:500;color:#8a8f98}
.pt-apps{display:flex;justify-content:space-between;padding:12px 4px 0}
.pt-app{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:8px;color:#1b2330;width:42px;white-space:nowrap;letter-spacing:-.02em}
.pt-app i{width:36px;height:36px;border-radius:9px;display:block}
.pt-app.ig i{background:radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285aeb 90%)}
.pt-app.line i{background:#06c755}
.pt-app.msg i{background:#34c759}
.pt-app.more i{background:#fff;border:1px solid #e1e1e6}
.pt-app.hl i{outline:2px solid #1f6f5b;outline-offset:2px}

/* Instagram：どこに共有するか */
.pt-ig{position:absolute;inset:0;background:#000;z-index:6;opacity:0;transition:opacity .3s;display:flex;flex-direction:column;justify-content:flex-end}
.pt-ig.on{opacity:1}
.pt-ig-prev{position:absolute;top:34px;left:50%;transform:translateX(-50%);width:120px;height:214px;border-radius:10px;background:linear-gradient(170deg,#2f9e7f,#1f6f5b 60%,#e2683b)}
.pt-ig-prev::before{content:"Tabistock";position:absolute;top:12px;left:0;right:0;text-align:center;font-weight:900;font-size:11px;color:#fff}
.pt-ig-prev::after{content:"";position:absolute;left:14px;right:14px;bottom:22px;height:8px;border-radius:3px;background:rgba(255,255,255,.85)}
.pt-ig-sheet{position:relative;background:#262626;border-radius:16px 16px 0 0;padding:12px 10px 18px;transform:translateY(105%);transition:transform .35s cubic-bezier(.2,.7,.2,1)}
.pt-ig.sheet .pt-ig-sheet{transform:none}
.pt-ig-row{padding:9px 8px;border-radius:8px;font-size:10.5px;font-weight:700;color:#fff}
.pt-ig-row.hl{background:#3a3a3a}

/* 完了 */
.pt-done{position:absolute;inset:0;z-index:7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:rgba(0,0,0,.55);opacity:0;transition:opacity .3s;color:#fff;font-size:11.5px;font-weight:800}
.pt-done.on{opacity:1}
.pt-done span{width:38px;height:38px;border-radius:50%;background:#fff;color:#1f6f5b;display:flex;align-items:center;justify-content:center;font-size:20px}

/* 指 */
.pt-finger{position:absolute;left:0;top:0;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(27,35,48,.28);border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);z-index:20;opacity:0;transition:transform .6s cubic-bezier(.4,0,.2,1),opacity .3s}
.pt-finger.on{opacity:1}
.pt-finger.tap{animation:ptTap .35s ease}
.pt-ripple{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:2px solid rgba(31,111,91,.6);z-index:19;pointer-events:none;animation:ptRipple .5s ease forwards}

/* ボタン */
.pt-btns{display:flex;flex-direction:column;gap:8px;width:100%;max-width:300px;margin-top:16px;opacity:0;pointer-events:none;transition:opacity .4s}
.pt-btns.on{opacity:1;pointer-events:auto}
.pt-btns button{border:none;border-radius:8px;padding:13px;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
.pt-go{background:#1f6f5b;color:#fff}
.pt-again{background:#efebe4;color:#1b2330}

@keyframes ptDraw{to{stroke-dashoffset:0}}
@keyframes ptUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ptTap{50%{transform:var(--pos) scale(.75)}}
@keyframes ptRipple{from{transform:scale(.6);opacity:1}to{transform:scale(2.2);opacity:0}}
@media (max-height:640px){.pt-phone{transform:scale(.85);margin:-32px 0}}
@media (prefers-reduced-motion:reduce){.pt *{animation-duration:.01s!important;animation-delay:0s!important;transition-duration:.01s!important}}
`;

const HTML = `
<button class="pt-skip" type="button">スキップ</button>
<div class="pt-thanks">
  <svg class="pt-check" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="36"/><path d="M24 41l11 11 21-23"/></svg>
  <h2>投稿ありがとうございます！</h2>
  <p>管理者の承認後に公開されます。<br>公開まで少しだけお待ちください。</p>
</div>
<div class="pt-demo">
  <p class="pt-lead">公開されたら、インスタでシェアしよう</p>
  <div class="pt-phone"><div class="pt-screen">
    <span class="pt-notch"></span>
    <div class="pt-art">
      <div class="pt-hero"></div>
      <div class="pt-line"></div><div class="pt-line s"></div><div class="pt-line t"></div>
      <div class="pt-acts"><span>♡</span><span>保存</span><span class="share" data-t="share">共有</span></div>
    </div>
    <div class="pt-dim"></div>
    <div class="pt-sheet">
      <div class="pt-grip"></div>
      <div class="pt-row" data-t="story"><i></i>ストーリー画像を作成（インスタ向け）</div>
      <div class="pt-row"><i></i>リンクをコピー</div>
      <div class="pt-row"><i></i>他のアプリで共有</div>
    </div>
    <div class="pt-os">
      <div class="pt-os-prev"><span class="img"></span><span class="tx">tabistock-story.jpg<small>画像</small></span></div>
      <div class="pt-apps">
        <span class="pt-app ig" data-t="ig"><i></i>Instagram</span>
        <span class="pt-app line"><i></i>LINE</span>
        <span class="pt-app msg"><i></i>メッセージ</span>
        <span class="pt-app more"><i></i>その他</span>
      </div>
    </div>
    <div class="pt-ig">
      <div class="pt-ig-prev"></div>
      <div class="pt-ig-sheet">
        <div class="pt-ig-row" data-t="stories">ストーリーズ</div>
        <div class="pt-ig-row">リール</div>
        <div class="pt-ig-row">フィード</div>
        <div class="pt-ig-row">メッセージ</div>
      </div>
    </div>
    <div class="pt-done"><span>✓</span>ストーリーズでシェア！</div>
    <span class="pt-finger"></span>
  </div></div>
  <p class="pt-cap"></p>
</div>
<div class="pt-btns">
  <button class="pt-go" type="button">マイページへ</button>
  <button class="pt-again" type="button">もう一度見る</button>
</div>`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

export function showPostThanks({ onDone } = {}){
  if(!document.getElementById("ptCss")){
    const st = document.createElement("style");
    st.id = "ptCss"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  const el = document.createElement("div");
  el.className = "pt";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-label", "投稿ありがとうございます");
  el.innerHTML = HTML;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => el.classList.add("on"));

  const $ = (s) => el.querySelector(s);
  const screen = $(".pt-screen"), finger = $(".pt-finger"), cap = $(".pt-cap");
  let run = 0; // 「もう一度見る」で前の再生を止めるための番号

  const finish = () => {
    run++;
    el.classList.remove("on");
    document.body.style.overflow = "";
    setTimeout(() => { el.remove(); if(onDone) onDone(); }, 300);
  };
  $(".pt-skip").addEventListener("click", finish);
  $(".pt-go").addEventListener("click", finish);

  // 指を画面内の要素の真ん中へ動かして、タップする
  const moveTo = (sel) => {
    const t = $(`[data-t="${sel}"]`);
    const a = screen.getBoundingClientRect(), b = t.getBoundingClientRect();
    const k = a.width / screen.offsetWidth || 1; // 小さい画面で縮小表示しているときの補正
    const x = (b.left + b.width / 2 - a.left) / k, y = (b.top + b.height / 2 - a.top) / k;
    finger.style.setProperty("--pos", `translate(${x}px,${y}px)`);
    finger.style.transform = `translate(${x}px,${y}px)`;
    return { x, y, t };
  };
  const tap = ({ x, y, t }) => {
    finger.classList.remove("tap"); void finger.offsetWidth; finger.classList.add("tap");
    const r = document.createElement("span");
    r.className = "pt-ripple"; r.style.left = x + "px"; r.style.top = y + "px";
    screen.appendChild(r); setTimeout(() => r.remove(), 520);
    t.classList.add("hl");
  };
  const say = (n, text) => {
    cap.style.opacity = "0";
    setTimeout(() => { cap.innerHTML = `<b>${n}</b>${text}`; cap.style.opacity = "1"; }, 200);
  };
  const reset = () => {
    ["pt-dim", "pt-sheet", "pt-os", "pt-done"].forEach(c => $("." + c).classList.remove("on"));
    $(".pt-ig").classList.remove("on", "sheet");
    el.querySelectorAll(".hl").forEach(x => x.classList.remove("hl"));
    finger.classList.remove("on");
    finger.style.transform = "translate(108px,330px)";
    $(".pt-btns").classList.remove("on");
  };

  const demo = async () => {
    const me = ++run;
    const alive = () => me === run && el.isConnected;
    reset();
    await wait(500); if(!alive()) return;
    finger.classList.add("on");
    say(1, "記事ページの「共有」をタップ");
    await wait(500); if(!alive()) return;
    let p = moveTo("share"); await wait(700); if(!alive()) return; tap(p);
    await wait(500); if(!alive()) return;
    $(".pt-dim").classList.add("on"); $(".pt-sheet").classList.add("on");
    say(2, "「ストーリー画像を作成」を選ぶ");
    await wait(700); if(!alive()) return;
    p = moveTo("story"); await wait(750); if(!alive()) return; tap(p);
    await wait(550); if(!alive()) return;
    $(".pt-os").classList.add("on");
    say(3, "共有先で「Instagram」を選ぶ");
    await wait(750); if(!alive()) return;
    p = moveTo("ig"); await wait(750); if(!alive()) return; tap(p);
    await wait(550); if(!alive()) return;
    $(".pt-ig").classList.add("on");
    await wait(350); if(!alive()) return;
    $(".pt-ig").classList.add("sheet");
    say(4, "「ストーリーズ」を選んで完成！");
    await wait(700); if(!alive()) return;
    p = moveTo("stories"); await wait(750); if(!alive()) return; tap(p);
    await wait(500); if(!alive()) return;
    finger.classList.remove("on");
    $(".pt-done").classList.add("on");
    await wait(600); if(!alive()) return;
    $(".pt-btns").classList.add("on");
  };
  $(".pt-again").addEventListener("click", demo);

  (async () => {
    await wait(2600);
    if(!el.isConnected) return;
    el.classList.add("step2");
    await wait(60);
    el.classList.add("show");
    demo();
  })();
}
