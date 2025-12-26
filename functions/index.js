
require('./firebaseAdmin');

const { createStripeCustomer } = require('./src/createStripeCustomer');
const { createSetupIntent } = require('./src/createSetupIntent');
const { createPaymentIntent } = require('./src/createPaymentIntent');
const { getAvailableTimeSlotsV2 } = require('./src/getAvailableTimeSlotsV2');
const { getAvailableTimeSlotsV3 } = require('./src/getAvailableTimeSlotsV3');
const { handleBookingNotification } = require('./src/handleBookingNotification');
const { sendPushOnNewNotification } = require('./src/sendPushOnNewNotification');
const { scheduleBookingReminder } = require('./src/scheduleBookingReminder');
const { sendChatNotification } = require('./src/sendChatNotification');
const { releaseTimeSlot} = require('./src/releaseTimeSlot')
const { reserveTimeSlot } = require('./src/reserveTimeSlot')

exports.createStripeCustomer = createStripeCustomer;
exports.createSetupIntent = createSetupIntent;
exports.createPaymentIntent = createPaymentIntent;
exports.getAvailableTimeSlotsV2 = getAvailableTimeSlotsV2;
exports.getAvailableTimeSlotsV3 = getAvailableTimeSlotsV3;
exports.handleBookingNotification = handleBookingNotification;
exports.sendPushOnNewNotification = sendPushOnNewNotification;
exports.scheduleBookingReminder = scheduleBookingReminder;
exports.sendChatNotification = sendChatNotification;
exports.reserveTimeSlot = reserveTimeSlot;
exports.releaseTimeSlot = releaseTimeSlot
