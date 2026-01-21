const functions = require('firebase-functions/v1');
const { db, admin } = require('../firebaseAdmin');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const { haversineDistance, isPointInPolygon } = require('../utils/helpers');

const UAE_TIMEZONE = 'Asia/Dubai';

exports.getAvailableTimeSlotsV4 = functions.runWith({ memory: '1GB' }).https.onCall(async (data, context) => {
  const { serviceId, dateString, selectedAddress, bufferTime = 0, addons = [], totalVehiclesCount } = data;

  if (!serviceId || !dateString || !selectedAddress) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters.');
  }

  const userId = context.auth ? context.auth.uid : null;

  try {
    // Fetch settings, service, and workers
    const [settingsSnap, serviceSnap, workerSnap] = await Promise.all([
      db.collection('settings').doc('appSettings').get(),
      db.collection('services').doc(serviceId).get(),
      db.collection('workers').where('assignedServices', 'array-contains', serviceId).get(),
    ]);

    if (!settingsSnap.exists || !serviceSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Settings or service not found.');
    }

    const appSettings = settingsSnap.data();
    const serviceData = { id: serviceSnap.id, ...serviceSnap.data() };
    const workers = workerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter workers based on serviceability (geofence or polygon)
    const serviceableWorkers = workers.filter(worker => {
      if (!Array.isArray(worker.serviceArea)) return false;
      const customerPoint = [selectedAddress.longitude, selectedAddress.latitude];
      return worker.serviceArea.some(area => {
        let geometry = area.geometry;
        if (typeof geometry === 'string') {
          try { geometry = JSON.parse(geometry); } catch { return false; }
        }
        if (!geometry || !geometry.type) return false;

        if (geometry.type === 'Point' && geometry.properties?.radius) {
          const distance = haversineDistance(
            selectedAddress.latitude, selectedAddress.longitude,
            geometry.coordinates[1], geometry.coordinates[0]
          );
          return distance <= geometry.properties.radius / 1000;
        } else if (geometry.type === 'Polygon') {
          return isPointInPolygon(customerPoint, geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
          return geometry.coordinates.some(polygon => isPointInPolygon(customerPoint, polygon[0]));
        }
        return false;
      });
    });

    if (!serviceableWorkers.length) {
      return { availableSlots: [], isServiceable: false };
    }

    // Compute total duration including addons and vehicles
    let totalDuration = (serviceData.duration || 60) * (totalVehiclesCount || 1);
    if (addons.length) {
      const addonsSnap = await db.collection('products')
        .where(admin.firestore.FieldPath.documentId(), 'in', [...new Set(addons)])
        .get();
      totalDuration += addonsSnap.docs.reduce((sum, doc) => sum + (doc.data().time || 0), 0);
    }

    // Fetch bookings & reservations for all workers
    const workerIds = serviceableWorkers.map(w => w.id);
    const bookingsSnap = await db.collection('bookings')
      .where('selectedDate', '==', dateString)
      .where('status', '==', 'confirmed')
      .where('workerId', 'in', workerIds)
      .get();

    const reservationsSnap = await db.collection('reservations')
      .where('selectedDate', '==', dateString)
      .where('workerId', 'in', workerIds)
      .where('expirationTime', '>', new Date())
      .get();

    // Build busy slots map per worker
    const busySlotsByWorker = {};
    bookingsSnap.docs.forEach(doc => {
      const b = doc.data();
      const start = dayjs.tz(`${dateString} ${b.selectedTime.split(' to ')[0]}`, 'YYYY-MM-DD hh:mm A', UAE_TIMEZONE)
        .subtract(b.drivingTime || 0, 'minute');
      const end = dayjs.tz(`${dateString} ${b.selectedTime.split(' to ')[1]}`, 'YYYY-MM-DD hh:mm A', UAE_TIMEZONE)
        .add(b.serviceBufferTime || serviceData.bufferTime || 0, 'minute');
      if (!busySlotsByWorker[b.workerId]) busySlotsByWorker[b.workerId] = [];
      busySlotsByWorker[b.workerId].push({ start, end });
    });

    reservationsSnap.docs.forEach(doc => {
      const r = doc.data();
      if (userId && r.userId === userId) return; // skip own reservations
      const start = dayjs.tz(`${dateString} ${r.selectedTime.split(' to ')[0]}`, 'YYYY-MM-DD hh:mm A', UAE_TIMEZONE);
      const end = dayjs.tz(`${dateString} ${r.selectedTime.split(' to ')[1]}`, 'YYYY-MM-DD hh:mm A', UAE_TIMEZONE)
        .add(serviceData.bufferTime || 0, 'minute');
      if (!busySlotsByWorker[r.workerId]) busySlotsByWorker[r.workerId] = [];
      busySlotsByWorker[r.workerId].push({ start, end });
    });

    // Generate slots per worker
    const step = 15; // 15-minute step
    const allAvailableSlots = [];

    const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayName = dayNames[new Date(dateString).getDay()];

    for (const worker of serviceableWorkers) {
      if (worker.enabled === false || worker.status === 'suspended' || worker.autoAccept === false) continue;
      if (worker.offDates?.includes(dateString)) continue;

      // Determine working hours
      let startTime = null, endTime = null;
      const specialHours = worker.specialWorkingHours?.find(h => h.date === dateString);
      if (specialHours) { startTime = specialHours.start; endTime = specialHours.end; }
      else if (worker.dailyWorkingHours?.[dayName]?.enabled) { startTime = worker.dailyWorkingHours[dayName].start; endTime = worker.dailyWorkingHours[dayName].end; }
      if (!startTime || !endTime) continue;

      let slotStart = dayjs.tz(`${dateString} ${startTime}`, 'YYYY-MM-DD HH:mm', UAE_TIMEZONE);
      const slotEndLimit = dayjs.tz(`${dateString} ${endTime}`, 'YYYY-MM-DD HH:mm', UAE_TIMEZONE);

      // Skip past times if today
      const now = dayjs().tz(UAE_TIMEZONE);
      const drivingGap = worker.defaultDrivingTime ?? serviceData.defaultDrivingTime ?? 30;
      
      if (dateString === now.format('YYYY-MM-DD') && slotStart.isBefore(now)) {
        const remainder = now.minute() % step;
        slotStart = remainder === 0 ? now : now.add(drivingGap +step - remainder, 'minute');
      }
      

      while (slotStart.add(totalDuration, 'minute').isBefore(slotEndLimit) || slotStart.add(totalDuration, 'minute').isSame(slotEndLimit)) {
        const slotEnd = slotStart.add(totalDuration, 'minute');

        // Check if overlaps with any busy slot
        const busySlots = busySlotsByWorker[worker.id] || [];
        const isOverlapping = busySlots.some(busy => slotStart.isBefore(busy.end) && slotEnd.isAfter(busy.start));

        if (!isOverlapping) {
          allAvailableSlots.push({
            slot: `${slotStart.format('hh:mm A')} to ${slotEnd.format('hh:mm A')}`,
            workerId: worker.id
          });
        }

        slotStart = slotStart.add(step, 'minute');
      }
    }

    // Sort slots by start time and worker ID
    allAvailableSlots.sort((a, b) => {
      const parseTime = (t) => {
        const [time, ampm] = t.split(' ');
        let [h, m] = time.split(':').map(Number);
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h*60 + m;
      };
      const diff = parseTime(a.slot.split(' to ')[0]) - parseTime(b.slot.split(' to ')[0]);
      if (diff !== 0) return diff;
      return a.workerId.localeCompare(b.workerId);
    });

    return { availableSlots: allAvailableSlots, isServiceable: true };

  } catch (error) {
    console.error('Error fetching available time slots:', error);
    throw new functions.https.HttpsError('internal', 'Failed to get available time slots.', error.message);
  }
});
