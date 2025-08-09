const admin = require('firebase-admin');

// When deployed to a Google Cloud environment like App Hosting,
// initializeApp() automatically discovers the service account credentials.
if (admin.apps.length === 0) {
  admin.initializeApp();
}

module.exports = admin;
