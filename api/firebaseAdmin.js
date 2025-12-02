const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize default app
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = getFirestore(); // default db
const dohaDb = getFirestore('doha-db');

module.exports = { admin, db, dohaDb };
