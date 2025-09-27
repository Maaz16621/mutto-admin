
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { sendNotification } = require('../utils/helpers');

dayjs.extend(utc);
dayjs.extend(timezone);

exports.scheduleBookingReminder = functions.pubsub.schedule('every 60 minutes').onRun(async (context) => {
  console.log('Running scheduleBookingReminder...');

  const nowUAE = dayjs().tz('Asia/Dubai');

  try {
    const bookingsSnapshot = await admin.firestore().collection('bookings')
      .where('status', '==', 'confirmed')
      .where('reminderSent', '!=', true) // Only get bookings that haven't sent a reminder
      .get();

    console.log(`Found ${bookingsSnapshot.docs.length} confirmed bookings without a reminder sent.`);

    for (const doc of bookingsSnapshot.docs) {
      const booking = doc.data();
      const bookingId = doc.id;

      // Ensure selectedDate and selectedTime exist
      if (!booking.selectedDate || !booking.selectedTime) {
        console.warn(`Booking ${bookingId} is missing selectedDate or selectedTime. Skipping.`);
        continue;
      }

      // Parse booking time in UAE timezone
      // Assuming selectedTime is like "10:00 AM to 11:00 AM", we take the start time
      const bookingStartTimeStr = booking.selectedTime.split(' to ')[0];
      const bookingDateTimeUAE = dayjs(`${booking.selectedDate} ${bookingStartTimeStr}`, 'YYYY-MM-DD hh:mm A').tz('Asia/Dubai');

      // Calculate 6-hour reminder time
      const reminderTimeUAE = bookingDateTimeUAE.subtract(6, 'hour');

      console.log(`Booking ${bookingId}: Booking Time (UAE): ${bookingDateTimeUAE.format()}, Reminder Time (UAE): ${reminderTimeUAE.format()}`);
      console.log(`Current Time (UAE): ${nowUAE.format()}`);

      // Check if the reminder time falls within the next hour window
      // i.e., reminderTimeUAE is between nowUAE (inclusive) and nowUAE + 1 hour (exclusive)
      if (reminderTimeUAE.isSameOrAfter(nowUAE, 'minute') && reminderTimeUAE.isBefore(nowUAE.add(61, 'minute'), 'minute')) {
        console.log(`Booking ${bookingId} is due for a 6-hour reminder!`);

        const userId = booking.userId;
        if (!userId) {
          console.warn(`Booking ${bookingId} has no userId. Skipping notification.`);
          continue;
        }

        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        if (!userDoc.exists) {
          console.warn(`User ${userId} not found for booking ${bookingId}. Skipping notification.`);
          continue;
        }

        const userToken = userDoc.data().expoPushToken;
        if (userToken) {
          const title = 'Booking Reminder';
          const body = `Your booking #${bookingId} is scheduled in 6 hours at ${bookingStartTimeStr} on ${booking.selectedDate}.`;
          const data = { bookingId };

          await sendNotification([userToken], title, body, data, [userId], 'user', true);
          console.log(`Sent reminder for booking ${bookingId} to user ${userId}.`);

          // Mark booking as reminderSent
          await doc.ref.update({ reminderSent: true });
          console.log(`Marked booking ${bookingId} as reminderSent.`);
        } else {
          console.log(`User ${userId} has no Expo push token for booking ${bookingId}. Skipping push notification.`);
          // Still mark as reminderSent to avoid re-processing
          await doc.ref.update({ reminderSent: true });
          console.log(`Marked booking ${bookingId} as reminderSent (no token).`);
        }
      } else {
        console.log(`Booking ${bookingId} reminder not due yet or already passed.`);
      }
    }
  } catch (error) {
    console.error('Error in scheduleBookingReminder:', error);
  }
  return null;
});
