// 旅程PDFの試作（管理者だけが使える。アプリやサイトの画面には出さない）
// 役割：trip-pdf.html から呼ばれ、指定した国の公開記事（と、管理者が指定した下書き記事）だけを資料にして、
//       行き先・時期・日数・予算に合わせた旅程案を JSON で返す。画面側がA4のPDFレイアウトに流し込む。
//
// 安全策：
//   - Firebase IDトークンを検証し、admins/{uid} がある人（管理者）だけ使える。
//   - 数字（費用・時刻）は記事に書かれているものだけを使わせる。書かれていなければ「記事に情報なし」に回す。
//   - 航空券は Travelpayouts（Aviasales）の数字だけ。
//   - 1人1日 DAILY_MAX 回まで（usage/ はサーバーだけが読み書きする）。
//
// 必要な環境変数：ANTHROPIC_API_KEY、FIREBASE_PROJECT_ID、FIREBASE_CLIENT_EMAIL、FIREBASE_PRIVATE_KEY

import admin from "firebase-admin";
import { UPDATED as FARE_UPDATED, FARES, CITIES } from "./_fares-data.js";
import { COUNTRY_JP } from "./_country-jp.js";

const DAILY_MAX = 30;
const MODEL = "claude-sonnet-4-6";
// 料金の概算（円。1ドル=150円、入力3ドル/出力15ドル（100万トークンあたり）。キャッシュは考えない）
const YEN_IN = (3 * 150) / 1e6, YEN_OUT = (15 * 150) / 1e6;

function ensureApp() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("missing service account env vars");
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

async function countUp(uid) {
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const ref = admin.firestore().collection("usage").doc(`tripPlan_${uid}_${day}`);
  return admin.firestore().runTransaction(async (t) => {
    const s = await t.get(ref);
    const n = s.exists ? Number(s.data().n || 0) : 0;
    if (n >= DAILY_MAX) return false;
    t.set(ref, { uid, n: n + 1, day, at: admin.firestore.FieldValue.serverTimestamp() });
    return true;
  });
}

