
const functions = require('firebase-functions/v1');
const { admin, db } = require('../firebaseAdmin');
const { logError } = require('../utils/logger');

exports.applyCoupon = functions.https.onCall(async (data, context) => {
    const { couponCode } = data;
    const userId = context.auth ? context.auth.uid : null;

    if (!userId) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to apply a coupon.');
    }

    if (!couponCode) {
        throw new functions.https.HttpsError('invalid-argument', 'Coupon code is required.');
    }

    try {
        const couponsRef = db.collection('coupons');
        const couponQuery = await couponsRef.where('code', '==', couponCode.toUpperCase()).get();

        if (couponQuery.empty) {
            throw new functions.https.HttpsError('not-found', 'Coupon not found.');
        }

        const couponDoc = couponQuery.docs[0];
        const coupon = { id: couponDoc.id, ...couponDoc.data() };

        // 1. Check if coupon is active (dates)
        const now = new Date();
        const startDate = new Date(coupon.startDate);
        const endDate = new Date(coupon.endDate);

        if (now < startDate || now > endDate) {
            throw new functions.https.HttpsError('failed-precondition', 'Coupon is not active.');
        }

        // 2. Check total usage limit
        if (coupon.usageLimit <= 0) {
            throw new functions.https.HttpsError('failed-precondition', 'Coupon has reached its usage limit.');
        }
        
        // 3. Check usage per user
        const usagePerUser = coupon.usagePerUser || 1;
        const bookingsRef = db.collection('bookings');
        const userBookingsQuery = await bookingsRef
            .where('userId', '==', userId)
            .where('appliedCoupon.code', '==', coupon.code)
            .where('status', 'in', ['confirmed', 'completed'])
            .get();

        if (userBookingsQuery.size >= usagePerUser) {
            throw new functions.https.HttpsError('failed-precondition', `You have already used this coupon ${userBookingsQuery.size} time(s).`);
        }

        // All checks passed, return coupon details
        return {
            id: coupon.id,
            code: coupon.code,
            type: coupon.type,
            value: coupon.value
        };

    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('Error applying coupon:', error);
        await logError(error, {
            message: 'Error applying coupon',
            data,
            context,
        });
        throw new functions.https.HttpsError('internal', 'Unable to apply coupon.', error.message);
    }
});
