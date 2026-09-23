import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';
import PoolCard from '../components/PoolCard';
import { GroupMap } from '../components/OpenStreetMap';

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
          label: 'Suggested meeting point · near the center of the group, on the shared route'
        };
      }
    }
  } catch (_) {
    // Older groups can fall back to the geographic midpoint.
  }

  return {
    ...center,
    label: 'Suggested meeting area · midpoint of passenger pickups'
  };
}

export default function GroupRoom() {
  const { groupId } = useParams();
  const userId = localStorage.getItem('flux_user_id');
  const [group, setGroup] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const previousMemberCount = useRef(null);

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

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  const meetingPoint = suggestedMeetingPoint(group);

  return <div className="page-container group-room-page">
    <div className="group-room-header">
      <div>
        <p className="eyebrow">YOUR SHARED RIDE</p>
        <h1 className="page-title">Group Room</h1>
        <p className="page-subtitle">See who’s travelling with you, get ready together and coordinate the ride.</p>
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
      </div> :
      <div className="group-room-layout">
        <section className="group-room-map-preview">
          <p className="eyebrow">LIVE GROUP MAP</p>
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

          {meetingPoint && <div className="meeting-suggestion">
            <span className="meeting-marker">M</span>
            <div>
              <strong>Suggested meeting point</strong>
              <p>FLUX picked a point near the center of the group’s pickups and keeps it on the shared route when route data is available.</p>
            </div>
          </div>}

          <p>Pickup markers and the suggested meeting point are visible only to members of this shared group.</p>
        </section>

        <PoolCard pool={group} onPoolChange={setGroup} />
      </div>}
  </div>;
}
