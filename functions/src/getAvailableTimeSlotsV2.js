
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const dayjs = require('dayjs');
const { haversineDistance, isPointInPolygon, generateTimeSlots } = require('../utils/helpers');

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
