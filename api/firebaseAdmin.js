// Firebase Admin SDK initialization
const admin = require('firebase-admin');

// Use the correct path to your service account key
const serviceAccount = require('./mutto-84d97-firebase-adminsdk-fbsvc-6baf4caccd.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
