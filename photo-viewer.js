// 記事ページの写真まわり（articles/view.html から使う）
// 1. 写真をタップすると全画面で表示（横スワイプで次の写真、×／背景／Escで閉じる）
// 2. 記事トップの縦写真は、枠に全体を収めて左右をぼかした同じ写真で埋める

const CSS = `
.pv{position:fixed;inset:0;z-index:2000;background:#0b0d0f;display:flex;flex-direction:column;opacity:0;transition:opacity .2s ease}
.pv.on{opacity:1}
.pv-track{flex:1;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.pv-track::-webkit-scrollbar{display:none}
.pv-slide{flex:0 0 100%;height:100%;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;padding:56px 0 calc(48px + env(safe-area-inset-bottom));box-sizing:border-box}
.pv-slide img{max-width:100%;max-height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none}
.pv-close{position:absolute;top:calc(env(safe-area-inset-top) + 10px);right:12px;width:42px;height:42px;border:none;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:24px;line-height:1;cursor:pointer;z-index:2}
.pv-count{position:absolute;top:calc(env(safe-area-inset-top) + 20px);left:50%;transform:translateX(-50%);color:#fff;font:700 14px/1 "Manrope","Noto Sans JP",sans-serif;letter-spacing:.06em;z-index:2}
.pv-nav{position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;border:none;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;font-size:26px;line-height:1;cursor:pointer;display:none;z-index:2}
.pv-prev{left:16px}.pv-next{right:16px}
@media (hover:hover) and (min-width:769px){.pv-nav{display:block}.pv-nav:disabled{opacity:.25;cursor:default}}
body.pv-lock{overflow:hidden}
.hero-images img,.photo-slider img{cursor:zoom-in}
`;

function injectCss(){
  if(document.getElementById("pvCss")) return;
  const st = document.createElement("style");
  st.id = "pvCss"; st.textContent = CSS;
  document.head.appendChild(st);
}

function openViewer(urls, start){
  const pv = document.createElement("div");
  pv.className = "pv";
  pv.setAttribute("role", "dialog");
  pv.setAttribute("aria-label", "写真");
  pv.innerHTML =
    `<div class="pv-track">${urls.map(u => `<div class="pv-slide"><img alt=""></div>`).join("")}</div>` +
    `<span class="pv-count"></span>` +
    `<button class="pv-close" type="button" aria-label="閉じる">×</button>` +
    (urls.length > 1 ? `<button class="pv-nav pv-prev" type="button" aria-label="前の写真">‹</button><button class="pv-nav pv-next" type="button" aria-label="次の写真">›</button>` : "");
  // src は属性に文字列で入れず、プロパティで設定する（URLにどんな文字が入っていても安全）
  pv.querySelectorAll(".pv-slide img").forEach((img, i) => { img.src = urls[i]; });
  document.body.appendChild(pv);
  document.body.classList.add("pv-lock");

  const track = pv.querySelector(".pv-track");
  const count = pv.querySelector(".pv-count");
  const prev = pv.querySelector(".pv-prev"), next = pv.querySelector(".pv-next");
  const cur = () => Math.round(track.scrollLeft / track.clientWidth);
  const paint = () => {
    const i = cur();
    count.textContent = urls.length > 1 ? `${i + 1} / ${urls.length}` : "";
    if(prev) prev.disabled = i <= 0;
    if(next) next.disabled = i >= urls.length - 1;
  };
  const go = (i) => track.scrollTo({ left: Math.max(0, Math.min(urls.length - 1, i)) * track.clientWidth, behavior: "smooth" });

  track.scrollLeft = start * track.clientWidth;
  paint();
  requestAnimationFrame(() => pv.classList.add("on"));

  let raf = 0;
  track.addEventListener("scroll", () => { if(!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); });
  if(prev) prev.addEventListener("click", () => go(cur() - 1));
  if(next) next.addEventListener("click", () => go(cur() + 1));

  const close = () => {
    document.removeEventListener("keydown", onKey);
    pv.classList.remove("on");
    document.body.classList.remove("pv-lock");
    setTimeout(() => pv.remove(), 200);
  };
  const onKey = (e) => {
    if(e.key === "Escape") close();
    else if(e.key === "ArrowLeft") go(cur() - 1);
    else if(e.key === "ArrowRight") go(cur() + 1);
  };
  document.addEventListener("keydown", onKey);
  pv.querySelector(".pv-close").addEventListener("click", close);
  // 写真の外側（黒い部分）をタップしても閉じる
  track.addEventListener("click", (e) => { if(e.target.classList.contains("pv-slide")) close(); });
}

// 写真タップで全画面表示。記事トップは記事トップの写真だけ、DAYはその日の写真だけを順に見られる
export function initPhotoViewer(root){
  injectCss();
  root.addEventListener("click", (e) => {
    const img = e.target.closest(".hero-images img, .photo-slider img");
    if(!img || !img.getAttribute("src")) return;
    const group = img.closest(".hero-images, .photo-slider");
    const imgs = [...group.querySelectorAll("img")].filter(i => i.getAttribute("src"));
    openViewer(imgs.map(i => i.currentSrc || i.src), Math.max(0, imgs.indexOf(img)));
  });
}

// 記事トップの縦写真：全体を収めて、左右は同じ写真のぼかしで埋める
export function fitHeroPortraits(root){
  root.querySelectorAll(".hero-images > img").forEach(img => {
    const check = () => {
      if(!img.naturalWidth || img.naturalHeight <= img.naturalWidth * 1.05) return;
      const wrap = document.createElement("div");
      wrap.className = "hero-ph";
      wrap.style.backgroundImage = `url("${String(img.currentSrc || img.src).replace(/["\\]/g, "\\$&")}")`;
      img.parentNode.insertBefore(wrap, img);
      wrap.appendChild(img);
    };
    if(img.complete) check(); else img.addEventListener("load", check, { once: true });
  });
}
