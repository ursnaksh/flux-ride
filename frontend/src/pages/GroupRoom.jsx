import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import PoolCard from '../components/PoolCard';
import InviteShareCard from '../components/InviteShareCard';
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

      if (best) return { ...best, label: 'Suggested meeting point' };
    }
  } catch (_) {
    // Older groups can fall back to the geographic midpoint.
  }

  return { ...center, label: 'Suggested meeting area' };
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

function distanceKm(first, second) {
  if (!first || !second) return null;
  const toRad = value => value * Math.PI / 180;
  const radius = 6371;
  const dLat = toRad(second.lat - first.lat);
  const dLng = toRad(second.lng - first.lng);
  const lat1 = toRad(first.lat);
  const lat2 = toRad(second.lat);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function GroupRoom() {
  const { groupId } = useParams();
  const userId = Number(localStorage.getItem('flux_user_id'));
  const [group, setGroup] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [smartMeetingPoint, setSmartMeetingPoint] = useState(null);
  const [meetingLookup, setMeetingLookup] = useState(false);
  const [copyState, setCopyState] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [liveSharing, setLiveSharing] = useState(false);
  const [liveLocations, setLiveLocations] = useState([]);
  const [liveError, setLiveError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  const previousMemberCount = useRef(null);
  const watchId = useRef(null);
  const lastLiveSentAt = useRef(0);

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

  useEffect(() => {
    let alive = true;

    async function loadLiveLocations() {
      try {
        const response = await axiosClient.get(`/api/pools/${groupId}/live-locations?userId=${userId}`);
        if (alive) setLiveLocations(response.data || []);
      } catch (_) {
        if (alive) setLiveLocations([]);
      }
    }

    loadLiveLocations();
    const timer = window.setInterval(loadLiveLocations, 5000);

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [groupId, userId]);

  useEffect(() => () => {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

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
        if (alive) setSmartMeetingPoint({ ...rawMeetingPoint, ...place });
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

  function startLiveLocation() {
    if (!navigator.geolocation || watchId.current != null) {
      if (!navigator.geolocation) setLiveError('Live location is not supported by this browser.');
      return;
    }

    setLiveError('');

    watchId.current = navigator.geolocation.watchPosition(
      async position => {
        const nowMs = Date.now();
        if (nowMs - lastLiveSentAt.current < 8000) return;
        lastLiveSentAt.current = nowMs;

        try {
          await axiosClient.post(`/api/pools/${groupId}/location/${userId}`, {
            sharing: true,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLiveSharing(true);
          setLiveError('');
        } catch (err) {
          setLiveError(err.message);
        }
      },
      locationError => {
        setLiveSharing(false);
        setLiveError(
          locationError.code === 1
            ? 'Location permission was denied. You can turn it on later from your browser settings.'
            : 'Your live location could not be read right now.'
        );
        if (watchId.current != null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  }

  async function stopLiveLocation() {
    if (watchId.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    setLiveSharing(false);
    lastLiveSentAt.current = 0;

    try {
      await axiosClient.post(`/api/pools/${groupId}/location/${userId}`, {
        sharing: false,
        latitude: null,
        longitude: null
      });
      setLiveLocations(current => current.filter(item => Number(item.userId) !== userId));
      setLiveError('');
    } catch (err) {
      setLiveError(err.message);
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

  return <>
    <div className={`page-container group-room-page ${tripMode ? 'trip-mode-active' : ''}`}>
      <div className="group-room-header">
        <div>
          <p className="eyebrow">YOUR SHARED RIDE</p>
          <h1 className="page-title">{tripMode ? 'Trip Mode' : 'Group Room'}</h1>
          <p className="page-subtitle">
            {tripMode
              ? 'Your group is coming together. Keep the meeting point, readiness, live positions and chat in one place.'
              : 'See who’s travelling with you, get ready together and coordinate the ride.'}
          </p>
        </div>

        <div className="group-room-actions">
          {group && <button className="btn btn-ghost" onClick={() => setShowInvite(true)}>Invite people</button>}
          {members.length > 1 && !liveSharing &&
            <button className="btn btn-ghost live-location-button" onClick={startLiveLocation}>Share live location</button>}
          {liveSharing &&
            <button className="btn btn-ghost live-location-button is-sharing" onClick={stopLiveLocation}>● Stop live sharing</button>}
          {notificationPermission !== 'unsupported' && notificationPermission !== 'granted' &&
            <button className="btn btn-ghost" onClick={enableNotifications}>Enable notifications</button>}
          {notificationPermission === 'granted' &&
            <span className="notification-enabled">● Notifications on</span>}
          <Link to="/my-trips" className="btn btn-ghost">← My trips</Link>
        </div>
      </div>

      {liveError && <p className="form-error live-location-error">{liveError}</p>}

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
            <div className="group-map-title-row">
              <div>
                <p className="eyebrow">{tripMode ? 'TRIP MAP' : 'LIVE GROUP MAP'}</p>
                <h2>{group.destinationLabel}</h2>
              </div>
              {liveLocations.length > 0 &&
                <span className="live-map-badge"><i></i>{liveLocations.length} live</span>}
            </div>

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
                  liveLocations={liveLocations}
                />
              : <div className="map-empty-state">
                  <strong>Map coordinates aren’t available for this older trip.</strong>
                  <p>New trips created with the map picker show passenger pickups and the road route here.</p>
                </div>}

            {liveLocations.length > 0 && <div className="live-location-strip">
              {liveLocations.map(item => {
                const away = meetingPoint
                  ? distanceKm(
                      { lat: item.latitude, lng: item.longitude },
                      { lat: meetingPoint.lat, lng: meetingPoint.lng }
                    )
                  : null;
                return <div key={item.userId}>
                  <span className="live-avatar-dot"></span>
                  <div>
                    <strong>{Number(item.userId) === userId ? 'You' : item.userName}</strong>
                    <small>{away != null ? `${away < 1 ? Math.round(away * 1000) + ' m' : away.toFixed(1) + ' km'} from meeting point` : 'sharing live'}</small>
                  </div>
                </div>;
              })}
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

            <p className="map-privacy-note">
              Live location is opt-in and visible only to members of this group. If updates stop, FLUX hides the position after about two minutes.
            </p>
          </section>

          <PoolCard pool={group} onPoolChange={setGroup} />
        </div>
        </>}
    </div>

    {showInvite && group && <InviteShareCard
      groupId={group.id}
      destination={group.destinationLabel}
      departureTime={group.departureTime}
      onClose={() => setShowInvite(false)}
    />}
  </>;
}
