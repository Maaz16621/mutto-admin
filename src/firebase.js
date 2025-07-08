import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBCQjWrgJem-afR7FdT9jrDkP4ZiuqVHWY",
  authDomain: "mutto-84d97.firebaseapp.com",
  projectId: "mutto-84d97",
  storageBucket: "mutto-84d97.firebasestorage.app",
  messagingSenderId: "816589390469",
  appId: "1:816589390469:web:f7ef72c0aa7566d5621fec",
  measurementId: "G-269XN9XQW5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const DATABASE_URL = "https://mutto-84d97-default-rtdb.firebaseio.com";

export { app, auth, db, firestore, DATABASE_URL, storage };
