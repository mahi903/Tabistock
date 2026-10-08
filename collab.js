// 共同投稿者（Instagram のコラボ投稿と同じ仕組み）。post.html / post-transit.html で共通利用。
// coAuthorInvites：招待中（相手がマイページで承認すると coAuthorIds へ移る）
// coAuthorIds：承認済み。投稿者欄に並び、記事の編集もできる。
// 招待・取り消しができるのは元の投稿者（と管理者）だけ。
import { db } from "./firebase-config.js";
import { collection, doc, getDoc, getDocs, query, orderBy, startAt, endAt, limit }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { esc } from "./tabistock-render.js";
import { sendNotification } from "./notify.js";

const COLLAB_MAX = 5;
const DEF_AVATAR = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20100%20100%22%3E%3Crect%20width%3D%22100%22%20height%3D%22100%22%20fill%3D%22%23e7ddcb%22%2F%3E%3C%2Fsvg%3E";

export const collab = {
  me: null,            // ログイン中の uid
  ownerId: null,       // 元の投稿者（新規なら自分）
  ids: [],             // 承認済み
  invites: [],         // 招待中
  origInvites: [],     // 読み込み時点の招待（新しく招待した人にだけ通知するため）
  canManage: true,     // 招待・取り消しできるか
  profiles: {}         // uid -> { nickname, photoURL }
};

// 記事のメンバー（投稿者＋共同投稿者＋招待中）。紐付け候補を「同じメンバーの記事」に絞るのに使う。
export function membersOf(d){
  return [d.authorId, ...(d.coAuthorIds || []), ...(d.coAuthorInvites || [])]
    .filter((u, i, a) => u && a.indexOf(u) === i).sort();
}
export function currentMembers(){
  return membersOf({ authorId: collab.ownerId, coAuthorIds: collab.ids, coAuthorInvites: collab.invites });
}
export function sameMembers(d){
  return membersOf(d).join(",") === currentMembers().join(",");
}

let onChangeCb = () => {};

const CSS = `
  .collab-sel{ display:flex; flex-wrap:wrap; gap:8px; margin:6px 0 8px; }
  .collab-chip{ display:inline-flex; align-items:center; gap:6px; border:1px solid #d9d2c4; border-radius:999px; padding:4px 6px 4px 4px; font-size:13px; background:#fff; }
  .collab-chip img{ width:24px; height:24px; border-radius:50%; object-fit:cover; background:#e7ddcb; }
  .collab-chip small{ color:var(--mut); font-size:11px; }
  .collab-chip .collab-x{ border:none; background:#f1e7d6; color:#7a6a4f; border-radius:50%; width:20px; height:20px; padding:0; line-height:20px; cursor:pointer; }
  .collab-results{ border:1px solid var(--line); border-radius:10px; margin-top:6px; overflow:hidden; }
  .collab-results:empty{ display:none; }
  .collab-res{ display:flex; align-items:center; gap:10px; width:100%; padding:9px 12px; border:none; border-bottom:1px solid var(--line); background:#fff; font-size:14px; text-align:left; cursor:pointer; }
  .collab-res:last-child{ border-bottom:none; }
  .collab-res:hover{ background:#f6f2ea; }
  .collab-res img{ width:28px; height:28px; border-radius:50%; object-fit:cover; background:#e7ddcb; }
  .collab-none{ padding:9px 12px; font-size:13px; color:var(--mut); }
  .collab-opt{ color:var(--mut); font-size:11px; margin-left:4px; font-weight:600; }
`;

