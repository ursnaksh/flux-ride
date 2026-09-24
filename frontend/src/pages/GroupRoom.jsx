import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import PoolCard from '../components/PoolCard';
import InviteShareCard from '../components/InviteShareCard';
import { GroupMap, resolveMeetingPlace } from '../components/OpenStreetMap';
import useRideLiveLocation from '../hooks/useRideLiveLocation';

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


function locationAgeLabel(updatedAt, now) {
  if (!updatedAt) return 'Updating…';
  const ageSeconds = Math.max(
    0,
    Math.round((now - new Date(updatedAt).getTime()) / 1000)
  );

  if (!Number.isFinite(ageSeconds) || ageSeconds < 8) return 'Just now';
  if (ageSeconds < 60) return `${ageSeconds}s ago`;
  return `${Math.floor(ageSeconds / 60)}m ago`;
}

function locationQuality(accuracyMeters) {
  if (!Number.isFinite(accuracyMeters)) {
    return { label: 'GPS', tone: 'unknown' };
  }
  if (accuracyMeters <= 20) {
    return { label: `±${Math.round(accuracyMeters)} m`, tone: 'good' };
  }
  if (accuracyMeters <= 60) {
    return { label: `±${Math.round(accuracyMeters)} m`, tone: 'okay' };
  }
  return { label: `±${Math.round(accuracyMeters)} m`, tone: 'weak' };
}

function movementLabel(speedMetersPerSecond) {
  if (!Number.isFinite(speedMetersPerSecond) || speedMetersPerSecond < 0.5) {
    return null;
  }
  return `${Math.round(speedMetersPerSecond * 3.6)} km/h`;
}

