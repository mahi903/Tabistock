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
// iPhoneアプリ（APNs）にも送るときに必要な環境変数：
//   APNS_KEY       … Apple Developer で作った .p8 の中身（-----BEGIN PRIVATE KEY----- から全部）
//   APNS_KEY_ID    … その鍵の Key ID（10文字）
//   APNS_TEAM_ID   … Apple Developer のチームID（10文字）
//   APNS_BUNDLE_ID … アプリのバンドルID（省略時 jp.tabistock.app）

import admin from "firebase-admin";
import http2 from "node:http2";
import crypto from "node:crypto";

// ---- APNs（iPhoneアプリ）----
// 認証は .p8 の鍵で作る JWT（ES256）。同じものを50分ほど使い回す
let apnsJwt = null, apnsJwtAt = 0;
function apnsToken() {
  // 鍵は貼り付け方で改行が消えたり「\n」の文字になったりするので、中身（base64）だけ取り出して PEM の形に組み直す
  const raw = String(process.env.APNS_KEY || "").replace(/\\n/g, "\n");
  const b64key = raw.replace(/-----(BEGIN|END)[^-]*-----/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
  const key = b64key ? "-----BEGIN PRIVATE KEY-----\n" + b64key.match(/.{1,64}/g).join("\n") + "\n-----END PRIVATE KEY-----\n" : "";
  const kid = String(process.env.APNS_KEY_ID || "").trim(), iss = String(process.env.APNS_TEAM_ID || "").trim();
  if (!key || !kid || !iss) return null;
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwt && now - apnsJwtAt < 50 * 60) return apnsJwt;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = b64({ alg: "ES256", kid }), body = b64({ iss, iat: now });
  const sig = crypto.sign("sha256", Buffer.from(head + "." + body), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  apnsJwt = `${head}.${body}.${sig}`; apnsJwtAt = now;
  return apnsJwt;
}
// 1台に送る。TestFlight・App Store は本番（api.push.apple.com）、Xcode から入れたものは開発用（sandbox）なので、
// 本番で「この端末は知らない」と言われたら sandbox でもう一度送る
function apnsSendOne(host, deviceToken, payload, jwt) {
  return new Promise((resolve) => {
    let client;
    try { client = http2.connect("https://" + host); } catch (e) { resolve({ status: 0, reason: String(e) }); return; }
    client.on("error", (e) => resolve({ status: 0, reason: String(e) }));
    const req = client.request({
      ":method": "POST", ":path": "/3/device/" + deviceToken,
      authorization: "bearer " + jwt,
      "apns-topic": process.env.APNS_BUNDLE_ID || "jp.tabistock.app",
      "apns-push-type": "alert", "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0, data = "";
    req.on("response", (h) => { status = h[":status"]; });
    req.on("data", (c) => (data += c));
    req.on("end", () => { client.close(); let reason = ""; try { reason = JSON.parse(data || "{}").reason || ""; } catch (e) {} resolve({ status, reason }); });
    req.on("error", (e) => { client.close(); resolve({ status: 0, reason: String(e) }); });
    req.end(JSON.stringify(payload));
  });
}
async function apnsSend(deviceToken, payload, jwt) {
  let r = await apnsSendOne("api.push.apple.com", deviceToken, payload, jwt);
  if (r.status === 400 && r.reason === "BadDeviceToken") r = await apnsSendOne("api.sandbox.push.apple.com", deviceToken, payload, jwt);
  return r;
}

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

// 悪用対策：1人が1日に送れる総数と、同じ相手に送れる数を制限する（日本時間の日付ごと）
const PUSH_DAY_MAX = 300, PUSH_PAIR_MAX = 40;
async function pushCountUp(from, to) {
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const db = admin.firestore();
  const a = db.collection("usage").doc(`push_${from}_${day}`);
  const b = db.collection("usage").doc(`pushTo_${from}_${to}_${day}`);
  return db.runTransaction(async (t) => {
    const [sa, sb] = await Promise.all([t.get(a), t.get(b)]);
    const na = sa.exists ? Number(sa.data().n || 0) : 0, nb = sb.exists ? Number(sb.data().n || 0) : 0;
    if (na >= PUSH_DAY_MAX || nb >= PUSH_PAIR_MAX) return false;
    const at = admin.firestore.FieldValue.serverTimestamp();
    t.set(a, { uid: from, n: na + 1, day, at });
    t.set(b, { uid: from, n: nb + 1, day, at });
    return true;
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
    // 開き先はこのアプリ内（/ か # で始まる）だけ。外部サイトへ誘導するURLは使えない
    let url = String(body.url || "/").slice(0, 300);
    if (!/^[\/#]/.test(url) || url.startsWith("//")) url = "/";
    if (!toUid || typeof toUid !== "string") { res.status(400).json({ error: "toUid required" }); return; }
    if (toUid === fromUid) { res.status(200).json({ skipped: "self" }); return; }

    const db = admin.firestore();

    if (!(await pushCountUp(fromUid, toUid))) { res.status(429).json({ error: "too many" }); return; }

    // iPhoneアプリ（APNs）
    let apnsSent = 0;
    try {
      const jwt = apnsToken();
      if (jwt) {
        const acol = db.collection("users").doc(toUid).collection("apnsTokens");
        const asnap = await acol.get();
        const payload = { aps: { alert: { title, body: text }, sound: "default" }, url };
        await Promise.all(asnap.docs.map(async (d) => {
          const r = await apnsSend(d.id, payload, jwt);
          if (r.status === 200) apnsSent++;
          else if (r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered") await d.ref.delete().catch(() => {});
          else console.warn("apns failed", r.status, r.reason);
        }));
      }
    } catch (e) { console.error("apns error:", e); }

    // ブラウザ（PWA）
    const col = db.collection("users").doc(toUid).collection("pushTokens");
    const snap = await col.get();
    const tokens = [];
    snap.forEach((d) => { const t = (d.data() && d.data().token) || d.id; if (t) tokens.push(t); });
    if (!tokens.length) { res.status(200).json({ sent: 0, apns: apnsSent }); return; }

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

    res.status(200).json({ sent: resp.successCount, failed: resp.failureCount, apns: apnsSent });
  } catch (e) {
    console.error("sendPush error:", e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
