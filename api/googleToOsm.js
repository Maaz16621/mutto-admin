const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

// GET /api/googleToOsm?googlePlaceId=...
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const d = R * c; // in metres
  return d;
}

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
    // 1. Get Lat/Lng and address components from Google Places Details API
    const googleDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=name,geometry,address_components&key=${googleApiKey}`;
    const googleResponse = await fetch(googleDetailsUrl);
    const googleData = await googleResponse.json();

    if (!googleData.result || !googleData.result.geometry || !googleData.result.geometry.location) {
      return res.status(404).json({ error: 'Google Place details not found or missing geometry.' });
    }

    const { name, address_components } = googleData.result;
    const { lat, lng } = googleData.result.geometry.location;
    const viewport = googleData.result.geometry.viewport; // Get viewport here

    let countryCode = null;
    if (address_components) {
      const countryComponent = address_components.find(comp => comp.types.includes('country'));
      if (countryComponent) {
        countryCode = countryComponent.short_name.toLowerCase();
      }
    }

    let osmData = null;

    // 2. Prioritize Nominatim Search by Name (with country filter)
    if (name) {
      let nominatimSearchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&polygon_geojson=1&accept-language=en`;
      if (countryCode) {
        nominatimSearchUrl += `&countrycodes=${countryCode}`;
      }
      const nominatimSearchResponse = await fetch(nominatimSearchUrl, {
        headers: {
          'User-Agent': 'MuttoCarWashApp/1.0 (mutto.app)'
        }
      });
      const nominatimSearchResults = await nominatimSearchResponse.json();

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

    // 4. Final Fallback: Overpass API for administrative boundaries around the point
    if (!osmData) {
      try {
        const overpassQuery = `
          [out:json];
          is_in(${lat},${lng});
          area._[admin_level];
          out geom;
        `;
        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
        const overpassResponse = await fetch(overpassUrl);
        const overpassData = await overpassResponse.json();

        if (overpassData.elements && overpassData.elements.length > 0) {
          const element = overpassData.elements[0];
          if (element.type === "relation" && element.members) {
            const coordinates = element.members
              .filter(m => m.type === "way" && m.geometry)
              .map(m => m.geometry.map(coord => [coord.lon, coord.lat]));
            if (coordinates.length > 0) {
              osmData = { geojson: { type: "MultiPolygon", coordinates: [coordinates] }, display_name: element.tags?.name || "Unnamed Area" };
            }
          } else if (element.type === "way" && element.geometry) {
            const coordinates = element.geometry.map(coord => [coord.lon, coord.lat]);
            osmData = { geojson: { type: "Polygon", coordinates: [coordinates] }, display_name: element.tags?.name || "Unnamed Area" };
          }
        }
      } catch (overpassErr) {
        console.error("Error fetching from Overpass API:", overpassErr);
      }
    }

    // If no detailed OSM geometry found after all attempts, fallback to a point with calculated radius
    if (!osmData || !osmData.geojson) {
      let calculatedRadius = 500; // Default fallback radius

      if (viewport) {
        const neLat = viewport.northeast.lat;
        const neLng = viewport.northeast.lng;
        const swLat = viewport.southwest.lat;
        const swLng = viewport.southwest.lng;

        // Calculate diagonal distance of the viewport
        const diagonalDistance = haversineDistance(neLat, neLng, swLat, swLng);
        calculatedRadius = diagonalDistance / 2; // Take half the diagonal as radius

        // Ensure a reasonable minimum/maximum radius
        calculatedRadius = Math.max(100, Math.min(calculatedRadius, 5000)); // Min 100m, Max 5km
      }

      osmData = {
        osm_id: googlePlaceId, // Use Google Place ID as fallback OSM ID
        display_name: name, // Use Google Place name as fallback display name
        geojson: {
          type: "Point",
          coordinates: [lng, lat], // GeoJSON format: [lng, lat]
          properties: { radius: calculatedRadius }
        }
      };
    }

    res.json(osmData);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
