
const { firestore } = require('firebase-functions/v1');
const admin = require('firebase-admin');

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
