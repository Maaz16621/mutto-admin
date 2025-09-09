const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

// GET /api/nominatimProxy?query=...
router.get('/nominatimProxy', async (req, res) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&polygon_geojson=1&accept-language=en`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MuttoCarWashApp/1.0 (mutto.app)' // Required by Nominatim usage policy
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
