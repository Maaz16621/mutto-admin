const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe')(functions.config().stripe.secret_key);
const axios = require('axios');

admin.initializeApp();

exports.createStripeCustomer = functions.https.onCall(async (data, context) => {
  const email = data.email;

  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required.');
  }

  try {
    const customer = await stripe.customers.create({ email });
    return { customerId: customer.id };
  } catch (error) {
    console.error('Error creating Stripe customer:', error);
    throw new functions.https.HttpsError('internal', 'Unable to create Stripe customer.', error.message);
  }
});

exports.createSetupIntent = functions.https.onCall(async (data, context) => {
  const customerId = data.customerId;

  if (!customerId) {
    throw new functions.https.HttpsError('invalid-argument', 'Customer ID is required.');
  }

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    });
    return { clientSecret: setupIntent.client_secret };
  } catch (error) {
    console.error('Error creating SetupIntent:', error);
    throw new functions.https.HttpsError('internal', 'Unable to create SetupIntent.', error.message);
  }
});

exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
  const amount = data.amount;
  const currency = data.currency || 'usd';

  if (!amount || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount must be a positive integer.');
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
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

const sendNotification = async (tokens, title, body, data, users, userType) => {
  // Normalize userType
  const normalizedType = userType.toLowerCase();
  
  if (['user', 'users', 'worker', 'workers', 'staff'].includes(normalizedType)) {
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    }));

    for (const message of messages) {
      try {
        await axios.post('https://exp.host/--/api/v2/push/send', message, {
          headers: {
            Accept: 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
        });
        console.log(`Successfully sent push notification to ${message.to}`);
      } catch (error) {
        console.error(`Error sending push notification to ${message.to}:`, error);
      }
    }
  } else {
    console.log(`Skipping push notifications for userType: ${userType}`);
  }
};


// Haversine formula to calculate distance between two lat/lon points in km
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

const generateTimeSlots = (startTime, endTime, interval) => {
  const slots = [];
  let [startHour, startMinute] = startTime.split(':').map(Number);
  let [endHour, endMinute] = endTime.split(':').map(Number);

  let current = new Date();
  current.setHours(startHour, startMinute, 0, 0);

  let end = new Date();
  end.setHours(endHour, endMinute, 0, 0);

  while (current.getTime() < end.getTime()) {
    const next = new Date(current.getTime() + interval * 60 * 1000);
    if (next.getTime() > end.getTime()) break;

    const formatTime = (date) => {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
      const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      return `${formattedHours}:${formattedMinutes} ${ampm}`;
    };

    slots.push(`${formatTime(current)} to ${formatTime(next)}`);
    current = next;
  }
  return slots;
};

