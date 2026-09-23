import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import PoolCard from '../components/PoolCard';
import { LocationMapPicker } from '../components/OpenStreetMap';
import SavedPlacesPanel from '../components/SavedPlacesPanel';
import { formatDeparture, isFuture, matchPercentage } from '../utils/trips';
import { loadSavedPlaces } from '../utils/savedPlaces';

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

function RequestForm({ useDailyCommute = false, inviteGroupId = null }) {
  const navigate = useNavigate();
  const savedCommute = useRef(useDailyCommute ? loadDailyCommute() : null);
  const [pickup, setPickup] = useState(savedCommute.current?.pickup || null);
  const [destination, setDestination] = useState(savedCommute.current?.destination || null);
  const [departureTime, setDepartureTime] = useState(
    savedCommute.current?.departureClock ? nextDepartureFromClock(savedCommute.current.departureClock) : ''
  );
  const [routeInfo, setRouteInfo] = useState(savedCommute.current?.routeInfo || null);
  const [savedPlaces, setSavedPlaces] = useState(loadSavedPlaces);
  const [saveCommute, setSaveCommute] = useState(Boolean(savedCommute.current));
  const [inviteSummary, setInviteSummary] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteGroupId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    if (!inviteGroupId) return;
    let active = true;

    axiosClient.get(`/api/pools/${inviteGroupId}/invite`)
      .then(response => {
        if (!active) return;
        const summary = response.data;
        setInviteSummary(summary);

        if (
          Number.isFinite(summary.destinationLatitude)
          && Number.isFinite(summary.destinationLongitude)
        ) {
          setDestination({
            label: summary.destinationLabel,
            lat: summary.destinationLatitude,
            lng: summary.destinationLongitude
          });
          setRouteInfo(null);
        }

        if (summary.departureTime && isFuture(summary.departureTime)) {
          setDepartureTime(String(summary.departureTime).slice(0, 16));
        }
      })
      .catch(err => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setInviteLoading(false);
      });

    return () => { active = false; };
  }, [inviteGroupId]);

  const directDistanceKm = distanceBetweenKm(pickup, destination);
  const distanceKm = routeInfo?.distanceKm || directDistanceKm;

  function useSavedAsPickup(place) {
    setPickup({ label: place.label, lat: place.lat, lng: place.lng });
  }

  function useSavedAsDestination(place) {
    if (inviteGroupId) return;
    setDestination({ label: place.label, lat: place.lat, lng: place.lng });
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    if (!pickup || !destination) return setError('Choose both your pickup and destination.');
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

      if (inviteGroupId) {
        navigate(`/invite/${inviteGroupId}?request=${response.data.id}`, { replace: true });
      } else {
        navigate(`/find?request=${response.data.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="map-booking-shell">
    <section className="booking-map-stage">
      <div className="booking-map-head">
        <div>
          <p className="eyebrow">LIVE ROUTE</p>
          <h2>{inviteGroupId ? 'Choose where you’ll join from.' : 'Start with the map.'}</h2>
        </div>
        {routeInfo && <div className="booking-map-stats">
          <span><strong>{routeInfo.distanceKm}</strong> km</span>
          <span><strong>{routeInfo.durationMinutes}</strong> min</span>
        </div>}
      </div>

      <LocationMapPicker
        pickup={pickup}
        destination={destination}
        onPickupChange={setPickup}
        onDestinationChange={inviteGroupId ? () => {} : setDestination}
        onRouteChange={setRouteInfo}
        destinationLocked={Boolean(inviteGroupId)}
      />
    </section>

    <aside className="card booking-sheet">
      <div className="booking-sheet-grabber" aria-hidden="true"></div>

      {inviteGroupId && <div className="invite-prefill-banner">
        <span>INVITE #{inviteGroupId}</span>
        <strong>{inviteLoading ? 'Loading destination…' : inviteSummary?.destinationLabel || 'Invited ride'}</strong>
        <small>The destination and departure time are locked to this invite. Pick your own pickup.</small>
      </div>}

      <div className="booking-sheet-head">
        <p className="eyebrow">PLAN YOUR RIDE</p>
        <h2>{inviteGroupId ? 'Join from your pickup.' : 'Where are we going?'}</h2>
        <p>{inviteGroupId
          ? 'Set your pickup and FLUX will check whether your route fits the invited group.'
          : 'Set the route, choose when you’re leaving, and FLUX will find people actually moving your way.'}</p>
      </div>

      <div className="booking-route-summary">
        <div className={pickup ? 'is-set' : ''}>
          <span className="booking-route-dot pickup"></span>
          <div><small>FROM</small><strong>{pickup?.label || 'Choose pickup on the map'}</strong></div>
        </div>
        <div className="booking-route-connector"></div>
        <div className={destination ? 'is-set' : ''}>
          <span className="booking-route-dot destination"></span>
          <div><small>TO</small><strong>{destination?.label || 'Choose destination on the map'}</strong></div>
        </div>
      </div>

      <SavedPlacesPanel
        pickup={pickup}
        destination={destination}
        savedPlaces={savedPlaces}
        onPlacesChange={setSavedPlaces}
        onUsePickup={useSavedAsPickup}
        onUseDestination={useSavedAsDestination}
      />

      <form className="form booking-form" onSubmit={submit}>
        <label className="field booking-time-field">
          <span>Leaving</span>
          <input
            type="datetime-local"
            value={departureTime}
            onChange={event => setDepartureTime(event.target.value)}
            required
            disabled={busy || Boolean(inviteGroupId)}
          />
          {inviteGroupId && <small>Departure comes from the invite.</small>}
        </label>

        <div className="booking-route-insight">
          <div>
            <span>{routeInfo ? 'ROAD ROUTE' : 'ROUTE'}</span>
            <strong>{distanceKm ? `${distanceKm} km` : '—'}</strong>
          </div>
          <div>
            <span>DRIVE</span>
            <strong>{routeInfo ? `~${routeInfo.durationMinutes} min` : '—'}</strong>
          </div>
          <div>
            <span>MATCHING</span>
            <strong>{routeInfo ? 'Route-aware' : 'Waiting'}</strong>
          </div>
        </div>

        {!inviteGroupId && <label className="commute-save-toggle">
          <input
            type="checkbox"
            checked={saveCommute}
            onChange={event => setSaveCommute(event.target.checked)}
          />
          <span>
            <strong>Make this my daily commute</strong>
            <small>Reuse the route and departure time with one tap next time.</small>
          </span>
        </label>}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn btn-primary btn-block booking-submit" disabled={busy || !pickup || !destination || inviteLoading}>
          {busy
            ? 'Creating your route…'
            : inviteGroupId
              ? 'Check this invite →'
              : 'Find people on my route →'}
        </button>
      </form>
    </aside>
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
        : matches.length ? <><p className="results-caption">{matches.length} compatible {matches.length === 1 ? 'group' : 'groups'} · Best matches first</p><div className="match-list">{matches.map((match, index) => <article
            className={`card match-card ${index === 0 ? 'match-card-featured' : ''}`}
            key={match.sharedTripId}
            style={{ '--match': matchPercentage(match.compatibilityScore) }}
          >
            <div className="match-card-top">
              <div className="match-ring" aria-label={`${matchPercentage(match.compatibilityScore)} percent match`}>
                <div><strong>{matchPercentage(match.compatibilityScore)}</strong><span>%</span></div>
              </div>
              <div className="match-title-block">
                <div className="match-label-row">
                  <span className="match-label">ROUTE MATCH</span>
                  {index === 0 && <span className="best-match"><i></i> BEST FIT</span>}
                </div>
                <h3>Heading to {match.destination}</h3>
                <p className="departure-line">{formatDeparture(match.departureTime)}</p>
              </div>
            </div>
            {(match.routeOverlapScore > 0 || match.estimatedDetourKm != null) && <div className="route-match-metrics">
              {match.routeOverlapScore > 0 && <span><strong>{Math.round(match.routeOverlapScore * 100)}%</strong> route overlap</span>}
              {match.estimatedDetourKm != null && <span><strong>+{Number(match.estimatedDetourKm).toFixed(1)} km</strong> pickup detour</span>}
            </div>}
            <ul className="match-reasons">{match.reasons.map(reason => <li key={reason}><span aria-hidden="true">✓</span> {reason}</li>)}</ul>
            <div className="match-bottom"><div><strong>{match.availableSeats} {match.availableSeats === 1 ? 'seat' : 'seats'} open</strong><span>{match.currentMembers}/4 already in · Group #{match.sharedTripId}</span></div>
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
  const inviteGroupId = params.get('invite');

  return <div className={`page-container find-page ${requestId ? '' : 'find-page-map-first'}`}>
    <div className="page-intro">
      <p className="eyebrow">{inviteGroupId ? 'RIDE INVITE' : 'FIND YOUR PEOPLE'}</p>
      <h1 className="page-title">{inviteGroupId ? 'Join the route.' : 'Move with people going your way.'}</h1>
      <p className="page-subtitle">{inviteGroupId
        ? 'Choose your pickup. FLUX already knows the invited group’s destination and departure time.'
        : 'Map your real route, see who overlaps with it, then choose your group.'}</p>
    </div>
    {requestId
      ? <RequestResults key={requestId} requestId={requestId} />
      : <RequestForm useDailyCommute={useDailyCommute} inviteGroupId={inviteGroupId} />}
  </div>;
}
