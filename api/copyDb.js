// copyDb.js
const express = require('express');
const { db, dohaDb } = require('./firebaseAdmin');

const axios = require('axios');


const router = express.Router();


async function copyCollection(collectionName) {
  const snapshot = await dohaDb.collection(collectionName).get();
  if (snapshot.empty) return 0;

  const batchSize = 500;
  let batch = db.batch();
  let counter = 0;

  for (const doc of snapshot.docs) {
    const docRef = db.collection(collectionName).doc(doc.id);
    batch.set(docRef, doc.data());
    counter++;

    if (counter % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (counter % batchSize !== 0) {
    await batch.commit();
  }

  return counter;
}

async function copyDatabase() {
  const collections = await dohaDb.listCollections();
  const results = [];

  for (const col of collections) {
    const count = await copyCollection(col.id);
    results.push({ collection: col.id, documentsCopied: count });
  }

  return results;
}

// API endpoint
router.get('/copy-db', async (req, res) => {
  try {
     // 🔐 Internal auth check
     const authHeader = req.headers.authorization;
     if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
       return res.status(401).json({ error: 'Unauthorized' });
     }
 
     const { bookingId, amount, userId, currency } = req.query;
 
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
});

module.exports = router;
