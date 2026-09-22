const STATUS_LABELS = {
  REQUESTED: 'Requested',
  ACCEPTED: 'Accepted',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed'
};

export default function RideCard({ ride }) {
  return (
    <div className="card ride-card">
      <div className="card-row">
        <div>
          <p className="card-eyebrow">Solo ride</p>
          <h3 className="card-title">{ride.pickup} → {ride.drop}</h3>
        </div>
        <span className={`status-badge status-${ride.status.toLowerCase()}`}>
          {STATUS_LABELS[ride.status] || ride.status}
        </span>
      </div>

      <div className="card-meta">
        <span>{ride.distanceKm} km</span>
        <span className="dot">•</span>
        <span>₹{ride.fare.toFixed(2)}</span>
        <span className="dot">•</span>
        <span>{ride.driverName ? `Driver: ${ride.driverName}` : 'Waiting for a driver'}</span>
      </div>
    </div>
  );
}
