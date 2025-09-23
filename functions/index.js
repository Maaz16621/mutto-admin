const functions = require('firebase-functions/v1');
const { firestore } = require('firebase-functions/v1');
const { pubsub } = require('firebase-functions/v1');
const admin = require('firebase-admin');
let stripe;
const getStripe = () => {
  if (!stripe) {
    stripe = require('stripe')(functions.config().stripe.secret_key);
  }
  return stripe;
};
const axios = require('axios');

admin.initializeApp();

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

exports.createSetupIntent = functions.https.onCall(async (data, context) => {
  const customerId = data.customerId;

  if (!customerId) {
    throw new functions.https.HttpsError('invalid-argument', 'Customer ID is required.');
  }

  try {
    const setupIntent = await getStripe().setupIntents.create({
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

const sendNotification = async (tokens, title, body, data, users, userType, createRecord = true) => {
  // Normalize userType
  const normalizedType = userType.toLowerCase();
  
  if (['user', 'users', 'worker', 'workers', 'staff', 'all'].includes(normalizedType)) {
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data,
    }));

    for (const message of messages) {
      let notificationStatus = 'sent';
      let errorMessage = null;
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
        notificationStatus = 'failed';
        errorMessage = error.message;
      } finally {
        if (createRecord) {
          // Create a record in Firestore for each notification sent
          try {
            await admin.firestore().collection('notifications').add({
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              title: title,
              body: body,
              recipientToken: message.to,
              recipientUserIds: users, // Assuming 'users' contains an array of user IDs
              userType: userType,
              status: notificationStatus,
              error: errorMessage,
              data: data, // Include any additional data passed with the notification
            });
            console.log(`Notification record created for ${message.to} with status: ${notificationStatus}`);
          } catch (firestoreError) {
            console.error(`Error creating notification record for ${message.to}:`, firestoreError);
          }
        }
      }
    }
  } else {
    console.log(`Skipping push notifications for userType: ${userType}`);
    if (createRecord) {
      // Still create a record even if push notification is skipped due to userType
      try {
        await admin.firestore().collection('notifications').add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          title: title,
          body: body,
          recipientToken: null, // No specific token if skipped
          recipientUserIds: users,
          userType: userType,
          status: 'skipped',
          error: 'Push notifications skipped for this user type.',
          data: data,
        });
        console.log(`Notification record created with status: skipped for userType: ${userType}`);
      } catch (firestoreError) {
        console.error(`Error creating notification record for skipped userType: ${userType}:`, firestoreError);
      }
    }
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

// Helper function for point-in-polygon (ray casting algorithm)
// point: [lng, lat]
// polygon: array of [lng, lat] coordinates (outer ring)
function isPointInPolygon(point, polygon) {
  let x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i][0], yi = polygon[i][1];
    let xj = polygon[j][0], yj = polygon[j][1];

    let intersect = ((yi > y) != (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

const generateTimeSlots = (startTime, endTime, interval, bufferTime = 0) => {
  const slots = [];
  let current = dayjs(startTime, "hh:mm A");
  const end = dayjs(endTime, "hh:mm A");

  while (current.isBefore(end)) {
    const next = current.add(interval, "minute").add(bufferTime, "minute");
    if (next.isAfter(end) && !next.isSame(end, 'minute')) break; // Ensure the last slot doesn't go past endTime significantly

    slots.push(`${formatTime(current)} to ${formatTime(next.subtract(bufferTime, "minute"))}`);
    current = current.add(interval, "minute");
  }
  return slots;
};

exports.getAvailableTimeSlotsV2 = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  const { serviceId, dateString, selectedAddress, bufferTime = 0 } = data;

  if (!serviceId || !dateString || !selectedAddress) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: serviceId, dateString, or selectedAddress.');
  }

  console.log('getAvailableTimeSlots called with:', { serviceId, dateString, selectedAddress });

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
    
    console.log(`Found ${workers.length} workers.`);

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
      console.log(`Processing worker ${worker.id}`);

      if (!worker.assignedServices || !Array.isArray(worker.assignedServices) || !worker.assignedServices.includes(serviceData.id)) {
        console.log(`Worker ${worker.id} skipped: not assigned to service ${serviceData.id}`);
        return;
      }

      // Check if worker's service area covers the selected address
      if (Array.isArray(worker.serviceArea) && worker.serviceArea.length > 0 && selectedAddress && typeof selectedAddress.latitude === 'number' && typeof selectedAddress.longitude === 'number') {
        const customerLat = selectedAddress.latitude;
        const customerLon = selectedAddress.longitude;
        const customerPoint = [customerLon, customerLat]; // GeoJSON format: [lng, lat]

        console.log(`Worker ${worker.id} serviceArea:`, JSON.stringify(worker.serviceArea, null, 2));
        console.log(`Selected address for worker ${worker.id}:`, JSON.stringify(selectedAddress, null, 2));

        const isCustomerInAnyServiceArea = worker.serviceArea.some((area, index) => {
          console.log(`Checking area ${index} for worker ${worker.id}`);
          if (!area.geometry) {
            console.log(`Area ${index} for worker ${worker.id} has no geometry.`);
            return false;
          }

          let geometry = area.geometry;
          if (typeof geometry === 'string') {
            try {
              geometry = JSON.parse(geometry);
            } catch (e) {
              console.error(`Error parsing serviceArea geometry string for worker ${worker.id}:`, e);
              return false;
            }
          }

          if (!geometry || typeof geometry !== 'object' || !geometry.type) {
            console.warn(`Invalid serviceArea geometry format for worker ${worker.id}:`, geometry);
            return false;
          }
          
          console.log(`Area ${index} for worker ${worker.id} has geometry type: ${geometry.type}`);

          if (geometry.type === 'Point' && geometry.properties && typeof geometry.properties.radius === 'number') {
            const workerLat = geometry.coordinates[1];
            const workerLon = geometry.coordinates[0];
            const radius = geometry.properties.radius; // in meters
            const radiusKm = radius / 1000;
            const distance = haversineDistance(customerLat, customerLon, workerLat, workerLon);
            const isInArea = distance <= radiusKm;
            console.log(`Worker ${worker.id} area ${index} (Point): distance=${distance}km, radius=${radiusKm}km, inArea=${isInArea}`);
            return isInArea;
          } else if (geometry.type === 'Polygon') {
            const isInArea = isPointInPolygon(customerPoint, geometry.coordinates[0]);
            console.log(`Worker ${worker.id} area ${index} (Polygon): inArea=${isInArea}`);
            return isInArea;
          } else if (geometry.type === 'MultiPolygon') {
            const isInArea = geometry.coordinates.some(polygonCoords => isPointInPolygon(customerPoint, polygonCoords[0]));
            console.log(`Worker ${worker.id} area ${index} (MultiPolygon): inArea=${isInArea}`);
            return isInArea;
          }

          console.log(`Area ${index} for worker ${worker.id} has unknown geometry type.`);
          return false;
        });

        console.log(`Worker ${worker.id} isCustomerInAnyServiceArea: ${isCustomerInAnyServiceArea}`);
        if (!isCustomerInAnyServiceArea) {
          console.log(`Worker ${worker.id} skipped: customer not in any service area.`);
          return; // Customer is not in any of the worker's service areas
        }
      } else {
        console.log(`Worker ${worker.id} skipped: no service area defined, invalid address, or serviceArea is not an array or is empty. serviceArea: ${JSON.stringify(worker.serviceArea)}`);
        // If worker has no service area defined, or invalid format, skip them
        return;
      }

      if (worker.enabled === false) {
        console.log(`Worker ${worker.id} skipped: disabled.`);
        return;
      }

      if (worker.offDates && Array.isArray(worker.offDates) && worker.offDates.includes(dateString)) {
        console.log(`Worker ${worker.id} skipped: off date on ${dateString}.`);
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
          console.log(`Worker ${worker.id} skipped: not working on ${currentDayName}.`);
          return;
        }
      } else {
        console.log(`Worker ${worker.id} skipped: no working hours defined for ${currentDayName}.`);
        return;
      }

      if (workerStartTime && workerEndTime && workerInterval) {
        const slots = generateTimeSlots(workerStartTime, workerEndTime, workerInterval, bufferTime);
        slots.forEach(slot => {
            const [slotStartStr, slotEndStr] = slot.split(' to ');
            const slotStart = dayjs(`${dateString} ${slotStartStr}`, 'YYYY-MM-DD hh:mm A');
            const slotEnd = dayjs(`${dateString} ${slotEndStr}`, 'YYYY-MM-DD hh:mm A');

            const isBooked = existingBookings.some(booking => {
                if (booking.workerId !== worker.id) return false;

                const [bookingStartStr, bookingEndStr] = booking.selectedTime.split(' to ');
                const bookingStart = dayjs(`${dateString} ${bookingStartStr}`, 'YYYY-MM-DD hh:mm A');
                const bookingEnd = dayjs(`${dateString} ${bookingEndStr}`, 'YYYY-MM-DD hh:mm A');

                // Check for overlap considering bufferTime
                // A slot is booked if its start time is before the booking's end time + buffer
                // AND its end time + buffer is after the booking's start time
                return (
                    slotStart.isBefore(bookingEnd.add(booking.bufferTime || 0, 'minute')) &&
                    slotEnd.add(bufferTime, 'minute').isAfter(bookingStart)
                );
            });

            if (isBooked) {
                console.log(`Slot ${slot} for worker ${worker.id} is already booked.`);
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
    
    console.log(`Returning ${sortedSlots.length} available slots.`);

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

exports.handleBookingNotification = firestore
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
        await sendNotification(staffTokens, 'New Booking', `A new booking #${bookingId} has been created.`, { bookingId }, staffIds, 'staff', true);
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

exports.sendPushOnNewNotification = firestore
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

      await sendNotification(allTokens, title, body, {}, allUserIds, 'all', false); // 'all' as userType for logging
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

      await sendNotification(tokens, title, body, {}, userIds, recipientType, false);
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

exports.scheduleBookingReminder = pubsub.schedule('every 60 minutes').onRun(async (context) => {
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

exports.sendChatNotification = firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    // Get the newly created message data
    const messageData = snapshot.data();
    if (!messageData) {
      console.log("No message data found.");
      return;
    }

    // Get the ID of the chat room and the sender's ID from the message
    const { chatId } = context.params;
    const senderId = messageData.senderId;
    const messageText = messageData.text;

    // --- 1. Determine the Recipient's ID ---
    // The chatId is a combination of two user IDs, separated by '_'.
    const participantIds = chatId.split('_');
    const recipientId = participantIds.find(id => id !== senderId);

    if (!recipientId) {
      console.error(`Could not determine recipient ID from chatId: ${chatId} and senderId: ${senderId}`);
      return;
    }
    console.log(`Sender: ${senderId}, Recipient: ${recipientId}, Message: "${messageText}"`);

    // --- 2. Get Sender's and Recipient's Information ---
    let senderName = 'Someone';
    let recipientToken = null;

    // Function to get a user's document from either 'users' or 'workers' collection
    const getUserDoc = async (userId) => {
      let userDoc = await admin.firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        return userDoc;
      }
      userDoc = await admin.firestore().collection('workers').doc(userId).get();
      if (userDoc.exists) {
        return userDoc;
      }
      return null;
    };

    // Fetch sender's document to get their name
    const senderDoc = await getUserDoc(senderId);
    if (senderDoc && senderDoc.exists) {
      // Assuming the name field is 'userName'
      senderName = senderDoc.data().userName || 'Someone';
    }

    // Fetch recipient's document to get their push token
    const recipientDoc = await getUserDoc(recipientId);
    if (recipientDoc && recipientDoc.exists) {
      // Assuming the token field is 'expoPushToken'
      recipientToken = recipientDoc.data().expoPushToken;
    }

    // --- 3. Send the Notification ---
    if (recipientToken) {
      console.log(`Found recipient token: ${recipientToken}`);

      // Construct the notification message payload for Expo
      const notificationPayload = {
        to: recipientToken,
        sound: 'default',
        title: `New message from ${senderName}`,
        body: messageText,
        data: {
          screen: 'chat-screen',
          chatId: chatId,
        },
      };

      // Use fetch to send the request to Expo's push API
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notificationPayload),
        });
        console.log('Successfully sent push notification.');
      } catch (error) {
        console.error('Error sending push notification:', error);
      }

    } else {
      console.log(`Recipient ${recipientId} not found or does not have a push token.`);
    }
  });