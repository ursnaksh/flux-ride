import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import RideCard from '../components/RideCard';
import PoolCard from '../components/PoolCard';
import Loader from '../components/Loader';

export default function MyRides() {
  const userId = localStorage.getItem('flux_user_id');
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');

    Promise.all([
      axiosClient.get('/api/rides/user/' + userId, { signal: controller.signal }),
      axiosClient.get('/api/pools/user/' + userId, { signal: controller.signal })
    ])
      .then(([rides, pools]) => {
        if (!controller.signal.aborted) {
          setRequests(rides.data);
          setGroups(pools.data);
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [userId, reload]);

  const activeRequests = useMemo(
    () => requests.filter(item => item.status === 'SEARCHING' || item.status === 'MATCHED').length,
    [requests]
  );

  const activeGroups = useMemo(
    () => groups.filter(item => ['FORMING', 'READY', 'BOOKED_EXTERNALLY'].includes(item.status)).length,
    [groups]
  );

  return <div className="page-container next-trips-page">
    <section className="next-trips-hero">
      <div>
        <p className="eyebrow">YOUR FLUX</p>
        <h1 className="page-title">Trips that are actually moving.</h1>
        <p className="page-subtitle">Requests, matches and shared groups — without hunting through old screens.</p>
      </div>

      <Link to="/find" className="btn next-primary-btn">Plan a new route <span>↗</span></Link>
    </section>

    <section className="trip-stat-strip">
      <div><span>ACTIVE REQUESTS</span><strong>{activeRequests}</strong></div>
      <div><span>SHARED GROUPS</span><strong>{activeGroups}</strong></div>
      <div><span>TOTAL JOURNEYS</span><strong>{requests.length}</strong></div>
    </section>

    <div className="next-trip-tabs" aria-label="Trip view">
      <button aria-pressed={tab === 'requests'} className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>
        <span>Requests</span><b>{requests.length}</b>
      </button>
      <button aria-pressed={tab === 'groups'} className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>
        <span>Shared trips</span><b>{groups.length}</b>
      </button>
    </div>

    {loading ? <Loader label="Pulling your trips together…" /> :
      error ? <div className="empty-state next-empty-state">
        <p className="form-error" role="alert">{error}</p>
        <button className="btn next-secondary-btn" onClick={() => setReload(value => value + 1)}>Try again</button>
      </div> :
      tab === 'requests' ?
        requests.length ?
          <div className="ride-list next-ride-list">{requests.map(request => <RideCard key={request.id} ride={request} />)}</div> :
          <div className="empty-state next-empty-state"><span className="empty-orb">↗</span><h2>Your next route starts here.</h2><p>No requests yet. Drop a route and let FLUX do the matching.</p><Link to="/find" className="btn next-primary-btn">Find people on my route</Link></div>
      :
        groups.length ?
          <div className="pool-grid next-pool-grid">{groups.map(group => <div className="group-summary-card next-group-card" key={group.id}>
            <PoolCard pool={group} showChat={false} />
            <Link to={'/groups/' + group.id} className="btn next-primary-btn btn-block open-group-btn">Open Group Room <span>↗</span></Link>
          </div>)}</div> :
          <div className="empty-state next-empty-state"><span className="empty-orb">✦</span><h2>No shared groups yet.</h2><p>Once you join a compatible group, it’ll show up here.</p><Link to="/find" className="btn next-primary-btn">Find a compatible route</Link></div>}
  </div>;
}
