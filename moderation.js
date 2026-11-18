// 通報・ブロックの共通モジュール（App Store 審査ガイドライン 1.2 対応）
//
// 通報： reports/{autoId} に保存し、管理者へプッシュで知らせる。
//        管理ページ（admin.html の「通報」タブ）で確認・対応する。
// ブロック： users/{me}/blocks/{targetUid}。
//        ブロックした相手のコメントは非表示、相手からのDM・通知はルールで拒否。
import { auth, db } from "./firebase-config.js";
import {
  addDoc, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const REASONS = [
  ["spam", "スパム・宣伝"],
  ["harass", "誹謗中傷・嫌がらせ"],
  ["inappropriate", "性的・暴力的など不適切な内容"],
  ["privacy", "個人情報の掲載"],
  ["impersonation", "なりすまし"],
  ["other", "その他"]
];

const TYPE_LABEL = { article: "この記事", comment: "このコメント", user: "このユーザー", message: "このメッセージ" };

let cssDone = false;
function css() {
  if (cssDone) return; cssDone = true;
  const s = document.createElement("style");
  s.textContent = `
  .md-ov{position:fixed;inset:0;background:rgba(15,20,25,.45);z-index:2000;display:flex;align-items:flex-end;justify-content:center}
  @media(min-width:640px){.md-ov{align-items:center}}
  .md-box{background:#fff;width:100%;max-width:440px;border-radius:22px 22px 0 0;padding:20px 20px calc(env(safe-area-inset-bottom,0px) + 20px);max-height:88vh;overflow:auto;font-family:inherit;color:#1b2330}
  @media(min-width:640px){.md-box{border-radius:20px}}
  .md-box h2{font-size:17px;margin:0 0 4px}
  .md-box .md-sub{font-size:12.5px;color:#6c7787;margin:0 0 12px;line-height:1.6}
  .md-opt{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1.5px solid #ece4d6;border-radius:12px;margin-bottom:8px;font-size:14px;cursor:pointer}
  .md-opt input{accent-color:#1f6f5b;width:18px;height:18px;margin:0}
  .md-opt:has(input:checked){border-color:#1f6f5b;background:#eef5f1}
  .md-box textarea{width:100%;box-sizing:border-box;border:1px solid #e9dcc6;border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;min-height:72px;margin-top:4px}
  .md-btns{display:flex;gap:10px;margin-top:14px}
  .md-btns button{flex:1;padding:12px;border-radius:12px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}
  .md-cancel{background:#faf6ee;color:#1f6f5b;border:1.5px solid #1f6f5b}
  .md-go{background:#d4493f;color:#fff;border:0}
  .md-go:disabled{opacity:.5}
  .md-err{color:#d4493f;font-size:12.5px;margin-top:8px}
  .md-toast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);transform:translateX(-50%);background:rgba(27,35,48,.94);color:#fff;font-size:13.5px;padding:11px 16px;border-radius:14px;z-index:2100;max-width:90%;text-align:center;line-height:1.5}
  .md-menu{position:fixed;inset:0;z-index:2000;background:rgba(15,20,25,.35);display:flex;align-items:flex-end;justify-content:center}
  .md-menu .md-sheet{background:#fff;width:100%;max-width:440px;border-radius:22px 22px 0 0;padding:8px 0 calc(env(safe-area-inset-bottom,0px) + 10px)}
  @media(min-width:640px){.md-menu{align-items:center}.md-menu .md-sheet{border-radius:18px}}
  .md-sheet button{display:block;width:100%;text-align:left;background:none;border:0;padding:15px 22px;font:inherit;font-size:15px;cursor:pointer;color:#1b2330}
  .md-sheet button.red{color:#d4493f}
  .md-sheet button+button{border-top:1px solid #f0ebe1}
  `;
  document.head.appendChild(s);
}

export function toast(text) {
  css();
  const t = document.createElement("div");
  t.className = "md-toast"; t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function needLogin() {
  if (auth.currentUser) return false;
  alert("この操作にはログインが必要です。");
  location.href = (location.pathname.includes("/articles/") ? "../" : "./") + "account.html";
  return true;
}

// 下から出るメニュー。items: [{label, red, onClick}]
export function openMenu(items) {
  css();
  const ov = document.createElement("div");
  ov.className = "md-menu";
  ov.innerHTML = `<div class="md-sheet">${items.map((it, i) => `<button type="button" data-i="${i}" class="${it.red ? "red" : ""}">${it.label}</button>`).join("")}<button type="button" data-i="x">キャンセル</button></div>`;
  ov.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (e.target === ov || (b && b.dataset.i === "x")) { ov.remove(); return; }
    if (b) { ov.remove(); items[+b.dataset.i].onClick(); }
  });
  document.body.appendChild(ov);
}

