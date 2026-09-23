import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import PoolCard from '../components/PoolCard';
import { LocationMapPicker } from '../components/OpenStreetMap';
import { formatDeparture, isFuture, matchPercentage } from '../utils/trips';

const COMMUTE_KEY = 'flux_daily_commute';

function nextDepartureFromClock(clock) {
  if (!clock) return '';
  const [hours, minutes] = clock.split(':').map(Number);
  const next = new Date();
  next.setSeconds(0, 0);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  if (next.getTime() <= Date.now() + 5 * 60 * 1000) next.setDate(next.getDate() + 1);
  const pad = value => String(value).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

function loadDailyCommute() {
  try {
    return JSON.parse(localStorage.getItem(COMMUTE_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

function distanceBetweenKm(first, second) {
  if (!first || !second) return null;
  const toRad = degrees => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const lat1 = toRad(first.lat);
  const lat2 = toRad(second.lat);
  const deltaLat = toRad(second.lat - first.lat);
  const deltaLng = toRad(second.lng - first.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const km = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.1, Math.round(km * 10) / 10);
}

function RequestForm({ useDailyCommute = false }) {
  const navigate = useNavigate();
  const savedCommute = useRef(useDailyCommute ? loadDailyCommute() : null);
  const [pickup, setPickup] = useState(savedCommute.current?.pickup || null);
  const [destination, setDestination] = useState(savedCommute.current?.destination || null);
  const [departureTime, setDepartureTime] = useState(
    savedCommute.current?.departureClock ? nextDepartureFromClock(savedCommute.current.departureClock) : ''
  );
  const [routeInfo, setRouteInfo] = useState(savedCommute.current?.routeInfo || null);
  const [saveCommute, setSaveCommute] = useState(Boolean(savedCommute.current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const directDistanceKm = distanceBetweenKm(pickup, destination);
  const distanceKm = routeInfo?.distanceKm || directDistanceKm;

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    if (!pickup || !destination) return setError('Search and select both your pickup and destination on the map.');
    if (!distanceKm) return setError('Choose two different locations.');
    if (!isFuture(departureTime)) return setError('Choose a departure time in the future.');

    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await axiosClient.post('/api/rides', {
        userId: Number(localStorage.getItem('flux_user_id')),
        pickup: pickup.label,
        drop: destination.label,
        pickupLatitude: pickup.lat,
        pickupLongitude: pickup.lng,
        dropLatitude: destination.lat,
        dropLongitude: destination.lng,
        routeGeometry: routeInfo?.coordinates ? JSON.stringify(routeInfo.coordinates) : null,
        routeDurationMinutes: routeInfo?.durationMinutes || null,
        distanceKm,
        departureTime: departureTime.length === 16 ? `${departureTime}:00` : departureTime
      });

      if (saveCommute) {
        localStorage.setItem(COMMUTE_KEY, JSON.stringify({
          pickup,
          destination,
          departureClock: departureTime.slice(11, 16),
          routeInfo: routeInfo || null,
          updatedAt: new Date().toISOString()
        }));
      }

      navigate(`/find?request=${response.data.id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="find-layout map-find-layout">
    <section className="card plan-panel map-plan-panel">
      <p className="eyebrow">01 / YOUR ROUTE</p>
      <h2>Plan the ride</h2>
      <p className="quiet-note">Search and select both locations on the map, then choose when you want to leave.</p>

      <div className="route-summary">
        <div><small>FROM</small><strong>{pickup?.label || 'Choose pickup on map'}</strong></div>
        <span aria-hidden="true">↓</span>
        <div><small>TO</small><strong>{destination?.label || 'Choose destination on map'}</strong></div>
      </div>

      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Departure date &amp; time</span>
          <input type="datetime-local" value={departureTime} onChange={event => setDepartureTime(event.target.value)} required disabled={busy} />
          <small>Use your local journey time.</small>
        </label>

        <div className="map-distance-card">
          <span>{routeInfo ? 'Real road route' : 'Distance estimate'}</span>
          <strong>{distanceKm ? `${distanceKm} km` : 'Select both points'}</strong>
          <small>{routeInfo
            ? `About ${routeInfo.durationMinutes} min driving · used for route-aware matching.`
            : 'Waiting for a drivable road route; direct distance is used only as fallback.'}</small>
        </div>

        <label className="commute-save-toggle">
          <input
            type="checkbox"
            checked={saveCommute}
            onChange={event => setSaveCommute(event.target.checked)}
          />
          <span><strong>Save as my daily commute</strong><small>Next time, reuse this route and departure time in one tap.</small></span>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy || !pickup || !destination}>
          {busy ? 'Saving your request…' : 'Find Co-Passengers →'}
        </button>
      </form>
    </section>

    <section className="map-planner-panel">
      <div className="section-heading">
        <div><p className="eyebrow">02 / PICK ON THE MAP</p><h2>Where are you going?</h2></div>
        <span className="map-live-badge">OPEN MAP</span>
      </div>
      <LocationMapPicker
        pickup={pickup}
        destination={destination}
        onPickupChange={setPickup}
        onDestinationChange={setDestination}
        onRouteChange={setRouteInfo}
      />
    </section>
  </div>;
}

function RequestResults({ requestId }) {
  const userId = localStorage.getItem('flux_user_id');
  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [joined, setJoined] = useState(null);
  const [created, setCreated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(null);
  const [error, setError] = useState('');
  const [joinError, setJoinError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  const version = useRef(0);

  const load = useCallback(async () => {
    const current = ++version.current;
    const valid = () => alive.current && current === version.current;
    setLoading(true); setError(''); setMatches([]);
    try {
      const response = await axiosClient.get(`/api/rides/user/${userId}`);
      const saved = response.data.find(item => String(item.id) === requestId);
      if (!valid()) return;
      if (!saved) { setRequest(null); throw new Error('This request was not found in your trips.'); }
      setRequest(saved);
      if (saved.status === 'SEARCHING' && isFuture(saved.departureTime)) {
        const result = await axiosClient.get(`/api/pools/matches/${saved.id}`);
        if (valid()) setMatches(result.data);
      }
    } catch (err) { if (valid()) setError(err.message); }
    finally { if (valid()) setLoading(false); }
  }, [requestId, userId]);

  useEffect(() => {
    alive.current = true; load();
    return () => { alive.current = false; version.current++; };
  }, [load]);

  // Refresh the owner's group while this page is open so joins made by
  // another passenger appear without a manual page refresh.
  useEffect(() => {
    if (!requestId || !userId) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await axiosClient.get(`/api/pools/user/${userId}`);
        if (!alive.current) return;
        const group = (response.data || []).find(pool =>
          String(pool.sourceTripRequestId) === String(requestId)
        );
        if (group) {
          setJoined(group);
          if ((group.members?.length || 0) > 1) {
            setRequest(value => value ? { ...value, status: 'MATCHED' } : value);
            setMatches([]);
          }
        }
      } catch (_) {
        // Keep the current screen; the normal refresh path handles errors.
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [requestId, userId]);

  async function join(groupId) {
    if (pending.current || loading || error || request?.status !== 'SEARCHING') return;
    if (!isFuture(request.departureTime)) { await load(); return; }
    pending.current = true; setJoining(groupId); setJoinError('');
    try {
      const response = await axiosClient.post(`/api/pools/${groupId}/join/${request.id}`);
      if (!alive.current) return;
      setJoined(response.data);
      setRequest(value => ({ ...value, status: 'MATCHED' }));
      setMatches([]);
    } catch (err) {
      if (!alive.current) return;
      setJoinError(`${err.message} Your request status and matches have been checked again below.`);
      // The response can be lost after a successful server commit. Read status
      // before offering another join instead of blindly repeating the POST.
      await load();
    } finally { pending.current = false; if (alive.current) setJoining(null); }
  }

  async function createGroup() {
    if (pending.current || loading || error || request?.status !== 'SEARCHING') return;
    if (!isFuture(request.departureTime)) { await load(); return; }
    pending.current = true; setJoining('create'); setJoinError('');
    try {
      const response = await axiosClient.post(`/api/pools/from-request/${request.id}`);
      if (!alive.current) return;
      setCreated(true);
      setJoined(response.data);
      setRequest(value => ({ ...value, status: 'MATCHED' }));
      setMatches([]);
    } catch (err) {
      if (!alive.current) return;
      setJoinError(`${err.message} Your request status has been checked again below.`);
      await load();
    } finally { pending.current = false; if (alive.current) setJoining(null); }
  }

  return <div className="find-layout">
    <aside className="card plan-panel">
      <p className="eyebrow">01 / YOUR PLAN</p><h2>Your trip request</h2>
      {request ? <><div className="route-summary"><div><small>FROM</small><strong>{request.pickup}</strong></div><span aria-hidden="true">↓</span><div><small>TO</small><strong>{request.drop}</strong></div></div>
        <p className="departure-line">{formatDeparture(request.departureTime)}</p><p className="quiet-note">{request.distanceKm} km · Request #{request.id}</p>
        <span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status}</span>
        <p className="quiet-note">Your request is saved. You can return to it from My trips.</p></> : <p className="quiet-note">{loading ? 'Loading your saved plan…' : 'Choose one of your saved requests or start a new trip.'}</p>}
      <div className="plan-actions"><Link to="/my-trips" className="text-link">My trips →</Link>{joining === null && <Link to="/find" className="text-link">New request →</Link>}</div>
    </aside>
    <section className="results-panel" aria-label="Compatible groups" aria-busy={loading || joining !== null}>
      <div className="section-heading"><div><p className="eyebrow">02 / YOUR COMPANY</p><h2>{request?.status === 'MATCHED' ? 'You’re matched.' : 'Find your group'}</h2></div>
        {!loading && request?.status === 'SEARCHING' && <button className="btn btn-ghost" onClick={load} disabled={joining !== null}>Refresh matches</button>}</div>
      {joinError && <p className="form-error" role="alert">{joinError}</p>}
      {loading ? <Loader label="Checking your request and compatible groups…" /> : error ? <div className="empty-state"><p className="form-error" role="alert">{error}</p><button className="btn btn-ghost" onClick={load}>Try again</button></div>
        : request?.status === 'MATCHED' ? <div aria-live="polite"><div className="success-message"><strong>{created ? "Group created — you’re the first passenger." : "MATCHED — you’ve joined a group."}</strong><p>{created ? "Your request is MATCHED. Other compatible passengers can now find and join this group." : "Agree on your pickup, then arrange your cab or auto together."}</p></div>
          {joined && <PoolCard pool={joined} />}<Link to="/my-trips" className="btn btn-primary result-link">View my trips →</Link></div>
        : request && (request.status !== 'SEARCHING' || !isFuture(request.departureTime)) ? <div className="empty-state"><h3>This request is no longer available for matching.</h3><p>{request.status === 'SEARCHING' ? 'Its departure time has passed.' : `Its current status is ${request.status}.`}</p><Link className="btn btn-primary" to="/find">Plan a new trip</Link></div>
        : matches.length ? <><p className="results-caption">{matches.length} compatible {matches.length === 1 ? 'group' : 'groups'} · Best matches first</p><div className="match-list">{matches.map((match, index) => <article className="card match-card" key={match.sharedTripId}>
            <div className="card-row"><span className="match-score">{matchPercentage(match.compatibilityScore)}% Match</span>{index === 0 && <span className="best-match">TOP MATCH</span>}</div>
            <h3>To {match.destination}</h3><p className="departure-line">{formatDeparture(match.departureTime)}</p>
            {(match.routeOverlapScore > 0 || match.estimatedDetourKm != null) && <div className="route-match-metrics">
              {match.routeOverlapScore > 0 && <span><strong>{Math.round(match.routeOverlapScore * 100)}%</strong> route overlap</span>}
              {match.estimatedDetourKm != null && <span><strong>+{Number(match.estimatedDetourKm).toFixed(1)} km</strong> pickup detour</span>}
            </div>}
            <ul className="match-reasons">{match.reasons.map(reason => <li key={reason}><span aria-hidden="true">✓</span> {reason}</li>)}</ul>
            <div className="match-bottom"><div><strong>{match.availableSeats} {match.availableSeats === 1 ? 'seat' : 'seats'} available</strong><span>{match.currentMembers}/4 passengers · Group #{match.sharedTripId}</span></div>
              <button className="btn btn-primary" disabled={joining !== null || match.availableSeats <= 0} onClick={() => join(match.sharedTripId)} aria-label={`Join Group ${match.sharedTripId}`}>
                {joining === match.sharedTripId ? 'Joining…' : 'Join Group →'}</button></div>
          </article>)}</div><p className="quiet-note">New map-based trips are ranked by destination proximity, shared route, pickup detour and departure time. Older requests fall back to text matching.</p></>
        : <div className="empty-state no-matches"><span className="discovery-symbol" aria-hidden="true">↗</span><h3>No compatible groups just yet.</h3><p>Your request is saved as SEARCHING. Check again later, or create a new request with different travel details.</p><p>FLUX RIDE won’t automatically join you to another group.</p><Link to="/my-trips" className="btn btn-ghost">View my requests</Link></div>}
      {!loading && !error && request?.status === 'SEARCHING' && isFuture(request.departureTime) && <div className="card create-group-panel">
        <h3>{matches.length ? 'Prefer to start your own group?' : 'Be the first to get a group going.'}</h3>
        <p className="quiet-note">Create a new group with this pickup, destination and departure time. You’ll be its first passenger, and your request will become MATCHED. Others can find and join you.</p>
        <button className="btn btn-primary" disabled={joining !== null} onClick={createGroup}>
          {joining === 'create' ? 'Creating group…' : 'Create Group'}
        </button>
        <p className="quiet-note">This starts a group only. You’ll arrange transport separately.</p>
      </div>}
    </section>
  </div>;
}

export default function FindCoPassengers() {
  const [params] = useSearchParams();
  const requestId = params.get('request');
  const useDailyCommute = params.get('commute') === '1';
  return <div className="page-container find-page"><div className="page-intro"><p className="eyebrow">GO TOGETHER, ON YOUR TERMS</p><h1 className="page-title">Find Co-Passengers</h1><p className="page-subtitle">Share your plans. Compare your matches. Choose your group.</p></div>
    {requestId ? <RequestResults key={requestId} requestId={requestId} /> : <RequestForm useDailyCommute={useDailyCommute} />}
  </div>;
}
