const express = require('express');
const router = express.Router();
const { db } = require('./firebaseAdmin');

router.get('/getServices', async (req, res) => {
    try {
        const servicesRef = db.collection('services');
        const snapshot = await servicesRef.get();

        if (snapshot.empty) {
            return res.status(404).json({ message: 'No services found.' });
        }

        const services = [];
        snapshot.forEach(doc => {
            services.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.status(200).json(services);
    } catch (error) {
        console.error('Error fetching services:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

module.exports = router;
