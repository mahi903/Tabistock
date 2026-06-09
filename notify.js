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
      type,                       // 'like' | 'comment' | 'follow'
      fromUid: user.uid,
      fromNickname: nick,
      articleId,
      articleTitle,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (e) {
    console.warn("通知の送信に失敗:", e);
  }
}
