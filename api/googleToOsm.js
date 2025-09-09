const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

// GET /api/googleToOsm?googlePlaceId=...
router.get('/googleToOsm', async (req, res) => {
  const { googlePlaceId } = req.query;
  const googleApiKey = "AIzaSyAcaEIbX_s-ZYhEkBbwKQBLuuX2GTBGISs";

  if (!googlePlaceId) {
    return res.status(400).json({ error: 'Missing googlePlaceId' });
  }

  if (!googleApiKey) {
    return res.status(500).json({ error: 'Google API key not configured on the server.' });
  }

  try {
    // Get Google Places Details API
    const googleDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=geometry&key=${googleApiKey}`;
    const googleResponse = await fetch(googleDetailsUrl);
    const googleData = await googleResponse.json();

    if (!googleData.result || !googleData.result.geometry) {
      return res.status(404).json({ error: 'Google Place details not found or missing geometry.' });
    }

    // Return the geometry directly
    res.json(googleData.result.geometry);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