// 1記事をAIに渡すテキストにする（api/ask.js と同じ考え方。各日の本文は長すぎないように）
function articleToText(a) {
  const lines = [`【記事ID】${a.id}`, `タイトル：${a.title || ""}`];
  const countries = (a.countries || []).map((c) => COUNTRY_JP[c] || c).join("・");
  if (countries) lines.push(`国：${countries}`);
  const costs = a.costs || {};
  const costSum = Object.values(costs).reduce((s, v) => s + (Number(v) || 0), 0);
  if (costSum > 0) {
    const parts = Object.entries(costs).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}:${Number(v)}円`);
    lines.push(`実際にかかった費用（円）：${parts.join("、")}（合計${costSum}円）`);
  }
  if (a.lead) lines.push(`リード：${String(a.lead).replace(/\s+/g, " ").slice(0, 300)}`);
  if (a.body) lines.push(`本文：${String(a.body).replace(/\s+/g, " ").slice(0, 800)}`);
  (Array.isArray(a.days) ? a.days : []).forEach((d, i) => {
    const sum = String(d.summary || "").replace(/\s+/g, " ").slice(0, 160);
    const txt = String(d.text || "").replace(/\s+/g, " ").slice(0, 800);
    lines.push(`DAY${i + 1}：${sum}${txt ? " / " + txt : ""}`);
  });
  if (a.comment) lines.push(`投稿者コメント：${String(a.comment).replace(/\s+/g, " ").slice(0, 800)}`);
  return lines.join("\n");
}

// 国 → 相場カレンダーの都市（CITIES の国名が一致するもの）。Aviasales の数字だけ
function faresFor(countryJp) {
  const out = {};
  const cities = CITIES.filter((c) => c[2] === countryJp);
  if (!cities.length) return { city: "", byOrigin: {} };
  const code = cities[0][0];
  for (const o of ["TYO", "OSA"]) {
    const row = (FARES[o] || {})[code] || {};
    out[o] = {};
    for (const [m, v] of Object.entries(row)) if (Array.isArray(v) && v[0] > 0) out[o][m] = v[0];
  }
  return { city: cities[0][1], byOrigin: out };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "method not allowed" }); return; }
  try {
    ensureApp();
    const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
    if (!m) { res.status(401).json({ error: "no auth token" }); return; }
    const { uid } = await admin.auth().verifyIdToken(m[1]);
    const db = admin.firestore();
    if (!(await db.collection("admins").doc(uid).get()).exists) { res.status(403).json({ error: "admin only" }); return; }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) { res.status(500).json({ error: "missing ANTHROPIC_API_KEY" }); return; }
    if (!(await countUp(uid))) { res.status(429).json({ error: "daily limit" }); return; }

    const body = req.body || {};
    const country = String(body.country || "").trim();
    const month = /^\d{4}-\d{2}$/.test(body.month) ? body.month : "";
    const days = Math.min(Math.max(parseInt(body.days, 10) || 5, 2), 14);
    const budgetMan = Math.min(Math.max(Number(body.budgetMan) || 0, 0), 300);
    const styles = Array.isArray(body.styles) ? body.styles.map(String).slice(0, 5) : [];
    const extraIds = (Array.isArray(body.includeIds) ? body.includeIds : []).map(String).filter((x) => /^[A-Za-z0-9]{10,40}$/.test(x)).slice(0, 5);
    if (!COUNTRY_JP[country]) { res.status(400).json({ error: "bad country" }); return; }
    const countryJp = COUNTRY_JP[country];

    // 資料：その国の公開記事 ＋ 管理者が指定した記事（下書きも可）
    const articles = [];
    const seen = new Set();
    const snap = await db.collection("articles").where("countries", "array-contains", country).get();
    snap.forEach((d) => { if (d.get("status") === "published") { seen.add(d.id); articles.push({ id: d.id, draft: false, ...d.data() }); } });
    for (const id of extraIds) {
      if (seen.has(id)) continue;
      const d = await db.collection("articles").doc(id).get();
      if (d.exists) { seen.add(id); articles.push({ id, draft: d.get("status") !== "published", ...d.data() }); }
    }
    if (!articles.length) { res.status(200).json({ error: "no articles", message: `${countryJp}の記事がありません` }); return; }

    const fares = faresFor(countryJp);
    const validIds = articles.map((a) => a.id);
    const corpus = articles.map(articleToText).join("\n\n----------------\n\n");
    const fareLine = month && fares.byOrigin.TYO
      ? `相場（往復の最安値の目安、円。${FARE_UPDATED}時点）：${month}出発 東京発 ${fares.byOrigin.TYO[month] || "データなし"} / 大阪発 ${(fares.byOrigin.OSA || {})[month] || "データなし"}`
      : "相場：データなし";

    const sys =
      "あなたは、旅の記録サイト『Tabistock』の旅程づくりのアシスタントです。" +
      "渡される『実際の旅の記事』の内容だけをもとに、指定された条件の旅程案を日本語で作ります。" +
      "守ること：" +
      "(1) 記事に書かれていない事実（時刻、料金、営業時間、乗り物、店名、地名）は書かない。創作しない。" +
      "(2) 料金は、記事に『実際にかかった費用』があるものだけを使う。ない項目は costs に入れず、unknown に『〇〇の料金は記事に情報なし』と書く。" +
      "(3) 日数は指定どおり。記事の日数と違うときは、記事の行程を組み替えて、指定の日数に収める（足りない日は『記事に情報なし』と書かず、近い行程を整理して使う）。" +
      "(4) 各日の items は、記事の行程を短い1行ずつにしたもの（最大5つ）。時刻や所要時間は記事にあるときだけ time に入れる。" +
      "(5) 各日と tips には、根拠にした記事のIDを sourceIds に入れる。存在するIDだけ。" +
      "(6) 費用の合計は、costs の合計と一致させる。予算を超えるときは、summary でその旨を短く伝える。" +
      "(7) 文は、短く、やさしく、学生の読者向けに。返答は必ず plan ツールで返す。";

    const userMsg =
      `条件：行き先＝${countryJp}／出発月＝${month || "未指定"}／日数＝${days}日間／予算＝${budgetMan ? budgetMan + "万円（航空券を除く現地費用）" : "未指定"}` +
      (styles.length ? `／スタイル＝${styles.join("・")}` : "") + `\n${fareLine}\n\n` +
      "--- 実際の旅の記事（ここからが資料）---\n" + corpus;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        tools: [{
          name: "plan",
          description: "旅程案を返す",
          input_schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "旅程のタイトル（例：トルコ 6日間）" },
              catch: { type: "string", description: "キャッチコピー（30字以内）" },
              summary: { type: "string", description: "この旅の要約（120字以内）" },
              costs: {
                type: "array", description: "現地費用の内訳。記事に実績があるものだけ",
                items: { type: "object", properties: { label: { type: "string" }, yen: { type: "number" }, sourceId: { type: "string" } }, required: ["label", "yen"] }
              },
              days: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "その日の見出し（20字以内）" },
                    place: { type: "string", description: "その日の主な場所" },
                    items: { type: "array", items: { type: "object", properties: { time: { type: "string" }, text: { type: "string" } }, required: ["text"] } },
                    sourceIds: { type: "array", items: { type: "string" } }
                  },
                  required: ["title", "items", "sourceIds"]
                }
              },
              tips: { type: "array", items: { type: "object", properties: { text: { type: "string" }, sourceId: { type: "string" } }, required: ["text"] }, description: "記事に書かれた注意・コツ（最大4つ）" },
              unknown: { type: "array", items: { type: "string" }, description: "記事に情報がなく、確認が必要なこと" }
            },
            required: ["title", "catch", "summary", "costs", "days", "tips", "unknown"]
          }
        }],
        tool_choice: { type: "tool", name: "plan" },
        system: sys,
        messages: [{ role: "user", content: userMsg }]
      })
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("tripPlan anthropic error:", r.status, errText);
      res.status(502).json({ error: "plan failed", detail: String(r.status) });
      return;
    }
    const data = await r.json();
    const tool = (data.content || []).find((c) => c.type === "tool_use" && c.input);
    if (!tool) { res.status(502).json({ error: "no plan" }); return; }
    const plan = tool.input;
    // 存在しない記事IDは落とす
    const clean = (ids) => (Array.isArray(ids) ? ids.filter((id) => validIds.includes(id)) : []);
    (plan.days || []).forEach((d) => { d.sourceIds = clean(d.sourceIds); });
    (plan.tips || []).forEach((t) => { if (t.sourceId && !validIds.includes(t.sourceId)) t.sourceId = ""; });
    (plan.costs || []).forEach((c) => { if (c.sourceId && !validIds.includes(c.sourceId)) c.sourceId = ""; });

    // 出典の記事（書いた人の名前つき）
    const used = new Set();
    (plan.days || []).forEach((d) => d.sourceIds.forEach((i) => used.add(i)));
    (plan.tips || []).forEach((t) => t.sourceId && used.add(t.sourceId));
    (plan.costs || []).forEach((c) => c.sourceId && used.add(c.sourceId));
    const names = {};
    const sources = [];
    for (const a of articles) {
      if (!used.has(a.id)) continue;
      if (!(a.authorId in names)) {
        try { const u = await db.collection("users").doc(a.authorId).get(); names[a.authorId] = (u.exists && u.data().nickname) || a.authorNickname || ""; } catch (e) { names[a.authorId] = a.authorNickname || ""; }
      }
      sources.push({ id: a.id, title: a.title || "", author: names[a.authorId] || a.authorNickname || "", draft: !!a.draft });
    }

    const u = data.usage || {};
    const yen = Math.round(((u.input_tokens || 0) + (u.cache_creation_input_tokens || 0)) * YEN_IN + (u.output_tokens || 0) * YEN_OUT);
    res.status(200).json({
      plan, sources, fares, fareUpdated: FARE_UPDATED,
      request: { country, countryJp, month, days, budgetMan, styles },
      articleCount: articles.length,
      usage: { inputTokens: u.input_tokens || 0, outputTokens: u.output_tokens || 0, yen }
    });
  } catch (e) {
    console.error("tripPlan error:", e);
    res.status(500).json({ error: String((e && e.message) || e) });
  }
}
