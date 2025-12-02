const admin = require('firebase-admin');

// Initialize default app
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Initialize Doha DB app
let dohaDb;
if (admin.apps.some(app => app.name === 'doha-db')) {
  dohaDb = admin.app('doha-db').firestore();
} else {
  // When deployed to a Google Cloud environment like App Hosting,
  // the service account is discovered automatically.
  // For local development, you might need to set GOOGLE_APPLICATION_CREDENTIALS
  // to the path of your service account key file.
  const dohaApp = admin.initializeApp({
    databaseId: 'doha-db'
  }, 'doha-db');
  dohaDb = dohaApp.firestore();
}


const db = admin.firestore();

module.exports = { admin, db, dohaDb };
