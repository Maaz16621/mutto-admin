const { Expo } = require('expo-server-sdk');

const sendPushNotification = async (pushToken, title, message) => {
  const expo = new Expo();

  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messageData = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: message,
    data: { withSome: 'data' },
  };

  try {
    const ticket = await expo.sendPushNotificationsAsync([messageData]);
    console.log('Ticket:', ticket);
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
};

module.exports = sendPushNotification;
