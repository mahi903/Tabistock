// 旅の相談AI（Vercel サーバーレス関数）
// 役割：ask.html の「AIに相談」から呼ばれ、ユーザーの自然文の質問（チャット形式で続けて質問できる）に対して
//       公開中の旅程記事だけを読み、その内容にもとづいてアドバイスを返す。
//       あわせて「参考になる記事」のIDを返し、画面側でリンクを出す。
//
// 安全策：
//   - 呼び出し元の Firebase IDトークンを検証（ログイン中の本人だけが使える）。
//   - 回答は必ず「渡した記事の範囲」で行うよう指示（記事に無いことは創作しない）。
//   - 紹介する記事は、実在する記事ID（articleIds）の中からのみ選ばせる。
//   - 航空券の相場カレンダー（月別の往復最安値）は、flights.html と同じく
//     「記事を1本以上公開した人」にだけ資料として渡す（先行公開のため）。
//
// 必要な環境変数（Vercel の Settings → Environment Variables に登録）：
//   ANTHROPIC_API_KEY      … Anthropic コンソールで発行した API キー（extractPlaces と共通）
//   FIREBASE_PROJECT_ID    … サービスアカウントの project_id
//   FIREBASE_CLIENT_EMAIL  … 同 client_email
//   FIREBASE_PRIVATE_KEY   … 同 private_key

import admin from "firebase-admin";
import { UPDATED as FARE_UPDATED, FARES, SKY, CITIES } from "./_fares-data.js";

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
  australia: "オーストラリア", "new-zealand": "ニュージーランド",
  "timor-leste": "東ティモール",
  "iraq": "イラク",
  "palestine": "パレスチナ",
  "vatican": "バチカン",
  "san-marino": "サンマリノ",
  "liechtenstein": "リヒテンシュタイン",
  "andorra": "アンドラ",
  "kosovo": "コソボ",
  "ukraine": "ウクライナ",
  "greenland": "グリーンランド",
  "belize": "ベリーズ",
  "honduras": "ホンジュラス",
  "el-salvador": "エルサルバドル",
  "nicaragua": "ニカラグア",
  "dominican-republic": "ドミニカ共和国",
  "bahamas": "バハマ",
  "puerto-rico": "プエルトリコ",
  "antarctica": "南極",
  "algeria": "アルジェリア",
  "cape-verde": "カーボベルデ",
  "seychelles": "セーシェル",
  "mozambique": "モザンビーク",
  "malawi": "マラウイ",
  "samoa": "サモア",
  "tonga": "トンガ",
  "vanuatu": "バヌアツ",
  "cook-islands": "クック諸島",
  "papua-new-guinea": "パプアニューギニア",
  "macau": "マカオ",
  "laos": "ラオス",
  "myanmar": "ミャンマー",
  "brunei": "ブルネイ",
  "tajikistan": "タジキスタン",
  "turkmenistan": "トルクメニスタン",
  "georgia": "ジョージア",
  "armenia": "アルメニア",
  "azerbaijan": "アゼルバイジャン",
  "jordan": "ヨルダン",
  "israel": "イスラエル",
  "lebanon": "レバノン",
  "oman": "オマーン",
  "saudi": "サウジアラビア",
  "bahrain": "バーレーン",
  "kuwait": "クウェート",
  "iran": "イラン",
  "slovenia": "スロベニア",
  "bosnia": "ボスニア・ヘルツェゴビナ",
  "montenegro": "モンテネグロ",
  "serbia": "セルビア",
  "albania": "アルバニア",
  "north-macedonia": "北マケドニア",
  "bulgaria": "ブルガリア",
  "romania": "ルーマニア",
  "moldova": "モルドバ",
  "malta": "マルタ",
  "cyprus": "キプロス",
  "luxembourg": "ルクセンブルク",
  "monaco": "モナコ",
  "russia": "ロシア",
  "cuba": "キューバ",
  "guatemala": "グアテマラ",
  "costarica": "コスタリカ",
  "panama": "パナマ",
  "jamaica": "ジャマイカ",
  "colombia": "コロンビア",
  "ecuador": "エクアドル",
  "uruguay": "ウルグアイ",
  "paraguay": "パラグアイ",
  "tunisia": "チュニジア",
  "tanzania": "タンザニア",
  "ethiopia": "エチオピア",
  "uganda": "ウガンダ",
  "rwanda": "ルワンダ",
  "ghana": "ガーナ",
  "senegal": "セネガル",
  "namibia": "ナミビア",
  "botswana": "ボツワナ",
  "zambia": "ザンビア",
  "zimbabwe": "ジンバブエ",
  "madagascar": "マダガスカル",
  "mauritius": "モーリシャス",
  "hawaii": "ハワイ",
  "guam": "グアム",
  "saipan": "サイパン",
  "palau": "パラオ",
  "fiji": "フィジー",
  "new-caledonia": "ニューカレドニア",
  "tahiti": "タヒチ"
};

