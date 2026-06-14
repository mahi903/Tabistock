// Tabistock 共有レンダリング（記事本文・検索カード）。view/search/index から import。
// 検索の語彙と完全一致させること（search.html の data-* と同じ値）。

export const COUNTRIES = [
  {v:'japan',jp:'日本',en:'Japan',r:'east-asia'},{v:'korea',jp:'韓国',en:'Korea',r:'east-asia'},
  {v:'china',jp:'中国',en:'China',r:'east-asia'},{v:'taiwan',jp:'台湾',en:'Taiwan',r:'east-asia'},
  {v:'hongkong',jp:'香港',en:'Hong Kong',r:'east-asia'},{v:'mongolia',jp:'モンゴル',en:'Mongolia',r:'east-asia'},
  {v:'thai',jp:'タイ',en:'Thailand',r:'southeast-asia'},{v:'cambodia',jp:'カンボジア',en:'Cambodia',r:'southeast-asia'},
  {v:'vietnam',jp:'ベトナム',en:'Vietnam',r:'southeast-asia'},{v:'malaysia',jp:'マレーシア',en:'Malaysia',r:'southeast-asia'},
  {v:'singapore',jp:'シンガポール',en:'Singapore',r:'southeast-asia'},{v:'indonesia',jp:'インドネシア',en:'Indonesia',r:'southeast-asia'},
  {v:'philippines',jp:'フィリピン',en:'Philippines',r:'southeast-asia'},
  {v:'india',jp:'インド',en:'India',r:'south-asia'},{v:'nepal',jp:'ネパール',en:'Nepal',r:'south-asia'},
  {v:'srilanka',jp:'スリランカ',en:'Sri Lanka',r:'south-asia'},{v:'bhutan',jp:'ブータン',en:'Bhutan',r:'south-asia'},
  {v:'maldives',jp:'モルディブ',en:'Maldives',r:'south-asia'},{v:'pakistan',jp:'パキスタン',en:'Pakistan',r:'south-asia'},
  {v:'bangladesh',jp:'バングラデシュ',en:'Bangladesh',r:'south-asia'},
  {v:'kazakhstan',jp:'カザフスタン',en:'Kazakhstan',r:'central-asia'},{v:'kyrgyzstan',jp:'キルギス',en:'Kyrgyzstan',r:'central-asia'},
  {v:'uzbekistan',jp:'ウズベキスタン',en:'Uzbekistan',r:'central-asia'},
  {v:'turkey',jp:'トルコ',en:'Turkey',r:'west-asia'},{v:'qatar',jp:'カタール',en:'Qatar',r:'west-asia'},
  {v:'UAE',jp:'アラブ首長国連邦',en:'UAE',r:'west-asia'},
  {v:'finland',jp:'フィンランド',en:'Finland',r:'europe'},{v:'sweden',jp:'スウェーデン',en:'Sweden',r:'europe'},
  {v:'norway',jp:'ノルウェー',en:'Norway',r:'europe'},{v:'estonia',jp:'エストニア',en:'Estonia',r:'europe'},
  {v:'latvia',jp:'ラトビア',en:'Latvia',r:'europe'},{v:'lithuania',jp:'リトアニア',en:'Lithuania',r:'europe'},
  {v:'croatia',jp:'クロアチア',en:'Croatia',r:'europe'},{v:'austria',jp:'オーストリア',en:'Austria',r:'europe'},
  {v:'hungary',jp:'ハンガリー',en:'Hungary',r:'europe'},{v:'slovakia',jp:'スロバキア',en:'Slovakia',r:'europe'},
  {v:'france',jp:'フランス',en:'France',r:'europe'},{v:'uk',jp:'イギリス',en:'UK',r:'europe'},
  {v:'italy',jp:'イタリア',en:'Italy',r:'europe'},{v:'spain',jp:'スペイン',en:'Spain',r:'europe'},
  {v:'germany',jp:'ドイツ',en:'Germany',r:'europe'},{v:'netherlands',jp:'オランダ',en:'Netherlands',r:'europe'},
  {v:'switzerland',jp:'スイス',en:'Switzerland',r:'europe'},{v:'portugal',jp:'ポルトガル',en:'Portugal',r:'europe'},
  {v:'greece',jp:'ギリシャ',en:'Greece',r:'europe'},{v:'czech',jp:'チェコ',en:'Czech',r:'europe'},
  {v:'poland',jp:'ポーランド',en:'Poland',r:'europe'},{v:'belgium',jp:'ベルギー',en:'Belgium',r:'europe'},
  {v:'ireland',jp:'アイルランド',en:'Ireland',r:'europe'},{v:'denmark',jp:'デンマーク',en:'Denmark',r:'europe'},
  {v:'iceland',jp:'アイスランド',en:'Iceland',r:'europe'},
  {v:'usa',jp:'アメリカ',en:'USA',r:'north-america'},{v:'canada',jp:'カナダ',en:'Canada',r:'north-america'},
  {v:'mexico',jp:'メキシコ',en:'Mexico',r:'north-america'},
  {v:'peru',jp:'ペルー',en:'Peru',r:'south-america'},{v:'bolivia',jp:'ボリビア',en:'Bolivia',r:'south-america'},
  {v:'chile',jp:'チリ',en:'Chile',r:'south-america'},{v:'argentina',jp:'アルゼンチン',en:'Argentina',r:'south-america'},
  {v:'brazil',jp:'ブラジル',en:'Brazil',r:'south-america'},
  {v:'morocco',jp:'モロッコ',en:'Morocco',r:'africa'},{v:'egypt',jp:'エジプト',en:'Egypt',r:'africa'},
  {v:'kenya',jp:'ケニア',en:'Kenya',r:'africa'},{v:'south-africa',jp:'南アフリカ',en:'South Africa',r:'africa'},
  {v:'australia',jp:'オーストラリア',en:'Australia',r:'oceania'},{v:'new-zealand',jp:'ニュージーランド',en:'New Zealand',r:'oceania'},
];
// 国コード -> 代表座標 [緯度, 経度]（地図ピン用・国の中心付近）
export const COUNTRY_LL = {
  japan:[36.2,138.25], korea:[36.5,127.85], china:[35.86,104.2], taiwan:[23.7,121.0], hongkong:[22.32,114.17], mongolia:[46.86,103.85],
  thai:[15.0,101.0], cambodia:[12.57,104.99], vietnam:[16.0,107.5], malaysia:[4.2,101.98], singapore:[1.35,103.82], indonesia:[-2.5,118.0], philippines:[12.88,121.77],
  india:[22.0,79.0], nepal:[28.39,84.12], srilanka:[7.87,80.77], bhutan:[27.51,90.43], maldives:[3.2,73.22], pakistan:[30.38,69.35], bangladesh:[23.68,90.36],
  kazakhstan:[48.0,67.0], kyrgyzstan:[41.2,74.77], uzbekistan:[41.38,64.59],
  turkey:[39.0,35.24], qatar:[25.35,51.18], UAE:[23.42,53.85],
  finland:[64.0,26.0], sweden:[62.0,15.0], norway:[64.5,11.0], estonia:[58.6,25.0], latvia:[56.88,24.6], lithuania:[55.17,23.88],
  croatia:[45.1,15.2], austria:[47.52,14.55], hungary:[47.16,19.5], slovakia:[48.67,19.7], france:[46.6,2.5], uk:[54.0,-2.5],
  italy:[42.8,12.6], spain:[40.0,-3.7], germany:[51.1,10.4], netherlands:[52.13,5.29], switzerland:[46.8,8.23], portugal:[39.5,-8.0],
  greece:[39.07,22.96], czech:[49.82,15.47], poland:[52.0,19.0], belgium:[50.5,4.47], ireland:[53.0,-8.0], denmark:[56.0,10.0], iceland:[64.96,-19.0],
  usa:[39.5,-98.35], canada:[56.13,-106.35], mexico:[23.63,-102.55],
  peru:[-9.19,-75.0], bolivia:[-16.29,-63.59], chile:[-35.68,-71.54], argentina:[-38.42,-63.62], brazil:[-10.0,-52.0],
  morocco:[31.79,-7.09], egypt:[26.0,30.0], kenya:[0.02,37.9], 'south-africa':[-30.56,22.94],
  australia:[-25.27,133.78], 'new-zealand':[-41.5,172.5]
};
export const REGION_JP={ "east-asia":"東アジア","southeast-asia":"東南アジア","south-asia":"南アジア","central-asia":"中央アジア","west-asia":"西アジア","europe":"ヨーロッパ","north-america":"北アメリカ","south-america":"南アメリカ","africa":"アフリカ","oceania":"オセアニア" };
export const REGION_EN={ "east-asia":"East Asia","southeast-asia":"Southeast Asia","south-asia":"South Asia","central-asia":"Central Asia","west-asia":"West Asia","europe":"Europe","north-america":"North America","south-america":"South America","africa":"Africa","oceania":"Oceania" };
export const BUDGETS=[{v:'10',l:'〜10万円'},{v:'20',l:'〜20万円'},{v:'30',l:'〜30万円'},{v:'40',l:'〜40万円'},{v:'50',l:'〜50万円'},{v:'50plus',l:'50万円以上'}];
export const DAYS_OPT=[{v:'daytrip',l:'日帰り'},{v:'1night',l:'1泊'},{v:'3-5',l:'3〜5日'},{v:'1w',l:'1週間'},{v:'2w',l:'2週間'},{v:'3w-plus',l:'3週間以上'}];
export const STYLES=[
  {v:'solo',l:'1人旅',tag:'ひとり旅'},{v:'friends',l:'友達と',tag:'友達旅'},{v:'family',l:'家族と',tag:'家族旅'},
  {v:'backpacker',l:'バックパッカー',tag:'バックパッカー'},{v:'girls',l:'女子旅',tag:'女子旅'},{v:'couple',l:'カップル',tag:'カップル'},
  {v:'nature',l:'自然・絶景',tag:'自然旅'},{v:'city',l:'都市・街歩き',tag:'街歩き'},{v:'local',l:'現地体験',tag:'現地体験'},{v:'round-trip',l:'周遊',tag:'周遊'},
  {v:'bicycle',l:'自転車旅',tag:'自転車旅'},{v:'train',l:'電車旅',tag:'電車旅'}
];
export const COST_ITEMS=[
  {k:'flight',l:'航空券'},{k:'stay',l:'宿泊'},{k:'food',l:'食費'},{k:'transit',l:'交通'},
  {k:'tour',l:'ツアー'},{k:'sightseeing',l:'観光費'},{k:'esim',l:'eSIM'},{k:'souvenir',l:'お土産'}
];

