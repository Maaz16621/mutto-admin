// Main API server entry point
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const deleteUserRoute = require('./deleteUser');
const placeDetailsRoute = require('./placeDetails');
const nominatimProxyRoute = require('./nominatimProxy');
const googleToOsmRoute = require('./googleToOsm');
const getServicesRoute = require('./getServices');
const { runUpdate } = require('./updateVehicleType');


const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mount admin routes
app.use('/api', deleteUserRoute);
app.use('/api', placeDetailsRoute);
app.use('/api', nominatimProxyRoute);
app.use('/api', googleToOsmRoute);
app.use('/api', getServicesRoute);
app.use('/api', require('./copyDb'));

app.get('/api/updateVehicles', async (req, res) => {
    try {
      const result = await runUpdate();
      res.status(200).send(result);
    } catch (error) {
      console.error('Failed to update vehicle types:', error);
      res.status(500).send(`An error occurred while updating vehicle types: ${error.message}`);
    }
  });



app.get("/", (req, res) => {
  res.send("✅ Cloud Run is working!");
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Listening on port ${PORT}`);
});