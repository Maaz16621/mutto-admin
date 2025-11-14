const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

// Assuming these helpers are available in your admin project's utils folder
// You might need to adjust the path based on your admin project's structure
const { haversineDistance, isPointInPolygon, generateTimeSlots } = require('../utils/helpers');

const UAE_TIMEZONE = 'Asia/Dubai';

exports.getAvailableTimeSlotsV2 = functions.runWith({ memory: '1GB' }).https.onCall(async (data, context) => {
    const { serviceId, dateString, selectedAddress, bufferTime = 0, addons = [], totalVehiclesCount } = data;
    if (!serviceId || !dateString || !selectedAddress) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: serviceId, dateString, or selectedAddress.');
    }

    console.log('getAvailableTimeSlots called with:', { serviceId, dateString, selectedAddress, totalVehiclesCount });

    const userId = context.auth ? context.auth.uid : null; // Get current user ID if authenticated

    try {
        // Fetch all necessary data from Firestore
        const settingsRef = admin.firestore().collection('settings').doc('appSettings');
        const serviceRef = admin.firestore().collection('services').doc(serviceId);
        const workersCollection = admin.firestore().collection('workers').where('assignedServices', 'array-contains', serviceId);

        const [settingsSnap, serviceSnap, workerSnap, addonSnaps] = await Promise.all([
            settingsRef.get(),
            serviceRef.get(),
            workersCollection.get(),
            addons && addons.length > 0 ? admin.firestore().collection('products').where(admin.firestore.FieldPath.documentId(), 'in', addons).get() : Promise.resolve(null)
        ]);

        if (!settingsSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'App settings not found.');
        }
        if (!serviceSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Service data not found.');
        }

        const appSettings = settingsSnap.data();
        const serviceData = { id: serviceSnap.id, ...serviceSnap.data() };
        const workers = workerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // **** START: Serviceability Check ****
        // Filter workers to find who can service the selected address.
        const serviceableWorkers = workers.filter(worker => {
            if (Array.isArray(worker.serviceArea) && worker.serviceArea.length > 0 && selectedAddress && typeof selectedAddress.latitude === 'number' && typeof selectedAddress.longitude === 'number') {
                const customerLat = selectedAddress.latitude;
                const customerLon = selectedAddress.longitude;
                const customerPoint = [customerLon, customerLat];

                const isCustomerInAnyServiceArea = worker.serviceArea.some(area => {
                    if (!area.geometry) return false;
                    let geometry = area.geometry;
                    if (typeof geometry === 'string') {
                        try {
                            geometry = JSON.parse(geometry);
                        } catch (e) {
                            console.error(`Error parsing serviceArea geometry for worker ${worker.id}:`, e);
                            return false;
                        }
                    }
                    if (!geometry || !geometry.type) return false;

                    if (geometry.type === 'Point' && geometry.properties && typeof geometry.properties.radius === 'number') {
                        const workerLat = geometry.coordinates[1];
                        const workerLon = geometry.coordinates[0];
                        const radiusKm = geometry.properties.radius / 1000;
                        const distance = haversineDistance(customerLat, customerLon, workerLat, workerLon);
                        return distance <= radiusKm;
                    } else if (geometry.type === 'Polygon') {
                        return isPointInPolygon(customerPoint, geometry.coordinates[0]);
                    } else if (geometry.type === 'MultiPolygon') {
                        return geometry.coordinates.some(polygonCoords => isPointInPolygon(customerPoint, polygonCoords[0]));
                    }
                    return false;
                });
                return isCustomerInAnyServiceArea;
            }
            return false; // Worker has no service area defined or it's invalid.
        });

        const isLocationServiceable = serviceableWorkers.length > 0;

        if (!isLocationServiceable) {
            console.log('No serviceable workers found for this location.');
            return {
                availableTimeSlots: [],
                timeSlotsToWorkersMap: {},
                isServiceable: false,
            };
        }
        // **** END: Serviceability Check ****

        // Calculate total service duration including addons and totalVehiclesCount
        let baseServiceDuration = serviceData.duration || 60;
        const effectiveVehiclesCount = totalVehiclesCount && totalVehiclesCount > 0 ? totalVehiclesCount : 1;
        let totalServiceDuration = baseServiceDuration * effectiveVehiclesCount;

        if (addonSnaps && addonSnaps.docs.length > 0) {
            const sumAddonTimes = addonSnaps.docs.reduce((sum, snap) => sum + (snap.data()?.time || 0), 0);
            totalServiceDuration += sumAddonTimes;
        }

        console.log(`Found ${serviceableWorkers.length} serviceable workers.`);

        const [year, month, day] = dateString.split('-').map(Number);
        const selectedDateObj = new Date(year, month - 1, day);
        const dayOfWeek = selectedDateObj.getDay();

        // Fetch existing confirmed bookings for the selected date for serviceable workers
        const bookingsQuery = admin.firestore().collection('bookings')
            .where('selectedDate', '==', dateString)
            .where('status', '==', 'confirmed')
            .where('workerId', 'in', serviceableWorkers.map(w => w.id));
        const bookingsSnapshot = await bookingsQuery.get();
        const existingBookings = bookingsSnapshot.docs.map(doc => doc.data());

        // Fetch existing active reservations for the selected date for serviceable workers
        const reservationsQuery = admin.firestore().collection('reservations')
            .where('selectedDate', '==', dateString)
            .where('workerId', 'in', serviceableWorkers.map(w => w.id))
            .where('expirationTime', '>', new Date()); // Only active reservations
        const reservationsSnapshot = await reservationsQuery.get();
        const existingReservations = reservationsSnapshot.docs.map(doc => doc.data());

        const bookingsByWorker = existingBookings.reduce((acc, booking) => {
            if (!acc[booking.workerId]) {
                acc[booking.workerId] = [];
            }
            const bookingStartStr = booking.selectedTime.split(' to ')[0];
            const bookingEndStr = booking.selectedTime.split(' to ')[1];
            const bookingStart = dayjs(`${dateString} ${bookingStartStr}`, 'YYYY-MM-DD hh:mm A');
            const bookingEnd = dayjs(`${dateString} ${bookingEndStr}`, 'YYYY-MM-DD hh:mm A');

            const serviceBufferTime = booking.serviceBufferTime || serviceData.bufferTime || 0;
            const drivingTime = booking.drivingTime || 0;

            const busyStart = bookingStart.subtract(drivingTime, 'minute');
            const busyEnd = bookingEnd.add(serviceBufferTime, 'minute');

            acc[booking.workerId].push({ start: busyStart, end: busyEnd, type: 'confirmed' });
            return acc;
        }, {});

        // Add active reservations to bookingsByWorker, treating them as busy slots
        existingReservations.forEach(reservation => {
            // Only consider reservations by *other* users as unavailable
            if (userId && reservation.userId === userId) {
                return; // Current user's own reservation should still appear available to them
            }

            if (!bookingsByWorker[reservation.workerId]) {
                bookingsByWorker[reservation.workerId] = [];
            }
            const reservationStartStr = reservation.selectedTime.split(' to ')[0];
            const reservationEndStr = reservation.selectedTime.split(' to ')[1];
            const reservationStart = dayjs(`${dateString} ${reservationStartStr}`, 'YYYY-MM-DD hh:mm A');
            const reservationEnd = dayjs(`${dateString} ${reservationEndStr}`, 'YYYY-MM-DD hh:mm A');

            const serviceBufferTime = serviceData.bufferTime || 0; // Assuming same buffer for reservations
            const drivingTime = 0; // Reservations don't have driving time yet

            const busyStart = reservationStart.subtract(drivingTime, 'minute');
            const busyEnd = reservationEnd.add(serviceBufferTime, 'minute');

            bookingsByWorker[reservation.workerId].push({ start: busyStart, end: busyEnd, type: 'reserved' });
        });

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayName = dayNames[dayOfWeek];

        const slotsMap = new Map();

        // Now iterate over only the serviceable workers
        serviceableWorkers.forEach(worker => {
            console.log(`Processing serviceable worker ${worker.id}`);

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
            let workerInterval = serviceData.duration || 60;

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
                let effectiveStartTime = workerStartTime;
                const today = dayjs().tz(UAE_TIMEZONE).format('YYYY-MM-DD');
                if (dateString === today) {
                    const now = dayjs().tz(UAE_TIMEZONE);
                    const workerStartToday = dayjs.tz(`${dateString} ${workerStartTime}`, UAE_TIMEZONE);
                    if (workerStartToday.isBefore(now)) {
                        // Calculate the next valid slot time that is after 'now'
                        let nextValidSlotTime = now.add(workerInterval - (now.minute() % workerInterval), 'minute');
                        // Ensure the next valid slot is not before the current time, and align it to the interval
                        if (now.minute() % workerInterval !== 0) {
                            nextValidSlotTime = now.startOf('minute').add(workerInterval - (now.minute() % workerInterval), 'minute');
                        } else {
                            nextValidSlotTime = now.startOf('minute');
                        }

                        // If the calculated nextValidSlotTime is still before 'now', advance it by one interval
                        if (nextValidSlotTime.isBefore(now)) {
                            nextValidSlotTime = nextValidSlotTime.add(workerInterval, 'minute');
                        }

                        const workerEndToday = dayjs().tz(UAE_TIMEZONE).endOf('day'); // Ensure it doesn't go past end of day
                        if (nextValidSlotTime.isAfter(workerEndToday)) {
                            return;
                        }
                        effectiveStartTime = nextValidSlotTime.format('HH:mm');
                    }
                }

                const slots = generateTimeSlots(dateString, effectiveStartTime, workerEndTime, totalServiceDuration, UAE_TIMEZONE);
                slots.forEach(slot => {
                    const serviceBufferTime = serviceData.bufferTime || 0;
                    const slotStartStr = slot.split(' to ')[0];
                    const slotEndStr = slot.split(' to ')[1];
                    const slotStart = dayjs(`${dateString} ${slotStartStr}`, 'YYYY-MM-DD hh:mm A');
                    const slotEnd = dayjs(`${dateString} ${slotEndStr}`, 'YYYY-MM-DD hh:mm A');

                    const workerBusySlots = bookingsByWorker[worker.id] || [];
                    const isBookedOrReserved = workerBusySlots.some(busySlot => {
                        const newSlotBusyStart = slotStart.subtract(worker.drivingTime || 0, 'minute');
                        const newSlotBusyEnd = slotEnd.add(serviceBufferTime, 'minute');
                        return newSlotBusyStart.isBefore(busySlot.end) && newSlotBusyEnd.isAfter(busySlot.start);
                    });

                    if (isBookedOrReserved) {
                        return; // This slot is booked or reserved for this worker, so skip it.
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
        const timeSlotsToWorkersMapObject = Object.fromEntries(slotsMap);

        return {
            availableTimeSlots: sortedSlots,
            timeSlotsToWorkersMap: timeSlotsToWorkersMapObject,
            isServiceable: true, // Location is serviceable
        };

    } catch (error) {
        console.error("Error fetching available time slots:", error);
        throw new functions.https.HttpsError('internal', 'Failed to get available time slots.', error.message);
    }
});
