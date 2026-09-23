import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import PoolCard from '../components/PoolCard';
import { GroupMap, resolveMeetingPlace } from '../components/OpenStreetMap';

function suggestedMeetingPoint(group) {
  const pickups = (group?.members || [])
    .filter(member => Number.isFinite(member.pickupLatitude) && Number.isFinite(member.pickupLongitude));

  if (pickups.length < 2) return null;

  const center = pickups.reduce(
    (sum, member) => ({
      lat: sum.lat + member.pickupLatitude / pickups.length,
      lng: sum.lng + member.pickupLongitude / pickups.length
    }),
    { lat: 0, lng: 0 }
  );

  try {
    const route = JSON.parse(group.routeGeometry || '[]');
    if (Array.isArray(route) && route.length) {
      let best = null;
      let bestDistance = Infinity;

      route.forEach(point => {
        if (!Array.isArray(point) || point.length < 2) return;
        const [lng, lat] = point;
        const distance = (lat - center.lat) ** 2 + (lng - center.lng) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { lat, lng };
        }
      });

      if (best) {
        return {
          ...best,
          label: 'Suggested meeting point'
        };
      }
    }
  } catch (_) {
    // Older groups can fall back to the geographic midpoint.
  }

  return {
    ...center,
    label: 'Suggested meeting area'
  };
}

function countdownLabel(departureTime, now) {
  if (!departureTime) return '';
  const difference = new Date(departureTime).getTime() - now;
  if (!Number.isFinite(difference)) return '';
  if (difference <= -30 * 60 * 1000) return 'Departure time passed';
  if (difference <= 0) return 'Time to leave';

  const totalMinutes = Math.ceil(difference / 60000);
  if (totalMinutes < 60) return `Leaving in ${totalMinutes} min`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return `Leaving in ${hours}h ${minutes}m`;

  const days = Math.floor(hours / 24);
  return `Leaving in ${days}d ${hours % 24}h`;
}

