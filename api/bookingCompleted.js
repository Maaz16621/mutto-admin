const express = require('express');
const axios = require('axios');

const router = express.Router();

router.post('/bookingCompleted', async (req, res) => {
  res.json({ success: true, message: "Debug response from bookingCompleted" });
  return;
  /*
  try {
    // 🔐 Internal auth check
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { bookingId, amount, userId, currency } = req.body;

    if (!bookingId || !userId) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // 🔥 Send event to GA4
    await axios.post(
      `https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA_MEASUREMENT_ID}&api_secret=${process.env.GA_API_SECRET}`,
      {
        client_id: userId,
        events: [
          {
            name: 'purchase',
            params: {
              transaction_id: bookingId,
              value: amount || 0,
              currency: currency || 'PKR'
            }
          }
        ]
      }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('GA4 analytics error:', err.message);
    return res.status(500).json({ error: 'Analytics failed' });
  }
  */
});

module.exports = router;
