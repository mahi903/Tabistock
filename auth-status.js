// ログイン状態をドロワー内の #authStatus に表示（全ページ共通）。
// 記事ページ(/articles/)からは ../ で account.html へ繋ぐ。
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, query, where, orderBy, limit, onSnapshot, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const base = location.pathname.includes("/articles/") ? "../" : "./";

// PWA: Service Worker を登録（インストール可能化＋静的ファイル高速化）。
// ルート(/sw.js)に置いてあるので scope はサイト全体。失敗してもページ動作には影響しない。
// 新バージョンを検知したら「更新」トーストを出し、タップで即時反映する。
if ("serviceWorker" in navigator) {
  let updateClicked = false; // 「更新」を押した時だけリロードする（初回インストール時の無駄なリロード防止）
  const showUpdateToast = (worker) => {
    if (document.getElementById("swUpdate")) return;
    const bar = document.createElement("div");
    bar.id = "swUpdate";
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 12px);z-index:120;display:flex;align-items:center;gap:10px;background:#1f6f5b;color:#fff;padding:9px 10px 9px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-family:"Noto Sans JP",-apple-system,sans-serif;font-size:13px;font-weight:700;max-width:calc(100vw - 24px)';
    const txt = document.createElement("span");
    txt.textContent = "新しいバージョンがあります";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "更新";
    btn.style.cssText = 'border:none;background:#fff;color:#1f6f5b;font-weight:800;font-size:13px;padding:7px 15px;border-radius:999px;cursor:pointer;flex-shrink:0';
    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "閉じる");
    close.textContent = "×";
    close.style.cssText = 'border:none;background:transparent;color:#fff;font-size:18px;line-height:1;cursor:pointer;padding:0 4px;flex-shrink:0';
    close.addEventListener("click", () => bar.remove());
    btn.addEventListener("click", () => { updateClicked = true; btn.disabled = true; btn.textContent = "更新中…"; worker.postMessage("SKIP_WAITING"); });
    bar.append(txt, btn, close);
    document.body.appendChild(bar);
  };

  // 新SWが制御を取ったら一度だけリロードして新版を適用。
  let refreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!updateClicked || refreshed) return;
    refreshed = true;
    location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      // 既に待機中の新SWがある場合（初回インストール時は controller が無いので出さない）
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
      // 新SWが見つかったら、インストール完了時に通知。
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdateToast(nw);
        });
      });
    } catch (e) { console.warn("SW登録に失敗:", e); }
  });
}

// スタイルを注入（style.css を読み込まないページでも見た目を統一）
if (!document.getElementById("authStatusStyle")) {
  const st = document.createElement("style");
  st.id = "authStatusStyle";
  st.textContent = `
.auth-status{margin:auto 0 0;padding:14px 16px;background:#fff;border:1px solid #e7ddcb;border-radius:14px;font-size:13px;font-family:"Noto Sans JP",-apple-system,BlinkMacSystemFont,"Helvetica Neue","Yu Gothic",sans-serif}
.auth-status .as-line{margin:0 0 10px;color:#6c7787;font-weight:500}
.auth-status .as-line strong{color:#1f6f5b;font-weight:800}
.auth-status .as-links{display:flex;gap:10px}
.auth-status .as-links a{flex:1;text-align:center;padding:9px 10px;border-radius:999px;font-size:12.5px;font-weight:800;text-decoration:none;border:1.5px solid #1f6f5b;white-space:nowrap;box-sizing:border-box}
.auth-status .as-links a:first-child{background:#1f6f5b;color:#fff}
.auth-status .as-links #asLogout{background:#faf6ee;color:#1f6f5b}
.auth-status .as-links a:hover{opacity:.88}`;
  document.head.appendChild(st);
}

const el = document.getElementById("authStatus");

