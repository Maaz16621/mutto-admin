const { db } = require('./firebaseAdmin');

const vehicleData = {
    SUV: {
      Toyota: ["Land Cruiser", "Prado", "Fortuner", "RAV4", "Highlander"],
      Lexus: ["LX", "GX", "RX", "NX"],
      "Mercedes-Benz": ["G-Class", "GLS", "GLE", "GLC"],
      BMW: ["X5", "X7", "X3", "X6"],
      Chevrolet: ["Tahoe", "Suburban", "Traverse"],
      Mitsubishi: ["Pajero", "Outlander", "Eclipse Cross"],
      "Range Rover / Land Rover": ["Range Rover", "Discovery", "Defender"],
      Ford: ["Explorer", "Expedition", "Bronco"],
      Audi: ["Q7", "Q8", "Q5"],
      Volkswagen: ["Touareg", "Tiguan", "Atlas"],
      Nissan: ["Patrol", "Armada", "Pathfinder"],
      Hyundai: ["Palisade", "Santa Fe", "Tucson"],
      Kia: ["Telluride", "Sorento", "Sportage"],
    },
    Sedan: {
      Toyota: ["Camry", "Corolla", "Avalon"],
      Lexus: ["LS", "ES", "IS"],
      "Mercedes-Benz": ["S-Class", "E-Class", "C-Class"],
      BMW: ["7 Series", "5 Series", "3 Series"],
      Chevrolet: ["Malibu", "Impala"],
      Honda: ["Accord", "Civic"],
      Ford: ["Taurus", "Fusion"],
      Audi: ["A8", "A6", "A4"],
      Volkswagen: ["Passat", "Jetta", "Arteon"],
      Nissan: ["Maxima", "Altima", "Sentra"],
      Hyundai: ["Azera", "Sonata", "Elantra"],
      Kia: ["K900", "Stinger", "K5"],
    },
    Van: {
      Toyota: ["Hiace", "Sienna"],
      "Mercedes-Benz": ["V-Class", "Sprinter"],
      Chevrolet: ["Express"],
      Ford: ["Transit"],
      Volkswagen: ["Transporter", "Multivan"],
      Nissan: ["Urvan"],
      Hyundai: ["Staria"],
      Kia: ["Carnival"],
    },
  };

function getVehicleType(company, model) {
    for (const type in vehicleData) {
        if (vehicleData[type][company] && vehicleData[type][company].includes(model)) {
            return type;
        }
    }
    return null; // Or a default type
}

async function runUpdate() {
  const vehiclesRef = db.collection('vehicles');
  const snapshot = await vehiclesRef.get();

  if (snapshot.empty) {
    return 'No matching documents.';
  }

  const batch = db.batch();
  let updates = 0;

  snapshot.forEach(doc => {
    const vehicle = doc.data();
    if (!vehicle.vehicleType && vehicle.company && vehicle.model) {
      const vehicleType = getVehicleType(vehicle.company, vehicle.model);
      if (vehicleType) {
        console.log(`Updating vehicle ${doc.id} with type ${vehicleType}`);
        const vehicleRef = db.collection('vehicles').doc(doc.id);
        batch.update(vehicleRef, { vehicleType: vehicleType });
        updates++;
      } else {
        console.warn(`Could not determine vehicle type for ${doc.id} (${vehicle.company} ${vehicle.model})`);
      }
    }
  });

  if (updates > 0) {
    await batch.commit();
    return `Successfully updated ${updates} vehicles.`;
  } else {
    return 'No vehicles needed updating.';
  }
}

module.exports = { runUpdate };
