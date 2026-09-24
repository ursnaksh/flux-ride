import { useEffect, useRef, useState } from 'react';
import { getDrivingRoute } from '../utils/routing';

const DEFAULT_CENTER = [18.5204, 73.8567];
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const GEOCODER_URL = import.meta.env.VITE_GEOCODER_URL || 'https://nominatim.openstreetmap.org';

let leafletPromise;
let geocodeQueue = Promise.resolve();
let nextGeocodeAt = 0;
const geocodeCache = new Map();
const reverseCache = new Map();

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

function queueGeocoder(work) {
  const run = async () => {
    const wait = Math.max(0, nextGeocodeAt - Date.now());
    if (wait) await new Promise(resolve => window.setTimeout(resolve, wait));
    nextGeocodeAt = Date.now() + 1100;
    return work();
  };
  const result = geocodeQueue.then(run, run);
  geocodeQueue = result.catch(() => {});
  return result;
}

function geocode(query) {
  const key = query.trim().toLowerCase();
  if (geocodeCache.has(key)) return Promise.resolve(geocodeCache.get(key));

  return queueGeocoder(async () => {
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
  });
}

function reverseGeocode(lat, lng) {
  const key = `${Number(lat).toFixed(5)},${Number(lng).toFixed(5)}`;
  if (reverseCache.has(key)) return Promise.resolve(reverseCache.get(key));

  return queueGeocoder(async () => {
    const url = `${GEOCODER_URL}/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Could not identify that point.');
    const data = await response.json();
    const result = {
      label: data.display_name || `Pinned location (${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)})`,
      lat: Number(lat),
      lng: Number(lng)
    };
    reverseCache.set(key, result);
    return result;
  });
}

export function resolveMeetingPlace(lat, lng) {
  return queueGeocoder(async () => {
    const url = `${GEOCODER_URL}/reverse?format=jsonv2&zoom=18&addressdetails=1&namedetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Could not name the meeting point.');
    const data = await response.json();
    const address = data.address || {};
    const primary =
      data.namedetails?.name
      || data.name
      || address.amenity
      || address.shop
      || address.public_transport
      || address.building
      || address.road
      || address.neighbourhood
      || address.suburb
      || 'Suggested meeting point';
    const area =
      address.neighbourhood
      || address.suburb
      || address.city_district
      || address.city
      || address.town
      || address.village
      || '';
    const label = area && !primary.toLowerCase().includes(area.toLowerCase())
      ? `${primary}, ${area}`
      : primary;
    return {
      lat: Number(lat),
      lng: Number(lng),
      label,
      fullLabel: data.display_name || label
    };
  });
}

