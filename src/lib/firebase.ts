import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  "projectId": "synergy-hub-yviyl",
  "appId": "1:102111219497:web:4a5b54b0ec7fd043f13138",
  "storageBucket": "synergy-hub-yviyl.firebasestorage.app",
  "apiKey": "AIzaSyBdCaTFR7RVrAjk7WTGbAuWfVZ8tyNuYMY",
  "authDomain": "synergy-hub-yviyl.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "102111219497"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
