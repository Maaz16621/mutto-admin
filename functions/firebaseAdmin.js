const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (admin.apps.length === 0) {
    admin.initializeApp();
}

const defaultDb = getFirestore('doha-db');
const db = getFirestore();

module.exports = { admin, db, defaultDb };
