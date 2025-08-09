const admin = require('firebase-admin');

try {
  let serviceAccount;

  // Check if the service account key is in an environment variable (for App Hosting)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Fallback to local file for local development
    serviceAccount = require('./mutto-84d97-firebase-adminsdk-fbsvc-6baf4caccd.json');
  }

  if (admin.apps.length === 0) { // Prevent re-initializing the app
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', error);
}

module.exports = admin;