if (el) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      let nick = user.displayName || "";
      try {
        const s = await getDoc(doc(db, "users", user.uid));
        if (s.exists() && s.data().nickname) nick = s.data().nickname;
      } catch (e) {}
      el.innerHTML =
        `<p class="as-line">ログイン中：<strong>${esc(nick || user.email)}</strong></p>` +
        `<div class="as-links">` +
        `<a href="${base}account.html">マイページ</a>` +
        `<a href="#" id="asLogout">ログアウト</a>` +
        `</div>`;
      const lo = document.getElementById("asLogout");
      if (lo) lo.addEventListener("click", (e) => { e.preventDefault(); signOut(auth); });
    } else {
      el.innerHTML =
        `<p class="as-line">ログインしていません</p>` +
        `<div class="as-links"><a href="${base}account.html">ログイン / 新規登録</a></div>`;
    }
  });
}

/* =========================================================
   通知ベル（ヘッダー）
   - users/{uid}/notifications を購読し、未読バッジ＋一覧を表示
   - ベルを開くと既読化
========================================================= */
(function initNotifications() {
  const hdr = document.querySelector(".hd-r");
  if (!hdr) return; // ヘッダーが無いページ（account/user等）はスキップ

  if (!document.getElementById("notifStyle")) {
    const s = document.createElement("style");
    s.id = "notifStyle";
    s.textContent = `
.hd-bell{position:relative;display:none;align-items:center;justify-content:center;width:40px;height:40px;border:none;background:transparent;cursor:pointer;color:#1b2330;border-radius:50%;padding:0}
.hd-bell:hover{background:rgba(31,111,91,.10)}
.hd-bell svg{width:22px;height:22px}
.hd-bell-badge{position:absolute;top:4px;right:4px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#e0564b;color:#fff;font-size:11px;font-weight:800;line-height:17px;text-align:center;display:none;box-sizing:border-box}
.hd-bell-badge.on{display:block}
.notif-panel{position:fixed;z-index:80;top:62px;right:14px;width:330px;max-width:calc(100vw - 24px);max-height:72vh;background:#fff;border:1px solid #e7ddcb;border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.18);overflow:hidden;display:none;flex-direction:column;font-family:"Noto Sans JP",-apple-system,BlinkMacSystemFont,"Helvetica Neue","Yu Gothic",sans-serif}
.notif-panel.open{display:flex}
.notif-head{padding:14px 16px;border-bottom:1px solid #f0e9da;font-weight:800;font-size:14px;color:#182033}
.notif-list{overflow:auto;padding:4px 0}
.notif-item{display:flex;gap:10px;padding:11px 16px;text-decoration:none;color:inherit;align-items:flex-start}
.notif-item:hover{background:#faf6ee}
.notif-item.unread{background:#f1f8f5}
.notif-ic{flex-shrink:0;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#eaf3ef;color:#1f6f5b}
.notif-tx{font-size:13px;line-height:1.5;color:#283142}
.notif-tx b{font-weight:800}
.notif-tm{display:block;font-size:11px;color:#9aa3b0;margin-top:3px}
.notif-empty{padding:30px 16px;text-align:center;color:#9aa3b0;font-size:13px}`;
    document.head.appendChild(s);
  }

  const bell = document.createElement("button");
  bell.className = "hd-bell";
  bell.id = "hdBell";
  bell.setAttribute("aria-label", "通知");
  bell.innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>` +
    `<span class="hd-bell-badge" id="hdBellBadge"></span>`;
  const burger = hdr.querySelector(".burger");
  if (burger) hdr.insertBefore(bell, burger); else hdr.appendChild(bell);

  const panel = document.createElement("div");
  panel.className = "notif-panel";
  panel.innerHTML = `<div class="notif-head">通知</div><div class="notif-list" id="notifList"></div>`;
  document.body.appendChild(panel);
  const listEl = panel.querySelector("#notifList");
  const badge = bell.querySelector("#hdBellBadge");

  const ICON = {
    like: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 21s-6.7-4.35-9.33-8.07C.9 10.27 1.86 6.5 5.2 6.06c1.94-.26 3.4.86 4.3 2.07.9-1.21 2.36-2.33 4.3-2.07 3.34.44 4.3 4.21 2.53 6.87C18.7 16.65 12 21 12 21z"/></svg>',
    comment: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.1-5.4A8.5 8.5 0 1 1 21 11.5z"/></svg>',
    follow: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
    dm: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>'
  };

  const timeAgo = (ts) => {
    if (!ts || !ts.seconds) return "";
    const diff = Date.now() / 1000 - ts.seconds;
    if (diff < 60) return "たった今";
    if (diff < 3600) return Math.floor(diff / 60) + "分前";
    if (diff < 86400) return Math.floor(diff / 3600) + "時間前";
    if (diff < 604800) return Math.floor(diff / 86400) + "日前";
    const d = new Date(ts.seconds * 1000);
    return (d.getMonth() + 1) + "/" + d.getDate();
  };

  let items = [], curUid = null, unsub = null;

  const render = () => {
    if (!items.length) {
      listEl.innerHTML = `<p class="notif-empty">通知はまだありません。</p>`;
      return;
    }
    listEl.innerHTML = items.map(n => {
      const name = esc(n.fromNickname || "ある旅人");
      const title = esc(n.articleTitle || "旅程");
      let txt, href;
      if (n.type === "follow") {
        txt = `<b>${name}</b>さんがあなたをフォローしました`;
        href = `${base}user.html?uid=${encodeURIComponent(n.fromUid || "")}`;
      } else if (n.type === "dm") {
        txt = `<b>${name}</b>さんからメッセージが届きました`;
        href = `${base}dm.html?to=${encodeURIComponent(n.fromUid || "")}`;
      } else if (n.type === "comment") {
        txt = `<b>${name}</b>さんが「${title}」にコメントしました`;
        href = `${base}articles/view.html?id=${encodeURIComponent(n.articleId || "")}`;
      } else {
        txt = `<b>${name}</b>さんがあなたの旅程「${title}」にいいねしました`;
        href = `${base}articles/view.html?id=${encodeURIComponent(n.articleId || "")}`;
      }
      return `<a class="notif-item ${n.read ? "" : "unread"}" href="${href}">` +
        `<span class="notif-ic">${ICON[n.type] || ICON.like}</span>` +
        `<span><span class="notif-tx">${txt}</span><span class="notif-tm">${timeAgo(n.createdAt)}</span></span>` +
        `</a>`;
    }).join("");
  };

  const updateBadge = () => {
    const unread = items.filter(n => !n.read).length;
    badge.textContent = unread > 9 ? "9+" : String(unread);
    badge.classList.toggle("on", unread > 0);
  };

  const markAllRead = async () => {
    const unread = items.filter(n => !n.read);
    if (!unread.length || !curUid) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => batch.update(doc(db, "users", curUid, "notifications", n.id), { read: true }));
      await batch.commit();
    } catch (e) { console.warn("既読化に失敗:", e); }
  };

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle("open");
    if (open) markAllRead();
  });
  document.addEventListener("click", (e) => {
    if (panel.classList.contains("open") && !panel.contains(e.target) && !bell.contains(e.target)) {
      panel.classList.remove("open");
    }
  });

  onAuthStateChanged(auth, (user) => {
    if (unsub) { unsub(); unsub = null; }
    if (!user) {
      curUid = null; items = []; bell.style.display = "none";
      panel.classList.remove("open"); badge.classList.remove("on");
      return;
    }
    curUid = user.uid;
    bell.style.display = "inline-flex";
    const qy = query(collection(db, "users", user.uid, "notifications"), orderBy("createdAt", "desc"), limit(20));
    unsub = onSnapshot(qy, (snap) => {
      items = [];
      snap.forEach(s => items.push({ id: s.id, ...s.data() }));
      render(); updateBadge();
    }, (err) => { console.warn("通知の購読に失敗:", err); });
  });
})();

/* =========================================================
   DMアイコン（ヘッダー・通知ベルの隣）
   - タップで dm.html（メッセージ一覧）へ。
   - conversations（participants array-contains 自分）を購読し、
     unread[自分] の合計を赤バッジで表示。
========================================================= */
(function initDmIcon() {
  const hdr = document.querySelector(".hd-r");
  if (!hdr) return; // ヘッダーが無いページ（account/user等）はスキップ

  if (!document.getElementById("dmIconStyle")) {
    const s = document.createElement("style");
    s.id = "dmIconStyle";
    s.textContent = `
.hd-dm{position:relative;display:none;align-items:center;justify-content:center;width:40px;height:40px;border:none;background:transparent;cursor:pointer;color:#1b2330;border-radius:50%;padding:0;text-decoration:none}
.hd-dm:hover{background:rgba(31,111,91,.10)}
.hd-dm svg{width:22px;height:22px}
.hd-dm-badge{position:absolute;top:4px;right:4px;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#e0564b;color:#fff;font-size:11px;font-weight:800;line-height:17px;text-align:center;display:none;box-sizing:border-box}
.hd-dm-badge.on{display:block}`;
    document.head.appendChild(s);
  }

  const link = document.createElement("a");
  link.className = "hd-dm";
  link.id = "hdDm";
  link.href = base + "dm.html";
  link.setAttribute("aria-label", "メッセージ");
  link.innerHTML =
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>` +
    `<span class="hd-dm-badge" id="hdDmBadge"></span>`;
  // 通知ベルの左隣に置く（無ければバーガー前 / 末尾）
  const bell = hdr.querySelector("#hdBell");
  const burger = hdr.querySelector(".burger");
  if (bell) hdr.insertBefore(link, bell);
  else if (burger) hdr.insertBefore(link, burger);
  else hdr.appendChild(link);

  const badge = link.querySelector("#hdDmBadge");
  let unsub = null;
  onAuthStateChanged(auth, (user) => {
    if (unsub) { unsub(); unsub = null; }
    if (!user) { link.style.display = "none"; badge.classList.remove("on"); return; }
    link.style.display = "inline-flex";
    const qy = query(collection(db, "conversations"), where("participants", "array-contains", user.uid));
    unsub = onSnapshot(qy, (snap) => {
      let total = 0;
      snap.forEach(s => { const u = s.data().unread; if (u && u[user.uid]) total += u[user.uid]; });
      badge.textContent = total > 99 ? "99+" : String(total);
      badge.classList.toggle("on", total > 0);
    }, (err) => { console.warn("DM未読の購読に失敗:", err); });
  });
})();

/* =========================================================
   iOS スタンドアロンPWA：同一オリジンのリンクはアプリ内で遷移
   - iOS はホーム画面起動の standalone でも <a> を踏むと Safari に
     飛び出し、下に「戻る／共有」バーが出てしまう。これを防ぐため、
     同一オリジンのリンクは location 遷移に置き換えてアプリ内に留める。
   - 外部リンク・_blank・ダウンロード・mailto/tel 等はそのまま（Safariへ）。
========================================================= */
(function keepLinksInApp() {
  if (window.navigator.standalone !== true) return; // iOSのホーム画面起動時のみ
  document.addEventListener(
    "click",
    function (e) {
      const a = e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("#") || /^(mailto:|tel:|sms:|javascript:)/i.test(href)) return;
      let url;
      try { url = new URL(href, location.href); } catch (_) { return; }
      if (url.origin !== location.origin) return; // 外部はSafariへ
      e.preventDefault();
      location.href = url.href; // 同一オリジンはアプリ内で遷移
    },
    false
  );
})();

/* =========================================================
   下タブバー（PWA／スマホのみ）
   - display-mode:standalone（ホーム画面から起動）かつ
     スマホ幅のときだけ表示。PCやブラウザ閲覧では出さない。
   - 5枠：ホーム／さがす／（中央）投稿／マップ／マイページ
   - 現在地のタブをハイライト。
========================================================= */
(function initTabbar() {
  // PWA（standalone）起動か判定。iOSは navigator.standalone。
  const standalone =
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true;
  if (!standalone) return; // ブラウザ閲覧時は出さない
  if (document.querySelector(".tabbar")) return; // 二重生成防止
  // 投稿/編集・DMページはタブを出さない（下部の入力バーと重なるため）
  {
    const pg = (location.pathname.split("/").pop() || "").toLowerCase();
    if (pg === "post.html" || pg === "dm.html") return;
  }

  if (!document.getElementById("tabbarStyle")) {
    const st = document.createElement("style");
    st.id = "tabbarStyle";
    st.textContent = `
.tabbar{position:fixed;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:90;display:none;align-items:center;justify-content:space-around;height:64px;padding:0 7px;background:rgba(255,255,255,.26);-webkit-backdrop-filter:blur(32px) saturate(190%);backdrop-filter:blur(32px) saturate(190%);border:1px solid rgba(255,255,255,.42);border-radius:999px;box-shadow:0 14px 40px rgba(20,30,25,.22),inset 0 1px 0 rgba(255,255,255,.55);font-family:"Noto Sans JP",-apple-system,BlinkMacSystemFont,"Helvetica Neue","Yu Gothic",sans-serif}
.tabbar a{flex:1;display:flex;align-items:center;justify-content:center;height:48px;margin:0 2px;border-radius:18px;text-decoration:none;color:#1b2330;-webkit-tap-highlight-color:transparent;transition:transform .12s ease,background .2s ease,color .2s ease}
.tabbar a svg{width:25px;height:25px}
.tabbar a span{display:none}
.tabbar a.active{color:#1f6f5b;background:rgba(255,255,255,.42)}
.tabbar a:active{transform:scale(.9)}
.tabbar .tb-fab{display:flex;align-items:center;justify-content:center}
.tabbar .tb-fab svg{width:25px;height:25px}
@media(max-width:768px){body.pwa .tabbar{display:flex}body.pwa{padding-bottom:calc(64px + env(safe-area-inset-bottom) + 28px)}body.pwa:has(.drawer.open) .tabbar{display:none}}`;
    document.head.appendChild(st);
  }
  document.body.classList.add("pwa");

  const SVG = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    post: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>',
    account: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>'
  };

  const cur = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const activeKey =
    (cur === "" || cur === "index.html") ? "home" :
    (cur === "search.html" || cur === "filter.html") ? "search" :
    (cur === "post.html") ? "post" :
    (cur === "map.html") ? "map" :
    (cur === "account.html" || cur === "user.html") ? "account" : "";

  const a = (key, label, href, svg) =>
    `<a class="${key === activeKey ? "active" : ""}" href="${base}${href}" aria-label="${label}">${svg}<span>${label}</span></a>`;

  const bar = document.createElement("nav");
  bar.className = "tabbar";
  bar.setAttribute("aria-label", "メインメニュー");
  bar.innerHTML =
    a("home", "ホーム", "index.html", SVG.home) +
    a("search", "さがす", "filter.html", SVG.search) +
    `<a class="tb-post ${activeKey === "post" ? "active" : ""}" href="${base}post.html" aria-label="投稿">` +
      `<span class="tb-fab">${SVG.post}</span><span class="tb-lbl">投稿</span></a>` +
    a("map", "マップ", "map.html", SVG.map) +
    a("account", "マイページ", "account.html", SVG.account);
  document.body.appendChild(bar);

  // ドロワー（ハンバーガーメニュー）展開中はタブバーを隠す。
  // CSS の :has() が効かない端末向けの保険として JS でも切り替える。
  const drawerEl = document.querySelector(".drawer");
  if (drawerEl) {
    const sync = () => { bar.style.display = drawerEl.classList.contains("open") ? "none" : ""; };
    new MutationObserver(sync).observe(drawerEl, { attributes: true, attributeFilter: ["class"] });
  }
})();

