// 旅程投稿の共通処理（サイトの post.html とアプリの app/post.js で共用）
// ・入力値の定数（通貨・言語、利用サービス、航空会社）
// ・写真の縮小、日数の自動判定
// ・Firestore への保存（写真アップロード → 記事ドキュメント → トランジット記事の紐付け）
import { db, storage } from "./firebase-config.js";
import { collection, doc, setDoc, getDocs, query, where, updateDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { collabFields, notifyNewInvites } from "./collab.js";

export const COUNTRY_CL={
  japan:['日本円','日本語'],korea:['韓国ウォン','韓国語'],china:['人民元','中国語'],taiwan:['台湾ドル','中国語'],hongkong:['香港ドル','広東語'],mongolia:['モンゴルトゥグルグ','モンゴル語'],
  thai:['タイバーツ','タイ語'],cambodia:['リエル','クメール語'],vietnam:['ベトナムドン','ベトナム語'],malaysia:['リンギット','マレー語'],singapore:['シンガポールドル','英語'],indonesia:['ルピア','インドネシア語'],philippines:['フィリピンペソ','フィリピン語・英語'],
  india:['インドルピー','ヒンディー語・英語'],nepal:['ネパールルピー','ネパール語'],srilanka:['スリランカルピー','シンハラ語・タミル語'],bhutan:['ニュルタム','ゾンカ語'],maldives:['ルフィヤ','ディベヒ語'],pakistan:['パキスタンルピー','ウルドゥー語'],bangladesh:['タカ','ベンガル語'],
  kazakhstan:['テンゲ','カザフ語・ロシア語'],kyrgyzstan:['ソム','キルギス語・ロシア語'],uzbekistan:['スム','ウズベク語'],
  turkey:['トルコリラ','トルコ語'],qatar:['カタールリヤル','アラビア語'],UAE:['ディルハム','アラビア語'],
  finland:['ユーロ','フィンランド語'],sweden:['スウェーデンクローナ','スウェーデン語'],norway:['ノルウェークローネ','ノルウェー語'],estonia:['ユーロ','エストニア語'],latvia:['ユーロ','ラトビア語'],lithuania:['ユーロ','リトアニア語'],croatia:['ユーロ','クロアチア語'],austria:['ユーロ','ドイツ語'],hungary:['フォリント','ハンガリー語'],slovakia:['ユーロ','スロバキア語'],france:['ユーロ','フランス語'],uk:['イギリスポンド','英語'],italy:['ユーロ','イタリア語'],spain:['ユーロ','スペイン語'],germany:['ユーロ','ドイツ語'],netherlands:['ユーロ','オランダ語'],switzerland:['スイスフラン','ドイツ語・フランス語'],portugal:['ユーロ','ポルトガル語'],greece:['ユーロ','ギリシャ語'],czech:['チェコ・コルナ','チェコ語'],poland:['ズロチ','ポーランド語'],belgium:['ユーロ','オランダ語・フランス語'],ireland:['ユーロ','英語'],denmark:['デンマーククローネ','デンマーク語'],iceland:['アイスランドクローナ','アイスランド語'],
  usa:['米ドル','英語'],canada:['カナダドル','英語・フランス語'],mexico:['メキシコペソ','スペイン語'],
  peru:['ソル','スペイン語'],bolivia:['ボリビアーノ','スペイン語'],chile:['チリペソ','スペイン語'],argentina:['アルゼンチンペソ','スペイン語'],brazil:['レアル','ポルトガル語'],
  morocco:['モロッコ・ディルハム','アラビア語・フランス語'],egypt:['エジプトポンド','アラビア語'],kenya:['ケニアシリング','スワヒリ語・英語'],'south-africa':['ランド','英語'],
  australia:['オーストラリアドル','英語'],'new-zealand':['ニュージーランドドル','英語'],
  'timor-leste':['米ドル','テトゥン語・ポルトガル語'],
  iraq:['イラク・ディナール','アラビア語・クルド語'],
  palestine:['新シェケル','アラビア語'],
  vatican:['ユーロ','イタリア語・ラテン語'],
  'san-marino':['ユーロ','イタリア語'],
  liechtenstein:['スイスフラン','ドイツ語'],
  andorra:['ユーロ','カタルーニャ語'],
  kosovo:['ユーロ','アルバニア語・セルビア語'],
  ukraine:['フリヴニャ','ウクライナ語'],
  greenland:['デンマーク・クローネ','グリーンランド語・デンマーク語'],
  belize:['ベリーズドル','英語・スペイン語'],
  honduras:['レンピラ','スペイン語'],
  'el-salvador':['米ドル','スペイン語'],
  nicaragua:['コルドバ','スペイン語'],
  'dominican-republic':['ドミニカ・ペソ','スペイン語'],
  bahamas:['バハマドル','英語'],
  'puerto-rico':['米ドル','スペイン語・英語'],
  antarctica:['米ドル（ツアー料金）','英語'],
  algeria:['アルジェリア・ディナール','アラビア語・フランス語'],
  'cape-verde':['エスクード','ポルトガル語'],
  seychelles:['セーシェル・ルピー','英語・フランス語'],
  mozambique:['メティカル','ポルトガル語'],
  malawi:['マラウイ・クワチャ','英語・チェワ語'],
  samoa:['タラ','サモア語・英語'],
  tonga:['パアンガ','トンガ語・英語'],
  vanuatu:['バツ','ビスラマ語・英語・フランス語'],
  'cook-islands':['ニュージーランドドル','英語・マオリ語'],
  'papua-new-guinea':['キナ','英語・トク・ピシン'],
  macau:['マカオパタカ','広東語・ポルトガル語'],
  laos:['キープ','ラオ語'],
  myanmar:['チャット','ミャンマー語'],
  brunei:['ブルネイドル','マレー語'],
  tajikistan:['ソモニ','タジク語'],
  turkmenistan:['マナト','トルクメン語'],
  georgia:['ラリ','ジョージア語'],
  armenia:['ドラム','アルメニア語'],
  azerbaijan:['マナト','アゼルバイジャン語'],
  jordan:['ヨルダン・ディナール','アラビア語'],
  israel:['新シェケル','ヘブライ語'],
  lebanon:['レバノン・ポンド','アラビア語'],
  oman:['オマーン・リアル','アラビア語'],
  saudi:['サウジ・リヤル','アラビア語'],
  bahrain:['バーレーン・ディナール','アラビア語'],
  kuwait:['クウェート・ディナール','アラビア語'],
  iran:['イラン・リアル','ペルシャ語'],
  slovenia:['ユーロ','スロベニア語'],
  bosnia:['兌換マルク','ボスニア語'],
  montenegro:['ユーロ','モンテネグロ語'],
  serbia:['セルビア・ディナール','セルビア語'],
  albania:['レク','アルバニア語'],
  'north-macedonia':['デナル','マケドニア語'],
  bulgaria:['レフ','ブルガリア語'],
  romania:['レウ','ルーマニア語'],
  moldova:['モルドバ・レウ','ルーマニア語'],
  malta:['ユーロ','マルタ語・英語'],
  cyprus:['ユーロ','ギリシャ語・トルコ語'],
  luxembourg:['ユーロ','ルクセンブルク語・フランス語・ドイツ語'],
  monaco:['ユーロ','フランス語'],
  russia:['ルーブル','ロシア語'],
  cuba:['キューバ・ペソ','スペイン語'],
  guatemala:['ケツァル','スペイン語'],
  costarica:['コロン','スペイン語'],
  panama:['バルボア・米ドル','スペイン語'],
  jamaica:['ジャマイカドル','英語'],
  colombia:['コロンビア・ペソ','スペイン語'],
  ecuador:['米ドル','スペイン語'],
  uruguay:['ウルグアイ・ペソ','スペイン語'],
  paraguay:['グアラニー','スペイン語・グアラニー語'],
  tunisia:['チュニジア・ディナール','アラビア語'],
  tanzania:['タンザニア・シリング','スワヒリ語・英語'],
  ethiopia:['ブル','アムハラ語'],
  uganda:['ウガンダ・シリング','英語・スワヒリ語'],
  rwanda:['ルワンダ・フラン','キニヤルワンダ語・英語'],
  ghana:['セディ','英語'],
  senegal:['CFAフラン','フランス語'],
  namibia:['ナミビアドル','英語'],
  botswana:['プラ','英語・ツワナ語'],
  zambia:['ザンビア・クワチャ','英語'],
  zimbabwe:['米ドル・ジンバブエドル','英語'],
  madagascar:['アリアリ','マダガスカル語・フランス語'],
  mauritius:['モーリシャス・ルピー','英語・フランス語'],
  hawaii:['米ドル','英語'],
  guam:['米ドル','英語'],
  saipan:['米ドル','英語'],
  palau:['米ドル','パラオ語・英語'],
  fiji:['フィジードル','英語・フィジー語'],
  'new-caledonia':['CFPフラン','フランス語'],
  tahiti:['CFPフラン','フランス語']
};

export const SERVICE_CATS=[
  {k:'宿泊',opts:['Booking.com','Agoda','Hostelworld','Airbnb','楽天トラベル'],ex:'例：現地ホテル直予約'},
  {k:'現地ツアー',opts:['GetYourGuide','Klook','Viator','KKday'],ex:'例：現地代理店ツアー'},
  {k:'eSIM',opts:['Airalo','au海外放題','ahamo','Holafly'],ex:'例：現地SIM'},
  {k:'地図・交通',opts:['Google Maps','Maps.me','Uber','Grab','Bolt'],ex:'例：UBCab（現地の配車アプリ）'},
  {k:'決済',opts:['現金','VISA','Mastercard','Wise','PayPay'],ex:'例：Alipay'},
  {k:'翻訳・その他',opts:['Google翻訳','DeepL'],ex:'例：現地ガイド'},
];

export const AIRLINES=[
  {name:"ANA",kana:["エーエヌエー","全日空","全日本空輸","ぜんにっくう"]},
  {name:"JAL",kana:["ジャル","日本航空","にほんこうくう"]},
  {name:"Peach",kana:["ピーチ","ピーチアビエーション"]},
  {name:"Jetstar",kana:["ジェットスター"]},
  {name:"Zipair",kana:["ジップエア"]},
  {name:"Skymark",kana:["スカイマーク"]},
  {name:"Solaseed Air",kana:["ソラシドエア","ソラシド"]},
  {name:"AirAsia",kana:["エアアジア"]},
  {name:"AirAsia X",kana:["エアアジアエックス"]},
  {name:"Scoot",kana:["スクート"]},
  {name:"Cebu Pacific",kana:["セブパシフィック","セブパシ"]},
  {name:"Cebgo",kana:["セブゴー"]},
  {name:"VietJet Air",kana:["ベトジェット","ベトジェットエア"]},
  {name:"Vietnam Airlines",kana:["ベトナム航空","ベトナムこうくう"]},
  {name:"Thai Airways",kana:["タイ国際航空","タイ航空","タイこうくう"]},
  {name:"Thai AirAsia",kana:["タイエアアジア"]},
  {name:"Bangkok Airways",kana:["バンコクエアウェイズ","バンコクエア"]},
  {name:"Singapore Airlines",kana:["シンガポール航空","シンガポールこうくう","シンガポールエアラインズ"]},
  {name:"Cathay Pacific",kana:["キャセイパシフィック","キャセイ"]},
  {name:"Hong Kong Airlines",kana:["香港航空","ホンコン航空"]},
  {name:"Greater Bay Airlines",kana:["グレーターベイ航空","グレーターベイ"]},
  {name:"EVA Air",kana:["エバー航空","エバーエア","エバ"]},
  {name:"China Airlines",kana:["チャイナエアライン","中華航空"]},
  {name:"Korean Air",kana:["大韓航空","だいかんこうくう","コリアンエア"]},
  {name:"Asiana Airlines",kana:["アシアナ航空","アシアナ"]},
  {name:"Jeju Air",kana:["チェジュ航空","チェジュエア","チェジュ"]},
  {name:"T'way Air",kana:["ティーウェイ航空","ティーウェイ"]},
  {name:"Air Busan",kana:["エアプサン"]},
  {name:"China Eastern Airlines",kana:["中国東方航空","東方航空"]},
  {name:"China Southern Airlines",kana:["中国南方航空","南方航空"]},
  {name:"Air China",kana:["中国国際航空","エアチャイナ"]},
  {name:"Spring Airlines",kana:["春秋航空","スプリング","しゅんじゅう"]},
  {name:"Hainan Airlines",kana:["海南航空","ハイナン航空"]},
  {name:"Philippine Airlines",kana:["フィリピン航空"]},
  {name:"Malaysia Airlines",kana:["マレーシア航空"]},
  {name:"Batik Air",kana:["バティックエア"]},
  {name:"Garuda Indonesia",kana:["ガルーダインドネシア","ガルーダ"]},
  {name:"Lion Air",kana:["ライオンエア"]},
  {name:"Qatar Airways",kana:["カタール航空","カタールエアウェイズ"]},
  {name:"Emirates",kana:["エミレーツ","エミレーツ航空"]},
  {name:"Etihad Airways",kana:["エティハド航空","エティハド"]},
  {name:"Turkish Airlines",kana:["ターキッシュエアラインズ","トルコ航空"]},
  {name:"Qantas",kana:["カンタス","カンタス航空"]},
  {name:"Air New Zealand",kana:["ニュージーランド航空","エアニュージーランド"]},
  {name:"American Airlines",kana:["アメリカン航空","アメリカンエアラインズ"]},
  {name:"United Airlines",kana:["ユナイテッド航空","ユナイテッド"]},
  {name:"Delta Air Lines",kana:["デルタ航空","デルタ"]},
  {name:"Hawaiian Airlines",kana:["ハワイアン航空","ハワイアン"]},
  {name:"Air Canada",kana:["エアカナダ","カナダ航空"]},
  {name:"Air India",kana:["エアインディア","インド航空"]},
  {name:"IndiGo",kana:["インディゴ"]},
  {name:"Finnair",kana:["フィンエアー","フィンランド航空"]},
  {name:"Lufthansa",kana:["ルフトハンザ","ルフトハンザドイツ航空"]},
  {name:"Air France",kana:["エールフランス","フランス航空"]},
  {name:"KLM",kana:["ケーエルエム","KLMオランダ航空","オランダ航空"]},
  {name:"British Airways",kana:["ブリティッシュエアウェイズ","イギリス航空"]},
  {name:"Swiss",kana:["スイス航空","スイスインターナショナル"]},
  {name:"Iberia",kana:["イベリア航空"]},
  {name:"ITA Airways",kana:["イタエアウェイズ","アリタリア"]},
  {name:"Aeroflot",kana:["アエロフロート","アエロフロートロシア航空"]},
  {name:"Aurora",kana:["オーロラ航空","オーロラ"]},
  {name:"Uzbekistan Airways",kana:["ウズベキスタン航空"]},
  {name:"Air Astana",kana:["エアアスタナ"]}
];

// 国名検索のよみ（漢字の国名を、ひらがなでも探せるように）
export const COUNTRY_YOMI={ japan:'にほん にっぽん', korea:'かんこく', china:'ちゅうごく', taiwan:'たいわん', hongkong:'ほんこん',
  UAE:'あらぶしゅちょうこくれんぽう どばい あぶだび', 'south-africa':'みなみあふりか', 'timor-leste':'ひがしてぃもーる',
  'dominican-republic':'どみにかきょうわこく', antarctica:'なんきょく', 'cook-islands':'くっくしょとう', 'north-macedonia':'きたまけどにあ',
  usa:'べいこく', uk:'えいこく' };

// 航空会社の候補（前方一致。英名・カナ・かな・漢字どれでも）
export const acNorm = (s) => (s || "").toLowerCase().replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
export function airlineMatches(text, max = 8){
  const q = acNorm((text || "").trim());
  if(!q) return [];
  return AIRLINES.filter((a) => acNorm(a.name).startsWith(q) || (a.kana || []).some((k) => acNorm(k).startsWith(q))).slice(0, max);
}

// 旅行時期 → 日数の区分（daytrip / 1night / 3-5 / 1w / 2w / 3w-plus）
export function nightsOf(start, end){
  return (start && end) ? Math.round((new Date(end) - new Date(start)) / 86400000) + 1 : 0;
}
export function daysVOf(start, end){
  const n = nightsOf(start, end);
  return n < 1 ? "" : n === 1 ? "daytrip" : n === 2 ? "1night" : n <= 5 ? "3-5" : n <= 9 ? "1w" : n <= 16 ? "2w" : "3w-plus";
}
// 選んだ国から通貨・言語（周遊は「／」で連結）
export const currencyOf = (countries) => [...new Set((countries || []).map((v) => (COUNTRY_CL[v] || [])[0]).filter(Boolean))].join("／");
export const languageOf = (countries) => [...new Set((countries || []).map((v) => (COUNTRY_CL[v] || [])[1]).filter(Boolean))].join("／");

// 写真の縮小（長辺1280px・JPEG）。iPhone でメモリ切れにならないよう縮小しながらデコードする
function loadImage(file){ return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); }); }
export async function resizeImage(file, maxEdge = 1280, q = 0.82){
  try{
    let bmp = await createImageBitmap(file, { resizeWidth: maxEdge, imageOrientation: "from-image" });
    if(Math.max(bmp.width, bmp.height) > maxEdge){
      const scale = maxEdge / Math.max(bmp.width, bmp.height);
      const bmp2 = await createImageBitmap(bmp, { resizeWidth: Math.round(bmp.width * scale), resizeHeight: Math.round(bmp.height * scale) });
      bmp.close(); bmp = bmp2;
    }
    const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext("2d").drawImage(bmp, 0, 0); bmp.close();
    return await new Promise((r) => cv.toBlob(r, "image/jpeg", q));
  }catch(e){
    const img = await loadImage(file);
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    return await new Promise((r) => cv.toBlob(r, "image/jpeg", q));
  }
}

