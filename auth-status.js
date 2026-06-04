// ログイン状態をドロワー内の #authStatus に表示（全ページ共通）。
// 記事ページ(/articles/)からは ../ で account.html へ繋ぐ。
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, collection, query, orderBy, limit, onSnapshot, writeBatch }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const base = location.pathname.includes("/articles/") ? "../" : "./";

// PWA: Service Worker を登録（インストール可能化＋静的ファイル高速化）。
// ルート(/sw.js)に置いてあるので scope はサイト全体。失敗してもページ動作には影響しない。
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(e => console.warn("SW登録に失敗:", e));
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
    follow: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>'
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

  if (!document.getElementById("tabbarStyle")) {
    const st = document.createElement("style");
    st.id = "tabbarStyle";
    st.textContent = `
.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:90;display:none;align-items:stretch;height:82px;background:#fff;border-top:1px solid #e7ddcb;padding-bottom:env(safe-area-inset-bottom);font-family:"Noto Sans JP",-apple-system,BlinkMacSystemFont,"Helvetica Neue","Yu Gothic",sans-serif}
.tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding-bottom:8px;text-decoration:none;color:#9aa3b0;font-size:11px;font-weight:700;-webkit-tap-highlight-color:transparent}
.tabbar a svg{width:24px;height:24px}
.tabbar a.active{color:#1f6f5b}
.tabbar .tb-fab{margin-top:-26px;width:56px;height:56px;border-radius:50%;background:#1f6f5b;color:#fff;display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 6px 16px rgba(31,111,91,.42)}
.tabbar .tb-fab svg{width:28px;height:28px}
.tabbar .tb-post:active .tb-fab{transform:scale(.94)}
@media(max-width:768px){body.pwa .tabbar{display:flex}body.pwa{padding-bottom:calc(82px + env(safe-area-inset-bottom))}}`;
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
})();