export const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const para=s=>esc(s).trim().split(/\n{2,}/).map(p=>p.replace(/\n/g,'<br>')).join('<br><br>');
export const yen=n=>'¥'+Number(n||0).toLocaleString('ja-JP');
export const pad=n=>String(n).padStart(2,'0');
export const cinfo=v=>COUNTRIES.find(c=>c.v===v);

export function fmtPeriod(s,e){
  if(!s||!e) return '';
  const a=new Date(s+'T00:00:00'), b=new Date(e+'T00:00:00');
  const sameYear=a.getFullYear()===b.getFullYear();
  const A=`${a.getFullYear()}.${pad(a.getMonth()+1)}.${pad(a.getDate())}`;
  const B=sameYear?`${pad(b.getMonth()+1)}.${pad(b.getDate())}`:`${b.getFullYear()}.${pad(b.getMonth()+1)}.${pad(b.getDate())}`;
  return `${A} - ${B}`;
}

export function buildTags(d){
  const tags=[];
  const c=cinfo((d.countries||[])[0]); if(c) tags.push(c.jp);
  const dd=DAYS_OPT.find(x=>x.v===d.days_v); if(dd) tags.push(dd.l);
  const bb=BUDGETS.find(x=>x.v===d.budget); if(bb) tags.push(bb.l);
  (d.styles||[]).forEach(s=>{ const ss=STYLES.find(x=>x.v===s); if(ss) tags.push(ss.tag); });
  return tags;
}

