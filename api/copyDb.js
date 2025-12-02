// copyDb.js
const express = require('express');
const { db, dohaDb } = require('./firebaseAdmin');


const router = express.Router();


async function copyCollection(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return 0;

  const batchSize = 500;
  let batch = dohaDb.batch();
  let counter = 0;

  for (const doc of snapshot.docs) {
    const docRef = dohaDb.collection(collectionName).doc(doc.id);
    batch.set(docRef, doc.data());
    counter++;

    if (counter % batchSize === 0) {
      await batch.commit();
      batch = dohaDb.batch();
    }
  }

  if (counter % batchSize !== 0) {
    await batch.commit();
  }

  return counter;
}

async function copyDatabase() {
  const collections = await db.listCollections();
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
    const result = await copyDatabase();
    res.json({
      success: true,
      message: 'Database copy to doha-db complete!',
      details: result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error copying database',
      error: error.message
    });
  }
});

module.exports = router;
