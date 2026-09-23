import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

const STORAGE_KEY = 'flux_seen_match_alerts';

function loadSeen() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return new Set(Array.isArray(value) ? value : []);
  } catch (_) {
    return new Set();
  }
}

function saveSeen(seen) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen].slice(-200)));
}

export default function NotificationCenter() {
  const userId = Number(localStorage.getItem('flux_user_id'));
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const seen = useRef(loadSeen());
  const firstRun = useRef(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    async function checkMatches() {
      try {
        const ridesResponse = await axiosClient.get(`/api/rides/user/${userId}`);
        const searching = (ridesResponse.data || []).filter(ride =>
          ride.status === 'SEARCHING' && new Date(ride.departureTime).getTime() > Date.now()
        );

        const nextAlerts = [];
        for (const ride of searching.slice(0, 5)) {
          try {
            const matchResponse = await axiosClient.get(`/api/pools/matches/${ride.id}`);
            for (const match of (matchResponse.data || []).slice(0, 3)) {
              const key = `${ride.id}:${match.sharedTripId}`;
              if (seen.current.has(key)) continue;
              nextAlerts.push({
                key,
                requestId: ride.id,
                groupId: match.sharedTripId,
                destination: match.destination,
                score: Math.round((match.compatibilityScore || 0) * 100),
                detourKm: match.estimatedDetourKm
              });
            }
          } catch (_) {
            // One stale request should not stop alerts for the others.
          }
        }

        if (!alive || !nextAlerts.length) {
          firstRun.current = false;
          return;
        }

        nextAlerts.forEach(item => seen.current.add(item.key));
        saveSeen(seen.current);
        setAlerts(current => [...nextAlerts, ...current].slice(0, 12));

        if (
          !firstRun.current
          && document.hidden
          && 'Notification' in window
          && Notification.permission === 'granted'
        ) {
          const item = nextAlerts[0];
          new Notification('New FLUX RIDE match', {
            body: `${item.score}% match to ${item.destination}`
          });
        }
      } finally {
        firstRun.current = false;
      }
    }

    checkMatches();
    const timer = window.setInterval(checkMatches, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [userId]);

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  const count = alerts.length;
  const buttonLabel = useMemo(
    () => count ? `Notifications, ${count} new` : 'Notifications',
    [count]
  );

  if (!userId) return null;

  return <div className="notification-center">
    <button
      type="button"
      className="notification-bell"
      aria-label={buttonLabel}
      aria-expanded={open}
      onClick={() => setOpen(value => !value)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="notification-icon">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
        <path d="M10 21h4"></path>
      </svg>
      {count > 0 && <strong>{count > 9 ? '9+' : count}</strong>}
    </button>

    {open && <div className="notification-popover">
      <div className="notification-popover-head">
        <div>
          <p className="eyebrow">LIVE MATCH ALERTS</p>
          <h3>Your ride updates</h3>
        </div>
        <button type="button" className="notification-close" onClick={() => setOpen(false)}>×</button>
      </div>

      {permission !== 'unsupported' && permission !== 'granted' &&
        <button type="button" className="btn btn-ghost btn-block" onClick={enableNotifications}>
          Enable browser alerts
        </button>}

      {alerts.length ? <div className="notification-list">
        {alerts.map(alert => <Link
          key={alert.key}
          to={`/find?request=${alert.requestId}`}
          className="notification-item"
          onClick={() => setOpen(false)}
        >
          <span className="notification-score">{alert.score}%</span>
          <div>
            <strong>New group heading to {alert.destination}</strong>
            <p>{alert.detourKm != null
              ? `About +${Number(alert.detourKm).toFixed(1)} km pickup detour.`
              : 'A compatible group is available now.'}</p>
          </div>
        </Link>)}
      </div> : <p className="notification-empty">No new match alerts yet. FLUX checks your active requests while the app is open.</p>}

      {!!alerts.length && <button
        type="button"
        className="text-link notification-clear"
        onClick={() => setAlerts([])}
      >Clear alerts</button>}
    </div>}
  </div>;
}
