const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

exports.releaseTimeSlot = functions.https.onCall(async (data, context) => {
 
    const { workerId, selectedDate, selectedTime, userId } = data;

    if (!workerId || !selectedDate || !selectedTime || !userId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: workerId, selectedDate, selectedTime, or userId.');
    }

    try {
        const reservationsRef = admin.firestore().collection('reservations');
        const querySnapshot = await reservationsRef
            .where('workerId', '==', workerId)
            .where('selectedDate', '==', selectedDate)
            .where('selectedTime', '==', selectedTime)
            .where('userId', '==', userId)
            .get();

        if (!querySnapshot.empty) {
            const docRef = querySnapshot.docs[0].ref;
            await docRef.delete();
            return { success: true, message: 'Reservation released.' };
        } else {
            return { success: true, message: 'No active reservation found to release.' };
        }
    } catch (error) {
        console.error('Error releasing time slot:', error);
        throw new functions.https.HttpsError('internal', 'Failed to release time slot.', error.message);
    }
});