// container に共同投稿者欄（ラベル・選択済みチップ・検索）を描画して配線する
export function initCollabBox(container, { me, onChange } = {}){
  collab.me = me || null;
  collab.ownerId = collab.ownerId || me || null;
  if(onChange) onChangeCb = onChange;
  if(!document.getElementById("collabCss")){
    const st = document.createElement("style"); st.id = "collabCss"; st.textContent = CSS;
    document.head.appendChild(st);
  }
  container.innerHTML = `
    <label class="f">共同投稿者<span class="collab-opt">任意</span></label>
    <p class="hint" style="margin:0 0 6px">一緒に旅した友達を招待できます。相手が承認すると、投稿者欄に2人とも表示され、どちらも編集できるようになります。</p>
    <div id="collabSel" class="collab-sel"></div>
    <div id="collabSearchWrap">
      <input type="text" id="collabSearch" placeholder="ニックネームで検索" autocomplete="off">
      <div id="collabResults" class="collab-results"></div>
    </div>`;

  document.getElementById("collabSel").addEventListener("click", (e) => {
    const x = e.target.closest(".collab-x");
    if(!x) return;
    const u = x.dataset.uid;
    collab.ids = collab.ids.filter(v => v !== u);
    collab.invites = collab.invites.filter(v => v !== u);
    renderCollab();
  });

  let timer = null;
  document.getElementById("collabSearch").addEventListener("input", (e) => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    const box = document.getElementById("collabResults");
    if(!q){ box.innerHTML = ""; return; }
    timer = setTimeout(async () => {
      try{
        // ニックネームの前方一致
        const snap = await getDocs(query(collection(db, "publicProfiles"), orderBy("nickname"), startAt(q), endAt(q + ""), limit(8)));
        const rows = [];
        snap.forEach(s => {
          const u = s.id;
          if(u === collab.me || u === collab.ownerId || collab.ids.includes(u) || collab.invites.includes(u)) return;
          const p = { nickname: s.data().nickname || "旅人", photoURL: s.data().photoURL || "" };
          collab.profiles[u] = p;
          rows.push(`<button type="button" class="collab-res" data-uid="${esc(u)}"><img src="${esc(p.photoURL || DEF_AVATAR)}" alt="">${esc(p.nickname)}</button>`);
        });
        box.innerHTML = rows.join("") || `<div class="collab-none">見つかりませんでした</div>`;
      }catch(err){
        console.warn("ユーザー検索に失敗:", err);
        box.innerHTML = `<div class="collab-none">検索できませんでした</div>`;
      }
    }, 250);
  });

  document.getElementById("collabResults").addEventListener("click", (e) => {
    const b = e.target.closest(".collab-res");
    if(!b) return;
    if(collab.ids.length + collab.invites.length >= COLLAB_MAX) return;
    collab.invites.push(b.dataset.uid);
    document.getElementById("collabSearch").value = "";
    document.getElementById("collabResults").innerHTML = "";
    renderCollab();
  });

  renderCollab();
}

// 既存記事の共同投稿者の状態を読み込む（招待・取り消しは元の投稿者と管理者だけ）
export function loadCollabFrom(data, { isAdmin = false } = {}){
  collab.ownerId = data.authorId;
  collab.ids = Array.isArray(data.coAuthorIds) ? data.coAuthorIds.slice() : [];
  collab.invites = Array.isArray(data.coAuthorInvites) ? data.coAuthorInvites.slice() : [];
  collab.origInvites = collab.invites.slice();
  collab.canManage = data.authorId === collab.me || isAdmin;
  renderCollab();
}

// 編集できる人か（元の投稿者・共同投稿者）
export function isMember(data, uid){
  return data.authorId === uid || (Array.isArray(data.coAuthorIds) && data.coAuthorIds.includes(uid));
}

async function profileOf(uid){
  if(collab.profiles[uid]) return collab.profiles[uid];
  let p = { nickname: "旅人", photoURL: "" };
  try{
    const s = await getDoc(doc(db, "publicProfiles", uid));
    if(s.exists()) p = { nickname: s.data().nickname || "旅人", photoURL: s.data().photoURL || "" };
  }catch(e){}
  return (collab.profiles[uid] = p);
}

export async function renderCollab(){
  const sel = document.getElementById("collabSel");
  if(!sel) return;
  const all = [...collab.ids.map(u => [u, "承認済み"]), ...collab.invites.map(u => [u, "招待中"])];
  await Promise.all(all.map(([u]) => profileOf(u)));
  sel.innerHTML = all.map(([u, label]) => {
    const p = collab.profiles[u];
    return `<span class="collab-chip"><img src="${esc(p.photoURL || DEF_AVATAR)}" alt="">${esc(p.nickname)} <small>${label}</small>` +
      (collab.canManage ? `<button type="button" class="collab-x" data-uid="${esc(u)}" aria-label="外す">×</button>` : "") + `</span>`;
  }).join("") || (collab.canManage ? "" : `<span class="hint">なし</span>`);
  document.getElementById("collabSearchWrap").hidden = !collab.canManage || all.length >= COLLAB_MAX;
  onChangeCb();
}

// 保存用フィールド。共同投稿者や管理者が編集しても、元の投稿者は変えない。
export function collabFields(isNew, nickname, origNickname){
  const isOwner = isNew || collab.ownerId === collab.me;
  return {
    authorId: isNew ? collab.me : collab.ownerId,
    authorNickname: isOwner ? nickname : (origNickname || nickname),
    coAuthorIds: collab.ids.slice(),
    coAuthorInvites: collab.invites.slice()
  };
}

// 保存後、新しく招待した人にだけ通知する
export function notifyNewInvites(articleId, articleTitle){
  const fresh = collab.invites.filter(u => !collab.origInvites.includes(u));
  fresh.forEach(toUid => sendNotification({ toUid, type: "collab", articleId, articleTitle }));
  collab.origInvites = collab.invites.slice();
}
