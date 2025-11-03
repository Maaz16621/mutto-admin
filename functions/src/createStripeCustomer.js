
const functions = require('firebase-functions/v1');
const { getStripe } = require('../utils/helpers');
const { logError } = require('../utils/logger');

exports.createStripeCustomer = functions.https.onCall(async (data, context) => {
  const { email } = data;

  if (!email) {
    const error = new functions.https.HttpsError('invalid-argument', 'Email is required.');
    await logError(error, {
      message: error,
      data,
      context,
    });
    throw error;
  }

  try {
    const customer = await getStripe().customers.create({ email });
    return { customerId: customer.id };
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    await logError(error, {
      message:error,
      data,
      context,
    });
    throw new functions.https.HttpsError('internal', 'Unable to create Stripe customer.', error.message);
  }
});
