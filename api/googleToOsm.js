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
  //updated

  if (!googleApiKey) {
    return res.status(500).json({ error: 'Google API key not configured on the server.' });
  }

  try {
    // 1. Get Lat/Lng from Google Places Details API
    const googleDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=name,geometry&key=${googleApiKey}`; // Request name field
    const googleResponse = await fetch(googleDetailsUrl);
    const googleData = await googleResponse.json();

    if (!googleData.result || !googleData.result.geometry || !googleData.result.geometry.location) {
      return res.status(404).json({ error: 'Google Place details not found or missing geometry.' });
    }

    const { name } = googleData.result; // Get name
    const { lat, lng } = googleData.result.geometry.location;

    let osmData = null;

    // 2. Prioritize Nominatim Search by Name
    if (name) {
      const nominatimSearchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&polygon_geojson=1&accept-language=en`;
      const nominatimSearchResponse = await fetch(nominatimSearchUrl, {
        headers: {
          'User-Agent': 'MuttoCarWashApp/1.0 (mutto.app)'
        }
      });
      const nominatimSearchResults = await nominatimSearchResponse.json();

      // Find the first result with a polygon
      const polygonResult = nominatimSearchResults.find(item => item.geojson && (item.geojson.type === "Polygon" || item.geojson.type === "MultiPolygon"));
      if (polygonResult) {
        osmData = polygonResult;
      }
    }

    // 3. Fallback to Nominatim Reverse Geocoding if search by name didn't yield a polygon
    if (!osmData) {
      const nominatimReverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&polygon_geojson=1&accept-language=en`;
      const nominatimReverseResponse = await fetch(nominatimReverseUrl, {
        headers: {
          'User-Agent': 'MuttoCarWashApp/1.0 (mutto.app)'
        }
      });
      const nominatimReverseResult = await nominatimReverseResponse.json();
      if (nominatimReverseResult.geojson && (nominatimReverseResult.geojson.type === "Polygon" || nominatimReverseResult.geojson.type === "MultiPolygon")) {
        osmData = nominatimReverseResult;
      }
    }

    if (!osmData) {
      return res.status(404).json({ error: 'No detailed OSM geometry found for this place.' });
    }

    res.json(osmData);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
