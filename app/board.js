// 旅の掲示板：イラストと、最初の記事
// 記事は Firestore の boards（status: "published"）から読む。まだ1本もないとき・読めないときは、ここの BOARD_SEED を出す。
// 本文は blocks の並び：{ t: "h" 見出し | "p" 文章 | "steps" 番号つき手順 | "list" 箇条書き | "note" 注意書き }

const INK = "#1b2330", G = "#1f6f5b", C = "#fbf9f4", T = "#e2683b", BG = "#efe7d6";

// イラスト（400×300、色は緑・クリーム・オレンジ＋輪郭の濃紺、線の太さは2.5で統一）
export const ILL = {
  passport: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="205" cy="152" r="118" fill="${BG}"/>
  <path d="M40 222 C 110 120, 250 70, 362 96" fill="none" stroke="${G}" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>
  <g transform="translate(352 92) rotate(12)" fill="${G}"><path d="M-13 0 L13 0 L16 -2 L13 4 L-13 4 Z"/><path d="M-2 0 L-9 -11 L-4 -11 L6 0 Z"/><path d="M-2 4 L-9 15 L-4 15 L6 4 Z"/><path d="M-13 0 L-17 -6 L-14 -6 L-9 0 Z"/></g>
  <g transform="translate(312 214) rotate(-14)" fill="none" stroke="${T}" stroke-width="2.5"><circle r="40"/><circle r="31" stroke-width="1.5"/><path d="M-20 -4 H20 M-20 6 H20" stroke-width="2"/>
    <text y="-12" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="800" font-size="9" fill="${T}" stroke="none" letter-spacing="1.5">ARRIVED</text>
    <text y="22" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="800" font-size="8" fill="${T}" stroke="none" letter-spacing="1">2026</text></g>
  <g transform="translate(186 146) rotate(-9)">
    <rect x="-66" y="-90" width="132" height="182" rx="7" fill="${C}" stroke="${INK}" stroke-width="2.5" transform="translate(7 5)"/>
    <rect x="-66" y="-90" width="132" height="182" rx="7" fill="${G}" stroke="${INK}" stroke-width="2.5"/>
    <g fill="none" stroke="${C}" stroke-width="2.2"><circle cx="0" cy="-12" r="30"/><ellipse cx="0" cy="-12" rx="13" ry="30"/><path d="M-30 -12 H30 M-26 -27 H26 M-26 3 H26"/></g>
    <text x="0" y="-60" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="800" font-size="13" fill="${C}" letter-spacing="3">PASSPORT</text>
    <rect x="-13" y="40" width="26" height="17" rx="3" fill="none" stroke="${C}" stroke-width="2"/><path d="M-13 48.5 H13 M0 40 V57" stroke="${C}" stroke-width="1.4"/>
  </g></svg>`,

  // はじめての海外：地球儀の線を背にしたスーツケースと荷札
  suitcase: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="200" cy="150" r="118" fill="${BG}"/>
  <g fill="none" stroke="${G}" stroke-width="2" opacity=".55"><circle cx="200" cy="140" r="96"/><ellipse cx="200" cy="140" rx="42" ry="96"/><path d="M104 140 H296 M116 92 H284 M116 188 H284"/></g>
  <path d="M60 236 C 120 236, 150 70, 330 64" fill="none" stroke="${T}" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>
  <g transform="translate(336 62) rotate(-6)" fill="${T}"><path d="M-13 0 L13 0 L16 -2 L13 4 L-13 4 Z"/><path d="M-2 0 L-9 -11 L-4 -11 L6 0 Z"/><path d="M-2 4 L-9 15 L-4 15 L6 4 Z"/><path d="M-13 0 L-17 -6 L-14 -6 L-9 0 Z"/></g>
  <g transform="translate(200 168)">
    <path d="M-22 -72 V-86 a6 6 0 0 1 6 -6 H16 a6 6 0 0 1 6 6 V-72" fill="none" stroke="${INK}" stroke-width="2.5"/>
    <rect x="-62" y="-72" width="124" height="134" rx="10" fill="${G}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M-30 -72 V62 M30 -72 V62" stroke="${C}" stroke-width="7"/>
    <path d="M-62 -4 H62" stroke="${INK}" stroke-width="2" opacity=".35"/>
    <circle cx="-40" cy="70" r="7" fill="${C}" stroke="${INK}" stroke-width="2.5"/><circle cx="40" cy="70" r="7" fill="${C}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M44 -60 L70 -38" stroke="${INK}" stroke-width="2"/>
    <g transform="translate(78 -26) rotate(28)"><path d="M-12 -16 H8 L14 -10 V16 H-12 Z" fill="${T}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="7" cy="-8" r="2.6" fill="${C}"/><path d="M-6 2 H8 M-6 8 H4" stroke="${C}" stroke-width="2" stroke-linecap="round"/></g>
  </g></svg>`,

  // 旅と地理：大気大循環（赤道で雲と雨、30度で乾いた空気がおりる、季節で動く雨の帯）
  wind: `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
  <circle cx="200" cy="150" r="118" fill="${BG}"/>
  <g transform="translate(330 60)" stroke="${T}" stroke-width="2.5" stroke-linecap="round"><circle r="15" fill="${T}" stroke="${INK}"/><path d="M0 -24 V-30 M0 24 V30 M-24 0 H-30 M24 0 H30 M17 -17 l4 -4 M-17 17 l-4 4 M17 17 l4 4 M-17 -17 l-4 -4"/></g>
  <g transform="translate(196 156)">
    <circle r="88" fill="${C}" stroke="${INK}" stroke-width="2.5"/>
    <path d="M-88 0 H88" stroke="${INK}" stroke-width="1.6" stroke-dasharray="4 5"/>
    <path d="M-76 -44 H76 M-76 44 H76" stroke="${INK}" stroke-width="1" opacity=".3"/>
    <g fill="none" stroke="${G}" stroke-width="3" stroke-linecap="round">
      <path d="M58 -38 C 40 -22, 22 -12, 4 -10"/><path d="M-20 -38 C -34 -26, -50 -16, -66 -12"/>
      <path d="M58 38 C 40 22, 22 12, 4 10"/><path d="M-20 38 C -34 26, -50 16, -66 12"/>
    </g>
    <g fill="${G}"><path d="M4 -10 l9 -6 l-1 9z"/><path d="M-66 -12 l9 -7 l0 10z"/><path d="M4 10 l9 6 l-1 -9z"/><path d="M-66 12 l9 7 l0 -10z"/></g>
    <g fill="none" stroke="${T}" stroke-width="3" stroke-linecap="round"><path d="M-44 -64 C -14 -72, 16 -72, 46 -64"/><path d="M-44 64 C -14 72, 16 72, 46 64"/></g>
    <g fill="${T}"><path d="M46 -64 l-9 -5 l2 9z"/><path d="M46 64 l-9 5 l2 -9z"/></g>
    <g transform="translate(-6 -2)"><path d="M-30 4 a12 12 0 0 1 6 -18 a16 16 0 0 1 30 -2 a11 11 0 0 1 18 12 a8 8 0 0 1 -4 10 Z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M-16 12 l-3 9 M-4 12 l-3 9 M8 12 l-3 9" stroke="${G}" stroke-width="2.5" stroke-linecap="round"/></g>
  </g></svg>`,
};

