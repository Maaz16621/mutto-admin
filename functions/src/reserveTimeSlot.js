const functions = require('firebase-functions/v1');
const { admin, db } = require('../firebaseAdmin');
const dayjs = require('dayjs');

exports.reserveTimeSlot = functions
  .runWith({ timeoutSeconds: 60, memory: '1GB' })
  .https.onCall(async (data, context) => {
    const { workerId, selectedDate, selectedTime, userId } = data;

    if (!workerId || !selectedDate || !selectedTime || !userId) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
    }

    const expirationTime = dayjs().add(10, 'minute').toDate();
    const reservationsRef = db.collection('reservations');
    const bookingsRef = db.collection('bookings');

    try {
      // 1️⃣ Check confirmed bookings first (outside transaction)
      const confirmedSnap = await bookingsRef
        .where('workerId', '==', workerId)
        .where('selectedDate', '==', selectedDate)
        .where('selectedTime', '==', selectedTime)
        .where('status', '==', 'confirmed')
        .get();

      if (!confirmedSnap.empty) {
        throw new functions.https.HttpsError('already-exists', 'This time slot is already booked.');
      }

      // 2️⃣ Check active reservations
      const reservationSnap = await reservationsRef
        .where('workerId', '==', workerId)
        .where('selectedDate', '==', selectedDate)
        .where('selectedTime', '==', selectedTime)
        .get();

      const now = new Date();
      let existingUserReservation = null;
      for (const doc of reservationSnap.docs) {
        const r = doc.data();
        if (r.userId === userId) existingUserReservation = doc.ref;
        else if (r.expirationTime.toDate() > now)
          throw new functions.https.HttpsError('unavailable', 'Time slot temporarily reserved.');
      }

      // 3️⃣ Create or update reservation
      if (existingUserReservation) {
        await existingUserReservation.update({ expirationTime });
        return { success: true, message: 'Reservation extended.' };
      } else {
        await reservationsRef.add({
          workerId,
          selectedDate,
          selectedTime,
          userId,
          expirationTime,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, message: 'Time slot reserved.' };
      }
    } catch (error) {
      console.error('Error reserving time slot:', error);
      throw new functions.https.HttpsError(
        error.code || 'internal',
        error.message || 'Failed to reserve time slot.'
      );
    }
  });
