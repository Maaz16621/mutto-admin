
const functions = require('firebase-functions/v1');
const { getStripe } = require('../utils/helpers');

exports.createSetupIntent = functions.https.onCall(async (data, context) => {
  const customerId = data.customerId;

  if (!customerId) {
    throw new functions.https.HttpsError('invalid-argument', 'Customer ID is required.');
  }

  try {
    const setupIntent = await getStripe().setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return { clientSecret: setupIntent.client_secret };
  } catch (error) {
    console.error('Error creating SetupIntent:', error);
    throw new functions.https.HttpsError('internal', 'Unable to create SetupIntent.', error.message);
  }
});
