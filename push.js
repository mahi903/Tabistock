// プッシュ通知（クライアント側）
// 役割：通知の許可を求め、FCMトークンを取得して
//       users/{uid}/pushTokens/{token} に保存する。
//       受信表示は sw.js（onBackgroundMessage）が担当。
import { app, auth, db } from "./firebase-config.js";
import { getMessaging, getToken, deleteToken, isSupported }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { doc, setDoc, deleteDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase コンソール → Cloud Messaging → ウェブプッシュ証明書の公開鍵。
const VAPID_KEY = "BNe7C_nCSGe3X1nd-dhShQ2JYQzcnADlozz63TJSEm6OnQcvVBplOyfGlEaC3fX7O4AvAUzyd6nNQBAHBo_qs3c";

// この端末/ブラウザがプッシュに対応しているか。
export async function isPushSupported() {
  try {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
    return await isSupported();
  } catch (e) {
    return false;
  }
}

// 通知を有効化：許可→トークン取得→Firestoreへ保存。トークンを返す。
export async function enablePush() {
  if (!(await isPushSupported())) {
    throw new Error("この端末・ブラウザはプッシュ通知に対応していません。");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("ログインが必要です。");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("通知が許可されませんでした。");

  // 既存の(キャッシュ用)SWを共用する。
  const reg = await navigator.serviceWorker.ready;
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: reg
  });
  if (!token) throw new Error("通知トークンを取得できませんでした。");

  await setDoc(doc(db, "users", user.uid, "pushTokens", token), {
    token,
    ua: navigator.userAgent || "",
    createdAt: serverTimestamp()
  }, { merge: true });

  return token;
}

// 通知を無効化：この端末のトークンを Firestore から削除し、FCM登録も解除する。
// （ブラウザの「許可」自体は取り消せないが、トークンを消せばサーバーは送らない）
export async function disablePush() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg
    });
    if (token) {
      await deleteDoc(doc(db, "users", user.uid, "pushTokens", token)).catch(() => {});
      try { await deleteToken(messaging); } catch (e) { /* 解除失敗は無視 */ }
    }
  } catch (e) {
    // トークン取得に失敗してもオフ状態として扱う（再送はされない）
  }
}
