// ストーリー画像（1080×1920）の作成。サイトの記事ページ（articles/view.html）と同じ見た目。
// 写真は Firebase Storage の CORS を避けるため /api/img 経由で読む。
const STORY_BLUR_IDS = new Set([
  "fwlRy8m6gFEKYaKeRjJD",  // プーケット（横長サムネで顔が切れるため正方形クロップ＋上下ぼかし）
]);

// 文字を最大幅で折り返す（日本語＝1文字ずつ計測、改行も尊重）
function wrapText(ctx, text, maxW){
  const lines = []; let line = "";
  for(const ch of (text || "")){
    if(ch === "\n"){ lines.push(line); line = ""; continue; }
    const test = line + ch;
    if(ctx.measureText(test).width > maxW && line){ lines.push(line); line = ch; }
    else line = test;
  }
  if(line) lines.push(line);
  return lines;
}

// インスタのストーリー用画像（1080×1920）を生成して File を返す。
// 白背景の中央に、写真＋ロゴ＋タイトル＋小見出しを載せた「縁アリカード」を配置。
export async function makeStoryImage(d, pickedUrl, eyebrow){
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const FT = '"Noto Sans JP", system-ui, sans-serif';
  const LOGO_FT = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Yu Gothic", sans-serif';

  // 背景（白）
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);

  // 写真の取得（Firebase Storage はCORS非対応のため同一オリジンのプロキシ経由）
  let photo = null;
  try{
    // 使う写真：共有メニューで選んだ写真（なければトップの1枚目）
    const imgUrl = pickedUrl || ((d.heroUrls || [])[0]) || d.thumbUrl;
    if(imgUrl){
      const fetchUrl = /^https:\/\/firebasestorage\.googleapis\.com\//.test(imgUrl)
        ? "/api/img?u=" + encodeURIComponent(imgUrl)
        : imgUrl;
      const res = await fetch(fetchUrl);
      const objUrl = URL.createObjectURL(await res.blob());
      try{
        photo = await new Promise((resolve, reject) => {
          const im = new Image();
          const to = setTimeout(() => reject(new Error("img load timeout")), 8000);
          im.onload = () => { clearTimeout(to); resolve(im); };
          im.onerror = () => { clearTimeout(to); reject(new Error("img load failed")); };
          im.decoding = "async";
          im.src = objUrl;
        });
      }finally{ URL.revokeObjectURL(objUrl); }
    }
  }catch(e){ photo = null; }

  try{
    if(document.fonts && document.fonts.ready){
      await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]);
    }
  }catch(e){}

  ctx.textBaseline = "alphabetic";

  // カード寸法（白背景の中央に配置）。S を下げると全体が一回り小さく表示される。
  const S = 0.80;
  const s = (n) => Math.round(n * S);
  const cardW = s(940), cardH = s(1540), cardR = s(48);
  const cardX = Math.round((W - cardW) / 2), cardY = Math.round((H - cardH) / 2);

  // 角丸長方形パス
  const rr = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // カードの影
  ctx.save();
  ctx.shadowColor = "rgba(20,30,25,0.22)"; ctx.shadowBlur = s(56); ctx.shadowOffsetY = s(18);
  ctx.fillStyle = "#10241d"; rr(cardX, cardY, cardW, cardH, cardR); ctx.fill();
  ctx.restore();

  // 以降はカード内部だけに描画（角丸クリップ）
  ctx.save();
  rr(cardX, cardY, cardW, cardH, cardR); ctx.clip();

  // 写真をカード全面に cover（失敗時は緑下地）
  if(photo){
    const iw = photo.naturalWidth || photo.width, ih = photo.naturalHeight || photo.height;
    if(STORY_BLUR_IDS.has(d.id)){
      // 顔切れ対策：写真の中央を「正方形」に切り取って表示し、上下はぼかし背景で埋める。
      // ぼかしは「縮小→拡大」で作る（canvas filter 非対応の iOS でも動くため）。
      const small = document.createElement("canvas");
      const sw = 40, sh = Math.max(1, Math.round(sw * cardH / cardW));
      small.width = sw; small.height = sh;
      const sctx = small.getContext("2d");
      const bScale = Math.max(sw / iw, sh / ih);
      sctx.drawImage(photo, (sw - iw * bScale) / 2, (sh - ih * bScale) / 2, iw * bScale, ih * bScale);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(small, cardX, cardY, cardW, cardH);          // ぼかし背景
      ctx.fillStyle = "rgba(8,18,14,0.30)";                       // 少し暗くして本体を引き立てる
      ctx.fillRect(cardX, cardY, cardW, cardH);
      // 中央正方形クロップ：元画像の中央から最大正方形を取り、カード幅いっぱいの正方形として中央配置。
      const srcSide = Math.min(iw, ih);
      const srcX = (iw - srcSide) / 2, srcY = (ih - srcSide) / 2;
      const sq = cardW;                                           // 表示する正方形の一辺
      const dx = cardX, dy = cardY + (cardH - sq) / 2;            // 上下中央に配置
      // いったん別キャンバスに正方形を描き、上下の縁を徐々に透明化（フェザー）して
      // ぼかし背景へなめらかに溶け込ませる（＝上下がじわっとぼける見え方）。
      const sqc = document.createElement("canvas");
      sqc.width = sq; sqc.height = sq;
      const qx = sqc.getContext("2d");
      qx.drawImage(photo, srcX, srcY, srcSide, srcSide, 0, 0, sq, sq);
      const feather = Math.round(sq * 0.22);                      // 縁のぼかし帯の高さ（約22%）
      qx.globalCompositeOperation = "destination-out";
      const gTopF = qx.createLinearGradient(0, 0, 0, feather);    // 上端：不透明→透明
      gTopF.addColorStop(0, "rgba(0,0,0,1)"); gTopF.addColorStop(1, "rgba(0,0,0,0)");
      qx.fillStyle = gTopF; qx.fillRect(0, 0, sq, feather);
      const gBotF = qx.createLinearGradient(0, sq - feather, 0, sq); // 下端：透明→不透明
      gBotF.addColorStop(0, "rgba(0,0,0,0)"); gBotF.addColorStop(1, "rgba(0,0,0,1)");
      qx.fillStyle = gBotF; qx.fillRect(0, sq - feather, sq, feather);
      qx.globalCompositeOperation = "source-over";
      ctx.drawImage(sqc, dx, dy);
    }else{
      const scale = Math.max(cardW / iw, cardH / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(photo, cardX + (cardW - dw) / 2, cardY + (cardH - dh) / 2, dw, dh);
    }
  }else{
    const base = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    base.addColorStop(0, "#1f6f5b"); base.addColorStop(1, "#10241d");
    ctx.fillStyle = base; ctx.fillRect(cardX, cardY, cardW, cardH);
  }

  // 写真の彩度を少し上げる（写真領域のみ。文字・ロゴ・グラデはこの後に描くので影響なし）。
  // ctx.filter は古い iOS で効かないため、ピクセル処理で実装。
  if(photo){
    try{
      const SAT = 1.18; // 1.0=変化なし。上げるほど鮮やか
      const x0 = Math.max(0, cardX), y0 = Math.max(0, cardY);
      const w0 = Math.min(W - x0, cardW), h0 = Math.min(H - y0, cardH);
      const imgd = ctx.getImageData(x0, y0, w0, h0);
      const p = imgd.data;
      for(let i = 0; i < p.length; i += 4){
        const r = p[i], g = p[i + 1], b = p[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        p[i]     = Math.max(0, Math.min(255, gray + (r - gray) * SAT));
        p[i + 1] = Math.max(0, Math.min(255, gray + (g - gray) * SAT));
        p[i + 2] = Math.max(0, Math.min(255, gray + (b - gray) * SAT));
      }
      ctx.putImageData(imgd, x0, y0);
    }catch(e){ /* getImageData 失敗時は彩度調整をスキップ */ }
  }

  // 上下グラデーション（ロゴ・文字の可読性確保）
  const gTop = ctx.createLinearGradient(0, cardY, 0, cardY + cardH * 0.26);
  gTop.addColorStop(0, "rgba(8,18,14,0.55)"); gTop.addColorStop(1, "rgba(8,18,14,0)");
  ctx.fillStyle = gTop; ctx.fillRect(cardX, cardY, cardW, cardH * 0.26);
  const gBot = ctx.createLinearGradient(0, cardY + cardH * 0.38, 0, cardY + cardH);
  gBot.addColorStop(0, "rgba(8,18,14,0)");
  gBot.addColorStop(0.55, "rgba(8,18,14,0.62)");
  gBot.addColorStop(1, "rgba(8,18,14,0.97)");
  ctx.fillStyle = gBot; ctx.fillRect(cardX, cardY, cardW, cardH);

  const pad = s(56), innerX = cardX + pad, maxW = cardW - pad * 2;

  // ロゴ（カード左上・白）
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${s(60)}px ${LOGO_FT}`;
  try{ ctx.letterSpacing = "-0.04em"; }catch(e){}
  ctx.fillText("Tabistock", innerX, cardY + s(96));
  try{ ctx.letterSpacing = "normal"; }catch(e){}
  ctx.fillStyle = "#7fd9bf";
  ctx.fillRect(innerX, cardY + s(116), s(132), s(6));

  // 下から積み上げ：URL → 小見出し → タイトル → 国・地域
  let y = cardY + cardH - s(76);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `700 ${s(34)}px ${FT}`;
  ctx.fillText("tabistock.jp", innerX, y);
  y -= s(74);

  const lead = String(d.lead || "").trim().replace(/\s+/g, " ");
  if(lead){
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = `500 ${s(38)}px ${FT}`;
    const leadLines = wrapText(ctx, lead, maxW).slice(0, 2);
    for(let i = leadLines.length - 1; i >= 0; i--){ ctx.fillText(leadLines[i], innerX, y); y -= s(54); }
    y -= s(14);
  }

  const title = String(d.title || "").trim();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${s(70)}px ${FT}`;
  const tLines = wrapText(ctx, title, maxW).slice(0, 3);
  for(let i = tLines.length - 1; i >= 0; i--){ ctx.fillText(tLines[i], innerX, y); y -= s(86); }
  y -= s(4);

  const eye = String(eyebrow || "").trim();
  if(eye){
    ctx.fillStyle = "#7fd9bf";
    ctx.font = `800 ${s(36)}px ${FT}`;
    ctx.fillText(eye, innerX, y);
  }

  ctx.restore(); // クリップ解除

  // カードの枠線（最後に上から）
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3;
  rr(cardX, cardY, cardW, cardH, cardR); ctx.stroke();

  const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.92));
  return new File([blob], "tabistock-story.jpg", { type: "image/jpeg" });
}

