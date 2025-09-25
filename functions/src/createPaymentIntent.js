
const functions = require('firebase-functions/v1');
const { getStripe } = require('../utils/helpers');

exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
  const amount = data.amount;
  const currency = data.currency || 'usd';

  if (!amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount must be a positive integer.');
  }

  try {
    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amount,
      currency: currency,
    });

    return {
      clientSecret: paymentIntent.client_secret,
    };
  } catch (error) {
    console.error('Error creating PaymentIntent:', error);
    throw new functions.https.HttpsError('internal', 'Unable to create PaymentIntent.', error.message);
  }
});
