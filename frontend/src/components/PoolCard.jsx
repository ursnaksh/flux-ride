import { formatDeparture, money } from '../utils/trips';

export default function PoolCard({ pool }) {
  const members = pool.members || [];
  const perMember = members.length ? pool.totalFare / members.length : pool.totalFare;
  return <article className="card shared-card">
    <div className="card-row"><div><p className="eyebrow">SHARED TRIP #{pool.id}</p><h3>To {pool.destinationLabel}</h3></div>
      <span className={`status-badge status-${pool.status?.toLowerCase()}`}>{pool.status?.replaceAll('_', ' ')}</span></div>
    <p className="departure-line">{formatDeparture(pool.departureTime)} <span>· {members.length}/4 passengers</span></p>
    <ul className="member-list">{members.map((member, index) => <li key={member.id || member.userId}>
      <span className={`member-avatar avatar-tone-${index % 3}`} aria-hidden="true">{member.initials || member.userName?.slice(0, 1)}</span>
      <div><strong>{member.userName}</strong><span>{member.pickup}</span></div>
    </li>)}</ul>
    <div className="fare-row"><span>Estimated share per person</span><strong>{money(perMember)}</strong></div>
    <p className="quiet-note">Coordinate with your group, then book your Uber, Ola, cab or auto separately. Joining here does not book transport. Actual fares may vary.</p>
  </article>;
}
