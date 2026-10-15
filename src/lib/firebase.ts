import { getApps, initializeApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

let db: Firestore | null = null;

export function getDb(): Firestore {
  if (!db) {
    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
        authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
      });
    // Build with AI 2026 is a past event: its data is frozen in the read-only
    // "legacy" database of gdg-cbba-bo. New events live in the (default) database.
    db = getFirestore(app, "legacy");
  }
  return db;
}
