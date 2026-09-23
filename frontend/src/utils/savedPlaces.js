const KEY = 'flux_saved_places';

export function loadSavedPlaces() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value) ? value.filter(item =>
      item && item.label && Number.isFinite(item.lat) && Number.isFinite(item.lng)
    ).slice(0, 6) : [];
  } catch (_) {
    return [];
  }
}

export function savePlace(place) {
  if (!place?.name || !place?.label || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
    return loadSavedPlaces();
  }

  const current = loadSavedPlaces();
  const next = [
    {
      id: place.id || \`\${Date.now()}-\${Math.random().toString(36).slice(2, 7)}\`,
      name: place.name.trim().slice(0, 30),
      label: place.label,
      lat: Number(place.lat),
      lng: Number(place.lng)
    },
    ...current.filter(item =>
      item.name.toLowerCase() !== place.name.trim().toLowerCase()
      && !(Math.abs(item.lat - place.lat) < 0.00001 && Math.abs(item.lng - place.lng) < 0.00001)
    )
  ].slice(0, 6);

  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeSavedPlace(id) {
  const next = loadSavedPlaces().filter(item => item.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
