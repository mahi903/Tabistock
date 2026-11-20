// Vercel Routing Middleware（静的ファイルより先に動く）
// 共有リンク /articles/view.html?id=… を「プレビュー取得ロボット」が開いたときだけ、
// 記事ごとの OGP を返す /api/share の結果を返す。人が開いたときは何もしない（通常の view.html）。
export const config = { matcher: "/articles/view.html" };

const BOT = /(facebookexternalhit|facebookcatalog|meta-externalagent|twitterbot|line-poker|slackbot|discordbot|whatsapp|telegrambot|skypeuripreview|linkedinbot|pinterest|embedly|applebot|google-inspectiontool|bingbot|googlebot|kakaotalk|redditbot|mastodon|iframely|vkshare|bot|crawler|spider)/i;

export default async function middleware(req) {
  const ua = req.headers.get("user-agent") || "";
  if (!BOT.test(ua)) return;   // 人 → そのまま静的ページへ
  const u = new URL(req.url);
  const id = u.searchParams.get("id") || "";
  return fetch(new URL("/api/share?id=" + encodeURIComponent(id), u.origin));
}
