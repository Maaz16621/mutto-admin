// This script creates a staff user in Firebase Auth and Firestore. Run ONCE, then delete for security.
// Usage: node createStaffUser.js (with proper Firebase Admin SDK setup)

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// Initialize Firebase Admin
initializeApp({
  credential: applicationDefault(),
  // Or use { credential: cert(serviceAccount) } with your service account key
});

const db = getFirestore();
const auth = getAuth();

async function createStaff() {
  // 1. Create user in Firebase Auth
  const userRecord = await auth.createUser({
    email: 'maazdev@gmail.com',
    password: '123456',
    displayName: 'Maaz Dev',
    emailVerified: false,
    disabled: false,
  });

  // 2. Create staff document in Firestore
  const staffDoc = {
    fullName: 'Maaz Dev',
    email: 'maazdev@gmail.com',
    role: 'admin',
    permissions: ['BOOKING_ASSIGN', 'MAP_VIEW'],
    status: 'active',
    lastLogin: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection('staff').doc(userRecord.uid).set(staffDoc);

  console.log('Staff user and Firestore doc created:', userRecord.uid);
}

createStaff().catch(console.error);
