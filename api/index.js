// Main API server entry point
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const deleteUserRoute = require('./deleteUser');
const placeDetailsRoute = require('./placeDetails');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(bodyParser.json());

// Mount admin routes
app.use('/api', deleteUserRoute);
app.use('/api', placeDetailsRoute);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Admin API server running on port ${PORT}`);
});
