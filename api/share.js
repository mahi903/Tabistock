// 共有リンクのプレビュー（OGP）用サーバーレス関数
// 目的：LINE・インスタ・iMessage などがリンク先を読みに来たとき、
//       記事ごとの写真・タイトル・説明を返して、きれいなプレビューを出す。
// 呼ばれ方：vercel.json で「プレビュー取得ロボット（User-Agent で判定）が
//          /articles/view.html を開いたときだけ」ここに回される。
//          人が開いたときは今までどおり静的な view.html が表示される。
// 金額は出さない（写真・タイトル・場所・日数・投稿者・リードのみ）。

import admin from "firebase-admin";
import { COUNTRY_JP } from "./_country-jp.js";

function ensureApp() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) throw new Error("missing service account env vars");
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const SITE = "https://tabistock.jp";
const DEF_IMG = SITE + "/images/og-image.png";
const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

function place(d) {
  const cs = (d.countries || []).map((c) => COUNTRY_JP[c] || "").filter(Boolean);
  if (!cs.length) return "";
  return cs.slice(0, 2).join("・") + (cs.length > 2 ? " ほか" : "");
}
function days(d) {
  if (d.dateStart && d.dateEnd) {
    const n = Math.round((new Date(d.dateEnd) - new Date(d.dateStart)) / 864e5) + 1;
    if (n > 0 && n < 400) return n === 1 ? "日帰り" : n === 2 ? "1泊" : n <= 5 ? "3〜5日" : n <= 9 ? "1週間" : n <= 16 ? "2週間" : n <= 23 ? "3週間" : "3週間〜";
  }
  return "";
}

function page({ title, desc, image, url }) {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Tabistock">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
</head><body><p><a href="${esc(url)}">${esc(title)}</a></p></body></html>`;
}

export default async function handler(req, res) {
  const id = typeof req.query.id === "string" ? req.query.id.slice(0, 60) : "";
  const url = SITE + "/articles/view.html" + (id ? "?id=" + encodeURIComponent(id) : "");
  let meta = { title: "Tabistock｜学生・若者のための旅のプラットフォーム", desc: "実際に行った旅の旅程・移動・写真を、そのまま残して共有できる旅のプラットフォーム。", image: DEF_IMG, url };
  try {
    if (id && /^[A-Za-z0-9_-]+$/.test(id)) {
      ensureApp();
      const db = admin.firestore();
      const snap = await db.collection("articles").doc(id).get();
      const d = snap.exists ? snap.data() : null;
      if (d && d.status === "published") {
        let author = d.authorNickname || "";
        if (!author && d.authorId) {
          const u = await db.collection("users").doc(d.authorId).get().catch(() => null);
          author = (u && u.exists && u.data().nickname) || "";
        }
        const isTransit = d.type === "transit";
        const title = d.title || (isTransit ? `${place(d)}でのトランジット` : "旅程");
        const info = [place(d), isTransit ? "トランジット" : days(d)].filter(Boolean).join("・");
        const head = [info, author].filter(Boolean).join("｜");
        meta = {
          title: `${title}｜Tabistock`,
          desc: cut([head, d.lead || ""].filter(Boolean).join("　"), 110),
          image: d.thumbUrl || (d.heroUrls && d.heroUrls[0]) || DEF_IMG,
          url,
        };
      }
    }
  } catch (e) {
    console.error("share meta failed", e && e.message);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=86400");
  res.status(200).send(page(meta));
}