// 記事本文（hero〜投稿者カード）。view.html の #article-root に挿入する。
export function renderArticleBody(d){
  const stars='★'.repeat(d.difficulty||0)+'☆'.repeat(5-(d.difficulty||0));
  const period=fmtPeriod(d.dateStart,d.dateEnd);
  const tags=buildTags(d);
  const author=d.authorNickname||d.author||'';
  const authorId=d.authorId||'';
  const adminBadge=d.authorIsAdmin?' <i class="fa-solid fa-circle-check admin-badge" title="管理者"></i>':'';
  const authorNameHTML=authorId
    ? `<a class="author-name-link" href="../user.html?uid=${esc(authorId)}">${esc(author)}</a>`
    : esc(author);
  const authorPhoto=d.authorPhotoURL||'';
  const authorBio=d.authorBio||'旅程を投稿しています。';
  let igUrl='';
  if(d.authorInstagram){
    const ig=String(d.authorInstagram).trim();
    igUrl=/^https?:\/\//.test(ig)?ig:('https://www.instagram.com/'+ig.replace(/^@/,'')+'/');
  }
  const defAvatar="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23e7ddcb%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2240%22%20r%3D%2218%22%20fill%3D%22%23b9ad95%22%2F%3E%3Cpath%20d%3D%22M20%2086c0-17%2013-28%2030-28s30%2011%2030%2028z%22%20fill%3D%22%23b9ad95%22%2F%3E%3C%2Fsvg%3E";
  const pc=cinfo((d.countries||[])[0]);
  const allCountries=(d.countries||[]).map(v=>cinfo(v)).filter(Boolean);
  const eyebrow=allCountries.length>1
    ?allCountries.map(c=>c.en).join(' · ')
    :pc?`${pc.en} · ${REGION_EN[pc.r]}`:'';

  const heroUrls=d.heroUrls||[];
  const heroImgs=heroUrls.map(u=>`    <img src="${esc(u)}" alt="${esc(d.title)}">`).join('\n');
  const heroDots=heroUrls.map(()=>'    <span></span>').join('\n');

  const costMap={flight:'航空券',stay:'宿泊',food:'食費',transit:'交通',tour:'ツアー',sightseeing:'観光費',esim:'eSIM',souvenir:'お土産'};
  const costs=d.costs||{};
  let costTotal=0; Object.values(costs).forEach(v=>costTotal+=Number(v||0));
  const costRows=COST_ITEMS.map(it=>`  <div class="cost-row">
    <span>${costMap[it.k]}</span>
    <strong>${yen(costs[it.k]||0)}</strong>
  </div>`).join('\n\n');

  const days=d.days||[];
  const timeline=days.map((day,i)=>`    <div class="timeline-item">
      <span class="day">DAY ${i+1}</span>
      <p>${esc(day.summary)}</p>
    </div>`).join('\n\n');

  // ルートマップ：座標が1つでもあれば表示（実際の描画は view.html 側で Leaflet が行う）
  const hasRoute = days.some(day =>
    (Array.isArray(day.places) && day.places.some(p => p && typeof p.lat === 'number' && typeof p.lng === 'number'))
    || typeof day.lat === 'number' && typeof day.lng === 'number'
  );
  const routeSection = hasRoute ? `<div class="section-intro">
  <p class="eyebrow">Route</p>
  <h2>ルートマップ</h2>
  <p>旅で訪れた場所をピンで表示しています。ピンをタップすると地名が出ます。</p>
</div>
<section class="route-grid">
  <div class="info-card route-card">
    <div id="routeMap" class="route-map"></div>
  </div>
</section>` : '';

  const flights=d.flights||[];
  let flightTotal=0; flights.forEach(f=>flightTotal+=Number(f.price||0));
  const flightRoutes=flights.map((f,i)=>`  <div class="flight-route">
    <span class="flight-label">航路${i+1}</span>
    <h3>${esc(f.route)}</h3>
    <p>${esc(f.airline)}${f.price?`　${yen(f.price)}`:''}</p>
  </div>`).join('\n\n');
  const flightMeta=(d.flightWhen||d.flightSite)?`  <div class="flight-meta">
    ${d.flightWhen?`<div><span>予約時期</span><strong>${esc(d.flightWhen)}</strong></div>`:''}
    ${d.flightSite?`<div><span>予約サイト</span><strong>${esc(d.flightSite)}</strong></div>`:''}
  </div>`:'';
  const flightCard=flights.length?`<div class="info-card flight-card">
  <h2>航空券</h2>

${flightRoutes}

${flightMeta}
  <div class="cost-total">
    <span>航空券合計</span>
    <strong>${yen(flightTotal)}</strong>
  </div>
</div>`:'';

  const services=d.services||[];
  const servicesCard=services.length?`<div class="info-card services-card">
  <h2>利用サービス</h2>

${services.map(s=>`  <div class="service-item">
    <span class="service-label">${esc(s.label)}</span>
    <strong>${(s.items||[]).map(esc).join('<br>')}</strong>
  </div>`).join('\n\n')}
</div>`:'';

  // 旅の概要：カードはボタン→中央モーダルで1枚ずつ表示（高さが揃わない／周遊で全部長くならない）
  const costCard=`<div class="info-card cost-card">
  <h2>費用内訳</h2>

${costRows}

  <div class="cost-total">
    <span>合計</span>
    <strong>${yen(costTotal)}</strong>
  </div>
</div>`;
  const itineraryCard=days.length?`<div class="info-card itinerary-card">
  <h2>旅程</h2>

  <div class="timeline">
${timeline}
  </div>
</div>`:'';
  const overviewItems=[
    {k:'cost',label:'費用内訳',card:costCard},
    ...(itineraryCard?[{k:'itinerary',label:'旅程',card:itineraryCard}]:[]),
    ...(flightCard?[{k:'flight',label:'航空券',card:flightCard}]:[]),
    ...(servicesCard?[{k:'services',label:'利用サービス',card:servicesCard}]:[]),
  ];
  const overviewTabs=overviewItems.map(it=>`    <button type="button" class="ov-tab" data-ov="${it.k}"><span>${it.label}</span></button>`).join('\n');
  const overviewPanels=overviewItems.map(it=>`      <div class="ov-panel" data-ov="${it.k}">${it.card}</div>`).join('\n');

  const dayCards=days.map((day,i)=>{
    const urls=day.photoUrls||[];
    const imgs=urls.map(u=>`        <img src="${esc(u)}" alt="" loading="lazy">`).join('\n');
    let gallery='';
    if(urls.length>1){
      // 複数枚：矢印＋「現在/総数」カウンターつきギャラリー
      gallery=`      <div class="photo-gallery" data-count="${urls.length}">
        <div class="photo-slider">
${imgs}
        </div>
        <span class="pg-counter"><b class="pg-cur">1</b> / ${urls.length}</span>
      </div>`;
    }else if(urls.length===1){
      gallery=`      <div class="photo-slider">
${imgs}
      </div>`;
    }
    return `  <article class="day-card">
    <button class="day-toggle">
      <span class="day-label">DAY ${i+1}.${day.date?' '+esc(day.date):''}</span>
      <span class="day-title">${esc(day.summary)}</span>
      <span class="day-icon">+</span>
    </button>
    <div class="day-content">
      <div class="day-text">
        <p>${para(day.text)}</p>
      </div>
${gallery}
    </div>
  </article>`;
  }).join('\n\n');

  const AFFILIATE_URLS={
    'Agoda':'https://px.a8.net/svt/ejp?a8mat=4B5VO7+23M2LU+4X1W+5YZ77',
    // 'Klook':'',
    // 'GetYourGuide':'',
    // 'トリップドットコム':'',
  };
  const specificUrl=d.agodaUrl||'';
  const usedServices=(d.services||[]).flatMap(s=>s.items||[]);
  const matchedLinks=specificUrl?[]
    :usedServices.filter(s=>AFFILIATE_URLS[s]).map(s=>`    <a href="${AFFILIATE_URLS[s]}" target="_blank" rel="noopener sponsored" class="affiliate-btn">
      ${esc(s)}で予約する <i class="fa-solid fa-arrow-up-right-from-square"></i>
    </a>`);
  const affiliateSection=(d.authorIsAdmin&&(specificUrl||matchedLinks.length))?`<section class="affiliate-section">
  <div class="affiliate-card">
    <p class="affiliate-eyebrow">Booking</p>
    <h2>${specificUrl?'著者が実際に泊まった宿':'著者が実際に使ったサービス'}</h2>
${specificUrl?`    <a href="${esc(specificUrl)}" target="_blank" rel="noopener sponsored" class="affiliate-btn">
      Agodaでこの宿を見る <i class="fa-solid fa-arrow-up-right-from-square"></i>
    </a>`:matchedLinks.join('\n')}
    <small class="affiliate-note">PR</small>
  </div>
</section>`:'';

  return `<main class="article-page">
  <section class="article-hero">
    <div class="hero-carousel">
    <div class="hero-images">
${heroImgs}
  </div>

  <div class="hero-dots">
${heroDots}
</div>
</div>
  <div class="hero-text">
    <p class="hero-eyebrow">${esc(eyebrow)}</p>
    <h1>${esc(d.title)}</h1>

    <p class="hero-lead">
      ${para(d.lead)}
    </p>
     <div class="hero-basic-info">
  <div><span>通貨</span><strong>${esc(d.currency)}</strong></div>
  <div><span>言語</span><strong>${esc(d.language)}</strong></div>
  <div><span>治安</span><strong>${esc(d.safety)}</strong></div>
</div>
<div class="hero-info">
      <div><span>旅行時期</span><strong>${esc(period)}</strong></div>
      <div><span>旅の難易度</span><strong>${stars}</strong></div>
      <div><span>投稿者</span><strong>${authorId
        ? `<a class="hero-author" href="../user.html?uid=${esc(authorId)}"><img class="hero-author-icon" src="${authorPhoto?esc(authorPhoto):defAvatar}" alt="" onerror="this.src='${defAvatar}'"><span class="hero-author-name">${esc(author)}</span></a>`
        : `<span class="hero-author"><img class="hero-author-icon" src="${authorPhoto?esc(authorPhoto):defAvatar}" alt="" onerror="this.src='${defAvatar}'"><span class="hero-author-name">${esc(author)}</span></span>`}</strong></div>
    </div>
    <div class="hero-tags">
${tags.map(t=>`      <span>${esc(t)}</span>`).join('\n')}
    </div>
  </div>
</section>
</main>

<div class="section-intro">
  <p class="eyebrow">Trip Overview</p>
  <h2>旅の概要</h2>
  <p>気になる項目をタップすると、詳しい内容が開きます。</p>
</div>
<section class="overview-tabs">
${overviewTabs}
</section>
<div class="ov-modal" id="ovModal" hidden>
  <div class="ov-backdrop" data-ov-close></div>
  <div class="ov-dialog" role="dialog" aria-modal="true" aria-label="旅の概要">
    <button type="button" class="ov-close" data-ov-close aria-label="閉じる">×</button>
    <div class="ov-body">
${overviewPanels}
    </div>
  </div>
</div>
${routeSection}
<div class="section-intro">
  <p class="eyebrow">Day by Day</p>
  <h2>旅の記録</h2>
</div>
<section class="day-grid">

${dayCards}
</section>
<section class="tips-section">
  <div class="tips-card">
    <p class="tips-eyebrow">From the Traveler</p>
    <h2>投稿者のコメント</h2>
    <p class="tips-text">
      ${para(d.comment)}
    </p>
  </div>
</section>

${affiliateSection}

<section class="article-actions">
  <button class="action-like" id="likeBtn" type="button" aria-pressed="false" aria-label="いいね">
    <i class="fa-regular fa-heart"></i>
    <span class="like-count" id="likeCount">0</span>
  </button>
  <button class="action-save" id="saveBtn" type="button" aria-pressed="false" aria-label="保存">
    <i class="fa-regular fa-bookmark"></i>
    <span>保存</span>
  </button>
  <button class="action-share" id="shareBtn" type="button" aria-label="共有する">
    <i class="fa-solid fa-arrow-up-from-bracket"></i>
    <span>共有</span>
  </button>
</section>

<section class="author-card">
  <img src="${authorPhoto?esc(authorPhoto):defAvatar}" alt="投稿者アイコン" class="author-icon" onerror="this.src='${defAvatar}'">

  <div class="author-info">
    <p class="author-label">Author</p>
    <div class="author-name-row">
      <h2>${authorNameHTML}${adminBadge}</h2>
      <button class="author-follow" id="followBtn" type="button" aria-pressed="false" data-uid="${esc(authorId)}" style="display:none">
        <i class="fa-solid fa-plus"></i><span>フォロー</span>
      </button>
    </div>
    <p>${esc(authorBio)}</p>
    ${igUrl?`<div class="author-socials">
      <a href="${esc(igUrl)}" target="_blank" rel="noopener" class="author-social" aria-label="Instagram">
        <i class="fa-brands fa-instagram"></i>
      </a>
    </div>`:''}
  </div>
</section>`;
}

