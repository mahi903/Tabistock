// プッシュ通知の送信（Vercel サーバーレス関数）
// 役割：いいね/コメント/フォロー/DM などの行動時に notify.js から呼ばれ、
//       firebase-admin を使って「相手」の端末トークン宛にプッシュを送る。
//
// 安全策：
//   - 呼び出し元の Firebase IDトークンを検証（ログイン中の本人だけが送れる）。
//   - data-only メッセージで送り、表示はSW(onBackgroundMessage)側に統一
//     （notification ペイロードを併用すると二重表示になるため）。
//   - 無効になったトークンは自動で掃除する。
//
// 必要な環境変数（Vercel の Settings → Environment Variables に登録）：
//   FIREBASE_PROJECT_ID    … サービスアカウントJSONの project_id
//   FIREBASE_CLIENT_EMAIL  … 同 client_email
//   FIREBASE_PRIVATE_KEY   … 同 private_key（改行を含むのでそのまま貼り付けでOK）

import admin from "firebase-admin";

function ensureApp() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  // 環境変数に "\n" の文字列で入っている場合は実改行へ変換。
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("missing service account env vars");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    ensureApp();

    // 呼び出し元の本人確認（Authorization: Bearer <idToken>）
    const authz = req.headers.authorization || "";
    const m = authz.match(/^Bearer (.+)$/);
    if (!m) { res.status(401).json({ error: "no auth token" }); return; }
    const decoded = await admin.auth().verifyIdToken(m[1]);
    const fromUid = decoded.uid;

    const body = req.body || {};
    const toUid = body.toUid;
    const title = String(body.title || "Tabistock").slice(0, 120);
    const text = String(body.body || "").slice(0, 240);
    const url = String(body.url || "/").slice(0, 300);
    if (!toUid || typeof toUid !== "string") { res.status(400).json({ error: "toUid required" }); return; }
    if (toUid === fromUid) { res.status(200).json({ skipped: "self" }); return; }

    const db = admin.firestore();
    const col = db.collection("users").doc(toUid).collection("pushTokens");
    const snap = await col.get();
    const tokens = [];
    snap.forEach((d) => { const t = (d.data() && d.data().token) || d.id; if (t) tokens.push(t); });
    if (!tokens.length) { res.status(200).json({ sent: 0 }); return; }

    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      data: { title, body: text, url }
    });

    // 失敗（=無効トークン）を掃除
    const dead = [];
    resp.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (code === "messaging/registration-token-not-registered"
          || code === "messaging/invalid-registration-token"
          || code === "messaging/invalid-argument") {
          dead.push(tokens[i]);
        }
      }
    });
    await Promise.all(dead.map((t) => col.doc(t).delete().catch(() => {})));

    res.status(200).json({ sent: resp.successCount, failed: resp.failureCount });
  } catch (e) {
    console.error("sendPush error:", e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
