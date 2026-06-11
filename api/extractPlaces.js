// 旅の記録の本文から観光地名を抽出する（Vercel サーバーレス関数）
// 役割：post.html の「本文から自動検出」ボタンから呼ばれ、
//       Claude（Anthropic Messages API）で文章中の観光地・地名を抜き出して返す。
//       地図上の座標化（ジオコーディング）はクライアント側（Nominatim）が担当。
//
// 安全策：
//   - 呼び出し元の Firebase IDトークンを検証（ログイン中の本人だけが使える）。
//   - 出力は地名の配列のみ。長文・本文の保存などは一切しない。
//
// 必要な環境変数（Vercel の Settings → Environment Variables に登録）：
//   ANTHROPIC_API_KEY      … Anthropic コンソールで発行した API キー
//   FIREBASE_PROJECT_ID    … （sendPush と共通）サービスアカウントの project_id
//   FIREBASE_CLIENT_EMAIL  … 同 client_email
//   FIREBASE_PRIVATE_KEY   … 同 private_key

import admin from "firebase-admin";

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

// Claude の返答から JSON 配列だけを安全に取り出す。
function parsePlaces(raw) {
  if (!raw) return [];
  let s = String(raw).trim();
  // ```json ... ``` のようなコードフェンスを除去
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  // 最初の [ から最後の ] までを抜き出す
  const a = s.indexOf("[");
  const b = s.lastIndexOf("]");
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => (typeof x === "string" ? x : (x && x.name) || ""))
      .map((x) => String(x).trim())
      .filter((x) => x.length > 0 && x.length <= 80)
      .slice(0, 10);
  } catch (e) {
    return [];
  }
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
    await admin.auth().verifyIdToken(m[1]);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "missing ANTHROPIC_API_KEY" }); return; }

    const body = req.body || {};
    const text = String(body.text || "").slice(0, 4000).trim();
    const country = String(body.country || "").slice(0, 60).trim();
    if (!text) { res.status(400).json({ error: "text required" }); return; }

    const sys =
      "あなたは旅行日記から『筆者がその日に実際に訪れた場所』だけを抽出するアシスタントです。" +
      "入力された文章を読み、筆者が実際に行った・滞在した・通った観光地や施設、都市、名所のうち、" +
      "地図で位置を特定できる固有の地名だけを、本文に出てくる順に抜き出してください。" +
      "次のものは必ず除外します：" +
      "(1) たとえ・比喩・印象として挙げられた場所（例：『まるでロンドンにいるよう』『パリのような街並み』）、" +
      "(2) 願望・予定だけで未訪問の場所（例：『いつか行きたい』『次は◯◯へ』）、" +
      "(3) 過去の別の旅行の回想や、他人から聞いた話の中の場所、" +
      "(4) 国名・地方名・大陸など範囲が広すぎる一般的言及（例：『ヨーロッパでは』）、" +
      "(5) 固有名のない一般名詞（ホテル・レストラン・市場・空港など）、料理名、人名、感想。" +
      "判断に迷う（実際に訪れたか不確かな）場所は含めないでください。" +
      (country ? `舞台となる国はおおむね「${country}」です。この国の中の場所を優先してください。` : "") +
      "出力は地名の文字列だけを要素に持つ JSON 配列のみ。説明文やコードフェンスは付けないでください。" +
      "該当が無ければ [] を返します。";

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 512,
        system: sys,
        messages: [{ role: "user", content: text }]
      })
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("anthropic error:", r.status, errText);
      res.status(502).json({ error: "extraction failed" });
      return;
    }

    const data = await r.json();
    const out = (data && Array.isArray(data.content))
      ? data.content.filter((c) => c.type === "text").map((c) => c.text).join("\n")
      : "";
    const places = parsePlaces(out);

    res.status(200).json({ places });
  } catch (e) {
    console.error("extractPlaces error:", e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