function pinIcon(L, kind) {
  const letter = kind === 'pickup' ? 'P' : kind === 'destination' ? 'D' : kind === 'live' ? '•' : 'M';
  return L.divIcon({
    className: '',
    html: `<span class="flux-map-pin flux-map-pin-${kind}"><span>${letter}</span></span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
    popupAnchor: [0, -38]
  });
}

function fitMap(map, points) {
  if (points.length > 1) {
    map.fitBounds(points, { padding: [54, 54], maxZoom: 15 });
  } else if (points.length === 1) {
    map.setView(points[0], 15);
  }
}

function SearchBox({ title, value, onSelect, onClear, placeholder, disabled = false }) {
  const [query, setQuery] = useState(value?.label || '');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setQuery(value?.label || '');
  }, [value?.label]);

  async function search(event) {
    event.preventDefault();
    if (query.trim().length < 3) return setError('Type at least 3 characters.');
    setBusy(true);
    setError('');
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
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder={placeholder} disabled={disabled} />
      <button className="btn btn-ghost" disabled={busy || disabled}>{busy ? 'Searching…' : disabled ? 'Locked' : 'Search'}</button>
    </form>
    {error && <p className="map-search-error">{error}</p>}
    {!!results.length && <div className="map-search-results">
      {results.map(result => <button type="button" key={`${result.lat}-${result.lng}`} onClick={() => { onSelect(result); setResults([]); }}>
        <span>{result.label}</span>
      </button>)}
    </div>}
    {value && <div className="selected-place">
      <span>✓</span><p>{value.label}</p>
      {!disabled && <button type="button" onClick={onClear} aria-label={`Clear ${title.toLowerCase()}`}>×</button>}
    </div>}
  </div>;
}

export function LocationMapPicker({
  pickup,
  destination,
  onPickupChange,
  onDestinationChange,
  onRouteChange,
  destinationLocked = false
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const routeRequest = useRef(0);
  const [activeTarget, setActiveTarget] = useState('pickup');
  const [locating, setLocating] = useState(false);
  const [routing, setRouting] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [mapError, setMapError] = useState('');

  async function setPoint(kind, lat, lng) {
    setMapError('');
    let point;
    try {
      point = await reverseGeocode(lat, lng);
    } catch (_) {
      point = {
        label: `Pinned location (${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)})`,
        lat: Number(lat),
        lng: Number(lng)
      };
    }

    if (kind === 'pickup') {
      onPickupChange(point);
      if (!destination && !destinationLocked) setActiveTarget('destination');
    } else {
      onDestinationChange(point);
    }
  }

  useEffect(() => {
    let active = true;
    ensureLeaflet().then(L => {
      if (!active || !container.current || mapRef.current) return;
      const map = L.map(container.current, { scrollWheelZoom: true, zoomControl: true }).setView(DEFAULT_CENTER, 12);
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    }).catch(() => setMapError('The interactive map could not be loaded.'));

    return () => {
      active = false;
      routeRequest.current += 1;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => mapRef.current?.invalidateSize(false));
    });

    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleClick = event => {
      const target = destinationLocked && activeTarget === 'destination' ? 'pickup' : activeTarget;
      setPoint(target, event.latlng.lat, event.latlng.lng);
    };
    map.on('click', handleClick);
    return () => map.off('click', handleClick);
  }, [activeTarget, destination, destinationLocked]);

  useEffect(() => {
    const L = window.L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;

    const currentRequest = ++routeRequest.current;
    layer.clearLayers();
    setMapError('');
    setRouteInfo(null);
    onRouteChange?.(null);

    const points = [];

    if (pickup) {
      const marker = L.marker([pickup.lat, pickup.lng], {
        draggable: true,
        icon: pinIcon(L, 'pickup')
      }).bindTooltip('Pickup · drag to adjust', { direction: 'top', offset: [0, -35] });
      marker.on('dragend', event => {
        const point = event.target.getLatLng();
        setPoint('pickup', point.lat, point.lng);
      });
      marker.addTo(layer);
      points.push([pickup.lat, pickup.lng]);
    }

    if (destination) {
      const marker = L.marker([destination.lat, destination.lng], {
        draggable: true,
        icon: pinIcon(L, 'destination')
      }).bindTooltip('Destination · drag to adjust', { direction: 'top', offset: [0, -35] });
      marker.on('dragend', event => {
        const point = event.target.getLatLng();
        setPoint('destination', point.lat, point.lng);
      });
      marker.addTo(layer);
      points.push([destination.lat, destination.lng]);
    }

    if (!pickup || !destination) {
      setRouting(false);
      fitMap(map, points);
      return;
    }

    setRouting(true);
    const controller = new AbortController();

    getDrivingRoute(pickup, destination, controller.signal)
      .then(route => {
        if (routeRequest.current !== currentRequest) return;
        setRouteInfo(route);
        onRouteChange?.(route);
        const roadPoints = route.coordinates.map(([lng, lat]) => [lat, lng]);
        L.polyline(roadPoints, { weight: 5, opacity: 0.88 }).addTo(layer);
        fitMap(map, roadPoints);
      })
      .catch(err => {
        if (err?.name === 'AbortError' || routeRequest.current !== currentRequest) return;
        L.polyline(
          [[pickup.lat, pickup.lng], [destination.lat, destination.lng]],
          { weight: 4, opacity: 0.75, dashArray: '10 8' }
        ).addTo(layer);
        fitMap(map, points);
        setMapError('Road route unavailable right now. Using a direct-line fallback.');
      })
      .finally(() => {
        if (routeRequest.current === currentRequest) setRouting(false);
      });

    return () => controller.abort();
  }, [pickup, destination, onRouteChange]);

  function useMyLocation() {
    if (!navigator.geolocation) return setMapError('Your browser does not support location access.');
    setLocating(true);
    setMapError('');
    navigator.geolocation.getCurrentPosition(
      position => {
        setPoint('pickup', position.coords.latitude, position.coords.longitude)
          .finally(() => setLocating(false));
        mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 15);
      },
      () => {
        setLocating(false);
        setMapError('Location access was not available. You can still search or pin the map manually.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function swapPoints() {
    const oldPickup = pickup;
    onPickupChange(destination);
    onDestinationChange(oldPickup);
    setActiveTarget(destination ? 'destination' : 'pickup');
  }

  return <div className="location-picker">
    <div className="location-searches">
      <SearchBox
        title="Pickup"
        value={pickup}
        onSelect={value => { onPickupChange(value); if (!destination && !destinationLocked) setActiveTarget('destination'); }}
        onClear={() => onPickupChange(null)}
        placeholder="Search pickup, e.g. VIT Pune"
      />
      <SearchBox
        title="Destination"
        value={destination}
        onSelect={onDestinationChange}
        onClear={() => onDestinationChange(null)}
        placeholder="Search destination, e.g. Pune Airport"
        disabled={destinationLocked}
      />
    </div>

    <div className="map-tool-row">
      <div className="map-pin-mode" aria-label="Map pin selection mode">
        <button type="button" className={activeTarget === 'pickup' ? 'active' : ''} onClick={() => setActiveTarget('pickup')}>Pin pickup</button>
        <button type="button" className={activeTarget === 'destination' ? 'active' : ''} onClick={() => setActiveTarget('destination')} disabled={destinationLocked}>Pin destination</button>
      </div>
      <div className="map-secondary-tools">
        <button type="button" className="btn btn-ghost" onClick={useMyLocation} disabled={locating}>{locating ? 'Locating…' : '◎ Use my location'}</button>
        <button type="button" className="btn btn-ghost" onClick={swapPoints} disabled={destinationLocked || (!pickup && !destination)}>⇄ Swap</button>
      </div>
    </div>

    <div className="map-instruction">
      <strong>{activeTarget === 'pickup' ? 'Setting pickup' : 'Setting destination'}</strong>
      <span>Click anywhere on the map or drag an existing pin to fine-tune it.</span>
    </div>

    {routeInfo && <div className="road-route-summary">
      <div><span>ROAD DISTANCE</span><strong>{routeInfo.distanceKm} km</strong></div>
      <div><span>EST. DRIVE</span><strong>{routeInfo.durationMinutes} min</strong></div>
    </div>}
    {routing && <p className="route-loading">Calculating the real driving route…</p>}
    {mapError && <p className="form-error" role="alert">{mapError}</p>}

    <div ref={container} className="osm-map osm-map-interactive" aria-label="Interactive map for choosing pickup and destination" />
    <p className="map-credit-note">Map and place data © OpenStreetMap contributors. Road route is calculated separately from the selected points.</p>
  </div>;
}

export function GroupMap({ destination, members = [], routeGeometry, meetingPoint, liveLocations = [] }) {
  const container = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let active = true;
    ensureLeaflet().then(L => {
      if (!active || !container.current) return;
      const map = L.map(container.current, { scrollWheelZoom: true }).setView(DEFAULT_CENTER, 12);
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      const points = [];

      if (routeGeometry) {
        try {
          const route = JSON.parse(routeGeometry);
          if (Array.isArray(route) && route.length > 1) {
            const roadPoints = route
              .filter(point => Array.isArray(point) && point.length >= 2)
              .map(([lng, lat]) => [lat, lng]);
            if (roadPoints.length > 1) {
              L.polyline(roadPoints, { weight: 5, opacity: 0.82 }).addTo(layer);
              points.push(...roadPoints);
            }
          }
        } catch (_) {
          // Older trips may not contain route geometry.
        }
      }

      members
        .filter(member => Number.isFinite(member.pickupLatitude) && Number.isFinite(member.pickupLongitude))
        .forEach(member => {
          const point = [member.pickupLatitude, member.pickupLongitude];
          points.push(point);
          L.marker(point, { icon: pinIcon(L, 'pickup') })
            .bindPopup(`${member.userName} · ${member.pickup}`)
            .addTo(layer);
        });

      if (destination && Number.isFinite(destination.lat) && Number.isFinite(destination.lng)) {
        const point = [destination.lat, destination.lng];
        points.push(point);
        L.marker(point, { icon: pinIcon(L, 'destination') })
          .bindPopup(destination.label || 'Destination')
          .addTo(layer);
      }

      if (meetingPoint && Number.isFinite(meetingPoint.lat) && Number.isFinite(meetingPoint.lng)) {
        const point = [meetingPoint.lat, meetingPoint.lng];
        points.push(point);
        L.marker(point, { icon: pinIcon(L, 'meeting') })
          .bindPopup(meetingPoint.label || 'Suggested meeting point')
          .addTo(layer);
      }

      liveLocations
        .filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
        .forEach(item => {
          const point = [item.latitude, item.longitude];
          points.push(point);
          L.marker(point, {
            icon: pinIcon(L, 'live'),
            zIndexOffset: 1200
          })
            .bindPopup(`${item.userName} · live location`)
            .bindTooltip(`${item.userName} · live`, { direction: 'top', offset: [0, -34] })
            .addTo(layer);
        });

      fitMap(map, points);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    }).catch(() => {});

    return () => {
      active = false;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, [destination?.lat, destination?.lng, members, routeGeometry, meetingPoint?.lat, meetingPoint?.lng, liveLocations]);

  return <div ref={container} className="osm-map group-osm-map" aria-label="Map showing group pickup points, route and destination" />;
}