/* =========================================================
   旅の概要カード（.info-grid）の横スクロール矢印
   - スマホで横スクロールに気づきにくい問題への対策。
   - 隣にカードがある向きにだけ、半透明の小さい矢印を表示。
     左右どちらにもあれば両方出す。端まで来たらその向きは消す。
   - PC（グリッド表示で横スクロール不要）では出さない。
   - view.html は記事を後から描画するため MutationObserver で検知。
========================================================= */
(function infoGridArrows() {
  const STYLE_ID = "infoGridArrowStyle";
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
.ig-wrap{position:relative}
.ig-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:5;width:34px;height:34px;padding:0;border:none;border-radius:50%;background:rgba(23,32,51,.30);color:#fff;align-items:center;justify-content:center;cursor:pointer;-webkit-tap-highlight-color:transparent;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);box-shadow:0 2px 8px rgba(0,0,0,.18);opacity:0;pointer-events:none;transition:opacity .2s;display:none}
.ig-nav svg{width:16px;height:16px;display:block}
.ig-nav.show{display:flex;opacity:1;pointer-events:auto}
.ig-prev{left:8px}
.ig-next{right:8px}
@media(min-width:769px){.ig-nav{display:none!important}}`;
    document.head.appendChild(st);
  }
  const CH_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
  const CH_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  function setup(grid) {
    if (grid.dataset.igReady) return;
    grid.dataset.igReady = "1";
    const wrap = document.createElement("div");
    wrap.className = "ig-wrap";
    grid.parentNode.insertBefore(wrap, grid);
    wrap.appendChild(grid);
    const prev = document.createElement("button");
    prev.type = "button"; prev.className = "ig-nav ig-prev";
    prev.setAttribute("aria-label", "前のカードへ"); prev.innerHTML = CH_L;
    const next = document.createElement("button");
    next.type = "button"; next.className = "ig-nav ig-next";
    next.setAttribute("aria-label", "次のカードへ"); next.innerHTML = CH_R;
    wrap.appendChild(prev); wrap.appendChild(next);

    // カードは scroll-snap で中央寄せされるため、scrollLeft の単純比較ではなく
    // 「各カードの中央」と「表示中央」を比べて判定・移動する。
    const cards = () => [...grid.children]; // 実カード（::before/::after擬似は含まれない）
    const viewCenter = () => grid.scrollLeft + grid.clientWidth / 2;
    const cardCenter = (card) => {
      const gr = grid.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      return (cr.left - gr.left) + grid.scrollLeft + cr.width / 2; // スクロール内容内での中央位置
    };
    const TOL = 6;
    const update = () => {
      const vc = viewCenter();
      const cs = cards();
      prev.classList.toggle("show", cs.some((c) => cardCenter(c) < vc - TOL));
      next.classList.toggle("show", cs.some((c) => cardCenter(c) > vc + TOL));
    };
    const goTo = (card) => {
      if (!card) return;
      grid.scrollTo({ left: Math.max(0, cardCenter(card) - grid.clientWidth / 2), behavior: "smooth" });
    };
    const step = (dir) => {
      const vc = viewCenter();
      const cs = cards();
      if (dir > 0) {
        goTo(cs.find((c) => cardCenter(c) > vc + TOL));
      } else {
        const left = cs.filter((c) => cardCenter(c) < vc - TOL);
        goTo(left[left.length - 1]);
      }
    };
    prev.addEventListener("click", () => step(-1));
    next.addEventListener("click", () => step(1));
    grid.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    setTimeout(update, 400); // 画像読み込みで幅が確定してから再計算
  }
  const scan = () => document.querySelectorAll(".info-grid").forEach(setup);
  if (document.readyState !== "loading") scan();
  else document.addEventListener("DOMContentLoaded", scan);
  let scheduled = false;
  const mo = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; scan(); });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
