
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, limit, query } from "firebase/firestore";

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
const firestore = getFirestore(app);

async function getUserSchema() {
  const usersCollection = collection(firestore, 'users');
  const q = query(usersCollection, limit(1));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    console.log('No documents found in the users collection.');
    return;
  }

  querySnapshot.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
}

generateSchema();
