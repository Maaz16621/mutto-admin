const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

// GET /api/placeDetails?placeId=...
router.get('/placeDetails', async (req, res) => {
  const { placeId } = req.query;
  const apiKey = "AIzaSyAcaEIbX_s-ZYhEkBbwKQBLuuX2GTBGISs";

  if (!placeId) {
    return res.status(400).json({ error: 'Missing placeId' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'Google API key not configured on the server.' });
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
