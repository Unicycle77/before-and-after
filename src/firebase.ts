import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const env = import.meta.env as Record<string, string | undefined>;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Object.values(config).every((v) => !!v);

const app = isFirebaseConfigured ? initializeApp(config) : undefined;

function need<T>(value: T | undefined): T {
  if (!value) throw new Error("Firebase is not configured. Copy .env.example to .env and fill it in.");
  return value;
}

export const auth = () => getAuth(need(app));
export const db = () => getDatabase(need(app));
export const storage = () => getStorage(need(app));

/** Base URL players are sent to. */
export const PUBLIC_URL: string = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || window.location.origin;
export const joinUrlFor = (code: string) => `${PUBLIC_URL}/play?code=${code}`;
