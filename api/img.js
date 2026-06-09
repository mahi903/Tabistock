// 画像プロキシ（Vercel サーバーレス関数）
// 目的：Firebase Storage の画像には CORS ヘッダが無く、ブラウザの canvas に
//       取り込めない（ストーリー画像生成が失敗する）。そこで同一オリジンの
//       /api/img?u=<画像URL> 経由でサーバー側が取得し、CORS 付きで返す。
// 安全策：Firebase Storage のURLのみ許可（オープンプロキシ化を防ぐ）。

export default async function handler(req, res) {
  const u = req.query.u;
  if (!u || typeof u !== "string" ||
      !/^https:\/\/firebasestorage\.googleapis\.com\//.test(u)) {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  try {
    const r = await fetch(u);
    if (!r.ok) { res.status(r.status).end(); return; }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, immutable");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).json({ error: "fetch failed" });
  }
}
