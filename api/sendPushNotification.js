const express = require('express');
const router = express.Router();
const admin = require('./firebaseAdmin');
const sendPushNotification = require('./sendNotification');

router.post('/send-push', async (req, res) => {
  const { recipientType, title, body } = req.body;

  if (!recipientType || !title || !body) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let collectionName;
  if (recipientType === 'users') {
    collectionName = 'users';
  } else if (recipientType === 'workers') {
    collectionName = 'workers';
  } else {
    return res.status(400).json({ error: 'Invalid recipient type' });
  }

  try {
    const firestore = admin.firestore();
    const snapshot = await firestore.collection(collectionName).get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'No recipients found' });
    }

    const tokens = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.expoPushToken) {
        tokens.push(data.expoPushToken);
      }
    });

    if (tokens.length === 0) {
      return res.status(404).json({ error: 'No push tokens found for the given recipient type' });
    }

    // Send notifications to all tokens
    const promises = tokens.map(token => sendPushNotification(token, title, body));
    await Promise.all(promises);

    res.status(200).json({ success: true, message: 'Notifications sent successfully' });
  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
