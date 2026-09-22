const AVATAR_COLORS = ['#4F46E5', '#14B8A6', '#F59E0B', '#EF4444'];

function Avatar({ initials, index }) {
  return (
    <div
      className="avatar"
      style={{ backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
      title={initials}
    >
      {initials}
    </div>
  );
}

export default function PoolCard({ pool, onJoin, onView, joinDisabled }) {
  const farePerMember = pool.members.length > 0 ? pool.totalFare / pool.members.length : pool.totalFare;
  const seatsLeft = 4 - pool.members.length;

  return (
    <div className="card pool-card">
      <div className="card-row">
        <div>
          <p className="card-eyebrow">Shared route</p>
          <h3 className="card-title">To {pool.destinationLabel}</h3>
        </div>
        <span className={`status-badge status-${pool.status.toLowerCase()}`}>{pool.status}</span>
      </div>

      <div className="avatar-stack">
        {pool.members.map((m, i) => (
          <Avatar key={m.id} initials={m.initials} index={i} />
        ))}
        {Array.from({ length: Math.max(seatsLeft, 0) }).map((_, i) => (
          <div className="avatar avatar-empty" key={`empty-${i}`}>+</div>
        ))}
      </div>

      <div className="card-meta">
        <span>{pool.members.length}/4 riders</span>
        <span className="dot">•</span>
        <span>₹{farePerMember.toFixed(2)} / person</span>
        <span className="dot">•</span>
        <span>Driver: {pool.driverName}</span>
      </div>

      <div className="card-actions">
        {onView && (
          <button className="btn btn-ghost" onClick={() => onView(pool)}>View route</button>
        )}
        {onJoin && (
          <button className="btn btn-primary" disabled={joinDisabled || seatsLeft <= 0} onClick={() => onJoin(pool)}>
            {seatsLeft <= 0 ? 'Full' : 'Join pool'}
          </button>
        )}
      </div>
    </div>
  );
}
