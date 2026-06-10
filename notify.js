// 通知の送信ヘルパー。
// いいね・コメント・フォローなどの行動をした瞬間に、相手の
// users/{toUid}/notifications に1件書き込む。自分自身へは送らない。
// 失敗してもUI操作は止めない（通知はあくまで付随処理）。
import { auth, db } from "./firebase-config.js";
import { addDoc, collection, doc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let _nick = null; // 自分の表示名を1回だけ取得してキャッシュ
async function myNickname(uid) {
  if (_nick != null) return _nick;
  try {
    const s = await getDoc(doc(db, "publicProfiles", uid));
    if (s.exists() && s.data().nickname) _nick = s.data().nickname;
  } catch (e) {}
  if (!_nick) _nick = (auth.currentUser && auth.currentUser.displayName) || "ある旅人";
  return _nick;
}

export async function sendNotification({ toUid, type, articleId = "", articleTitle = "" }) {
  const user = auth.currentUser;
  if (!user || !toUid || user.uid === toUid) return; // 未ログイン/宛先なし/自分宛ては送らない
  try {
    const nick = await myNickname(user.uid);
    await addDoc(collection(db, "users", toUid, "notifications"), {
      type,                       // 'like' | 'comment' | 'follow' | 'dm'
      fromUid: user.uid,
      fromNickname: nick,
      articleId,
      articleTitle,
      read: false,
      createdAt: serverTimestamp()
    });

    // プッシュ通知も送る（相手が端末を登録していれば届く）。失敗は無視。
    try {
      let title = "Tabistock", text = "", url = "/";
      if (type === "like") {
        title = nick + "さんがいいねしました";
        text = articleTitle || "";
        url = "/articles/view.html?id=" + encodeURIComponent(articleId);
      } else if (type === "comment") {
        title = nick + "さんがコメントしました";
        text = articleTitle || "";
        url = "/articles/view.html?id=" + encodeURIComponent(articleId);
      } else if (type === "follow") {
        title = nick + "さんにフォローされました";
        url = "/user.html?uid=" + encodeURIComponent(user.uid);
      } else if (type === "dm") {
        title = nick + "さんからメッセージが届きました";
        url = "/dm.html?to=" + encodeURIComponent(user.uid);
      }
      const idToken = await user.getIdToken();
      fetch("/api/sendPush", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
        body: JSON.stringify({ toUid, title, body: text, url })
      }).catch(() => {});
    } catch (e) { /* プッシュは付随処理。失敗してもUIは止めない */ }
  } catch (e) {
    console.warn("通知の送信に失敗:", e);
  }
}
