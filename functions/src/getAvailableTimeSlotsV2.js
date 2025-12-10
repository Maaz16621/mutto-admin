const functions = require('firebase-functions/v1');
const { admin, db } = require('../firebaseAdmin');
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

    console.log('getAvailableTimeSlots called with:', { serviceId, dateString, selectedAddress, totalVehiclesCount, addons });

    const userId = context.auth ? context.auth.uid : null; // Get current user ID if authenticated

    try {
        // Fetch settings, service, and workers
        const settingsRef = db.collection('settings').doc('appSettings');
        const serviceRef = db.collection('services').doc(serviceId);
        const workersCollection = db.collection('workers').where('assignedServices', 'array-contains', serviceId);

        const [settingsSnap, serviceSnap, workerSnap] = await Promise.all([
            settingsRef.get(),
            serviceRef.get(),
            workersCollection.get(),
        ]);

        // Fetch data for the unique addons passed from the client
        const uniqueAddonIds = [...new Set(addons)];
        const addonSnaps = uniqueAddonIds.length > 0
            ? await db.collection('products').where(admin.firestore.FieldPath.documentId(), 'in', uniqueAddonIds).get()
            : null;

        // Create a map of the fetched addon data for quick lookup
        const addonsDataMap = new Map();
        if (addonSnaps) {
            addonSnaps.docs.forEach(doc => {
                addonsDataMap.set(doc.id, doc.data());
            });
        }

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
            return false;
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

        // Correctly calculate addon duration by iterating through the provided addon IDs (with duplicates)
        let sumAddonTimes = 0;
        if (addons && addons.length > 0) {
            sumAddonTimes = addons.reduce((sum, addonId) => {
                const addonData = addonsDataMap.get(addonId);
                return sum + (addonData?.time || 0);
            }, 0);
        }
        totalServiceDuration += sumAddonTimes;

        console.log(`Found ${serviceableWorkers.length} serviceable workers. Total calculated duration: ${totalServiceDuration} mins.`);

        const [year, month, day] = dateString.split('-').map(Number);
        const selectedDateObj = new Date(year, month - 1, day);
        const dayOfWeek = selectedDateObj.getDay();

        // Fetch existing confirmed bookings for the selected date for serviceable workers
        const bookingsQuery = db.collection('bookings')
            .where('selectedDate', '==', dateString)
            .where('status', '==', 'confirmed')
            .where('workerId', 'in', serviceableWorkers.map(w => w.id));
        const bookingsSnapshot = await bookingsQuery.get();
        const existingBookings = bookingsSnapshot.docs.map(doc => doc.data());

        // Fetch existing active reservations for the selected date for serviceable workers
        const reservationsQuery = db.collection('reservations')
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
            if (userId && reservation.userId === userId) {
                return;
            }

            if (!bookingsByWorker[reservation.workerId]) {
                bookingsByWorker[reservation.workerId] = [];
            }
            const reservationStartStr = reservation.selectedTime.split(' to ')[0];
            const reservationEndStr = reservation.selectedTime.split(' to ')[1];
            const reservationStart = dayjs(`${dateString} ${reservationStartStr}`, 'YYYY-MM-DD hh:mm A');
            const reservationEnd = dayjs(`${dateString} ${reservationEndStr}`, 'YYYY-MM-DD hh:mm A');

            const serviceBufferTime = serviceData.bufferTime || 0;
            const drivingTime = 0;

            const busyStart = reservationStart.subtract(drivingTime, 'minute');
            const busyEnd = reservationEnd.add(serviceBufferTime, 'minute');

            bookingsByWorker[reservation.workerId].push({ start: busyStart, end: busyEnd, type: 'reserved' });
        });

        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const currentDayName = dayNames[dayOfWeek];

        const slotsMap = new Map();

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
                        let nextValidSlotTime = now.add(workerInterval - (now.minute() % workerInterval), 'minute');
                        if (now.minute() % workerInterval !== 0) {
                            nextValidSlotTime = now.startOf('minute').add(workerInterval - (now.minute() % workerInterval), 'minute');
                        } else {
                            nextValidSlotTime = now.startOf('minute');
                        }

                        if (nextValidSlotTime.isBefore(now)) {
                            nextValidSlotTime = nextValidSlotTime.add(workerInterval, 'minute');
                        }

                        const workerEndToday = dayjs().tz(UAE_TIMEZONE).endOf('day');
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
        const timeSlotsToWorkersMapObject = Object.fromEntries(slotsMap);

        return {
            availableTimeSlots: sortedSlots,
            timeSlotsToWorkersMap: timeSlotsToWorkersMapObject,
            isServiceable: true,
        };

    } catch (error) {
        console.error("Error fetching available time slots:", error);
        throw new functions.https.HttpsError('internal', 'Failed to get available time slots.', error.message);
    }
});