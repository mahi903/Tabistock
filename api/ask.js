// 旅の相談AI（Vercel サーバーレス関数）
// 役割：search.html の「AIに相談」から呼ばれ、ユーザーの自然文の質問に対して
//       公開中の旅程記事だけを読み、その内容にもとづいてアドバイスを返す。
//       あわせて「参考になる記事」のIDを返し、画面側でリンクを出す。
//
// 安全策：
//   - 呼び出し元の Firebase IDトークンを検証（ログイン中の本人だけが使える）。
//   - 回答は必ず「渡した記事の範囲」で行うよう指示（記事に無いことは創作しない）。
//   - 紹介する記事は、実在する記事ID（articleIds）の中からのみ選ばせる。
//
// 必要な環境変数（Vercel の Settings → Environment Variables に登録）：
//   ANTHROPIC_API_KEY      … Anthropic コンソールで発行した API キー（extractPlaces と共通）
//   FIREBASE_PROJECT_ID    … サービスアカウントの project_id
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

// 国コード → 日本語名（記事の countries はコードで入っているため）
const COUNTRY_JP = {
  japan: "日本", korea: "韓国", china: "中国", taiwan: "台湾", hongkong: "香港", mongolia: "モンゴル",
  thai: "タイ", cambodia: "カンボジア", vietnam: "ベトナム", malaysia: "マレーシア", singapore: "シンガポール",
  indonesia: "インドネシア", philippines: "フィリピン",
  india: "インド", nepal: "ネパール", srilanka: "スリランカ", bhutan: "ブータン", maldives: "モルディブ",
  pakistan: "パキスタン", bangladesh: "バングラデシュ",
  kazakhstan: "カザフスタン", kyrgyzstan: "キルギス", uzbekistan: "ウズベキスタン",
  turkey: "トルコ", qatar: "カタール", UAE: "アラブ首長国連邦",
  finland: "フィンランド", sweden: "スウェーデン", norway: "ノルウェー", estonia: "エストニア", latvia: "ラトビア",
  lithuania: "リトアニア", croatia: "クロアチア", austria: "オーストリア", hungary: "ハンガリー", slovakia: "スロバキア",
  france: "フランス", uk: "イギリス", italy: "イタリア", spain: "スペイン", germany: "ドイツ", netherlands: "オランダ",
  switzerland: "スイス", portugal: "ポルトガル", greece: "ギリシャ", czech: "チェコ", poland: "ポーランド",
  belgium: "ベルギー", ireland: "アイルランド", denmark: "デンマーク", iceland: "アイスランド",
  usa: "アメリカ", canada: "カナダ", mexico: "メキシコ",
  peru: "ペルー", bolivia: "ボリビア", chile: "チリ", argentina: "アルゼンチン", brazil: "ブラジル",
  morocco: "モロッコ", egypt: "エジプト", kenya: "ケニア", "south-africa": "南アフリカ",
  australia: "オーストラリア", "new-zealand": "ニュージーランド"
};

const STYLE_JP = {
  solo: "1人旅", friends: "友達と", family: "家族と", backpacker: "バックパッカー", girls: "女子旅",
  couple: "カップル", nature: "自然・絶景", city: "都市・街歩き", local: "現地体験", "round-trip": "周遊",
  bicycle: "自転車旅", train: "電車旅", transit: "トランジット"
};

const BUDGET_JP = {
  "10": "〜10万円", "20": "〜20万円", "30": "〜30万円", "40": "〜40万円", "50": "〜50万円", "50plus": "50万円以上"
};

// 1記事をAIに渡す用のテキストに整形（長すぎないよう各日の本文は要約寄りに抑える）。
function articleToText(a) {
  const countries = (a.countries || []).map((c) => COUNTRY_JP[c] || c).join("・");
  const styles = (a.styles || []).map((s) => STYLE_JP[s] || s).join("・");
  const budget = BUDGET_JP[a.budget] || a.budget || "";
  const lines = [];
  lines.push(`【記事ID】${a.id}`);
  if (a.type === "transit") lines.push("種別：トランジット（乗り継ぎ）記事");
  lines.push(`タイトル：${a.title || ""}`);
  if (countries) lines.push(`国：${countries}`);
  if (budget) lines.push(`予算：${budget}`);
  if (styles) lines.push(`スタイル：${styles}`);
  // トランジット記事は空港・乗り継ぎ時間・本文を渡す（days/budget は無い）
  if (a.airport) lines.push(`空港：${a.airport}`);
  if (a.layover) lines.push(`乗り継ぎ時間：${a.layover}時間`);
  if (a.body) lines.push(`本文：${String(a.body).replace(/\s+/g, " ").slice(0, 800)}`);
  if (a.lead) lines.push(`リード：${String(a.lead).replace(/\s+/g, " ").slice(0, 300)}`);
  const days = Array.isArray(a.days) ? a.days : [];
  days.forEach((d, i) => {
    const sum = String(d.summary || "").replace(/\s+/g, " ").slice(0, 120);
    const txt = String(d.text || "").replace(/\s+/g, " ").slice(0, 600);
    lines.push(`DAY${i + 1}：${sum}${txt ? " / " + txt : ""}`);
  });
  // 投稿者コメントは要約せず全文を渡す（投稿者の生の助言を尊重するため）。
  if (a.comment) lines.push(`投稿者コメント：${String(a.comment).replace(/\s+/g, " ")}`);
  return lines.join("\n");
}

