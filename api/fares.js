// 航空券の相場カレンダー用データ（Vercel サーバーレス関数）
// 役割：flights.html から呼ばれ、「記事を1本以上公開している人」にだけ相場データを返す。
//       開発中の機能を、記事を書いてくれた人に先行公開するための仕組み。
//
// 判定：
//   - 呼び出し元の Firebase IDトークンを検証（ログイン中の本人だけ）
//   - articles に「authorId == 本人」または「coAuthorIds に本人を含む」記事があり、
//     そのうち1本でも status が "published" なら OK
//
// 返すもの：{ ok: true, updated, fares, sky }
//   記事がない人には 403 { error: "no_article" }、未ログインには 401 を返す。
//
// 必要な環境変数は ask.js と共通（FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY）。

import admin from "firebase-admin";
import { UPDATED, FARES, SKY } from "./_fares-data.js";

function ensureApp() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("missing service account env vars");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
}

async function hasPublishedArticle(uid) {
  const col = admin.firestore().collection("articles");
  // 複合インデックスが要らないよう、本人の記事を取ってから status をコード側で確認する
  const own = await col.where("authorId", "==", uid).get();
  if (own.docs.some((d) => d.get("status") === "published")) return true;
  const co = await col.where("coAuthorIds", "array-contains", uid).get();
  return co.docs.some((d) => d.get("status") === "published");
}

export default async function handler(req, res) {
  // 個人ごとに結果が変わるので、CDN や共有キャッシュには載せない
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    ensureApp();
    const authz = req.headers.authorization || "";
    const m = authz.match(/^Bearer (.+)$/);
    if (!m) { res.status(401).json({ error: "no_auth" }); return; }
    let uid;
    try {
      uid = (await admin.auth().verifyIdToken(m[1])).uid;
    } catch (e) {
      res.status(401).json({ error: "bad_token" });
      return;
    }
    if (!(await hasPublishedArticle(uid))) {
      res.status(403).json({ error: "no_article" });
      return;
    }
    res.status(200).json({ ok: true, updated: UPDATED, fares: FARES, sky: SKY });
  } catch (e) {
    console.error("fares error", e);
    res.status(500).json({ error: "server_error" });
  }
}
