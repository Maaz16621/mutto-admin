
const functions = require('firebase-functions/v1');
const { admin, db } = require('../firebaseAdmin');
const axios = require('axios');
const crypto = require('crypto'); // required for hashing


async function sendMetaPurchaseEvent({ bookingId, afterData }) {
  const META_APP_ID = '877863721313586';
  const META_ACCESS_TOKEN = functions.config().meta.access_token;

  if (!META_ACCESS_TOKEN) {
    console.error('[Meta] Access token missing');
    return;
  }

  const hash = (value) =>
    crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');

  const payload = {
    event: "CUSTOM_APP_EVENTS",
    custom_events: [
      {
        _eventName: "fb_mobile_purchase",
        _logTime: Math.floor(Date.now() / 1000),
        _eventID: bookingId,
        _valueToSum: Number(afterData.totalAmount || 0),
        fb_currency: "AED"
      }
    ],
    user_data: {
      em: afterData.email ? [hash(afterData.email)] : undefined,
      ph: afterData.phone ? [hash(afterData.phone)] : undefined
    }
  };

  console.log(`[Meta] Sending payload for booking ${bookingId}:`, JSON.stringify(payload, null, 2));

  let metaResponse = null;

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${META_APP_ID}/activities`,
      payload,
      { params: { access_token: META_ACCESS_TOKEN } }
    );

    metaResponse = response.data;
    console.log(`[Meta] Response for booking ${bookingId}:`, JSON.stringify(metaResponse, null, 2));
  } catch (error) {
    metaResponse = error?.response?.data || { error: error.message };
    console.error(`[Meta] Failed for booking ${bookingId}:`, JSON.stringify(metaResponse, null, 2));
  }

  // Optional: save to Firestore for historical tracking
  try {
    await db.collection('metaLogs').add({
      bookingId,
      payload,
      response: metaResponse,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[Meta] Logged event to Firestore for booking ${bookingId}`);
  } catch (err) {
    console.error(`[Meta] Failed to save log for booking ${bookingId}:`, err.message);
  }
}





async function triggerAnalyticsAPI(bookingId, bookingData) {
  try {
    await axios.get(
      'https://mutto-admin-api--mutto-84d97.asia-east1.hosted.app/api/copy-db',
      {
        params: {
          bookingId,
          amount: bookingData.totalAmount || 0,
          userId: bookingData.userId,
          currency: 'AED'
        },
        headers: {
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`
        },
        timeout: 5000
      }
    );
  } catch (err) {
    console.error('Analytics trigger failed:', err.message);
  }
}

exports.handleBookingNotification = functions.firestore
  .document('bookings/{bookingId}')
  .onWrite(async (change, context) => {
    const bookingId = context.params.bookingId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    if (afterData.reminderSent) {
      return null;
    }

    // Case 1: User books a service (New booking)
    if (!beforeData && afterData) {
      // Notify all relevant staff
      const staffSnapshot = await db.collection('staff').where('permissions', 'array-contains', 'bookings').get();
      staffSnapshot.forEach(doc => {
        db.collection('notifications').add({
          title: 'New Booking',
          body: `A new booking #${bookingId} has been created.`,
          userId: doc.id,
          userType: 'staff',
          data: { bookingId },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      // If a worker is already assigned at creation, notify them immediately.
      if (afterData.workerId) {
        db.collection('notifications').add({
          title: 'New Assignment',
          body: `You have been assigned to a new booking #${bookingId}.`,
          userId: afterData.workerId,
          userType: 'worker',
          data: { bookingId },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // Case 2: Admin assigns worker
    if (beforeData && afterData && beforeData.workerId !== afterData.workerId) {
      db.collection('notifications').add({
        title: 'New Assignment',
        body: `You have been assigned to booking #${bookingId}.`,
        userId: afterData.workerId,
        userType: 'worker',
        data: { bookingId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      db.collection('notifications').add({
        title: 'Worker Assigned',
        body: `A worker has been assigned to your booking #${bookingId}.`,
        userId: afterData.userId,
        userType: 'user',
        data: { bookingId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Case 3: Worker updates status
    if (beforeData && afterData && beforeData.status !== afterData.status) {
      let notificationBody = `The status of your booking #${bookingId} has been updated to ${afterData.status}.`;
      if (afterData.status === 'on its way') {
        notificationBody = 'Your worker is on its way.';
      }
      db.collection('notifications').add({
        title: 'Booking Status Updated',
        body: notificationBody,
        userId: afterData.userId,
        userType: 'user',
        data: { bookingId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      const staffSnapshot = await db.collection('staff').where('permissions', 'array-contains', 'bookings').get();
      staffSnapshot.forEach(doc => {
        db.collection('notifications').add({
          title: 'Booking Status Updated',
          body: `The status of booking #${bookingId} has been updated to ${afterData.status}.`,
          userId: doc.id,
          userType: 'staff',
          data: { bookingId },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    }

    // Case 4: Booking details changed
    if (beforeData && afterData && (JSON.stringify(beforeData) !== JSON.stringify(afterData) && beforeData.workerId === afterData.workerId && beforeData.status === afterData.status)) {
      db.collection('notifications').add({
        title: 'Booking Details Changed',
        body: `The details of your booking #${bookingId} have been updated.`,
        userId: afterData.userId,
        userType: 'user',
        data: { bookingId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (afterData.workerId) {
        db.collection('notifications').add({
          title: 'Booking Details Changed',
          body: `The details of booking #${bookingId} have been updated.`,
          userId: afterData.workerId,
          userType: 'worker',
          data: { bookingId },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

 if (
  beforeData &&
  afterData &&
  beforeData.status !== 'completed' &&
  afterData.status === 'completed' &&
  !afterData.analyticsTracked
) {
  await db.collection('notifications').add({
    title: 'Booking Completed',
    body: `Your booking #${bookingId} has been completed.`,
    userId: afterData.userId,
    userType: 'user',
    data: { bookingId },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // 🔥 META PURCHASE EVENT
  await sendMetaPurchaseEvent({ bookingId, afterData });

  await triggerAnalyticsAPI(bookingId, afterData);

  await db.collection('bookings').doc(bookingId).update({
    analyticsTracked: true,
  });
}



    // Case 6: Booking cancelled by User
    if (beforeData && afterData && afterData.status === 'cancelled' && beforeData.status !== 'cancelled' && afterData.cancelledBy === 'user') {
      const staffSnapshot = await db.collection('staff').where('permissions', 'array-contains', 'bookings').get();
      staffSnapshot.forEach(doc => {
        db.collection('notifications').add({
          title: 'Booking Cancelled',
          body: `Booking #${bookingId} has been cancelled by the user.`,
          userId: doc.id,
          userType: 'staff',
          data: { bookingId },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      if (afterData.workerId) {
        db.collection('notifications').add({
          title: 'Booking Cancelled',
          body: `Booking #${bookingId} has been cancelled by the user.`,
          userId: afterData.workerId,
          userType: 'worker',
          data: { bookingId },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    // Case 7: Booking cancelled by Worker/Admin
    if (beforeData && afterData && afterData.status === 'cancelled' && beforeData.status !== 'cancelled' && (afterData.cancelledBy === 'worker' || afterData.cancelledBy === 'admin')) {
      db.collection('notifications').add({
        title: 'Booking Cancelled',
        body: `Your booking #${bookingId} has been cancelled.`,
        userId: afterData.userId,
        userType: 'user',
        data: { bookingId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return null;
  });
