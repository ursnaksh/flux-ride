const ROUTING_URL = import.meta.env.VITE_ROUTING_URL || 'https://router.project-osrm.org';

function sampleCoordinates(coordinates, maxPoints = 80) {
  if (!Array.isArray(coordinates) || coordinates.length <= maxPoints) return coordinates || [];
  const sampled = [];
  const step = (coordinates.length - 1) / (maxPoints - 1);
  for (let index = 0; index < maxPoints; index += 1) {
    sampled.push(coordinates[Math.round(index * step)]);
  }
  return sampled;
}

export async function getDrivingRoute(pickup, destination, signal) {
  if (!pickup || !destination) return null;

  const coordinates = [
    pickup.lng, pickup.lat,
    destination.lng, destination.lat
  ];

  const url = `${ROUTING_URL}/route/v1/driving/${coordinates[0]},${coordinates[1]};${coordinates[2]},${coordinates[3]}?overview=full&geometries=geojson&steps=false`;
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });

  if (!response.ok) {
    throw new Error('Road routing is temporarily unavailable.');
  }

  const data = await response.json();
  const route = data.routes?.[0];

  if (!route?.geometry?.coordinates?.length) {
    throw new Error('No drivable route was found between these points.');
  }

  return {
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    durationMinutes: Math.max(1, Math.round(route.duration / 60)),
    coordinates: sampleCoordinates(route.geometry.coordinates)
  };
}