exports.getAvailableTimeSlots = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { serviceId, dateString, selectedAddress } = data;

  if (!serviceId || !dateString || !selectedAddress) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: serviceId, dateString, or selectedAddress.');
  }

  try {
    // Fetch all necessary data from Firestore
    const settingsRef = admin.firestore().collection('settings').doc('appSettings');
    const serviceRef = admin.firestore().collection('services').doc(serviceId);
    const workersCollection = admin.firestore().collection('workers');
    
    const [settingsSnap, serviceSnap, workerSnapshot] = await Promise.all([
        settingsRef.get(),
        serviceRef.get(),
        workersCollection.get()
    ]);

    if (!settingsSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'App settings not found.');
    }
    if (!serviceSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Service data not found.');
    }

    const appSettings = settingsSnap.data();
    const serviceData = { id: serviceSnap.id, ...serviceSnap.data() };
    const workers = workerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const [year, month, day] = dateString.split('-').map(Number);
    const selectedDateObj = new Date(year, month - 1, day);
    const dayOfWeek = selectedDateObj.getDay();

    // Fetch existing bookings for the selected date
    const bookingsQuery = admin.firestore().collection('bookings')
      .where('selectedDate', '==', dateString)
      .where('status', '==', 'confirmed');
    const bookingsSnapshot = await bookingsQuery.get();
    const existingBookings = bookingsSnapshot.docs.map(doc => doc.data());

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = dayNames[dayOfWeek];

    const slotsMap = new Map();

    workers.forEach(worker => {
      if (!worker.assignedServices || !Array.isArray(worker.assignedServices) || !worker.assignedServices.includes(serviceData.id)) {
        return;
      }

      if (worker.serviceArea && worker.serviceArea.geometry && Array.isArray(worker.serviceArea.geometry.coordinates) && worker.serviceArea.geometry.coordinates.length >= 2 && worker.serviceArea.properties && typeof worker.serviceArea.properties.radius === 'number' && selectedAddress && typeof selectedAddress.latitude === 'number' && typeof selectedAddress.longitude === 'number') {
        const workerLat = worker.serviceArea.geometry.coordinates[1];
        const workerLon = worker.serviceArea.geometry.coordinates[0];
        const radius = worker.serviceArea.properties.radius;
        const radiusKm = radius / 1000;

        const distance = haversineDistance(
          selectedAddress.latitude,
          selectedAddress.longitude,
          workerLat,
          workerLon
        );

        if (distance > radiusKm) {
          return;
        }
      } else {
        return;
      }

      if (worker.enabled === false) {
        return;
      }

      if (worker.offDates && Array.isArray(worker.offDates) && worker.offDates.includes(dateString)) {
        return;
      }

      let workerStartTime = '';
      let workerEndTime = '';
      let workerInterval = worker.interval || 60;

      const workerSpecialHoursMap = worker.specialWorkingHours && Array.isArray(worker.specialWorkingHours) ?
        worker.specialWorkingHours.reduce((acc, curr) => {
          if (curr.date) acc[curr.date] = curr;
          return acc;
        }, {}) : {};

      if (workerSpecialHoursMap[dateString]) {
        const specialHours = workerSpecialHoursMap[dateString];
        workerStartTime = specialHours.start;
        workerEndTime = specialHours.end;
        workerInterval = specialHours.interval || workerInterval;
      } else if (worker.dailyWorkingHours && worker.dailyWorkingHours[currentDayName]) {
        const dailyHours = worker.dailyWorkingHours[currentDayName];
        if (dailyHours.enabled) {
          workerStartTime = dailyHours.start;
          workerEndTime = dailyHours.end;
          workerInterval = dailyHours.interval || workerInterval;
        } else {
          return;
        }
      } else {
        return;
      }

      if (workerStartTime && workerEndTime && workerInterval) {
        const slots = generateTimeSlots(workerStartTime, workerEndTime, workerInterval);
        slots.forEach(slot => {
            const isBooked = existingBookings.some(booking =>
                booking.workerId === worker.id && booking.selectedTime === slot
            );

            if (isBooked) {
                return;
            }

          const existingWorkers = slotsMap.get(slot) || [];
          if (!existingWorkers.includes(worker.id)) {
            slotsMap.set(slot, [...existingWorkers, worker.id]);
          }
        });
      }
    });

    const sortedSlots = Array.from(slotsMap.keys()).sort((a, b) => {
      const parseTime = (timeStr) => {
        const [time, ampm] = timeStr.split(' ');
        let [hours, minutes] = time.split(':').map(Number);
        if (ampm === 'PM' && hours !== 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
      };
      const timeA = parseTime(a.split(' to ')[0]);
      const timeB = parseTime(b.split(' to ')[0]);
      return timeA - timeB;
    });
    
    // Convert Map to an object for JSON serialization
    const timeSlotsToWorkersMapObject = Object.fromEntries(slotsMap);

    return {
        availableTimeSlots: sortedSlots,
        timeSlotsToWorkersMap: timeSlotsToWorkersMapObject
    };

  } catch (error) {
    console.error("Error fetching available time slots:", error);
    throw new functions.https.HttpsError('internal', 'Failed to get available time slots.', error.message);
  }
});

