// Main API server entry point
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const deleteUserRoute = require('./deleteUser');
const placeDetailsRoute = require('./placeDetails');
const nominatimProxyRoute = require('./nominatimProxy');
const googleToOsmRoute = require('./googleToOsm');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mount admin routes
app.use('/api', deleteUserRoute);
app.use('/api', placeDetailsRoute);
app.use('/api', nominatimProxyRoute);
app.use('/api', googleToOsmRoute);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Admin API server running on port ${PORT}`);
});