function etaAtCurrentSpeed(distance, speedMetersPerSecond) {
  if (
    !Number.isFinite(distance)
    || !Number.isFinite(speedMetersPerSecond)
    || speedMetersPerSecond < 0.6
  ) {
    return null;
  }

  const minutes = Math.ceil(
    (distance * 1000) / speedMetersPerSecond / 60
  );

  if (minutes < 1) return '<1 min';
  if (minutes > 120) return null;
  return `~${minutes} min`;
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
  const [focusLiveUserId, setFocusLiveUserId] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  const previousMemberCount = useRef(null);

  const {
    liveLocations,
    sharing: liveSharing,
    starting: liveStarting,
    error: liveError,
    start: startLiveLocation,
    stop: stopLiveLocation
  } = useRideLiveLocation({
    groupId,
    userId,
    userName: localStorage.getItem('flux_user_name') || 'You'
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
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

  useEffect(() => {
    if (loading || !group || !window.location.hash) return;

    const targetId = window.location.hash.slice(1);
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [loading, group?.id]);

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

  const liveDetails = liveLocations.map(item => {
    const away = meetingPoint
      ? distanceKm(
          { lat: item.latitude, lng: item.longitude },
          { lat: meetingPoint.lat, lng: meetingPoint.lng }
        )
      : null;

    return {
      ...item,
      away,
      ageLabel: locationAgeLabel(item.updatedAt, now),
      quality: locationQuality(item.accuracyMeters),
      movement: movementLabel(item.speedMetersPerSecond),
      eta: etaAtCurrentSpeed(away, item.speedMetersPerSecond)
    };
  });

  const nearMeetingCount = liveDetails.filter(
    item => item.away != null && item.away <= 0.2
  ).length;

  const everyoneSharing =
    members.length > 1 && liveDetails.length === members.length;

  const everyoneNear =
    everyoneSharing
    && meetingPoint
    && liveDetails.every(
      item => item.away != null && item.away <= 0.2
    );

  const missingLiveCount = Math.max(
    0,
    members.length - liveDetails.length
  );

  const currentMember = members.find(
    member => Number(member.userId) === userId
  );

  function jumpTo(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  return <>
    <div className={`page-container group-room-page ${tripMode ? 'trip-mode-active' : ''}`}>
      <div className="group-room-header ride-control-header">
        <div>
          <p className="eyebrow">RIDE CONTROL</p>
          <h1 className="page-title">{group?.destinationLabel || 'Your shared ride'}</h1>
          <p className="page-subtitle">
            One place for your people, chat, live location and meeting point.
          </p>
        </div>
        <Link to="/" className="btn btn-ghost">← Home</Link>
      </div>

      {liveError && <p className="form-error live-location-error">{liveError}</p>}

      {loading ? <Loader label="Opening your group…" /> :
        error ? <div className="empty-state">
          <h2>Couldn’t open this group.</h2>
          <p className="form-error">{error}</p>
          <Link to="/my-trips" className="btn btn-primary">Back to My trips</Link>
        </div> : <>
        <section className={`ride-control-deck ${tripMode ? 'is-trip-mode' : ''}`}>
          <div className="ride-control-summary">
            <div className="ride-control-state">
              <span></span>
              {tripMode ? 'TRIP MODE' : members.length > 1 ? 'GROUP ACTIVE' : 'WAITING FOR PASSENGERS'}
            </div>
            <div className="ride-control-route">
              <div>
                <small>DESTINATION</small>
                <strong>{group.destinationLabel}</strong>
              </div>
              <div className="ride-control-countdown">
                <small>DEPARTURE</small>
                <strong>{countdown || 'Time pending'}</strong>
              </div>
            </div>
            <div className="ride-control-stats">
              <div><span>PEOPLE</span><strong>{members.length}/4</strong></div>
              <div><span>READY</span><strong>{readyCount}/{members.length}</strong></div>
              <div><span>LIVE</span><strong>{liveLocations.length}</strong></div>
              <div><span>YOU</span><strong>{currentMember?.ready ? 'READY' : 'NOT READY'}</strong></div>
            </div>
          </div>

          <div className="ride-control-actions" aria-label="Ride controls">
            <button type="button" onClick={() => jumpTo('chat')} disabled={members.length < 2}>
              <span>01</span>
              <div><strong>Chat</strong><small>{members.length > 1 ? 'Coordinate the ride' : 'Available after someone joins'}</small></div>
            </button>

            <button
              type="button"
              className={liveSharing ? 'is-active' : ''}
              onClick={liveSharing ? stopLiveLocation : startLiveLocation}
              disabled={members.length < 2 || liveStarting}
            >
              <span>02</span>
              <div>
                <strong>{liveStarting ? 'Finding GPS…' : liveSharing ? 'Live location ON' : 'Live location'}</strong>
                <small>{members.length > 1 ? (liveSharing ? 'Tap to stop sharing' : 'Share with this ride') : 'Available after someone joins'}</small>
              </div>
            </button>

            <button type="button" onClick={() => jumpTo('meeting-point')} disabled={!meetingPoint}>
              <span>03</span>
              <div><strong>Meeting point</strong><small>{meetingPoint ? 'See where to meet' : 'Calculated when pickups are available'}</small></div>
            </button>

            <button type="button" onClick={() => setShowInvite(true)}>
              <span>04</span>
              <div><strong>Invite</strong><small>Bring another passenger in</small></div>
            </button>
          </div>

          <div className="ride-control-secondary">
            <button type="button" className="text-link" onClick={() => jumpTo('people')}>People &amp; readiness ↓</button>
            <button type="button" className="text-link" onClick={() => jumpTo('live-map')}>Map ↓</button>
            {notificationPermission !== 'unsupported' && notificationPermission !== 'granted' &&
              <button type="button" className="text-link" onClick={enableNotifications}>Enable notifications</button>}
            {notificationPermission === 'granted' &&
              <span className="ride-control-notification">● Notifications on</span>}
          </div>
        </section>

        <div className="group-room-layout ride-control-layout">
          <div id="coordination" className="group-coordination-anchor">
            <PoolCard pool={group} onPoolChange={setGroup} roomMode />
          </div>

          <section className="group-room-map-preview" id="live-map">
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

            {liveDetails.length > 0 && <div className={`live-coordination-status ${everyoneNear ? 'everyone-near' : ''}`}>
              <span className="live-status-orb">◎</span>
              <div>
                <strong>
                  {everyoneNear
                    ? 'Everyone is near the meeting point'
                    : meetingPoint
                      ? `${nearMeetingCount}/${liveDetails.length} live passenger${liveDetails.length === 1 ? '' : 's'} within 200 m`
                      : `${liveDetails.length} passenger${liveDetails.length === 1 ? '' : 's'} sharing live`}
                </strong>
                <small>
                  {missingLiveCount > 0
                    ? `${missingLiveCount} passenger${missingLiveCount === 1 ? ' is' : 's are'} not sharing live location.`
                    : 'All passengers are sharing live location.'}
                </small>
              </div>
              {focusLiveUserId && <button type="button" onClick={() => setFocusLiveUserId(null)}>Show overview</button>}
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
                  currentUserId={userId}
                  focusLiveUserId={focusLiveUserId}
                />
              : <div className="map-empty-state">
                  <strong>Map coordinates aren’t available for this older trip.</strong>
                  <p>New trips created with the map picker show passenger pickups and the road route here.</p>
                </div>}

            {liveDetails.length > 0 && <div className="live-location-strip live-location-cards">
              {liveDetails.map(item => {
                const distanceLabel = item.away != null
                  ? item.away < 1
                    ? `${Math.round(item.away * 1000)} m from meeting point`
                    : `${item.away.toFixed(1)} km from meeting point`
                  : 'Sharing live location';

                return <button
                  type="button"
                  className={`live-location-card ${Number(focusLiveUserId) === Number(item.userId) ? 'is-focused' : ''}`}
                  key={item.userId}
                  onClick={() => setFocusLiveUserId(
                    Number(focusLiveUserId) === Number(item.userId)
                      ? null
                      : item.userId
                  )}
                >
                  <span className="live-person-avatar">
                    {Number(item.userId) === userId
                      ? 'YOU'
                      : (item.userName || '?').slice(0, 2).toUpperCase()}
                    <i></i>
                  </span>
                  <div className="live-person-copy">
                    <div>
                      <strong>{Number(item.userId) === userId ? 'You' : item.userName}</strong>
                      <span className={`live-quality live-quality-${item.quality.tone}`}>{item.quality.label}</span>
                    </div>
                    <small>{distanceLabel}{item.eta ? ` · ${item.eta} at current speed` : ''}</small>
                    <em>{item.ageLabel}{item.movement ? ` · ${item.movement}` : ''}</em>
                  </div>
                  <b>{Number(focusLiveUserId) === Number(item.userId) ? 'Following' : 'Follow'}</b>
                </button>;
              })}
            </div>}

            {meetingPoint && <div className="meeting-suggestion smart-meeting-suggestion" id="meeting-point">
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
              Live location is opt-in and visible only to members of this ride. FLUX shows GPS accuracy and update age, and automatically hides positions that stop updating for about two minutes.
            </p>
          </section>

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
