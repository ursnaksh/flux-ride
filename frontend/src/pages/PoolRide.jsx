import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import PoolCard from '../components/PoolCard';
import RouteMap from '../components/RouteMap';
import Loader from '../components/Loader';

export default function PoolRide() {
  const userId = localStorage.getItem('flux_user_id');

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myPool, setMyPool] = useState(null);

  const [openPools, setOpenPools] = useState([]);
  const [poolsLoading, setPoolsLoading] = useState(true);
  const [poolsError, setPoolsError] = useState('');
  const [viewedPool, setViewedPool] = useState(null);

  const loadOpenPools = async () => {
    setPoolsLoading(true);
    setPoolsError('');
    try {
      const response = await axiosClient.get('/api/pools/open');
      setOpenPools(response.data);
    } catch (err) {
      setPoolsError(err.message);
    } finally {
      setPoolsLoading(false);
    }
  };

  useEffect(() => {
    loadOpenPools();
  }, []);

  const validate = () => {
    if (!pickup.trim() || !destination.trim()) return 'Please enter both pickup and destination.';
    if (!distanceKm || isNaN(distanceKm) || parseFloat(distanceKm) <= 0) {
      return 'Please enter a valid distance in km.';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const response = await axiosClient.post('/api/pools/join-or-create', {
        userId: Number(userId),
        pickup,
        destination,
        distanceKm: parseFloat(distanceKm)
      });
      setMyPool(response.data);
      loadOpenPools();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeave = async () => {
    if (!myPool) return;
    try {
      await axiosClient.post(`/api/pools/${myPool.id}/leave`, { userId: Number(userId) });
      setMyPool(null);
      setPickup('');
      setDestination('');
      setDistanceKm('');
      loadOpenPools();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleQuickJoin = (pool) => {
    setDestination(pool.destinationLabel);
    setMyPool(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const activePool = myPool || viewedPool;
  const mapPoints = activePool
    ? [
        ...activePool.members.map((m) => ({ label: m.pickup, kind: 'member' })),
        { label: activePool.destinationLabel, kind: 'drop' }
      ]
    : [];

  return (
    <div className="page-container">
      <div className="two-column">
        <div className="card form-panel">
          <p className="card-eyebrow">Cab pooling</p>
          <h1 className="page-title">Pool a ride</h1>
          <p className="page-subtitle">
            We'll match you with an open pool headed the same way, or start a new one.
          </p>

          {myPool ? (
            <div className="my-pool-summary">
              <h3>You're in a pool to {myPool.destinationLabel}</h3>
              <div className="avatar-stack">
                {myPool.members.map((m, i) => (
                  <div key={m.id} className="avatar" style={{ backgroundColor: ['#4F46E5', '#14B8A6', '#F59E0B', '#EF4444'][i % 4] }}>
                    {m.initials}
                  </div>
                ))}
              </div>
              <p className="card-meta">
                {myPool.members.length}/4 riders • ₹{(myPool.totalFare / myPool.members.length).toFixed(2)} / person
              </p>
              {myPool.status === 'OPEN' && (
                <button className="btn btn-ghost" onClick={handleLeave}>Leave pool</button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="form">
              <label className="field">
                <span>Your pickup location</span>
                <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Sector 15 Market" />
              </label>

              <label className="field">
                <span>Destination</span>
                <input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Airport Terminal 2" />
              </label>

              <label className="field">
                <span>Approx. distance (km)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="14"
                />
              </label>

              {error && <p className="form-error">{error}</p>}

              <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                {submitting ? <Loader label="Matching..." /> : 'Find or create a pool'}
              </button>
            </form>
          )}
        </div>

        <div className="map-panel">
          {activePool ? (
            <RouteMap points={mapPoints} />
          ) : (
            <div className="map-placeholder">
              <RouteMap points={[]} />
              <p>Your shared route will appear here once you're matched.</p>
            </div>
          )}
        </div>
      </div>

      <section className="open-pools-section">
        <h2>Open pools</h2>

        {poolsLoading && <Loader label="Loading open pools..." />}
        {poolsError && <p className="form-error">{poolsError}</p>}
        {!poolsLoading && !poolsError && openPools.length === 0 && (
          <p className="empty-state">No open pools right now — be the first to start one.</p>
        )}

        <div className="pool-grid">
          {openPools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onJoin={handleQuickJoin}
              onView={setViewedPool}
              joinDisabled={!!myPool}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