export default function GroupRoom() {
  const { groupId } = useParams();
  const userId = localStorage.getItem('flux_user_id');
  const [group, setGroup] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [smartMeetingPoint, setSmartMeetingPoint] = useState(null);
  const [meetingLookup, setMeetingLookup] = useState(false);
  const [copyState, setCopyState] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const previousMemberCount = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const response = await axiosClient.get(`/api/pools/user/${userId}`);
        if (!alive) return;

        const found = (response.data || []).find(item => String(item.id) === String(groupId));
        if (!found) throw new Error('This group was not found or you are not a member.');

        if (
          previousMemberCount.current != null
          && (found.members?.length || 0) > previousMemberCount.current
          && document.hidden
          && 'Notification' in window
          && Notification.permission === 'granted'
        ) {
          const latestMember = found.members?.[found.members.length - 1];
          new Notification('Someone joined your FLUX RIDE group', {
            body: latestMember ? `${latestMember.userName} joined the trip.` : 'A new passenger joined your group.'
          });
        }

        previousMemberCount.current = found.members?.length || 0;
        setGroup(found);
        setError('');
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [groupId, userId]);

  const rawMeetingPoint = useMemo(() => suggestedMeetingPoint(group), [group]);

  useEffect(() => {
    if (!rawMeetingPoint) {
      setSmartMeetingPoint(null);
      return;
    }

    let alive = true;
    setMeetingLookup(true);

    resolveMeetingPlace(rawMeetingPoint.lat, rawMeetingPoint.lng)
      .then(place => {
        if (!alive) return;
        setSmartMeetingPoint({
          ...rawMeetingPoint,
          ...place
        });
      })
      .catch(() => {
        if (alive) setSmartMeetingPoint(rawMeetingPoint);
      })
      .finally(() => {
        if (alive) setMeetingLookup(false);
      });

    return () => { alive = false; };
  }, [rawMeetingPoint?.lat, rawMeetingPoint?.lng]);

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  async function copyMeetingPoint() {
    if (!smartMeetingPoint) return;
    const value = smartMeetingPoint.fullLabel || smartMeetingPoint.label;
    try {
      await navigator.clipboard.writeText(value);
      setCopyState('Copied');
      window.setTimeout(() => setCopyState(''), 1600);
    } catch (_) {
      setCopyState('Copy unavailable');
    }
  }

  const members = group?.members || [];
  const readyCount = members.filter(member => member.ready).length;
  const countdown = countdownLabel(group?.departureTime, now);
  const departureDifference = group?.departureTime
    ? new Date(group.departureTime).getTime() - now
    : Infinity;
  const tripMode = members.length > 1 && (
    group?.status === 'READY'
    || departureDifference <= 60 * 60 * 1000
  );

  const meetingPoint = smartMeetingPoint || rawMeetingPoint;
  const osmMeetingUrl = meetingPoint
    ? `https://www.openstreetmap.org/?mlat=${meetingPoint.lat}&mlon=${meetingPoint.lng}#map=18/${meetingPoint.lat}/${meetingPoint.lng}`
    : null;

  return <div className={`page-container group-room-page ${tripMode ? 'trip-mode-active' : ''}`}>
    <div className="group-room-header">
      <div>
        <p className="eyebrow">YOUR SHARED RIDE</p>
        <h1 className="page-title">{tripMode ? 'Trip Mode' : 'Group Room'}</h1>
        <p className="page-subtitle">
          {tripMode
            ? 'Your group is coming together. Keep the meeting point, readiness and chat in one place.'
            : 'See who’s travelling with you, get ready together and coordinate the ride.'}
        </p>
      </div>
      <div className="group-room-actions">
        {notificationPermission !== 'unsupported' && notificationPermission !== 'granted' &&
          <button className="btn btn-ghost" onClick={enableNotifications}>Enable notifications</button>}
        {notificationPermission === 'granted' &&
          <span className="notification-enabled">● Notifications on</span>}
        <Link to="/my-trips" className="btn btn-ghost">← My trips</Link>
      </div>
    </div>

    {loading ? <Loader label="Opening your group…" /> :
      error ? <div className="empty-state">
        <h2>Couldn’t open this group.</h2>
        <p className="form-error">{error}</p>
        <Link to="/my-trips" className="btn btn-primary">Back to My trips</Link>
      </div> : <>
      {tripMode && <section className="trip-mode-banner">
        <div>
          <p className="eyebrow">LIVE TRIP MODE</p>
          <h2>{countdown}</h2>
          <p>{readyCount}/{members.length} passengers ready · {group.destinationLabel}</p>
        </div>
        <div className="trip-mode-progress" aria-label={`${readyCount} of ${members.length} passengers ready`}>
          {members.map(member => <span key={member.id || member.userId} className={member.ready ? 'ready' : ''} title={member.userName} />)}
        </div>
      </section>}

      <div className="group-room-layout">
        <section className="group-room-map-preview">
          <p className="eyebrow">{tripMode ? 'TRIP MAP' : 'LIVE GROUP MAP'}</p>
          <h2>{group.destinationLabel}</h2>

          {(group.routeDistanceKm || group.routeDurationMinutes) && <div className="group-route-stats">
            {group.routeDistanceKm && <span><strong>{Number(group.routeDistanceKm).toFixed(1)} km</strong> road route</span>}
            {group.routeDurationMinutes && <span><strong>{Math.round(group.routeDurationMinutes)} min</strong> estimated drive</span>}
          </div>}

          {Number.isFinite(group.destinationLatitude) && Number.isFinite(group.destinationLongitude)
            ? <GroupMap
                destination={{
                  lat: group.destinationLatitude,
                  lng: group.destinationLongitude,
                  label: `Destination · ${group.destinationLabel}`
                }}
                members={group.members || []}
                routeGeometry={group.routeGeometry}
                meetingPoint={meetingPoint}
              />
            : <div className="map-empty-state">
                <strong>Map coordinates aren’t available for this older trip.</strong>
                <p>New trips created with the map picker show passenger pickups and the road route here.</p>
              </div>}

          {meetingPoint && <div className="meeting-suggestion smart-meeting-suggestion">
            <span className="meeting-marker">M</span>
            <div className="meeting-copy">
              <strong>{meetingLookup ? 'Finding a useful meeting place…' : meetingPoint.label}</strong>
              <p>{meetingPoint.fullLabel || 'Near the center of the group’s pickups and kept on the shared route when route data is available.'}</p>
              <div className="meeting-actions">
                <button type="button" className="text-link" onClick={copyMeetingPoint}>{copyState || 'Copy place'}</button>
                {osmMeetingUrl && <a className="text-link" href={osmMeetingUrl} target="_blank" rel="noreferrer">Open map ↗</a>}
              </div>
            </div>
          </div>}

          <p>Pickup markers and the suggested meeting place are visible only to members of this shared group.</p>
        </section>

        <PoolCard pool={group} onPoolChange={setGroup} />
      </div>
      </>}
  </div>;
}