// Claude の返答（JSON）から answer と articleIds を安全に取り出す。
function parseAnswer(raw, validIds) {
  const fallback = { answer: String(raw || "").trim(), articleIds: [] };
  if (!raw) return { answer: "", articleIds: [] };
  let s = String(raw).trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1 && b > a) s = s.slice(a, b + 1);
  try {
    const obj = JSON.parse(s);
    const answer = String(obj.answer || "").trim();
    let ids = Array.isArray(obj.articleIds) ? obj.articleIds.map((x) => String(x)) : [];
    // 実在するIDだけに絞る（AIが存在しないIDを返しても無視）
    ids = ids.filter((id) => validIds.includes(id)).slice(0, 5);
    if (!answer) return fallback;
    return { answer, articleIds: ids };
  } catch (e) {
    return fallback;
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
    const question = String(body.question || "").slice(0, 1000).trim();
    if (!question) { res.status(400).json({ error: "question required" }); return; }

    // 公開中の記事をすべて取得（今は件数が少ないので全件渡す）。
    const db = admin.firestore();
    const snap = await db.collection("articles").where("status", "==", "published").get();
    const articles = [];
    snap.forEach((d) => articles.push({ id: d.id, ...d.data() }));

    if (!articles.length) {
      res.status(200).json({
        answer: "まだ公開されている旅程記事がないため、記事をもとにしたお答えができません。記事が増えると、ここから相談できるようになります。",
        articleIds: []
      });
      return;
    }

    const validIds = articles.map((a) => a.id);
    const corpus = articles.map(articleToText).join("\n\n----------------\n\n");

    const sys =
      "あなたは旅の相談に乗るアシスタントです。ユーザーの質問に対して、" +
      "以下に渡される『Tabistockに投稿された旅程記事』の内容だけをもとに、" +
      "実用的なアドバイスを日本語で答えてください。" +
      "重要なルール：" +
      "(1) 記事に書かれていないことは推測で創作せず、わかる範囲で正直に答える。" +
      "記事に関連情報が無い場合は、その旨を正直に伝え、無理に記事を紹介しない。" +
      "(2) 回答は親しみやすく簡潔に。要点を2〜4文程度＋必要なら箇条書きでまとめる。" +
      "(3) 参考になる記事があれば、その『記事ID』を articleIds に入れる" +
      "（関連が薄い記事は入れない。最大3件まで。本当に関連する記事だけ）。" +
      "(4) 出力は必ず次のJSON形式のみ。説明文やコードフェンスは付けない：" +
      '{"answer":"回答本文","articleIds":["記事ID1","記事ID2"]}。' +
      "answer 本文の中では『記事ID』という文字列やIDそのものは書かないでください" +
      "（記事へのリンクは画面側が articleIds をもとに自動で表示します）。";

    // 記事本文（資料）。毎回まったく同じ前置きなので、ここをプロンプトキャッシュ対象にする。
    const corpusBlock = "--- 旅程記事（ここからが資料）---\n" + corpus;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        // system を2ブロックに分割し、それぞれに cache_control を付ける。
        //  - 指示文：ほぼ不変 → 記事を追加してもキャッシュが効き続ける
        //  - 記事本文：記事が変わるまで同一 → 2回目以降は入力料金が最大90%オフ
        // （プロンプトキャッシュはGA機能。ベータヘッダ不要。最低約1024トークンで有効化）
        system: [
          { type: "text", text: sys, cache_control: { type: "ephemeral" } },
          { type: "text", text: corpusBlock, cache_control: { type: "ephemeral" } }
        ],
        messages: [{ role: "user", content: question }]
      })
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("anthropic error:", r.status, errText);
      res.status(502).json({ error: "ask failed" });
      return;
    }

    const data = await r.json();
    const out = (data && Array.isArray(data.content))
      ? data.content.filter((c) => c.type === "text").map((c) => c.text).join("\n")
      : "";
    const parsed = parseAnswer(out, validIds);

    // 画面リンク用に、紹介する記事の最小情報も返す。
    const byId = {};
    articles.forEach((a) => { byId[a.id] = a; });
    const refs = parsed.articleIds.map((id) => {
      const a = byId[id] || {};
      const c = (a.countries || [])[0];
      return { id, title: a.title || "", country: COUNTRY_JP[c] || "" };
    });

    res.status(200).json({ answer: parsed.answer, articles: refs });
  } catch (e) {
    console.error("ask error:", e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