// 写真のファイル名は毎回ユニークで中身は変わらないので、ブラウザに1年間保存してもらう（2回目からは読み込みなしで出る）
export const IMG_META = { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" };
async function uploadAndGetUrl(path, blob){
  const r = ref(storage, path);
  await uploadBytes(r, blob, IMG_META);
  return await getDownloadURL(r);
}
// 一覧のカード用の小さい写真（長辺720px）。トップ写真の1枚目から作る
const THUMB_EDGE = 720;
async function saveThumb(id, first, heroUrls, edit){
  if(!heroUrls.length) return "";
  // 1枚目が前と同じなら、前に作ったサムネをそのまま使う
  if(!(first && first.file)){
    const old = edit && edit.thumbUrl;
    return (old && old !== edit.heroUrls?.[0] && edit.heroUrls?.[0] === heroUrls[0]) ? old : heroUrls[0];
  }
  try{ return await uploadAndGetUrl(`articles/${id}/thumb_${Date.now()}.jpg`, await resizeImage(first.file, THUMB_EDGE, 0.78)); }
  catch(e){ return heroUrls[0]; }
}

// 自分が投稿者・共同投稿者のトランジット記事（新しい順）
export async function loadMyTransits(uid){
  const [own, co] = await Promise.all([
    getDocs(query(collection(db, "articles"), where("authorId", "==", uid))),
    getDocs(query(collection(db, "articles"), where("coAuthorIds", "array-contains", uid))).catch(() => null)
  ]);
  const items = [];
  const add = (s) => { const a = s.data(); if(a.type === "transit" && !items.some((x) => x.id === s.id)) items.push({ id: s.id, ...a }); };
  own.forEach(add); if(co) co.forEach(add);
  items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return items;
}

// 写真は並び順のまま。新規分（{file}）だけ縮小してアップロードし、URLの並びを返す（ファイル名は毎回ユニークに）
function photoSaver(id, progress){
  const stamp = Date.now();
  return async function(items, prefix, label){
    const urls = [];
    const total = items.filter((it) => it.file).length;
    let n = 0;
    for(let j = 0; j < items.length; j++){
      const it = items[j];
      if(it.url){ urls.push(it.url); continue; }
      n++;
      progress(`${label} ${n}/${total} をアップロード中…`);
      const blob = await resizeImage(it.file);
      urls.push(await uploadAndGetUrl(`articles/${id}/${prefix}_${stamp}_${j + 1}.jpg`, blob));
    }
    return urls;
  };
}
function statusOf(edit, mode){
  if(mode === "draft") return "draft";
  if(!edit || !edit.id) return "pending";
  return ["published", "pending", "hidden"].includes(edit.status) ? edit.status : "pending";
}
const isFirstSubmit = (edit, mode) => mode !== "draft" && (!edit || !edit.id || !["published", "pending", "hidden"].includes(edit.status));

// 自分が投稿者・共同投稿者の旅程記事（トランジット以外。新しい順）。トランジット記事の紐付け先に使う
export async function loadMyTrips(uid){
  const [own, co] = await Promise.all([
    getDocs(query(collection(db, "articles"), where("authorId", "==", uid))),
    getDocs(query(collection(db, "articles"), where("coAuthorIds", "array-contains", uid))).catch(() => null)
  ]);
  const items = [];
  const add = (s) => { const a = s.data(); if(a.type !== "transit" && !items.some((x) => x.id === s.id)) items.push({ id: s.id, ...a }); };
  own.forEach(add); if(co) co.forEach(add);
  items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return items;
}

/* トランジット記事を保存する。
   d … { country, region, airport, layover, title, body, photos:[{url}|{file}], places:[{name,lat,lng}], parentId }
   戻り値 … { id, status, heroUrls, firstSubmit } */
export async function saveTransit({ d, edit = null, mode = "publish", nickname = "", progress = () => {} }){
  const editId = edit && edit.id || null;
  const articleRef = editId ? doc(db, "articles", editId) : doc(collection(db, "articles"));
  const id = articleRef.id;
  const status = statusOf(edit, mode), firstSubmit = isFirstSubmit(edit, mode);
  progress(editId ? "記事を更新中…" : "記事を作成中…");
  const heroUrls = await photoSaver(id, progress)(d.photos || [], "hero", "写真");
  const places = (d.places || []).filter((p) => p && typeof p.lat === "number" && typeof p.lng === "number").map((p) => ({ name: p.name || "", lat: p.lat, lng: p.lng }));
  progress("保存中…");
  await setDoc(articleRef, {
    type: "transit",
    ...collabFields(!editId, nickname || d.author, edit && edit.authorNickname),
    status,
    createdAt: (editId && edit.createdAt) ? edit.createdAt : serverTimestamp(),
    // 公開日は承認時に admin.html が入れる。編集で消えないよう引き継ぐ
    ...((editId && edit.publishedAt) ? { publishedAt: edit.publishedAt } : {}),
    updatedAt: serverTimestamp(),
    countries: [d.country], region: d.region || "",
    styles: ["transit"],
    airport: d.airport, layover: Number(d.layover) || null,
    title: d.title || "", body: d.body || "",
    places, heroUrls, thumbUrl: await saveThumb(id, (d.photos || [])[0], heroUrls, edit),
    parentId: d.parentId || null
  });
  notifyNewInvites(id, d.title || "トランジット記事");
  return { id, status, heroUrls, firstSubmit };
}

/* 記事を保存する。
   d       … フォームの内容（post.html の gather() と同じ形。写真は {url} / {file} の並び）
   edit    … 編集中の記事 { id, status, createdAt, publishedAt, authorNickname }（新規は null）
   mode    … "publish" | "draft"
   transits… { selected:[id], shown:[記事] } 表示中のトランジット記事のうち、選んだものをこの旅程に紐付ける
   progress… 進み具合の文字を受け取る関数
   戻り値   … { id, status, heroUrls, days, firstSubmit } */
export async function saveArticle({ d, edit = null, mode = "publish", nickname = "", transits = null, progress = () => {} }){
  const editId = edit && edit.id || null;
  const articleRef = editId ? doc(db, "articles", editId) : doc(collection(db, "articles"));
  const id = articleRef.id;

  let status;
  if(mode === "draft") status = "draft";
  else if(!editId) status = "pending";
  else status = ["published", "pending", "hidden"].includes(edit.status) ? edit.status : "pending";
  // 新しく投稿（申請）したとき：新規、または下書きからの投稿
  const firstSubmit = mode !== "draft" && (!editId || !["published", "pending", "hidden"].includes(edit.status));

  progress(editId ? "記事を更新中…" : "記事を作成中…");
  const savePhotos = photoSaver(id, progress);
  const heroUrls = await savePhotos(d.heroPhotos || [], "hero", "トップ写真");
  const days = [];
  for(let i = 0; i < d.days.length; i++){
    const day = d.days[i];
    const photoUrls = await savePhotos(day.photos || [], `day${i + 1}`, `DAY${i + 1} 写真`);
    const dayObj = { date: day.date || "", summary: day.summary, text: day.text, photoUrls };
    const places = Array.isArray(day.places)
      ? day.places.filter((p) => p && typeof p.lat === "number" && typeof p.lng === "number")
          .map((p) => (p.cc ? { name: p.name || "", lat: p.lat, lng: p.lng, cc: p.cc } : { name: p.name || "", lat: p.lat, lng: p.lng }))
      : [];
    if(places.length){ dayObj.places = places; dayObj.lat = places[0].lat; dayObj.lng = places[0].lng; }
    else if(typeof day.lat === "number" && typeof day.lng === "number"){ dayObj.lat = day.lat; dayObj.lng = day.lng; }
    days.push(dayObj);
  }

  progress("保存中…");
  await setDoc(articleRef, {
    ...collabFields(!editId, nickname || d.author, edit && edit.authorNickname),
    status,
    createdAt: (editId && edit.createdAt) ? edit.createdAt : serverTimestamp(),
    ...((editId && edit.publishedAt) ? { publishedAt: edit.publishedAt } : {}),
    updatedAt: serverTimestamp(),
    countries: d.countries, region: d.region, prefectures: d.prefectures || [], notFromJapan: !!d.notFromJapan,
    budget: d.budget, days_v: d.days_v, styles: d.styles,
    title: d.title, lead: d.lead,
    dateStart: d.dateStart, dateEnd: d.dateEnd,
    currency: d.currency, language: d.language, safety: d.safety, difficulty: d.difficulty,
    costs: d.costs, flights: d.flights, flightWhen: d.flightWhen, flightSite: d.flightSite,
    services: d.services, comment: d.comment,
    agodaUrl: d.agodaUrl || "",
    days, heroUrls, thumbUrl: await saveThumb(id, (d.heroPhotos || [])[0], heroUrls, edit)
  });

  notifyNewInvites(id, d.title);

  // トランジット記事の紐付け：選んだものは parentId をこの旅程に、外したもの（ここに付いていた分）は解除
  if(transits){
    try{
      for(const t of transits.shown || []){
        const want = (transits.selected || []).includes(t.id);
        const here = (t.parentId || null) === id;
        if(want && !here){
          progress("トランジット記事を紐付け中…");
          await updateDoc(doc(db, "articles", t.id), { parentId: id, updatedAt: serverTimestamp() });
          t.parentId = id;
        }else if(!want && here){
          await updateDoc(doc(db, "articles", t.id), { parentId: null, updatedAt: serverTimestamp() });
          t.parentId = null;
        }
      }
    }catch(e){ console.warn("トランジット記事の紐付け更新に失敗:", e); }
  }
  return { id, status, heroUrls, days, firstSubmit };
}
