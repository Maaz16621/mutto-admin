// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBCQjWrgJem-afR7FdT9jrDkP4ZiuqVHWY",
  authDomain: "mutto-84d97.firebaseapp.com",
  projectId: "mutto-84d97",
  storageBucket: "mutto-84d97.firebasestorage.app",
  messagingSenderId: "816589390469",
  appId: "1:816589390469:web:f7ef72c0aa7566d5621fec",
  measurementId: "G-269XN9XQW5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export { app, analytics };
