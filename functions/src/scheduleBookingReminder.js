const functions = require('firebase-functions/v1');
const { db } = require('../firebaseAdmin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { sendNotification } = require('../utils/helpers');

dayjs.extend(utc);
dayjs.extend(timezone);

const UAE_TZ = 'Asia/Dubai';

exports.scheduleBookingReminder = functions.pubsub
  .schedule('every 15 minutes')
  .timeZone(UAE_TZ)
  .onRun(async () => {
    const nowUAE = dayjs().tz(UAE_TZ);

    try {
      const bookingsSnapshot = await db
        .collection('bookings')
        .where('status', '==', 'confirmed')
        .get();

      for (const doc of bookingsSnapshot.docs) {
        const booking = doc.data();
        const bookingId = doc.id;

        if (!booking.selectedDate || !booking.selectedTime) {
          console.warn(`Booking ${bookingId} missing date/time`);
          continue;
        }

        // ============================
        // Parse booking time in UAE
        // ============================
        const bookingStartTimeStr = booking.selectedTime.split(' to ')[0];

        const bookingDateTimeUAE = dayjs.tz(
          `${booking.selectedDate} ${bookingStartTimeStr}`,
          'YYYY-MM-DD hh:mm A',
          UAE_TZ
        );

        if (!bookingDateTimeUAE.isValid()) {
          console.warn(`Invalid datetime for booking ${bookingId}`);
          continue;
        }

        // ❗ HARD GUARD: never process past bookings
        if (bookingDateTimeUAE.isBefore(nowUAE)) {
          continue;
        }

        // Minutes remaining
        const diffMinutes = bookingDateTimeUAE.diff(nowUAE, 'minute');

        // ============================
        // USER REMINDER (6 HOURS)
        // ============================
        if (
          !booking.userReminderSent &&
          diffMinutes <= 360 &&
          diffMinutes > 0
        ) {
          if (booking.userId) {
            const userDoc = await db.collection('users').doc(booking.userId).get();

            if (
              userDoc.exists &&
              Array.isArray(userDoc.data().pushTokens) &&
              userDoc.data().pushTokens.length > 0
            ) {
              let serviceName = 'your booked service';

              if (booking.serviceId) {
                const serviceDoc = await db
                  .collection('services')
                  .doc(booking.serviceId)
                  .get();
                if (serviceDoc.exists) {
                  serviceName = serviceDoc.data().name || serviceName;
                }
              }

              await sendNotification(
                userDoc.data().pushTokens,
                'Booking Reminder',
                `Your ${serviceName} booking is scheduled in about 6 hours.`,
                { bookingId },
                [booking.userId],
                'user',
                false
              );
            }
          }

          // ✅ mark sent immediately (idempotent)
          await doc.ref.update({
            userReminderSent: true,
            userReminderSentAt: new Date()
          });
        }

        // ============================
        // WORKER REMINDER
        // ============================
        if (
          !booking.workerReminderSent &&
          booking.workerId
        ) {
          const workerDoc = await db
            .collection('workers')
            .doc(booking.workerId)
            .get();

          if (workerDoc.exists) {
            const workerData = workerDoc.data();
            const drivingTime = Number(workerData.drivingTime || 0);
            const workerReminderOffset = drivingTime + 15;

            if (
              diffMinutes <= workerReminderOffset &&
              diffMinutes > 0
            ) {
              if (workerData.expoPushToken) {
                let serviceName = 'a service';

                if (booking.serviceId) {
                  const serviceDoc = await db
                    .collection('services')
                    .doc(booking.serviceId)
                    .get();
                  if (serviceDoc.exists) {
                    serviceName = serviceDoc.data().name || serviceName;
                  }
                }

                await sendNotification(
                  [workerData.expoPushToken],
                  'Booking Reminder',
                  `You have a booking for ${serviceName} at ${bookingStartTimeStr}.`,
                  { bookingId },
                  [booking.workerId],
                  'worker',
                  false
                );
              }

              await doc.ref.update({
                workerReminderSent: true,
                workerReminderSentAt: new Date()
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in scheduleBookingReminder:', error);
    }

    return null;
  });
