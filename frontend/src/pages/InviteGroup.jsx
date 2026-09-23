import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import { formatDeparture, isFuture } from '../utils/trips';

export default function InviteGroup() {
  const { groupId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const userId = Number(localStorage.getItem('flux_user_id'));
  const requestedTripId = params.get('request');

  const [group, setGroup] = useState(null);
  const [compatibleRequest, setCompatibleRequest] = useState(null);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const [summaryResponse, myGroupsResponse, ridesResponse] = await Promise.all([
          axiosClient.get(\`/api/pools/\${groupId}/invite\`),
          axiosClient.get(\`/api/pools/user/\${userId}\`),
          axiosClient.get(\`/api/rides/user/\${userId}\`)
        ]);

        if (!alive) return;

        const summary = summaryResponse.data;
        setGroup(summary);

        const membership = (myGroupsResponse.data || []).some(item => String(item.id) === String(groupId));
        setAlreadyMember(membership);

        if (membership) {
          setCompatibleRequest(null);
          return;
        }

        const activeRequests = (ridesResponse.data || []).filter(ride =>
          ride.status === 'SEARCHING' && isFuture(ride.departureTime)
        );

        const candidates = requestedTripId
          ? activeRequests.filter(ride => String(ride.id) === String(requestedTripId))
          : activeRequests.slice(0, 6);

        for (const ride of candidates) {
          try {
            const matchResponse = await axiosClient.get(\`/api/pools/matches/\${ride.id}\`);
            const invitedMatch = (matchResponse.data || []).find(match =>
              String(match.sharedTripId) === String(groupId)
            );

            if (invitedMatch) {
              if (alive) setCompatibleRequest({ ride, match: invitedMatch });
              return;
            }
          } catch (_) {
            // Try another active request.
          }
        }

        if (alive) setCompatibleRequest(null);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [groupId, requestedTripId, userId]);

  async function join() {
    if (!compatibleRequest || joining) return;
    setJoining(true);
    setError('');
    try {
      await axiosClient.post(\`/api/pools/\${groupId}/join/\${compatibleRequest.ride.id}\`);
      navigate(\`/groups/\${groupId}\`, { replace: true });
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  }

  if (loading) {
    return <div className="page-container invite-page"><Loader label="Opening your ride invite…" /></div>;
  }

  if (error && !group) {
    return <div className="page-container invite-page">
      <section className="card invite-error-card">
        <p className="eyebrow">RIDE INVITE</p>
        <h1>Couldn’t open this invite.</h1>
        <p className="form-error">{error}</p>
        <Link to="/" className="btn btn-primary">Go home</Link>
      </section>
    </div>;
  }

  const seats = group?.availableSeats ?? 0;
  const canAccept = group?.status === 'FORMING' && seats > 0;

  return <div className="page-container invite-page">
    <section className="invite-hero-card">
      <div className="invite-hero-copy">
        <p className="eyebrow">YOU’VE BEEN INVITED</p>
        <h1>There’s a seat heading your way.</h1>
        <p>FLUX still checks your pickup, route and departure timing before letting you into the group.</p>

        <div className="invite-summary-grid">
          <div><span>DESTINATION</span><strong>{group.destinationLabel}</strong></div>
          <div><span>LEAVING</span><strong>{formatDeparture(group.departureTime)}</strong></div>
          <div><span>SEATS</span><strong>{seats} open</strong></div>
          {group.routeDistanceKm && <div><span>ROAD ROUTE</span><strong>{Number(group.routeDistanceKm).toFixed(1)} km</strong></div>}
        </div>
      </div>

      <div className="invite-visual" aria-hidden="true">
        <div className="invite-visual-route"></div>
        <span className="invite-visual-dot dot-a"></span>
        <span className="invite-visual-dot dot-b"></span>
        <span className="invite-visual-seat">{group.currentMembers}/4</span>
      </div>
    </section>

    <section className="card invite-action-card">
      {alreadyMember ? <>
        <p className="eyebrow">YOU’RE ALREADY IN</p>
        <h2>This is your group.</h2>
        <p className="quiet-note">Open the Group Room to see everyone, the meeting point, live trip map and chat.</p>
        <Link to={\`/groups/\${groupId}\`} className="btn btn-primary">Open Group Room →</Link>
      </> : !canAccept ? <>
        <p className="eyebrow">INVITE CLOSED</p>
        <h2>This group isn’t accepting new passengers.</h2>
        <p className="quiet-note">It may be full, ready to leave, completed or cancelled.</p>
        <Link to="/find" className="btn btn-primary">Find another ride</Link>
      </> : compatibleRequest ? <>
        <p className="eyebrow">COMPATIBLE ROUTE FOUND</p>
        <h2>Your trip fits this group.</h2>
        <div className="invite-match-row">
          <span><strong>{Math.round((compatibleRequest.match.compatibilityScore || 0) * 100)}%</strong> match</span>
          {compatibleRequest.match.routeOverlapScore > 0 &&
            <span><strong>{Math.round(compatibleRequest.match.routeOverlapScore * 100)}%</strong> route overlap</span>}
          {compatibleRequest.match.estimatedDetourKm != null &&
            <span><strong>+{Number(compatibleRequest.match.estimatedDetourKm).toFixed(1)} km</strong> detour</span>}
        </div>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary" onClick={join} disabled={joining}>
          {joining ? 'Joining group…' : 'Join this ride →'}
        </button>
      </> : <>
        <p className="eyebrow">SET YOUR PICKUP</p>
        <h2>Tell FLUX where you’re joining from.</h2>
        <p className="quiet-note">The destination and departure time are already loaded from the invite. You only need to choose your pickup and confirm the route.</p>
        <Link to={\`/find?invite=\${groupId}\`} className="btn btn-primary">Choose my pickup →</Link>
      </>}
    </section>
  </div>;
}