const STYLE_JP = {
  solo: "1人旅", friends: "友達と", family: "家族と", backpacker: "バックパッカー", girls: "女子旅",
  couple: "カップル", nature: "自然・絶景", city: "都市・街歩き", local: "現地体験", "round-trip": "周遊",
  bicycle: "自転車旅", train: "電車旅", "study-abroad": "留学中", "world-trip": "世界一周中", transit: "トランジット"
};

const BUDGET_JP = {
  "5": "〜5万円", "10": "〜10万円", "15": "〜15万円", "20": "〜20万円", "25": "〜25万円", "30": "〜30万円", "35": "〜35万円", "40": "〜40万円", "45": "〜45万円", "50": "〜50万円", "50plus": "50万円以上"
};

// 記事を1本以上公開しているか（相場カレンダーの先行公開の判定。api/fares.js と同じ条件）
async function hasPublishedArticle(uid) {
  const col = admin.firestore().collection("articles");
  const own = await col.where("authorId", "==", uid).get();
  if (own.docs.some((d) => d.get("status") === "published")) return true;
  const co = await col.where("coAuthorIds", "array-contains", uid).get();
  return co.docs.some((d) => d.get("status") === "published");
}

// 相場カレンダーのデータをAIに渡すテキストにする。
// 都市ごとに「東京発／大阪発」の月別往復最安値（万円）を1行にまとめる。
// 価格は Aviasales と Skyscanner の安いほう（flights.html と同じ考え方）。
const FARE_MONTHS = ["2026-11","2026-12","2027-01","2027-02","2027-03","2027-04","2027-05","2027-06","2027-07","2027-08","2027-09","2027-10"];
function fareAt(o, code, m) {
  const a = ((FARES[o] || {})[code] || {})[m];
  const s = ((SKY[o] || {})[code] || {})[m];
  const av = Array.isArray(a) ? a[0] : null;
  const vals = [av, s].filter((v) => typeof v === "number" && v > 0);
  return vals.length ? Math.min(...vals) : null;
}
function faresToText() {
  const lines = CITIES.map(([code, name, country, region]) => {
    const part = (o, label) => {
      const cells = FARE_MONTHS.map((m) => {
        const v = fareAt(o, code, m);
        const [y, mm] = m.split("-");
        return `${y.slice(2)}年${Number(mm)}月:${v ? (v / 10000).toFixed(1) : "-"}`;
      });
      return `${label} ${cells.join(" ")}`;
    };
    return `${name}（${country}／${region}）｜${part("TYO", "東京発")}｜${part("OSA", "大阪発")}`;
  });
  return "--- 航空券の相場カレンダー（ここからが資料）---\n" +
    `日本発・往復の、出発月ごとの最安値の目安（単位：万円。${FARE_UPDATED}時点。Aviasales・Skyscanner調べ）。` +
    "「-」はデータなし。表示は出発月で、旅の日数や乗り継ぎ回数は含まない。\n" + lines.join("\n");
}

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
  // 旅の出発地（AIが「日本からの往復旅行」を優先して紹介できるように明示する）
  if (a.type !== "transit") {
    const st = a.styles || [];
    const domestic = (a.countries || []).length > 0 && (a.countries || []).every((c) => c === "japan");
    if (domestic) lines.push("旅の形：国内旅行");
    else if (a.notFromJapan || st.includes("study-abroad") || st.includes("world-trip")) {
      lines.push("旅の形：日本からの往復ではない（留学先・世界一周・旅の途中から出発）");
    } else lines.push("旅の形：日本から往復した海外旅行");
  }
  if (budget) lines.push(`予算：${budget}`);
  // 実際にかかった費用の合計（費用内訳の合計）。区分より正確なので一緒に渡す
  const costSum = Object.values(a.costs || {}).reduce((s, v) => s + (Number(v) || 0), 0);
  if (costSum > 0) lines.push(`費用の合計：約${(costSum / 10000).toFixed(1)}万円`);
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
  const fallback = { answer: String(raw || "").trim(), articleIds: [], usedFares: false };
  if (!raw) return { answer: "", articleIds: [], usedFares: false };
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
    return { answer, articleIds: ids, usedFares: obj.usedFares === true };
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
    const { uid } = await admin.auth().verifyIdToken(m[1]);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "missing ANTHROPIC_API_KEY" }); return; }

    // 会話（チャット形式）。messages があればそれを、なければ従来どおり question 1つを使う。
    //   - user と assistant が交互になるよう整え、最後は必ず user にする
    //   - 直近20発言まで・1発言の長さにも上限をつけて、料金が増えすぎないようにする
    //   - assistant の発言は、AIが出す形式（JSON）に戻して渡す（答え方の形をそろえるため）
    const body = req.body || {};
    let convo = [];
    if (Array.isArray(body.messages)) {
      for (const m of body.messages.slice(-20)) {
        if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
        const text = String(m.content || "").trim();
        if (!text) continue;
        const content = m.role === "user"
          ? text.slice(0, 1000)
          : JSON.stringify({
              answer: text.slice(0, 2000),
              articleIds: Array.isArray(m.articleIds) ? m.articleIds.map(String).slice(0, 5) : [],
              usedFares: m.usedFares === true
            });
        if (convo.length && convo[convo.length - 1].role === m.role) convo[convo.length - 1] = { role: m.role, content };
        else convo.push({ role: m.role, content });
      }
      while (convo.length && convo[0].role !== "user") convo.shift();
    } else if (body.question) {
      convo = [{ role: "user", content: String(body.question).slice(0, 1000).trim() }];
    }
    if (!convo.length || convo[convo.length - 1].role !== "user") {
      res.status(400).json({ error: "question required" });
      return;
    }

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

    // 相場カレンダーは記事を公開した人にだけ渡す（先行公開）
    let fareOK = false;
    try { fareOK = await hasPublishedArticle(uid); } catch (e) { console.error("fare check error:", e); }

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
      '{"answer":"回答本文","articleIds":["記事ID1","記事ID2"],"usedFares":false}。' +
      "answer 本文の中では『記事ID』という文字列やIDそのものは書かないでください" +
      "（記事へのリンクは画面側が articleIds をもとに自動で表示します）。" +
      "(0) 会話は続けて行われることがある。前のやり取りをふまえて、『そこ』『それ』『じゃあ9月は？』のような質問にも文脈で答える。" +
      "記事の紹介（articleIds）は、その回の質問に本当に関係するものだけにし、前の回と同じ記事をくり返し入れなくてよい。" +
      "(5) 記事を紹介する優先順位：海外旅行の相談では『旅の形：日本から往復した海外旅行』の記事を最優先する。" +
      "『日本からの往復ではない（留学先・世界一周・旅の途中から）』記事は、費用や日程の組み方が日本発の旅行と大きく違うので、" +
      "日本から往復する記事が無いとき、または質問が留学・世界一周・現地からの旅についてのときだけ紹介する。" +
      "その場合は『留学中の旅の記事ですが』のように、日本発ではないことを回答の中で一言断る。" +
      "費用や日数の目安を答えるときも、日本から往復した記事の数字を優先する。" +
      "(6) 航空券の値段や『何月が安いか』を聞かれたときは、記事に書かれた実際の運賃に加えて、" +
      "資料に『航空券の相場カレンダー』があればその数字を使って答える。" +
      "相場カレンダーの数字は『〇〇時点の目安』であり、実際の価格は予約サイトで変わることを一言添える。" +
      "使ったときは JSON に \"usedFares\":true を入れる（使っていなければ false）。" +
      "資料に相場カレンダーが無い場合は、数字を推測せず、記事の運賃の範囲で答え、" +
      "『月ごとの相場は、記事を1本公開すると使える相場カレンダー（先行公開中）で見られます』と案内してよい。";

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
          { type: "text", text: corpusBlock, cache_control: { type: "ephemeral" } },
          // 相場カレンダー（記事を公開した人だけ）。データ更新まで同一なのでこれもキャッシュ
          ...(fareOK ? [{ type: "text", text: faresToText(), cache_control: { type: "ephemeral" } }] : [])
        ],
        messages: convo
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

    res.status(200).json({ answer: parsed.answer, articles: refs, fares: fareOK && parsed.usedFares });
  } catch (e) {
    console.error("ask error:", e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
