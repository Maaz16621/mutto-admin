// Express route to delete a Firebase Auth user by UID (admin only)
const express = require('express');
const admin = require('./firebaseAdmin');

const router = express.Router();

// POST /api/deleteUser { uid: string }
router.post('/deleteUser', async (req, res) => {
  const { uid } = req.body;
  if (!uid) {
    return res.status(400).json({ error: 'Missing uid' });
  }
  try {
    await admin.auth().deleteUser(uid);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
