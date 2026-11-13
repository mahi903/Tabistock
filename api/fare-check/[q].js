// 航空券相場（Travelpayouts / Aviasales Data API）のデータ量チェック用（一時的な確認ツール）
// 使い方：/api/fare-check/TYO  または  /api/fare-check/OSA-jp（-jp を付けると日本市場のデータ）
// 主要64都市について、12か月のうち何か月分の最安値データがあるかを返す。
// トークンは Vercel の環境変数 TRAVELPAYOUTS_TOKEN（コードには書かない）。結果は1時間CDNにキャッシュ。

const DEST = {
  asia: ["SEL","PUS","TPE","HKG","SHA","BJS","BKK","SGN","HAN","DAD","SIN","KUL","MNL","CEB","DPS","DEL","KTM","ULN","ALA","TAS","DXB","IST"],
  europe: ["LON","PAR","ROM","MIL","BCN","MAD","LIS","AMS","FRA","MUC","ZRH","VIE","PRG","BUD","HEL","CPH","STO","ATH"],
  africa: ["CAI","RAK","NBO","JNB","CPT"],
  northAmerica: ["HNL","GUM","LAX","SFO","SEA","NYC","YVR","YTO"],
  latinAmerica: ["MEX","CUN","LIM","SAO","BUE"],
  oceania: ["SYD","MEL","BNE","CNS","PER","AKL"]
};

async function monthly(origin, dest, market, token){
  const p = new URLSearchParams({ origin, destination: dest, currency: "jpy", group_by: "month" });
  if (market) p.set("market", market);
  const r = await fetch("https://api.travelpayouts.com/aviasales/v3/grouped_prices?" + p, {
    headers: { "X-Access-Token": token, "Accept-Encoding": "gzip, deflate" }
  });
  if (!r.ok) return { error: r.status };
  const j = await r.json();
  const months = {};
  for (const [m, v] of Object.entries(j.data || {})) months[m] = { price: v.price, transfers: v.transfers };
  const prices = Object.values(months).map(v => v.price);
  return { n: prices.length, min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null, months };
}

export default async function handler(req, res) {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) { res.status(500).json({ error: "TRAVELPAYOUTS_TOKEN が未設定" }); return; }
  const [o, market] = String(req.query.q || "").split("-");
  const origin = (o || "").toUpperCase();
  if (!["TYO", "OSA"].includes(origin)) { res.status(400).json({ error: "origin は TYO か OSA" }); return; }

  const jobs = [];
  for (const [region, list] of Object.entries(DEST)) for (const d of list) jobs.push({ region, d });
  const out = {};
  // 同時に16件ずつ問い合わせる
  for (let i = 0; i < jobs.length; i += 16) {
    const chunk = jobs.slice(i, i + 16);
    const rs = await Promise.all(chunk.map(j => monthly(origin, j.d, market, token).catch(e => ({ error: String(e) }))));
    chunk.forEach((j, k) => { (out[j.region] ||= {})[j.d] = rs[k]; });
  }
  const summary = {};
  for (const [region, obj] of Object.entries(out)) {
    const v = Object.values(obj);
    summary[region] = { routes: v.length, full12: v.filter(x => x.n >= 12).length, some: v.filter(x => x.n > 0 && x.n < 12).length, none: v.filter(x => !x.n).length };
  }
  res.setHeader("Cache-Control", "s-maxage=3600");
  res.status(200).json({ origin, market: market || null, summary, routes: out });
}