export const BOARD_CATS = [["", "すべて"], ["first", "はじめて"], ["prep", "準備"], ["flight", "航空券"], ["geo", "旅と地理"]];

export const BOARD_SEED = [
  {
    id: "first-trip", cat: "first", ill: "suitcase", order: 1, mins: 5, updated: "2026-11-24",
    title: "はじめての海外旅行ガイド",
    lead: "何から決めればいい？ 出発までにやることを、順番に並べた。",
    facts: [["始める目安", "出発の2〜3か月前"], ["最初にやること", "パスポートの確認"]],
    blocks: [
      { t: "h", x: "出発までの流れ" },
      { t: "steps", items: [
        ["行き先と時期を決める", "Tabistockの旅程記事で、実際にかかった費用と日数を見ながら決めると早い。"],
        ["パスポートを確認する", "持っていなければ申請する（受け取りまで約2週間）。持っていても、残りの有効期間を確認しておく。"],
        ["航空券を取る", "比較サイトで探して、日程と値段が決まったら予約する。「航空券の相場」ページで、行き先ごとの安い月も見られる。"],
        ["宿を取る", "最初の1泊だけでも先に決めておくと、着いた日に焦らない。"],
        ["入国の条件を調べる", "ビザや、アメリカのESTAのような電子渡航認証が必要な国もある。外務省や大使館のページで確認する。"],
        ["お金・通信・保険を用意する", "クレジットカードは2枚、スマホはeSIM、それに海外旅行保険。カードに保険が付いていることもあるので、条件を見ておく。"],
      ] },
      { t: "h", x: "持っていくと安心なもの" },
      { t: "list", items: ["パスポートのコピー（スマホの写真でもOK）", "クレジットカード2枚（別々の場所にしまう）", "少しの現金", "モバイルバッテリーと変換プラグ"] },
      { t: "note", x: "迷ったら「AI相談」に聞いてみてください。Tabistockの旅程記事をもとに答えます。" },
    ],
  },
  {
    id: "passport", cat: "prep", ill: "passport", order: 2, mins: 3, updated: "2026-11-24",
    title: "パスポートの取り方",
    lead: "スマホで申請すれば、窓口に行くのは受け取りの1回だけ。手数料も窓口より安くなる。",
    facts: [["費用", "8,900円", "10年用・スマホ申請（窓口は9,300円）"], ["かかる日数", "約2週間〜", "申請から受け取りまで"], ["必要なもの", "マイナンバーカードとスマホ"]],
    blocks: [
      { t: "h", x: "スマホで申請する流れ" },
      { t: "steps", items: [
        ["マイナポータルで申請", "マイナポータルのアプリから申請する。顔写真もスマホで撮ってそのまま送れる。戸籍謄本の提出はいらない。"],
        ["できあがりの連絡を待つ", "だいたい2週間。春休みや夏休みの前は混むので、もっとかかることがある。"],
        ["窓口で受け取る", "窓口に行くのはこの1回だけ。受け取りは本人しかできない。"],
      ] },
      { t: "h", x: "気をつけること" },
      { t: "list", items: ["2026年7月から、18歳以上は10年用だけになった（5年用は18歳未満のみ）", "国によっては、入国のときにパスポートの残りの有効期間が6か月以上必要", "手数料や手続きは変わることがある。申請の前に、外務省のパスポートのページで最新の情報を確認する"] },
      { t: "note", x: "旅行の1か月前までには申請しておくと安心。" },
    ],
  },
  {
    id: "wind-seasons", cat: "geo", ill: "wind", order: 3, mins: 6, updated: "2026-11-24",
    title: "風を知ると、旅の季節がわかる",
    lead: "雨季と乾季はなぜあるのか。地球をめぐる大きな風の流れ（大気大循環）で見ると、行き先のベストシーズンが読めるようになる。",
    facts: [["キーワード", "大気大循環・熱帯収束帯"], ["わかること", "熱帯の雨季と乾季、砂漠ができる場所"]],
    blocks: [
      { t: "h", x: "赤道では、空気がのぼって雨が降る" },
      { t: "p", x: "太陽の熱をいちばん受ける赤道のあたりでは、あたためられた空気が上へのぼる。のぼった空気は冷えて雲になり、雨を降らせる。この雨の帯を「熱帯収束帯」という。" },
      { t: "h", x: "緯度30度あたりでは、空気がおりて乾く" },
      { t: "p", x: "のぼった空気は南北に流れて、緯度30度あたりでおりてくる。おりてくる空気は乾いているので、雲ができにくい。サハラ砂漠やアラビア半島、オーストラリアの内陸に砂漠が多いのはこのため。" },
      { t: "h", x: "雨の帯は、季節で南北に動く" },
      { t: "p", x: "熱帯収束帯は太陽の高さに合わせて、7月ごろは北へ、1月ごろは南へ動く。帯が来ているあいだが雨季、離れているあいだが乾季になる。" },
      { t: "list", items: ["タイ（バンコク）：雨季は5〜10月ごろ。乾季の11〜2月が旅行しやすい", "インドネシア（バリ島）：赤道の南なので季節が逆。乾季は4〜10月ごろ"] },
      { t: "note", x: "同じ東南アジアでも、赤道の北と南で雨季が逆になる。行き先を決めるときは、まず赤道のどちら側かを見てみよう。" },
    ],
  },
];