exports.handleBookingNotification = functions.firestore
  .document('bookings/{bookingId}')
  .onWrite(async (change, context) => {
    console.log(`handleBookingNotification triggered for bookingId: ${context.params.bookingId}`)
    const bookingId = context.params.bookingId;
    const beforeData = change.before.data();
    const afterData = change.after.data();

    console.log('beforeData exists:', !!beforeData); // <-- ADD THIS
    console.log('afterData exists:', !!afterData); // <-- ADD THIS

    // Case 1: User books a service (New booking)
    if (!beforeData && afterData) {
      console.log('New booking detected. Proceeding to send notifications.');
      console.log(`New booking details: Booking ID: ${bookingId}, Service: ${afterData.serviceName}, Total Amount: AED ${afterData.totalAmount}, Customer: ${afterData.customerName}`);

      // Notify all relevant staff
      const staffSnapshot = await admin.firestore().collection('staff').where('permissions', 'array-contains', 'bookings').get();
      console.log(`Found ${staffSnapshot.docs.length} staff members with 'bookings' permission.`);
      const staffTokens = staffSnapshot.docs.map(doc => doc.data().expoPushToken).filter(token => token);
      const staffIds = staffSnapshot.docs.map(doc => doc.id);
      console.log(`Found ${staffTokens.length} staff members with valid push tokens.`);

      if (staffIds.length > 0) { // Ensure notification is saved to Firestore for all staff
        console.log('Condition met: staffIds.length > 0. Calling sendNotification for staff.');
        await sendNotification(staffTokens, 'New Booking', `A new booking #${bookingId} has been created.`, { bookingId }, staffIds, 'staff');
      } else {
        console.log('Condition not met: staffIds.length is 0. Skipping staff notification.');
      }

      // If a worker is already assigned at creation, notify them immediately.
      if (afterData.workerId) {
        console.log(`Condition met: afterData.workerId is present. Value: ${afterData.workerId}.`);
        const workerId = afterData.workerId;
        const workerDoc = await admin.firestore().collection('workers').doc(workerId).get();
        if (workerDoc.exists) {
            console.log(`Worker doc found for workerId: ${workerId}.`);
            const workerData = workerDoc.data();
            console.log(`Worker data: ${JSON.stringify(workerData, null, 2)}`);
            const workerToken = workerData.expoPushToken;
            if (workerToken) {
              console.log(`Worker token found: ${workerToken}`);
              // Always call sendNotification if worker exists, let sendNotification handle push token check
              console.log('Calling sendNotification for worker.');
              await sendNotification([workerToken], 'New Assignment', `You have been assigned to a new booking #${bookingId}.`, { bookingId }, [workerId], 'worker', true);
            } else {
              console.log(`Worker token not found for workerId: ${workerId}`);
            }
        } else {
            console.error(`Worker document not found for workerId: ${workerId} during new booking notification.`);
        }
      } else {
        console.log('Condition not met: afterData.workerId is not present. Skipping worker notification.');
      }
    }

    // Case 2: Admin assigns worker
    if (beforeData && afterData && beforeData.workerId !== afterData.workerId) {
      const workerId = afterData.workerId;
      const workerDoc = await admin.firestore().collection('workers').doc(workerId).get();
      const workerToken = workerDoc.data().expoPushToken;
      // Always call sendNotification if worker exists, let sendNotification handle push token check
      await sendNotification(workerToken ? [workerToken] : [], 'New Assignment', `You have been assigned to booking #${bookingId}.`, { bookingId }, [workerId], 'worker', true);

      const userId = afterData.userId;
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userToken = userDoc.data().expoPushToken;
      if (userToken) {
        await sendNotification([userToken], 'Worker Assigned', `A worker has been assigned to your booking #${bookingId}.`, { bookingId }, [userId], 'user', true);
      }
    }

    // Case 3: Worker updates status
    if (beforeData && afterData && beforeData.status !== afterData.status) {
      const userId = afterData.userId;
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userToken = userDoc.data().expoPushToken;
      if (userToken) {
        let notificationBody = `The status of your booking #${bookingId} has been updated to ${afterData.status}.`;
        if (afterData.status === 'on its way') {
          notificationBody = 'Your worker is on its way.';
        }
        await sendNotification([userToken], 'Booking Status Updated', notificationBody, { bookingId }, [userId], 'user', true);
      }

      const staffSnapshot = await admin.firestore().collection('staff').where('permissions', 'array-contains', 'bookings').get();
      const staffTokens = staffSnapshot.docs.map(doc => doc.data().expoPushToken).filter(token => token);
      const staffIds = staffSnapshot.docs.map(doc => doc.id);
      if (staffIds.length > 0) { // Ensure notification is saved to Firestore for all staff
        await sendNotification(staffTokens, 'Booking Status Updated', `The status of booking #${bookingId} has been updated to ${afterData.status}.`, { bookingId }, staffIds, 'staff', true);
      }
    }

    // Case 4: Booking details changed (Assuming any change other than workerId and status is a detail change)
    if (beforeData && afterData && (JSON.stringify(beforeData) !== JSON.stringify(afterData) && beforeData.workerId === afterData.workerId && beforeData.status === afterData.status)) {
        const userId = afterData.userId;
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        const userToken = userDoc.data().expoPushToken;
        if (userToken) {
            await sendNotification([userToken], 'Booking Details Changed', `The details of your booking #${bookingId} have been updated.`, { bookingId }, [userId], 'user', true);
        }

        const workerId = afterData.workerId;
        if (workerId) {
            const workerDoc = await admin.firestore().collection('workers').doc(workerId).get();
            const workerToken = workerDoc.data().expoPushToken;
            // Always call sendNotification if worker exists, let sendNotification handle push token check
            await sendNotification(workerToken ? [workerToken] : [], 'Booking Details Changed', `The details of booking #${bookingId} have been updated.`, { bookingId }, [workerId], 'worker', true);
        }
    }
    
    // Case 5: Booking reminder (This should be handled by a scheduled function, not a trigger)

    // Case 6: Booking cancelled by User
    if (beforeData && afterData && afterData.status === 'cancelled' && beforeData.status !== 'cancelled' && afterData.cancelledBy === 'user') {
        const staffSnapshot = await admin.firestore().collection('staff').where('permissions', 'array-contains', 'bookings').get();
        const staffTokens = staffSnapshot.docs.map(doc => doc.data().expoPushToken).filter(token => token);
        const staffIds = staffSnapshot.docs.map(doc => doc.id);
        if (staffIds.length > 0) { // Ensure notification is saved to Firestore for all staff
            await sendNotification(staffTokens, 'Booking Cancelled', `Booking #${bookingId} has been cancelled by the user.`, { bookingId }, staffIds, 'staff', true);
        }

        const workerId = afterData.workerId;
        if (workerId) {
            const workerDoc = await admin.firestore().collection('workers').doc(workerId).get();
            const workerToken = workerDoc.data().expoPushToken;
            // Always call sendNotification if worker exists, let sendNotification handle push token check
            await sendNotification(workerToken ? [workerToken] : [], 'Booking Cancelled', `Booking #${bookingId} has been cancelled by the user.`, { bookingId }, [workerId], 'worker', true);
        }
    }

    // Case 7: Booking cancelled by Worker/Admin
    if (beforeData && afterData && afterData.status === 'cancelled' && beforeData.status !== 'cancelled' && (afterData.cancelledBy === 'worker' || afterData.cancelledBy === 'admin')) {
        const userId = afterData.userId;
        const userDoc = await admin.firestore().collection('users').doc(userId).get();
        const userToken = userDoc.data().expoPushToken;
        if (userToken) {
            await sendNotification([userToken], 'Booking Cancelled', `Your booking #${bookingId} has been cancelled.`, { bookingId }, [userId], 'user', true);
        }
    }

    return null;
  });

