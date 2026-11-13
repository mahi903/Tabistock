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

// 往復：月ごとに「その月に出発する往復の最安値」を1件ずつ取る（主要12都市だけ）
const RT_DEST = ["SEL","TPE","HKG","SHA","BKK","SIN","DPS","LON","PAR","HNL","LAX","SYD"];
function nextMonths(n){
  const out = []; const d = new Date(); d.setUTCDate(1);
  for (let i = 0; i < n; i++){ out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
  return out;
}
async function roundTrip(origin, dest, month, token){
  const p = new URLSearchParams({ origin, destination: dest, currency: "jpy", departure_at: month, one_way: "false", sorting: "price", limit: "30" });
  const r = await fetch("https://api.travelpayouts.com/aviasales/v3/prices_for_dates?" + p, {
    headers: { "X-Access-Token": token, "Accept-Encoding": "gzip, deflate" }
  });
  if (!r.ok) return { error: r.status };
  const j = await r.json();
  // 旅行日数が3〜21日の往復だけ（日帰りや数か月滞在のような極端な日程を除く）
  const days = x => (new Date(x.return_at) - new Date(x.departure_at)) / 86400000;
  const x = (j.data || []).filter(x => x.return_at && days(x) >= 3 && days(x) <= 21)[0];
  return x ? { price: x.price, dep: x.departure_at, ret: x.return_at, transfers: x.transfers, returnTransfers: x.return_transfers } : null;
}

export default async function handler(req, res) {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) { res.status(500).json({ error: "TRAVELPAYOUTS_TOKEN が未設定" }); return; }
  const [o, market, regionKey] = String(req.query.q || "").split("-");
  // 往復を地域ごとに全都市：/api/fare-check/TYO-rt-asia
  if (market === "rt" && regionKey) {
    const origin = (o || "").toUpperCase(); const list = DEST[regionKey];
    if (!["TYO", "OSA"].includes(origin) || !list) { res.status(400).json({ error: "bad params" }); return; }
    const months = nextMonths(12); const jobs = [];
    for (const d of list) for (const m of months) jobs.push([d, m]);
    const out = {};
    for (let i = 0; i < jobs.length; i += 24) {
      const chunk = jobs.slice(i, i + 24);
      const rs = await Promise.all(chunk.map(([d, m]) => roundTrip(origin, d, m, token).catch(() => null)));
      chunk.forEach(([d, m], k) => { if (rs[k] && rs[k].price) (out[d] ||= {})[m] = rs[k]; });
    }
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).json({ origin, mode: "roundtrip", region: regionKey, routes: out });
    return;
  }
  // 帰り（現地→日本）の片道：/api/fare-check/TYO-ret
  if (market === "ret") {
    const home = (o || "").toUpperCase();
    if (!["TYO", "OSA"].includes(home)) { res.status(400).json({ error: "origin は TYO か OSA" }); return; }
    const out = {};
    const rs = await Promise.all(RT_DEST.map(d => monthly(d, home, null, token).catch(e => ({ error: String(e) }))));
    RT_DEST.forEach((d, k) => { out[d] = rs[k]; });
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).json({ to: home, mode: "return-oneway", routes: out });
    return;
  }
  if (market === "rt") {
    const origin = (o || "").toUpperCase();
    if (!["TYO", "OSA"].includes(origin)) { res.status(400).json({ error: "origin は TYO か OSA" }); return; }
    const months = nextMonths(12); const out = {};
    for (const d of RT_DEST) {
      const rs = await Promise.all(months.map(m => roundTrip(origin, d, m, token).catch(e => ({ error: String(e) }))));
      out[d] = {}; months.forEach((m, k) => { out[d][m] = rs[k]; });
    }
    const summary = Object.fromEntries(Object.entries(out).map(([d, v]) => [d, Object.values(v).filter(x => x && x.price).length]));
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(200).json({ origin, mode: "roundtrip", summary, routes: out });
    return;
  }
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
