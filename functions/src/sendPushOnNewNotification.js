
const { firestore } = require('firebase-functions/v1');
const admin = require('firebase-admin');
const { sendNotification } = require('../utils/helpers');

exports.sendPushOnNewNotification = firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snapshot, context) => {
    const notificationData = snapshot.data();
    console.log('Notification data received by function:', JSON.stringify(notificationData, null, 2));
    const { title, body, recipientType, userId, userType } = notificationData;

    console.log(`Processing new notification: ${title}. Recipient Type: ${recipientType}`);

    if (userId && userType) {
      let collectionName;
      if (userType === 'user') {
        collectionName = 'users';
      } else if (userType === 'worker') {
        collectionName = 'workers';
      } else if (userType === 'staff') {
        collectionName = 'staff';
      } else {
        console.log(`Invalid userType: ${userType}`);
        return null;
      }

      const doc = await admin.firestore().collection(collectionName).doc(userId).get();
      if (doc.exists) {
        const data = doc.data();
        if (data.expoPushToken) {
          await sendNotification([data.expoPushToken], title, body, notificationData.data || {}, [userId], userType, false);
          console.log(`Push notification sent for new notification: ${title} to ${userType} ${userId}.`);
        } else {
          console.log(`No Expo push token found for ${userType} ${userId}.`);
        }
      } else {
        console.log(`${userType} ${userId} not found.`);
      }
      return null;
    }

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
