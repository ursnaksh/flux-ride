import { Link } from 'react-router-dom';
import { formatDeparture, isFuture, money } from '../utils/trips';

function shortPlace(label) {
  if (!label) return 'Unknown';
  return label.split(',').slice(0, 2).join(',').trim();
}

export default function RideCard({ ride }) {
  const canSearch = ride.status === 'SEARCHING' && isFuture(ride.departureTime);

  return <article className="card request-card next-request-card">
    <div className="next-request-top">
      <div className="request-id-pill">REQUEST #{ride.id}</div>
      <span className={'status-badge status-' + ride.status?.toLowerCase()}>{ride.status}</span>
    </div>

    <div className="next-request-route">
      <div>
        <span className="route-node route-node-start"></span>
        <div><small>FROM</small><strong>{shortPlace(ride.pickup)}</strong></div>
      </div>
      <span className="request-route-line"></span>
      <div>
        <span className="route-node route-node-end"></span>
        <div><small>TO</small><strong>{shortPlace(ride.drop)}</strong></div>
      </div>
    </div>

    <div className="next-request-meta">
      <span>{formatDeparture(ride.departureTime)}</span>
      <span>{ride.distanceKm} km</span>
      <span>{money(ride.fare)} est.</span>
    </div>

    {canSearch && <Link className="btn next-primary-btn request-action" to={'/find?request=' + ride.id}>Open matches <span>↗</span></Link>}
    {ride.status === 'SEARCHING' && !canSearch && <p className="quiet-note">Departure has passed. Create a fresh request when you’re ready.</p>}
    {ride.status === 'MATCHED' && <p className="quiet-note">You’re matched. Open Shared trips to jump into your Group Room.</p>}
  </article>;
}
