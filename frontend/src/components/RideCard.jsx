import { Link } from 'react-router-dom';
import { formatDeparture, isFuture, money } from '../utils/trips';
export default function RideCard({ ride }) {
  const canSearch = ride.status === 'SEARCHING' && isFuture(ride.departureTime);
  return <article className="card request-card">
    <div className="card-row"><div><p className="eyebrow">REQUEST #{ride.id}</p><h3>{ride.pickup} <span aria-hidden="true">→</span> {ride.drop}</h3></div>
      <span className={`status-badge status-${ride.status?.toLowerCase()}`}>{ride.status}</span></div>
    <p className="departure-line">{formatDeparture(ride.departureTime)}</p>
    <p className="quiet-note">{ride.distanceKm} km · Estimated total fare {money(ride.fare)}</p>
    {canSearch && <Link className="btn btn-primary" to={`/find?request=${ride.id}`}>Find matches →</Link>}
    {ride.status === 'SEARCHING' && !canSearch && <p className="quiet-note">This departure time has passed. Create a new request for a future trip.</p>}
    {ride.status === 'MATCHED' && <p className="quiet-note">You joined a group with this request. See your shared trips for group details.</p>}
  </article>;
}
