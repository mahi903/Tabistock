// アカウント削除（Vercel サーバーレス関数）
// 役割：マイページの「アカウントを削除」から呼ばれ、本人のデータをすべて消してから
//       Firebase Auth のユーザー自体を削除する。App Store 審査の必須要件（5.1.1(v)）。
//
// 消すもの：
//   - 本人が投稿者の記事（いいね・コメント・コメントのいいね・Storage の写真ごと）
//   - 共同投稿者／招待中になっている他人の記事からは、本人を外すだけ
//   - 他人の記事に付けたコメント（とそのいいね）、記事・コメントへのいいね
//   - フォロー関係（相手側の followers / following も）
//   - 本人が送った通知
//   - DM（本人が参加している会話は、メッセージごと全部）
//   - users/{uid}（保存・端末トークン・通知などのサブコレクション含む）、publicProfiles/{uid}
//   - Storage の avatars/{uid}/
//   - 最後に Firebase Auth のユーザー
//
// 安全策：
//   - IDトークンを検証し、さらに「直前（5分以内）にパスワードで再ログインした」ことを
//     auth_time で確認する（盗まれた端末から勝手に消されないように）。
//   - 本文に confirm: "DELETE" が無ければ何もしない。

import admin from "firebase-admin";

const BUCKET = "tabistock.firebasestorage.app";

function ensureApp() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY || "";
  if (privateKey.includes("\\n")) privateKey = privateKey.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("missing service account env vars");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: BUCKET
  });
}

// ドキュメントをサブコレクションごと消す
async function rdel(ref) {
  await admin.firestore().recursiveDelete(ref);
}

// Storage のフォルダ（prefix）を丸ごと消す
async function delFolder(prefix) {
  try {
    await admin.storage().bucket().deleteFiles({ prefix, force: true });
  } catch (e) {
    console.warn("storage delete failed", prefix, e && e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  try {
    ensureApp();

    const authz = req.headers.authorization || "";
    const m = authz.match(/^Bearer (.+)$/);
    if (!m) { res.status(401).json({ error: "no auth token" }); return; }
    const decoded = await admin.auth().verifyIdToken(m[1], true);
    const uid = decoded.uid;

    const body = req.body || {};
    if (body.confirm !== "DELETE") { res.status(400).json({ error: "confirm required" }); return; }

    // 直前の再ログインを必須にする（auth_time は秒）
    const ageSec = Math.floor(Date.now() / 1000) - Number(decoded.auth_time || 0);
    if (ageSec > 5 * 60) { res.status(401).json({ error: "recent login required" }); return; }

    const db = admin.firestore();
    // 管理者アカウントは誤操作防止のため、ここからは消せない
    if ((await db.collection("admins").doc(uid).get()).exists) {
      res.status(403).json({ error: "admin account" }); return;
    }
    const FV = admin.firestore.FieldValue;
    const stats = { articles: 0, comments: 0, conversations: 0 };

    // 1) 記事
    const all = await db.collection("articles").get();
    for (const a of all.docs) {
      const d = a.data() || {};
      if (d.authorId === uid) {
        // 本人の記事：写真ごと削除
        await delFolder(`articles/${a.id}/`);
        await rdel(a.ref);
        stats.articles++;
        continue;
      }
      // 共同投稿・招待から外す
      const co = Array.isArray(d.coAuthorIds) && d.coAuthorIds.includes(uid);
      const inv = Array.isArray(d.coAuthorInvites) && d.coAuthorInvites.includes(uid);
      if (co || inv) {
        await a.ref.update({ coAuthorIds: FV.arrayRemove(uid), coAuthorInvites: FV.arrayRemove(uid) });
      }
      // 「一緒に行った人」のタグから外す
      if (Array.isArray(d.taggedIds) && d.taggedIds.includes(uid)) {
        await a.ref.update({ taggedIds: FV.arrayRemove(uid) });
      }
      // 記事へのいいね
      await a.ref.collection("likes").doc(uid).delete();
      // コメント：本人のものは削除、他人のコメントへのいいねも外す
      const cs = await a.ref.collection("comments").get();
      for (const c of cs.docs) {
        if ((c.data() || {}).authorId === uid) {
          await rdel(c.ref);
          stats.comments++;
        } else {
          await c.ref.collection("likes").doc(uid).delete();
        }
      }
    }

    // 2) フォロー関係（相手側の記録も消す）
    const me = db.collection("users").doc(uid);
    const following = await me.collection("following").get();
    for (const f of following.docs) {
      await db.collection("users").doc(f.id).collection("followers").doc(uid).delete();
    }
    const followers = await me.collection("followers").get();
    for (const f of followers.docs) {
      await db.collection("users").doc(f.id).collection("following").doc(uid).delete();
    }

    // 3) 本人が他の人に送った通知
    const users = await db.collection("users").get();
    for (const u of users.docs) {
      if (u.id === uid) continue;
      const ns = await u.ref.collection("notifications").where("fromUid", "==", uid).get();
      for (const n of ns.docs) await n.ref.delete();
    }

    // 4) DM：本人が参加している会話をメッセージごと削除
    const convs = await db.collection("conversations").where("participants", "array-contains", uid).get();
    for (const c of convs.docs) {
      await rdel(c.ref);
      stats.conversations++;
    }

    // 5) 本人が出した通報
    const reps = await db.collection("reports").where("reporterUid", "==", uid).get();
    for (const r of reps.docs) await r.ref.delete();

    // 6) プロフィール・ユーザー情報・アイコン
    await rdel(me);
    await rdel(db.collection("publicProfiles").doc(uid));
    await delFolder(`avatars/${uid}/`);

    // 7) ログイン情報（最後に消す）
    await admin.auth().deleteUser(uid);

    res.status(200).json({ ok: true, ...stats });
  } catch (e) {
    console.error("deleteAccount failed", e);
    const code = e && e.code === "auth/id-token-revoked" ? 401 : 500;
    res.status(code).json({ error: "delete failed", detail: String((e && e.message) || e).slice(0, 200) });
  }
}
