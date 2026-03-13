export const locations = [
  { id: "kempegowda-airport", name: "Kempegowda Airport (Bangalore)", x: 14, y: 22 },
  { id: "majestic-east", name: "Majestic East (Bangalore)", x: 78, y: 34 },
  { id: "hubli", name: "Hubballi Junction (Hubli)", x: 71, y: 61 },
  { id: "sdm-college", name: "SDM College (Dharwad)", x: 23, y: 70 },
  { id: "belgaum-fort", name: "Belagavi Fort (Belgaum)", x: 36, y: 31 },
  { id: "gulbarga-uni", name: "Gulbarga University (Kalaburagi)", x: 52, y: 48 },
  { id: "gol-gumbaz", name: "Gol Gumbaz (Vijayapura)", x: 62, y: 79 },
  { id: "bidar-fort", name: "Bidar Fort (Bidar)", x: 34, y: 56 }
];

export function getLocation(id) {
  return locations.find((location) => location.id === id);
}

export function calculateDistanceKm(pickupId, dropoffId) {
  const pickup = getLocation(pickupId);
  const dropoff = getLocation(dropoffId);
  if (!pickup || !dropoff) throw new Error("Pickup or dropoff location is invalid.");

  const dx = dropoff.x - pickup.x;
  const dy = dropoff.y - pickup.y;
  const baseDistance = Math.sqrt(dx * dx + dy * dy);

  return Number(Math.max(2.8, baseDistance * 0.48).toFixed(1));
}

export function createRoutePoints(pickupId, dropoffId) {
  const pickup = getLocation(pickupId);
  const dropoff = getLocation(dropoffId);
  if (!pickup || !dropoff) throw new Error("Pickup or dropoff location is invalid.");

  const midX = Number(((pickup.x + dropoff.x) / 2).toFixed(1));
  const midY = Number(((pickup.y + dropoff.y) / 2).toFixed(1));
  const curve = ((pickup.x + dropoff.y) % 2 === 0 ? 6 : -6);

  return [
    { x: pickup.x, y: pickup.y },
    { x: Number((midX - curve).toFixed(1)), y: Number((midY - 4).toFixed(1)) },
    { x: Number((midX + curve).toFixed(1)), y: Number((midY + 6).toFixed(1)) },
    { x: dropoff.x, y: dropoff.y }
  ];
}

export function calculateEta(driverLocationId, pickupId) {
  return Math.max(3, Math.round(calculateDistanceKm(driverLocationId, pickupId) * 1.6));
}

export function calculateTripMetrics(carType, pickupId, dropoffId) {
  const distanceKm = calculateDistanceKm(pickupId, dropoffId);
  const durationMin = Math.max(10, Math.round(distanceKm * 3.8));
  
  const ratePerKm = parseFloat(carType.rate_per_km || carType.ratePerKm);
  const baseFare = parseFloat(carType.base_fare || carType.baseFare);
  const minFare = parseFloat(carType.min_fare || carType.minFare);

  const rawFare = baseFare + distanceKm * ratePerKm + durationMin * 1.35;
  const fare = Math.max(minFare, Math.round(rawFare));
  const driverPayout = Math.round(fare * 0.74);

  return {
    distanceKm,
    durationMin,
    fare,
    driverPayout,
    platformRevenue: fare - driverPayout,
    routePoints: createRoutePoints(pickupId, dropoffId)
  };
}
