// プッシュ通知（クライアント側）
// 役割：通知の許可を求め、FCMトークンを取得して
//       users/{uid}/pushTokens/{token} に保存する。
//       受信表示は sw.js（onBackgroundMessage）が担当。
import { app, auth, db } from "./firebase-config.js";
import { getMessaging, getToken, isSupported }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";
import { doc, setDoc, serverTimestamp }
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
