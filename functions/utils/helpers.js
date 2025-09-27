
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios');
const dayjs = require('dayjs');

let stripe;
const getStripe = () => {
  if (!stripe) {
    stripe = require('stripe')(functions.config().stripe.secret_key);
  }
  return stripe;
};

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

const formatTime = (date) => date.format('hh:mm A');

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

module.exports = {
  getStripe,
  sendNotification,
  haversineDistance,
  isPointInPolygon,
  generateTimeSlots,
};
