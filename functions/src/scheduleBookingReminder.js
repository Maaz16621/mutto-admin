
const functions = require('firebase-functions/v1');
const { db } = require('../firebaseAdmin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { sendNotification } = require('../utils/helpers');

dayjs.extend(utc);
dayjs.extend(timezone);

exports.scheduleBookingReminder = functions.pubsub.schedule('every 15 minutes').timeZone('Asia/Dubai').onRun(async (context) => {
  const nowUAE = dayjs().tz('Asia/Dubai');

  try {
    const bookingsSnapshot = await db.collection('bookings')
      .where('status', '==', 'confirmed')
      .get();

    for (const doc of bookingsSnapshot.docs) {
      const booking = doc.data();
      const bookingId = doc.id;

      if (!booking.selectedDate || !booking.selectedTime) {
        console.warn(`Booking ${bookingId} is missing selectedDate or selectedTime. Skipping.`);
        continue;
      }

      const bookingStartTimeStr = booking.selectedTime.split(' to ')[0];
      const bookingDateTimeUAE = dayjs(`${booking.selectedDate} ${bookingStartTimeStr}`, 'YYYY-MM-DD hh:mm A').tz('Asia/Dubai');

      // --- Handle User Reminder ---
      const isBookingToday = nowUAE.isSame(bookingDateTimeUAE, 'day');
      if (isBookingToday && !booking.userReminderSent) {
        const userReminderTimeUAE = bookingDateTimeUAE.subtract(6, 'hour');
        if (nowUAE.isAfter(userReminderTimeUAE) && nowUAE.isBefore(bookingDateTimeUAE)) {
          const userId = booking.userId;
          if (userId) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists && userDoc.data().pushTokens && userDoc.data().pushTokens.length > 0) {
              let serviceName = 'your booked service';
              if (booking.serviceId) {
                const serviceDoc = await db.collection('services').doc(booking.serviceId).get();
                if (serviceDoc.exists) {
                  serviceName = serviceDoc.data().name || serviceName;
                }
              }

              const userTokens = userDoc.data().pushTokens;
              const title = 'Booking Reminder';
              const body = `Your ${serviceName} booking is scheduled in about 6 hours.`;
              await sendNotification(userTokens, title, body, { bookingId }, [userId], 'user', false);
            }
          }
          await doc.ref.update({ userReminderSent: true, reminderSent: true });
        }
      }

      // --- Handle Worker Reminder ---
      if (isBookingToday && !booking.workerReminderSent) {
        const workerId = booking.workerId;
        if (workerId) {
          const workerDoc = await db.collection('workers').doc(workerId).get();
          if (workerDoc.exists) {
            const workerData = workerDoc.data();
            const drivingTime = workerData.drivingTime || 0; // Default to 0 if not set
            const workerReminderOffset = drivingTime + 15; // driving time + 15 minutes
            const workerReminderTimeUAE = bookingDateTimeUAE.subtract(workerReminderOffset, 'minute');

            if (nowUAE.isAfter(workerReminderTimeUAE) && nowUAE.isBefore(bookingDateTimeUAE)) {
              if (workerData.expoPushToken) {
                let serviceName = 'a service';
                if (booking.serviceId) {
                  const serviceDoc = await db.collection('services').doc(booking.serviceId).get();
                  if (serviceDoc.exists) {
                    serviceName = serviceDoc.data().name || serviceName;
                  }
                }

                const workerToken = workerData.expoPushToken;
                const title = 'Booking Reminder';
                const body = `You have a booking for ${serviceName} at ${bookingStartTimeStr}.`;
                await sendNotification([workerToken], title, body, { bookingId }, [workerId], 'worker', false);
              }
              await doc.ref.update({ workerReminderSent: true, reminderSent: true });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in scheduleBookingReminder:', error);
  }
  return null;
});

