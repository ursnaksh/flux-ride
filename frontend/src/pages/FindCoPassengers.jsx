import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import PoolCard from '../components/PoolCard';
import { formatDeparture, isFuture, matchPercentage } from '../utils/trips';

function RequestForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ pickup: '', drop: '', distanceKm: '', departureTime: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  function update(event) { setForm(value => ({ ...value, [event.target.name]: event.target.value })); }
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    if (!form.pickup.trim() || !form.drop.trim()) return setError('Enter both your pickup and destination.');
    if (!Number.isFinite(Number(form.distanceKm)) || Number(form.distanceKm) <= 0) return setError('Enter a distance greater than zero.');
    if (!isFuture(form.departureTime)) return setError('Choose a departure time in the future.');
    pending.current = true; setBusy(true); setError('');
    try {
      const response = await axiosClient.post('/api/rides', {
        userId: Number(localStorage.getItem('flux_user_id')),
        pickup: form.pickup.trim(), drop: form.drop.trim(), distanceKm: Number(form.distanceKm),
        // LocalDateTime has no UTC offset: preserve the local wall-clock input.
        departureTime: form.departureTime.length === 16 ? `${form.departureTime}:00` : form.departureTime
      });
      navigate(`/find?request=${response.data.id}`, { replace: true });
    } catch (err) { setError(err.message); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="find-layout">
    <section className="card plan-panel"><p className="eyebrow">01 / YOUR PLAN</p><h2>Where are you headed?</h2>
      <p className="quiet-note">A few details help us find compatible groups.</p>
      <form className="form" onSubmit={submit}>
        <label className="field"><span>Pickup location</span><input name="pickup" value={form.pickup} onChange={update} placeholder="VIT Main Road" required disabled={busy} /></label>
        <label className="field"><span>Destination</span><input name="drop" value={form.drop} onChange={update} placeholder="Pune Airport" required disabled={busy} /></label>
        <label className="field"><span>Departure date &amp; time</span><input name="departureTime" type="datetime-local" value={form.departureTime} onChange={update} required disabled={busy} /><small>Use local time for your journey.</small></label>
        <label className="field"><span>Approximate distance (km)</span><input name="distanceKm" type="number" min="0.1" step="0.1" value={form.distanceKm} onChange={update} placeholder="12" required disabled={busy} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving your request…' : 'Find compatible groups →'}</button>
        <p className="quiet-note">This saves a trip request. You’ll choose a group in the next step.</p>
      </form>
    </section>
    <section className="discovery-placeholder"><span className="discovery-symbol" aria-hidden="true">↗</span><p className="eyebrow">02 / YOUR COMPANY</p><h2>A shared direction.<br />A choice that’s yours.</h2><p>Your matches will appear here with compatibility scores, departure times and available seats.</p>
      <div className="matching-factors"><span>Destination</span><span>Pickup similarity</span><span>Departure time</span></div>
      <div className="choice-note"><strong>You’re in control.</strong><p>Compare the options. Join the group that suits you. Arrange transport together afterward.</p></div>
    </section>
  </div>;
}

function RequestResults({ requestId }) {
  const userId = localStorage.getItem('flux_user_id');
  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [joined, setJoined] = useState(null);
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
        : request?.status === 'MATCHED' ? <div aria-live="polite"><div className="success-message"><strong>MATCHED — you’ve joined a group.</strong><p>Agree on your pickup, then arrange your cab or auto together.</p></div>
          {joined && <PoolCard pool={joined} />}<Link to="/my-trips" className="btn btn-primary result-link">View my trips →</Link></div>
        : request && (request.status !== 'SEARCHING' || !isFuture(request.departureTime)) ? <div className="empty-state"><h3>This request is no longer available for matching.</h3><p>{request.status === 'SEARCHING' ? 'Its departure time has passed.' : `Its current status is ${request.status}.`}</p><Link className="btn btn-primary" to="/find">Plan a new trip</Link></div>
        : matches.length ? <><p className="results-caption">{matches.length} compatible {matches.length === 1 ? 'group' : 'groups'} · Best matches first</p><div className="match-list">{matches.map((match, index) => <article className="card match-card" key={match.sharedTripId}>
            <div className="card-row"><span className="match-score">{matchPercentage(match.compatibilityScore)}% Match</span>{index === 0 && <span className="best-match">TOP MATCH</span>}</div>
            <h3>To {match.destination}</h3><p className="departure-line">{formatDeparture(match.departureTime)}</p>
            <ul className="match-reasons">{match.reasons.map(reason => <li key={reason}><span aria-hidden="true">✓</span> {reason}</li>)}</ul>
            <div className="match-bottom"><div><strong>{match.availableSeats} {match.availableSeats === 1 ? 'seat' : 'seats'} available</strong><span>{match.currentMembers}/4 passengers · Group #{match.sharedTripId}</span></div>
              <button className="btn btn-primary" disabled={joining !== null || match.availableSeats <= 0} onClick={() => join(match.sharedTripId)} aria-label={`Join Group ${match.sharedTripId}`}>
                {joining === match.sharedTripId ? 'Joining…' : 'Join Group →'}</button></div>
          </article>)}</div><p className="quiet-note">Scores compare destination, pickup similarity and timing. Availability is checked again when you join.</p></>
        : <div className="empty-state no-matches"><span className="discovery-symbol" aria-hidden="true">↗</span><h3>No compatible groups just yet.</h3><p>Your request is saved as SEARCHING. Check again later, or create a new request with different travel details.</p><p>FLUX RIDE won’t automatically join you to another group.</p><Link to="/my-trips" className="btn btn-ghost">View my requests</Link></div>}
    </section>
  </div>;
}

export default function FindCoPassengers() {
  const [params] = useSearchParams();
  const requestId = params.get('request');
  return <div className="page-container find-page"><div className="page-intro"><p className="eyebrow">GO TOGETHER, ON YOUR TERMS</p><h1 className="page-title">Find Co-Passengers</h1><p className="page-subtitle">Share your plans. Compare your matches. Choose your group.</p></div>
    {requestId ? <RequestResults key={requestId} requestId={requestId} /> : <RequestForm />}
  </div>;
}
