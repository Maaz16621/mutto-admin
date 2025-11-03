const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * Logs an error to the 'logs' collection in Firestore.
 * @param {Error} error The error object to log.
 * @param {object} context Additional context to log with the error.
 */
const logError = async (error, context = {}) => {
  try {
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: error.message,
      stack: error.stack,
      context,
    };
    await db.collection('logs').add(logEntry);
    console.error("Error logged to Firestore:", logEntry);
  } catch (firestoreError) {
    console.error("Error writing to Firestore logs:", firestoreError);
    console.error("Original error:", error);
  }
};

module.exports = { logError };
