
const functions = require('firebase-functions/v1');
const { getStripe } = require('../utils/helpers');
const { logError } = require('../utils/logger');

exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
  const { amount, currency = 'aed' } = data;

  if (!amount || amount <= 0) {
    const error = new functions.https.HttpsError('invalid-argument', 'Amount must be a positive integer.');
    await logError(error, {
      message: error,
      data,
      context,
    });
    throw error;
  }

  try {
  const paymentIntent = await getStripe().paymentIntents.create({
  amount,
  currency,
  automatic_payment_methods: { enabled: true },
});


    return {
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error) {
    console.error('Error creating PaymentIntent:', error);
    await logError(error, {
      message: error,
      data,
      context,
    });
    throw new functions.https.HttpsError('internal', 'Unable to create PaymentIntent.', error.message);
  }
});
