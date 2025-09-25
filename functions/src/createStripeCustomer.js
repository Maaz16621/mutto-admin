
const functions = require('firebase-functions/v1');
const { getStripe } = require('../utils/helpers');

exports.createStripeCustomer = functions.https.onCall(async (data, context) => {
  const email = data.email;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required.');
  }

  try {
    const customer = await getStripe().customers.create({ email });
    return { customerId: customer.id };
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new functions.https.HttpsError('internal', 'Unable to create Stripe customer.', error.message);
  }
});
