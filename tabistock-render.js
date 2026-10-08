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
  // 追加分（2）
  {v:'timor-leste',jp:'東ティモール',en:'Timor-Leste',r:'southeast-asia'},
  {v:'iraq',jp:'イラク',en:'Iraq',r:'west-asia'},
  {v:'palestine',jp:'パレスチナ',en:'Palestine',r:'west-asia'},
  {v:'vatican',jp:'バチカン',en:'Vatican City',r:'europe'},
  {v:'san-marino',jp:'サンマリノ',en:'San Marino',r:'europe'},
  {v:'liechtenstein',jp:'リヒテンシュタイン',en:'Liechtenstein',r:'europe'},
  {v:'andorra',jp:'アンドラ',en:'Andorra',r:'europe'},
  {v:'kosovo',jp:'コソボ',en:'Kosovo',r:'europe'},
  {v:'ukraine',jp:'ウクライナ',en:'Ukraine',r:'europe'},
  {v:'greenland',jp:'グリーンランド',en:'Greenland',r:'other'},
  {v:'belize',jp:'ベリーズ',en:'Belize',r:'north-america'},
  {v:'honduras',jp:'ホンジュラス',en:'Honduras',r:'north-america'},
  {v:'el-salvador',jp:'エルサルバドル',en:'El Salvador',r:'north-america'},
  {v:'nicaragua',jp:'ニカラグア',en:'Nicaragua',r:'north-america'},
  {v:'dominican-republic',jp:'ドミニカ共和国',en:'Dominican Republic',r:'north-america'},
  {v:'bahamas',jp:'バハマ',en:'Bahamas',r:'north-america'},
  {v:'puerto-rico',jp:'プエルトリコ',en:'Puerto Rico',r:'other'},
  {v:'antarctica',jp:'南極',en:'Antarctica',r:'other'},
  {v:'algeria',jp:'アルジェリア',en:'Algeria',r:'africa'},
  {v:'cape-verde',jp:'カーボベルデ',en:'Cape Verde',r:'africa'},
  {v:'seychelles',jp:'セーシェル',en:'Seychelles',r:'africa'},
  {v:'mozambique',jp:'モザンビーク',en:'Mozambique',r:'africa'},
  {v:'malawi',jp:'マラウイ',en:'Malawi',r:'africa'},
  {v:'samoa',jp:'サモア',en:'Samoa',r:'oceania'},
  {v:'tonga',jp:'トンガ',en:'Tonga',r:'oceania'},
  {v:'vanuatu',jp:'バヌアツ',en:'Vanuatu',r:'oceania'},
  {v:'cook-islands',jp:'クック諸島',en:'Cook Islands',r:'oceania'},
  {v:'papua-new-guinea',jp:'パプアニューギニア',en:'Papua New Guinea',r:'oceania'},
  // 追加分
  {v:'macau',jp:'マカオ',en:'Macau',r:'east-asia'},
  {v:'laos',jp:'ラオス',en:'Laos',r:'southeast-asia'},
  {v:'myanmar',jp:'ミャンマー',en:'Myanmar',r:'southeast-asia'},
  {v:'brunei',jp:'ブルネイ',en:'Brunei',r:'southeast-asia'},
  {v:'tajikistan',jp:'タジキスタン',en:'Tajikistan',r:'central-asia'},
  {v:'turkmenistan',jp:'トルクメニスタン',en:'Turkmenistan',r:'central-asia'},
  {v:'georgia',jp:'ジョージア',en:'Georgia',r:'west-asia'},
  {v:'armenia',jp:'アルメニア',en:'Armenia',r:'west-asia'},
  {v:'azerbaijan',jp:'アゼルバイジャン',en:'Azerbaijan',r:'west-asia'},
  {v:'jordan',jp:'ヨルダン',en:'Jordan',r:'west-asia'},
  {v:'israel',jp:'イスラエル',en:'Israel',r:'west-asia'},
  {v:'lebanon',jp:'レバノン',en:'Lebanon',r:'west-asia'},
  {v:'oman',jp:'オマーン',en:'Oman',r:'west-asia'},
  {v:'saudi',jp:'サウジアラビア',en:'Saudi Arabia',r:'west-asia'},
  {v:'bahrain',jp:'バーレーン',en:'Bahrain',r:'west-asia'},
  {v:'kuwait',jp:'クウェート',en:'Kuwait',r:'west-asia'},
  {v:'iran',jp:'イラン',en:'Iran',r:'west-asia'},
  {v:'slovenia',jp:'スロベニア',en:'Slovenia',r:'europe'},
  {v:'bosnia',jp:'ボスニア・ヘルツェゴビナ',en:'Bosnia and Herzegovina',r:'europe'},
  {v:'montenegro',jp:'モンテネグロ',en:'Montenegro',r:'europe'},
  {v:'serbia',jp:'セルビア',en:'Serbia',r:'europe'},
  {v:'albania',jp:'アルバニア',en:'Albania',r:'europe'},
  {v:'north-macedonia',jp:'北マケドニア',en:'North Macedonia',r:'europe'},
  {v:'bulgaria',jp:'ブルガリア',en:'Bulgaria',r:'europe'},
  {v:'romania',jp:'ルーマニア',en:'Romania',r:'europe'},
  {v:'moldova',jp:'モルドバ',en:'Moldova',r:'europe'},
  {v:'malta',jp:'マルタ',en:'Malta',r:'europe'},
  {v:'cyprus',jp:'キプロス',en:'Cyprus',r:'europe'},
  {v:'luxembourg',jp:'ルクセンブルク',en:'Luxembourg',r:'europe'},
  {v:'monaco',jp:'モナコ',en:'Monaco',r:'europe'},
  {v:'russia',jp:'ロシア',en:'Russia',r:'europe'},
  {v:'cuba',jp:'キューバ',en:'Cuba',r:'north-america'},
  {v:'guatemala',jp:'グアテマラ',en:'Guatemala',r:'north-america'},
  {v:'costarica',jp:'コスタリカ',en:'Costa Rica',r:'north-america'},
  {v:'panama',jp:'パナマ',en:'Panama',r:'north-america'},
  {v:'jamaica',jp:'ジャマイカ',en:'Jamaica',r:'north-america'},
  {v:'colombia',jp:'コロンビア',en:'Colombia',r:'south-america'},
  {v:'ecuador',jp:'エクアドル',en:'Ecuador',r:'south-america'},
  {v:'uruguay',jp:'ウルグアイ',en:'Uruguay',r:'south-america'},
  {v:'paraguay',jp:'パラグアイ',en:'Paraguay',r:'south-america'},
  {v:'tunisia',jp:'チュニジア',en:'Tunisia',r:'africa'},
  {v:'tanzania',jp:'タンザニア',en:'Tanzania',r:'africa'},
  {v:'ethiopia',jp:'エチオピア',en:'Ethiopia',r:'africa'},
  {v:'uganda',jp:'ウガンダ',en:'Uganda',r:'africa'},
  {v:'rwanda',jp:'ルワンダ',en:'Rwanda',r:'africa'},
  {v:'ghana',jp:'ガーナ',en:'Ghana',r:'africa'},
  {v:'senegal',jp:'セネガル',en:'Senegal',r:'africa'},
  {v:'namibia',jp:'ナミビア',en:'Namibia',r:'africa'},
  {v:'botswana',jp:'ボツワナ',en:'Botswana',r:'africa'},
  {v:'zambia',jp:'ザンビア',en:'Zambia',r:'africa'},
  {v:'zimbabwe',jp:'ジンバブエ',en:'Zimbabwe',r:'africa'},
  {v:'madagascar',jp:'マダガスカル',en:'Madagascar',r:'africa'},
  {v:'mauritius',jp:'モーリシャス',en:'Mauritius',r:'africa'},
  {v:'hawaii',jp:'ハワイ',en:'Hawaii',r:'other'},
  {v:'guam',jp:'グアム',en:'Guam',r:'other'},
  {v:'saipan',jp:'サイパン',en:'Saipan',r:'other'},
  {v:'palau',jp:'パラオ',en:'Palau',r:'oceania'},
  {v:'fiji',jp:'フィジー',en:'Fiji',r:'oceania'},
  {v:'new-caledonia',jp:'ニューカレドニア',en:'New Caledonia',r:'oceania'},
  {v:'tahiti',jp:'タヒチ',en:'Tahiti',r:'oceania'},
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
  australia:[-25.27,133.78], 'new-zealand':[-41.5,172.5],
  'timor-leste':[-8.87,125.73],
  iraq:[36.19,44.01],
  palestine:[31.7,35.2],
  vatican:[41.9,12.45],
  'san-marino':[43.94,12.46],
  liechtenstein:[47.17,9.56],
  andorra:[42.51,1.52],
  kosovo:[42.6,20.9],
  ukraine:[48.38,31.17],
  greenland:[64.18,-51.72],
  belize:[17.19,-88.5],
  honduras:[15.2,-86.24],
  'el-salvador':[13.79,-88.9],
  nicaragua:[12.87,-85.21],
  'dominican-republic':[18.74,-70.16],
  bahamas:[25.03,-77.4],
  'puerto-rico':[18.22,-66.59],
  antarctica:[-64.8,-62.9],
  algeria:[28.03,1.66],
  'cape-verde':[16.0,-24.01],
  seychelles:[-4.68,55.49],
  mozambique:[-18.67,35.53],
  malawi:[-13.25,34.3],
  samoa:[-13.76,-172.1],
  tonga:[-21.18,-175.2],
  vanuatu:[-15.38,166.96],
  'cook-islands':[-21.24,-159.78],
  'papua-new-guinea':[-6.31,143.96],
  macau:[22.2,113.55],
  laos:[19.86,102.5],
  myanmar:[21.9,95.96],
  brunei:[4.54,114.73],
  tajikistan:[38.86,71.28],
  turkmenistan:[38.97,59.56],
  georgia:[42.32,43.36],
  armenia:[40.07,45.04],
  azerbaijan:[40.14,47.58],
  jordan:[30.59,36.24],
  israel:[31.05,34.85],
  lebanon:[33.85,35.86],
  oman:[21.51,55.92],
  saudi:[23.89,45.08],
  bahrain:[26.07,50.56],
  kuwait:[29.31,47.48],
  iran:[32.43,53.69],
  slovenia:[46.15,14.99],
  bosnia:[43.92,17.68],
  montenegro:[42.71,19.37],
  serbia:[44.02,21.01],
  albania:[41.15,20.17],
  'north-macedonia':[41.61,21.75],
  bulgaria:[42.73,25.49],
  romania:[45.94,24.97],
  moldova:[47.41,28.37],
  malta:[35.94,14.38],
  cyprus:[35.13,33.43],
  luxembourg:[49.82,6.13],
  monaco:[43.74,7.42],
  russia:[55.75,37.62],
  cuba:[21.52,-77.78],
  guatemala:[15.78,-90.23],
  costarica:[9.75,-83.75],
  panama:[8.54,-80.78],
  jamaica:[18.11,-77.3],
  colombia:[4.57,-74.3],
  ecuador:[-1.83,-78.18],
  uruguay:[-32.52,-55.77],
  paraguay:[-23.44,-58.44],
  tunisia:[33.89,9.54],
  tanzania:[-6.37,34.89],
  ethiopia:[9.15,40.49],
  uganda:[1.37,32.29],
  rwanda:[-1.94,29.87],
  ghana:[7.95,-1.02],
  senegal:[14.5,-14.45],
  namibia:[-22.96,18.49],
  botswana:[-22.33,24.68],
  zambia:[-13.13,27.85],
  zimbabwe:[-19.02,29.15],
  madagascar:[-18.77,46.87],
  mauritius:[-20.35,57.55],
  hawaii:[20.8,-156.33],
  guam:[13.44,144.79],
  saipan:[15.18,145.75],
  palau:[7.51,134.58],
  fiji:[-17.71,178.07],
  'new-caledonia':[-20.9,165.62],
  tahiti:[-17.65,-149.43]
};
export const REGION_JP={ "east-asia":"東アジア","southeast-asia":"東南アジア","south-asia":"南アジア","central-asia":"中央アジア","west-asia":"西アジア","europe":"ヨーロッパ","north-america":"北アメリカ","south-america":"南アメリカ","africa":"アフリカ","oceania":"オセアニア","other":"その他" };
export const REGION_EN={ "east-asia":"East Asia","southeast-asia":"Southeast Asia","south-asia":"South Asia","central-asia":"Central Asia","west-asia":"West Asia","europe":"Europe","north-america":"North America","south-america":"South America","africa":"Africa","oceania":"Oceania","other":"Other" };
export const BUDGETS=[{v:'10',l:'〜10万円'},{v:'20',l:'〜20万円'},{v:'30',l:'〜30万円'},{v:'40',l:'〜40万円'},{v:'50',l:'〜50万円'},{v:'50plus',l:'50万円以上'}];
export const DAYS_OPT=[{v:'daytrip',l:'日帰り'},{v:'1night',l:'1泊'},{v:'3-5',l:'3〜5日'},{v:'1w',l:'1週間'},{v:'2w',l:'2週間'},{v:'3w-plus',l:'3週間以上'}];
export const STYLES=[
  {v:'solo',l:'1人旅',tag:'ひとり旅'},{v:'friends',l:'友達と',tag:'友達旅'},{v:'family',l:'家族と',tag:'家族旅'},
  {v:'backpacker',l:'バックパッカー',tag:'バックパッカー'},{v:'girls',l:'女子旅',tag:'女子旅'},{v:'couple',l:'カップル',tag:'カップル'},
  {v:'nature',l:'自然・絶景',tag:'自然旅'},{v:'city',l:'都市・街歩き',tag:'街歩き'},{v:'local',l:'現地体験',tag:'現地体験'},{v:'round-trip',l:'周遊',tag:'周遊'},
  {v:'bicycle',l:'自転車旅',tag:'自転車旅'},{v:'train',l:'電車旅',tag:'電車旅'},
  // トランジットは特別スタイル（投稿フォームの選択肢には出さず、トランジット記事に自動付与）
  {v:'transit',l:'トランジット',tag:'トランジット'}
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

const DEF_AVATAR="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23e7ddcb%22%2F%3E%3Ccircle%20cx%3D%2250%22%20cy%3D%2240%22%20r%3D%2218%22%20fill%3D%22%23b9ad95%22%2F%3E%3Cpath%20d%3D%22M20%2086c0-17%2013-28%2030-28s30%2011%2030%2028z%22%20fill%3D%22%23b9ad95%22%2F%3E%3C%2Fsvg%3E";

// 記事の投稿者一覧（共同投稿なら複数）。view.html が d.authors を詰めて渡す。
// 無ければ従来の単独著者フィールドから1人分を組み立てる。
function authorsOf(d){
  if(Array.isArray(d.authors) && d.authors.length) return d.authors;
  return [{ id:d.authorId||'', nickname:d.authorNickname||d.author||'', photoURL:d.authorPhotoURL||'',
            bio:d.authorBio||'', instagram:d.authorInstagram||'', isAdmin:!!d.authorIsAdmin }];
}

// hero の「投稿者」欄：アイコン＋名前を人数分並べる
function heroAuthorsHTML(authors){
  return `<span class="hero-authors">${authors.map(a=>{
    const inner=`<img class="hero-author-icon" src="${a.photoURL?esc(a.photoURL):DEF_AVATAR}" alt="" onerror="this.src='${DEF_AVATAR}'"><span class="hero-author-name">${esc(a.nickname)}</span>`;
    return a.id
      ? `<a class="hero-author" href="../user.html?uid=${esc(a.id)}">${inner}</a>`
      : `<span class="hero-author">${inner}</span>`;
  }).join('')}</span>`;
}

// 記事末尾の投稿者カード：人数分
function authorCardsHTML(authors){
  const cards=authors.map(a=>{
    const adminBadge=a.isAdmin?' <i class="fa-solid fa-circle-check admin-badge" title="管理者"></i>':'';
    const nameHTML=a.id
      ? `<a class="author-name-link" href="../user.html?uid=${esc(a.id)}">${esc(a.nickname)}</a>`
      : esc(a.nickname);
    let igUrl='';
    if(a.instagram){
      const ig=String(a.instagram).trim();
      igUrl=/^https?:\/\//.test(ig)?ig:('https://www.instagram.com/'+ig.replace(/^@/,'')+'/');
    }
    return `<section class="author-card">
  <img src="${a.photoURL?esc(a.photoURL):DEF_AVATAR}" alt="投稿者アイコン" class="author-icon" onerror="this.src='${DEF_AVATAR}'">
  <div class="author-info">
    <p class="author-label">Author</p>
    <div class="author-name-row">
      <h2>${nameHTML}${adminBadge}</h2>
      <button class="author-follow" type="button" aria-pressed="false" data-uid="${esc(a.id)}" style="display:none">
        <i class="fa-solid fa-plus"></i><span>フォロー</span>
      </button>
    </div>
    <p>${esc(a.bio||'旅程を投稿しています。')}</p>
    ${igUrl?`<div class="author-socials">
      <a href="${esc(igUrl)}" target="_blank" rel="noopener" class="author-social" aria-label="Instagram">
        <i class="fa-brands fa-instagram"></i>
      </a>
    </div>`:''}
  </div>
</section>`;
  }).join('\n');
  return authors.length>1?`<div class="author-cards">\n${cards}\n</div>`:cards;
}

// 記事本文（hero〜投稿者カード）。view.html の #article-root に挿入する。
export function renderArticleBody(d){
  // トランジット記事は専用の簡易レイアウトで描画
  if(d.type==='transit') return renderTransitBody(d);
  const stars='★'.repeat(d.difficulty||0)+'☆'.repeat(5-(d.difficulty||0));
  const period=fmtPeriod(d.dateStart,d.dateEnd);
  const tags=buildTags(d);
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

  const specificUrl=d.agodaUrl||'';
  // 予約欄は「著者がAgodaリンクを実際に入力したとき」だけ出す。
  // （サービス選択だけで自動の汎用リンクは出さない）
  const affiliateSection=(d.authorIsAdmin&&specificUrl)?`<section class="affiliate-section">
  <div class="affiliate-card">
    <p class="affiliate-eyebrow">Booking</p>
    <h2>著者が実際に泊まった宿</h2>
    <a href="${esc(specificUrl)}" target="_blank" rel="noopener sponsored" class="affiliate-btn">
      Agodaでこの宿を見る <i class="fa-solid fa-arrow-up-right-from-square"></i>
    </a>
    <small class="affiliate-note">PR</small>
  </div>
</section>`:'';

  // この旅程に紐づくトランジット記事（view.html が d.childTransits をセット）
  const transitLinks=transitLinksSection(d.childTransits);

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
      <div><span>投稿者</span><strong>${heroAuthorsHTML(authorsOf(d))}</strong></div>
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

${transitLinks}

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

${authorCardsHTML(authorsOf(d))}`;
}

// 乗り継ぎ時間（数値）→「20時間」。値が無ければ空。
export const fmtLayover=h=>{ const n=Number(h); return (n&&n>0)?`${n}時間`:''; };

// トランジット記事に紐づく「経由地」リンク群（旅程記事の本文に差し込む）。
// items: [{id,title,country,airport,layover,thumbUrl}]
function transitLinksSection(items){
  if(!Array.isArray(items) || !items.length) return '';
  const cards=items.map(t=>{
    const c=cinfo((t.countries||[t.country])[0]||t.country);
    const cjp=c?c.jp:'';
    const lay=fmtLayover(t.layover);
    const sub=[t.airport||'', lay?`乗り継ぎ${lay}`:''].filter(Boolean).join('・');
    const thumb=t.thumbUrl||'';
    const img=thumb
      ? `<img src="${esc(thumb)}" alt="" loading="lazy">`
      : `<span class="transit-link-noimg"><i class="fa-solid fa-plane-departure"></i></span>`;
    return `  <a class="transit-link-card" href="./view.html?id=${esc(t.id)}">
    ${img}
    <div class="transit-link-body">
      <span class="transit-link-badge">Transit · ${esc(cjp)}</span>
      <strong>${esc(t.title||(cjp+'でのトランジット'))}</strong>
      ${sub?`<span class="transit-link-sub">${esc(sub)}</span>`:''}
    </div>
  </a>`;
  }).join('\n');
  return `<div class="section-intro">
  <p class="eyebrow">Layover</p>
  <h2>この旅のトランジット</h2>
  <p>乗り継ぎ中の過ごし方を別記事にまとめています。</p>
</div>
<section class="transit-links">
${cards}
</section>`;
}

// トランジット記事の本文（hero〜投稿者カード）。view.html の #article-root に挿入。
function renderTransitBody(d){
  const c=cinfo((d.countries||[])[0]);
  const cjp=c?c.jp:'';
  const cen=c?c.en:'';
  const title=d.title||(cjp?`${cjp}でのトランジット`:'トランジット');
  const lay=fmtLayover(d.layover);

  const heroUrls=d.heroUrls||[];
  const heroImgs=heroUrls.map(u=>`    <img src="${esc(u)}" alt="${esc(title)}">`).join('\n');
  const heroDots=heroUrls.map(()=>'    <span></span>').join('\n');
  const heroCarousel=heroUrls.length?`    <div class="hero-carousel">
    <div class="hero-images">
${heroImgs}
  </div>
  <div class="hero-dots">
${heroDots}
</div>
</div>`:'';

  const infoRows=[
    `<div><span>空港または都市</span><strong>${esc(d.airport||'')}</strong></div>`,
    lay?`<div><span>乗り継ぎ時間</span><strong>${esc(lay)}</strong></div>`:'',
    `<div><span>投稿者</span><strong>${heroAuthorsHTML(authorsOf(d))}</strong></div>`
  ].filter(Boolean).join('\n      ');

  // 親（この旅行の記事）へのリンク
  const pInfo=d.parentInfo;
  let parentSection='';
  if(pInfo && pInfo.id){
    const pc=cinfo((pInfo.countries||[pInfo.country])[0]||pInfo.country);
    const pcjp=pc?pc.jp:'';
    const pImg=pInfo.thumbUrl
      ? `<img src="${esc(pInfo.thumbUrl)}" alt="" loading="lazy">`
      : `<span class="transit-link-noimg"><i class="fa-solid fa-suitcase-rolling"></i></span>`;
    parentSection=`<div class="section-intro">
  <p class="eyebrow">Trip</p>
  <h2>この旅行の記事</h2>
  <p>このトランジットが含まれる旅程はこちら。</p>
</div>
<section class="transit-links">
  <a class="transit-link-card" href="./view.html?id=${esc(pInfo.id)}">
    ${pImg}
    <div class="transit-link-body">
      <span class="transit-link-badge">Trip${pcjp?' · '+esc(pcjp):''}</span>
      <strong>${esc(pInfo.title||'旅程記事')}</strong>
    </div>
  </a>
</section>`;
  }

  // 立ち寄った場所（地図は view.html の initRouteMap が d.places を読んで描画）
  const hasPlacePins=Array.isArray(d.places) && d.places.some(p=>p && typeof p.lat==='number' && typeof p.lng==='number');
  const routeSection=hasPlacePins?`<div class="section-intro">
  <p class="eyebrow">Route</p>
  <h2>ルートマップ</h2>
  <p>乗り継ぎ中に訪れた場所をピンで表示しています。ピンをタップすると地名が出ます。</p>
</div>
<section class="route-grid route-grid-transit">
  <div class="info-card route-card">
    <div id="routeMap" class="route-map"></div>
  </div>
</section>`:'';

  const bodySection=d.body?`<section class="tips-section">
  <div class="tips-card">
    <p class="tips-eyebrow">Layover Notes</p>
    <h2>乗り継ぎの過ごし方</h2>
    <p class="tips-text">
      ${para(d.body)}
    </p>
  </div>
</section>`:'';

  return `<main class="article-page">
  <section class="article-hero">
${heroCarousel}
  <div class="hero-text">
    <p class="hero-eyebrow is-transit">Transit${cen?' · '+esc(cen):''}</p>
    <h1>${esc(title)}</h1>
    <div class="hero-info">
      ${infoRows}
    </div>
    <div class="hero-tags">
      <span>トランジット</span>
      ${cjp?`<span>${esc(cjp)}</span>`:''}
    </div>
  </div>
</section>
</main>

${parentSection}

${bodySection}

${routeSection}

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

${authorCardsHTML(authorsOf(d))}`;
}

// 検索カード（search / index 用）。リンクは articles/view.html?id=
export function renderCard(d){
  if(d.type==='transit') return renderTransitCard(d);
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
     data-type="itinerary"
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

// トランジット記事の検索カード。予算/日数のかわりに空港・乗り継ぎ時間を見せる。
function renderTransitCard(d){
  const c=cinfo((d.countries||[])[0]) || {en:'', jp:''};
  const lay=fmtLayover(d.layover);
  const title=d.title||(c.jp?`${c.jp}でのトランジット`:'トランジット');
  const thumb=d.thumbUrl||(d.heroUrls&&d.heroUrls[0])||'';
  const sub=[d.airport||'', lay?`乗り継ぎ${lay}`:''].filter(Boolean).join('・');
  // 検索用テキスト：国（日英）・地域・空港・タイトル・本文・「トランジット/乗り継ぎ」キーワード
  const searchParts=[];
  if(c.jp){ searchParts.push(c.jp, c.en, REGION_JP[c.r]||'', REGION_EN[c.r]||''); }
  if(d.region) searchParts.push(REGION_JP[d.region]||d.region, REGION_EN[d.region]||'');
  searchParts.push(d.title||'', d.airport||'', String(d.body||'').slice(0,200), 'トランジット','乗り継ぎ','transit','layover');
  const searchText=searchParts.filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  const imgHTML=thumb
    ? `<img src="${esc(thumb)}" alt="" loading="lazy" decoding="async">`
    : `<span class="trip-image-noimg"><i class="fa-solid fa-plane-departure"></i></span>`;
  return `  <a href="./articles/view.html?id=${esc(d.id)}"
     class="trip-card trip-card-transit"
     data-id="${esc(d.id)}"
     data-type="transit"
     data-country="${esc((d.countries||[]).join(' '))}"
     data-days=""
     data-budget=""
     data-style="transit"
     data-region="${esc(d.region||'')}"
     data-search="${esc(searchText)}"
     data-created="${esc(String(d.createdAt?.seconds||0))}"
     data-likes="0">
    <div class="trip-image">
      ${imgHTML}
      <span class="trip-badge-transit"><i class="fa-solid fa-plane-departure"></i> Transit</span>
    </div>
    <div class="trip-content">
      <p class="country">${esc(c.en)}</p>
      <h3>${esc(title)}</h3>
      ${sub?`<p>${esc(sub)}</p>`:''}
      <div class="tags">
        <span>トランジット</span>
        ${c.jp?`<span>${esc(c.jp)}</span>`:''}
      </div>
    </div>
  </a>`;
}