// 通報ダイアログ。
// target: { type:'article'|'comment'|'user'|'message', targetId, targetUid, articleId?, convId?, excerpt? }
export function openReport(target) {
  if (needLogin()) return;
  css();
  const ov = document.createElement("div");
  ov.className = "md-ov";
  ov.innerHTML = `<div class="md-box" role="dialog" aria-modal="true">
    <h2>${TYPE_LABEL[target.type] || ""}を通報</h2>
    <p class="md-sub">理由を選んでください。運営が24時間以内に確認し、規約違反があれば削除などの対応をします。通報したことは相手に通知されません。</p>
    ${REASONS.map(([v, l]) => `<label class="md-opt"><input type="radio" name="mdr" value="${v}">${l}</label>`).join("")}
    <textarea id="mdNote" maxlength="500" placeholder="詳しい内容（任意）"></textarea>
    <div class="md-err" id="mdErr"></div>
    <div class="md-btns"><button type="button" class="md-cancel" id="mdCancel">やめる</button><button type="button" class="md-go" id="mdGo" disabled>通報する</button></div>
  </div>`;
  document.body.appendChild(ov);
  const go = ov.querySelector("#mdGo");
  ov.querySelectorAll('input[name="mdr"]').forEach(r => r.addEventListener("change", () => { go.disabled = false; }));
  ov.querySelector("#mdCancel").onclick = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
  go.onclick = async () => {
    const reason = (ov.querySelector('input[name="mdr"]:checked') || {}).value;
    if (!reason) return;
    go.disabled = true; go.textContent = "送信中…";
    try {
      await addDoc(collection(db, "reports"), {
        type: target.type,
        targetId: String(target.targetId || ""),
        targetUid: String(target.targetUid || ""),
        articleId: String(target.articleId || ""),
        convId: String(target.convId || ""),
        excerpt: String(target.excerpt || "").slice(0, 300),
        reason,
        note: ov.querySelector("#mdNote").value.trim().slice(0, 500),
        reporterUid: auth.currentUser.uid,
        status: "open",
        createdAt: serverTimestamp()
      });
      ov.remove();
      toast("通報を受け付けました。ご協力ありがとうございます。");
      alertAdmins(target.type).catch(() => {});
    } catch (e) {
      console.error(e);
      ov.querySelector("#mdErr").textContent = "送信できませんでした。時間をおいてお試しください。";
      go.disabled = false; go.textContent = "通報する";
    }
  };
}

// 管理者へプッシュで知らせる（失敗しても無視）
async function alertAdmins(type) {
  const user = auth.currentUser;
  if (!user) return;
  const admins = await getDocs(collection(db, "admins"));
  const token = await user.getIdToken();
  admins.forEach((a) => {
    if (a.id === user.uid) return;
    fetch("/api/sendPush", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ toUid: a.id, title: "通報が届きました", body: (TYPE_LABEL[type] || "") + "への通報", url: "/admin.html" })
    }).catch(() => {});
  });
}

// ---- ブロック ----
let blockedCache = null;
export async function getBlocked() {
  const me = auth.currentUser && auth.currentUser.uid;
  if (!me) return new Set();
  if (blockedCache && blockedCache.uid === me) return blockedCache.set;
  const set = new Set();
  try { (await getDocs(collection(db, "users", me, "blocks"))).forEach(d => set.add(d.id)); } catch (e) {}
  blockedCache = { uid: me, set };
  return set;
}

export async function isBlocked(uid) {
  return (await getBlocked()).has(uid);
}

export async function blockUser(uid, nickname) {
  if (needLogin()) return false;
  const me = auth.currentUser.uid;
  if (!uid || uid === me) return false;
  if (!confirm(`${nickname || "このユーザー"}さんをブロックしますか？\n\n・相手のコメントが表示されなくなります\n・相手からメッセージや通知が届かなくなります\n・あなたからのフォローは解除されます\n\nブロックしたことは相手に通知されません。`)) return false;
  await setDoc(doc(db, "users", me, "blocks", uid), { nickname: nickname || "", createdAt: serverTimestamp() });
  // 自分→相手のフォローを外す
  try { await deleteDoc(doc(db, "users", me, "following", uid)); } catch (e) {}
  try { await deleteDoc(doc(db, "users", uid, "followers", me)); } catch (e) {}
  (await getBlocked()).add(uid);
  toast("ブロックしました");
  return true;
}

export async function unblockUser(uid) {
  const me = auth.currentUser && auth.currentUser.uid;
  if (!me) return false;
  await deleteDoc(doc(db, "users", me, "blocks", uid));
  (await getBlocked()).delete(uid);
  toast("ブロックを解除しました");
  return true;
}

export async function listBlocked() {
  const me = auth.currentUser && auth.currentUser.uid;
  if (!me) return [];
  const out = [];
  (await getDocs(collection(db, "users", me, "blocks"))).forEach(d => out.push({ uid: d.id, ...d.data() }));
  return out;
}

export { REASONS };
