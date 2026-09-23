import { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = [18.5204, 73.8567];
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const GEOCODER_URL = import.meta.env.VITE_GEOCODER_URL || 'https://nominatim.openstreetmap.org';

let leafletPromise;
let geocodeQueue = Promise.resolve();
let nextGeocodeAt = 0;
const geocodeCache = new Map();

function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-flux-leaflet]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      css.dataset.fluxLeaflet = 'true';
      document.head.appendChild(css);
    }

    const existing = document.querySelector('script[data-flux-leaflet]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.dataset.fluxLeaflet = 'true';
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('Map library could not be loaded.'));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

function geocode(query) {
  const key = query.trim().toLowerCase();
  if (geocodeCache.has(key)) return Promise.resolve(geocodeCache.get(key));

  const work = async () => {
    const wait = Math.max(0, nextGeocodeAt - Date.now());
    if (wait) await new Promise(resolve => window.setTimeout(resolve, wait));
    nextGeocodeAt = Date.now() + 1100;

    const url = `${GEOCODER_URL}/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(query.trim())}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Location search is temporarily unavailable.');
    const data = await response.json();
    const results = data.map(item => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon)
    }));
    geocodeCache.set(key, results);
    return results;
  };

  const result = geocodeQueue.then(work, work);
  geocodeQueue = result.catch(() => {});
  return result;
}

function drawLocations(L, map, layer, locations) {
  layer.clearLayers();
  const points = [];

  locations.filter(Boolean).forEach((location, index) => {
    const point = [location.lat, location.lng];
    points.push(point);
    L.marker(point)
      .bindPopup(location.label || (index === 0 ? 'Pickup' : 'Destination'))
      .addTo(layer);
  });

  if (points.length > 1) {
    L.polyline(points, { weight: 4, opacity: 0.75, dashArray: '8 8' }).addTo(layer);
    map.fitBounds(points, { padding: [42, 42], maxZoom: 14 });
  } else if (points.length === 1) {
    map.setView(points[0], 14);
  }
}

function SearchBox({ title, value, onSelect, placeholder }) {
  const [query, setQuery] = useState(value?.label || '');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (value?.label) setQuery(value.label);
  }, [value?.label]);

  async function search(event) {
    event.preventDefault();
    if (query.trim().length < 3) return setError('Type at least 3 characters.');
    setBusy(true); setError('');
    try {
      const found = await geocode(query);
      setResults(found);
      if (!found.length) setError('No locations found. Try a nearby landmark or area.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="map-search-block">
    <span className="map-search-label">{title}</span>
    <form className="map-search-row" onSubmit={search}>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder={placeholder} />
      <button className="btn btn-ghost" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
    </form>
    {error && <p className="map-search-error">{error}</p>}
    {!!results.length && <div className="map-search-results">
      {results.map(result => <button type="button" key={`${result.lat}-${result.lng}`} onClick={() => { onSelect(result); setResults([]); }}>
        <span>{result.label}</span>
      </button>)}
    </div>}
    {value && <p className="selected-place"><span>✓</span>{value.label}</p>}
  </div>;
}

export function LocationMapPicker({ pickup, destination, onPickupChange, onDestinationChange }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    let active = true;
    ensureLeaflet().then(L => {
      if (!active || !container.current || mapRef.current) return;
      const map = L.map(container.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12);
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerRef.current = layer;
      window.setTimeout(() => map.invalidateSize(), 0);
      drawLocations(L, map, layer, [pickup, destination]);
    }).catch(() => {});
    return () => {
      active = false;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current || !window.L) return;
    drawLocations(window.L, mapRef.current, layerRef.current, [pickup, destination]);
  }, [pickup, destination]);

  return <div className="location-picker">
    <div className="location-searches">
      <SearchBox title="Pickup" value={pickup} onSelect={onPickupChange} placeholder="Search pickup, e.g. VIT Pune" />
      <SearchBox title="Destination" value={destination} onSelect={onDestinationChange} placeholder="Search destination, e.g. Pune Airport" />
    </div>
    <div ref={container} className="osm-map" aria-label="Map showing selected pickup and destination" />
    <p className="map-credit-note">Search is user-triggered. Map and place data © OpenStreetMap contributors.</p>
  </div>;
}

export function GroupMap({ destination, members = [] }) {
  const container = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let active = true;
    ensureLeaflet().then(L => {
      if (!active || !container.current) return;
      const map = L.map(container.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 12);
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);

      const pickups = members
        .filter(member => Number.isFinite(member.pickupLatitude) && Number.isFinite(member.pickupLongitude))
        .map(member => ({ lat: member.pickupLatitude, lng: member.pickupLongitude, label: `${member.userName} · ${member.pickup}` }));
      const locations = [...pickups];
      if (destination && Number.isFinite(destination.lat) && Number.isFinite(destination.lng)) locations.push(destination);
      drawLocations(L, map, layer, locations);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    }).catch(() => {});

    return () => {
      active = false;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, [destination?.lat, destination?.lng, members]);

  return <div ref={container} className="osm-map group-osm-map" aria-label="Map showing group pickup points and destination" />;
}
