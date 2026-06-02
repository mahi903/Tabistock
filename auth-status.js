// ログイン状態をドロワー内の #authStatus に表示（全ページ共通）。
// 記事ページ(/articles/)からは ../ で account.html へ繋ぐ。
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const base = location.pathname.includes("/articles/") ? "../" : "./";

// スタイルを注入（style.css を読み込まないページでも見た目を統一）
if (!document.getElementById("authStatusStyle")) {
  const st = document.createElement("style");
  st.id = "authStatusStyle";
  st.textContent = `
.auth-status{margin:0 0 6px;padding:14px 16px;background:#fff;border:1px solid #e7ddcb;border-radius:14px;font-size:13px;font-family:"Noto Sans JP",-apple-system,BlinkMacSystemFont,"Helvetica Neue","Yu Gothic",sans-serif}
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
        `<a href="${base}account.html">アカウント</a>` +
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
