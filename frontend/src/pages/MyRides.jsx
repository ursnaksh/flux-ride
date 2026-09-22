import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import RideCard from '../components/RideCard';
import PoolCard from '../components/PoolCard';
import Loader from '../components/Loader';

export default function MyRides() {
  const userId = localStorage.getItem('flux_user_id');

  const [tab, setTab] = useState('rides'); // 'rides' | 'pools'
  const [rides, setRides] = useState([]);
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [ridesRes, poolsRes] = await Promise.all([
          axiosClient.get(`/api/rides/user/${userId}`),
          axiosClient.get(`/api/pools/user/${userId}`)
        ]);
        if (!cancelled) {
          setRides(ridesRes.data);
          setPools(poolsRes.data);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="page-container">
      <h1 className="page-title">My rides</h1>

      <div className="tab-switch">
        <button className={tab === 'rides' ? 'active' : ''} onClick={() => setTab('rides')} type="button">
          Solo rides ({rides.length})
        </button>
        <button className={tab === 'pools' ? 'active' : ''} onClick={() => setTab('pools')} type="button">
          Pool history ({pools.length})
        </button>
      </div>

      {loading && <Loader label="Loading your rides..." />}
      {error && <p className="form-error">{error}</p>}

      {!loading && !error && tab === 'rides' && (
        rides.length === 0 ? (
          <p className="empty-state">No rides yet — book your first one!</p>
        ) : (
          <div className="ride-list">
            {rides.map((ride) => <RideCard key={ride.id} ride={ride} />)}
          </div>
        )
      )}

      {!loading && !error && tab === 'pools' && (
        pools.length === 0 ? (
          <p className="empty-state">No pools yet — try pooling your next ride.</p>
        ) : (
          <div className="pool-grid">
            {pools.map((pool) => <PoolCard key={pool.id} pool={pool} />)}
          </div>
        )
      )}
    </div>
  );
}
