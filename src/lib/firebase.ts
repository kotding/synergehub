import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  "projectId": "synergy-hub-yviyl",
  "appId": "1:102111219497:web:4a5b54b0ec7fd043f13138",
  "storageBucket": "quizgame-3e7a1.appspot.com",
  "apiKey": "AIzaSyBdCaTFR7RVrAjk7WTGbAuWfVZ8tyNuYMY",
  "authDomain": "synergy-hub-yviyl.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "102111219497"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

export { app, db, storage };