// 検索カード（search / index 用）。リンクは articles/view.html?id=
export function renderCard(d){
  const c=cinfo((d.countries||[])[0]) || {en:'', jp:''};
  const cardTags=[];
  const bb=BUDGETS.find(x=>x.v===d.budget); if(bb) cardTags.push(bb.l);
  (d.styles||[]).slice(0,2).forEach(s=>{ const ss=STYLES.find(x=>x.v===s); if(ss) cardTags.push(ss.tag); });
  const budgetAttr = d.budget==='50plus' ? '50' : d.budget;
  const thumb=d.thumbUrl||(d.heroUrls&&d.heroUrls[0])||'';
  // 検索用の隠しテキスト（画面には表示しない）。キーワード検索はカードの表示文字＋この属性を対象にする。
  // 内容：日本語/英語の国名・地域（日英）・タイトル・リード・各DAYの要約。
  const ci=(d.countries||[]).map(cinfo).filter(Boolean);
  const searchParts=[];
  ci.forEach(x=>{ searchParts.push(x.jp, x.en, REGION_JP[x.r]||'', REGION_EN[x.r]||''); });
  if(d.region) searchParts.push(REGION_JP[d.region]||d.region, REGION_EN[d.region]||'');
  searchParts.push(d.title||'', d.lead||'');
  (d.days||[]).forEach(day=>{ if(day&&day.summary) searchParts.push(day.summary); });
  const searchText=searchParts.filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  return `  <a href="./articles/view.html?id=${esc(d.id)}"
     class="trip-card"
     data-id="${esc(d.id)}"
     data-country="${esc((d.countries||[]).join(' '))}"
     data-days="${esc(d.days_v||'')}"
     data-budget="${esc(budgetAttr||'')}"
     data-style="${esc((d.styles||[]).join(' '))}"
     data-region="${esc(d.region||'')}"
     data-search="${esc(searchText)}"
     data-created="${esc(String(d.createdAt?.seconds||0))}"
     data-likes="0">
    <div class="trip-image">
      <img src="${esc(thumb)}" alt="" loading="lazy" decoding="async">
    </div>
    <div class="trip-content">
      <p class="country">${esc(ci.length>1?ci.map(x=>x.en).join(' · '):c.en)}</p>
      <h3>${esc(d.title)}</h3>
      <p>${esc(String(d.lead||'').replace(/\n+/g,' '))}</p>

      <div class="tags">
${cardTags.map(t=>`        <span>${esc(t)}</span>`).join('\n')}
      </div>
    </div>
  </a>`;
}
