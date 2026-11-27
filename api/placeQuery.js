// 地図検索の言い換え（Vercel サーバーレス関数）
// 役割：投稿フォームの「ピンを置く」検索で、日本語の名前では地図（OpenStreetMap）に
//       見つからなかったとき、Claude（Haiku）が英語・現地語の名前に言い換える。
//       例：「ブルーモスク」→ ["Sultan Ahmed Mosque, Istanbul, Turkey", ...]
//       座標化はクライアント側（Nominatim）が担当する。
//
// 安全策：
//   - 呼び出し元の Firebase IDトークンを検証（ログイン中の本人だけが使える）。
//   - 1人1日 DAILY_MAX 回まで（Firestore の usage/ はルールで閉じており、サーバーだけが読み書きする）。
//   - 入力は短い地名だけ（60文字まで）。出力は検索文字列の配列のみ。何も保存しない。
//
// 必要な環境変数：ANTHROPIC_API_KEY / FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";

const DAILY_MAX = 80;

function ensureApp() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("missing service account env vars");
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

// 1日の回数を数える（日本時間の日付ごと）。上限を超えたら false
async function countUp(uid) {
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const ref = admin.firestore().collection("usage").doc(`placeQuery_${uid}_${day}`);
  return admin.firestore().runTransaction(async (t) => {
    const s = await t.get(ref);
    const n = s.exists ? Number(s.data().n || 0) : 0;
    if (n >= DAILY_MAX) return false;
    t.set(ref, { uid, n: n + 1, day, at: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

function parseList(raw) {
  let s = String(raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const a = s.indexOf("["), b = s.lastIndexOf("]");
  if (a !== -1 && b > a) s = s.slice(a, b + 1);
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) ? arr.map((x) => String(x || "").trim()).filter((x) => x && x.length <= 120).slice(0, 3) : [];
  } catch (e) { return []; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }
  try {
    ensureApp();
    const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (!m) { res.status(401).json({ error: "no auth token" }); return; }
    const { uid } = await admin.auth().verifyIdToken(m[1]);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "missing ANTHROPIC_API_KEY" }); return; }

    const body = req.body || {};
    const text = String(body.text || "").replace(/\s+/g, " ").trim().slice(0, 60);
    const countries = (Array.isArray(body.countries) ? body.countries : []).map((c) => String(c || "").trim().slice(0, 40)).filter(Boolean).slice(0, 8);
    if (text.length < 2) { res.status(400).json({ error: "text required" }); return; }

    if (!(await countUp(uid))) { res.status(429).json({ error: "daily limit" }); return; }

    const sys =
      "あなたは旅行の地図検索を助けるアシスタントです。ユーザーが日本語（カタカナの通称を含む）で入力した場所の名前を、" +
      "OpenStreetMap の検索（Nominatim）で見つかりやすい、英語または現地語の正式名称に言い換えてください。" +
      (countries.length ? `旅行先の国は次のとおりです：${countries.join("、")}。可能ならこれらの国の中の場所として解釈してください。` : "") +
      "形は『施設名, 都市, 国』にします。表記ゆれで複数の呼び方がある場所は、候補を最大3つまで出します（最初が最有力）。" +
      "実在が確かでない場所は作らず、わからなければ [] を返します。" +
      '出力は文字列の JSON 配列のみ（例：["Sultan Ahmed Mosque, Istanbul, Turkey","Blue Mosque, Istanbul, Turkey"]）。説明やコードフェンスは付けません。';

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 200, system: sys, messages: [{ role: "user", content: text }] })
    });
    if (!r.ok) { console.error("placeQuery anthropic error:", r.status, await r.text().catch(() => "")); res.status(502).json({ error: "failed" }); return; }
    const data = await r.json();
    const out = Array.isArray(data && data.content) ? data.content.filter((c) => c.type === "text").map((c) => c.text).join("\n") : "";
    res.status(200).json({ queries: parseList(out) });
  } catch (e) {
    console.error("placeQuery error:", e);
    res.status(500).json({ error: "server error" });
  }
}
