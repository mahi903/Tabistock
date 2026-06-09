// Tabistock - Firebase 接続（クライアント用・公開前提の設定）
// 各ページから `import { auth, db, storage } from "./firebase-config.js"` で利用する。
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC64CiQzn6RrpLKNv8ZEIWdtJ3vVqrxlsQ",
  authDomain: "tabistock.firebaseapp.com",
  projectId: "tabistock",
  storageBucket: "tabistock.firebasestorage.app",
  messagingSenderId: "1003651778196",
  appId: "1:1003651778196:web:ce29437f495873f1acd681",
  measurementId: "G-JBLFB31W6C"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
