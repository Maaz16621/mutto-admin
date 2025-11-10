const express = require('express');
const { admin, db } = require('./firebaseAdmin'); // Assuming firebaseAdmin.js initializes admin SDK

const router = express.Router();

// POST /api/deleteUser { uid: string, reason: string, feedback: string }
router.post('/deleteUser', async (req, res) => {
  const { uid, reason, feedback } = req.body;

  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' });
  }

  try {
    // 1. Update the user's document in Firestore
    const userRef = db.collection('users').doc(uid);
    await userRef.update({
      isDeleted: true,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletionReason: reason,
      deletionFeedback: feedback,
    });

    // 2. Delete the user from Firebase Auth
    await admin.auth().deleteUser(uid);

    // 3. (Optional) Save the deletion request for analytics
    await db.collection('deletionRequests').add({
      userId: uid,
      reason: reason,
      feedback: feedback,
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;