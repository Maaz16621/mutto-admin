
const functions = require('firebase-functions/v1');
const { getStripe } = require('../utils/helpers');
const { logError } = require('../utils/logger');

exports.createSetupIntent = functions.https.onCall(async (data, context) => {
  const { customerId } = data;

  if (!customerId) {
    const error = new functions.https.HttpsError('invalid-argument', 'Customer ID is required.');
    await logError(error, {
      message: error,
      data,
      context,
    });
    throw error;
  }

  try {
    const setupIntent = await getStripe().setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return { clientSecret: setupIntent.client_secret };
  } catch (error) {
    console.error('Error creating SetupIntent:', error);
    await logError(error, {
      message: error,
      data,
      context,
    });
    throw new functions.https.HttpsError('internal', 'Unable to create SetupIntent.', error.message);
  }
});