exports.sendPushOnNewNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notificationData = snapshot.data();
    console.log('Notification data received by function:', JSON.stringify(notificationData, null, 2));
    const { title, body, recipientType } = notificationData; // Removed 'source'

    console.log(`Processing new notification: ${title}. Recipient Type: ${recipientType}`);

    let collectionName;
    if (recipientType === 'users') {
      collectionName = 'users';
    } else if (recipientType === 'workers') {
      collectionName = 'workers';
    } else {
      // If recipientType is not 'users' or 'workers', it means it's a notification
      // that should go to all users and workers.
      // This handles notifications created by the Notification Manager that are
      // intended for a broad audience.
      console.log('Recipient type is not users or workers. Sending to all users and workers.');
      const usersSnapshot = await admin.firestore().collection('users').get();
      const workersSnapshot = await admin.firestore().collection('workers').get();

      const allTokens = [];
      const allUserIds = [];

      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.expoPushToken) {
          allTokens.push(data.expoPushToken);
          allUserIds.push(doc.id);
        }
      });

      workersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.expoPushToken) {
          allTokens.push(data.expoPushToken);
          allUserIds.push(doc.id);
        }
      });

      console.log(`Found ${allTokens.length} total tokens for all users/workers. Tokens:`, allTokens);

      if (allTokens.length === 0) {
        console.log('No Expo push tokens found for any users or workers.');
        return null;
      }

      await sendNotification(allTokens, title, body, {}, allUserIds, 'all'); // 'all' as userType for logging
      console.log(`Push notifications sent for new notification: ${title} to all users and workers.`);
      return null;
    }

    try {
      const firestore = admin.firestore();
      const recipientsSnapshot = await firestore.collection(collectionName).get();

      if (recipientsSnapshot.empty) {
        console.log(`No recipients found in ${collectionName} collection.`);
        return null;
      }

      const tokens = [];
      const userIds = [];
      recipientsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.expoPushToken) {
          tokens.push(data.expoPushToken);
          userIds.push(doc.id);
        }
      });

      console.log(`Found ${tokens.length} tokens for ${collectionName}. Tokens:`, tokens);

      if (tokens.length === 0) {
        console.log(`No Expo push tokens found for ${collectionName}.`);
        return null;
      }

      await sendNotification(tokens, title, body, {}, userIds, recipientType);
      console.log(`Push notifications sent for new notification: ${title} to ${recipientType}.`);

    } catch (error) {
      console.error('Error sending push notification from Firebase Function:', error);
    }

    return null;
  });

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
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
