import { useEffect, useState } from 'react';
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
    setLoading(true); setError('');
    Promise.all([axiosClient.get(`/api/rides/user/${userId}`, { signal: controller.signal }), axiosClient.get(`/api/pools/user/${userId}`, { signal: controller.signal })])
      .then(([rides, pools]) => { if (!controller.signal.aborted) { setRequests(rides.data); setGroups(pools.data); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [userId, reload]);
  return <div className="page-container">
    <div className="section-heading"><div><p className="eyebrow">YOUR JOURNEYS</p><h1 className="page-title">My trips</h1><p className="page-subtitle">Your requests and the company you’ve chosen.</p></div><Link to="/find" className="btn btn-primary">Plan a trip →</Link></div>
    <div className="tab-switch trip-tabs" aria-label="Trip view">
      <button aria-pressed={tab === 'requests'} className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Requests ({requests.length})</button>
      <button aria-pressed={tab === 'groups'} className={tab === 'groups' ? 'active' : ''} onClick={() => setTab('groups')}>Shared trips ({groups.length})</button>
    </div>
    {loading ? <Loader label="Loading your trips…" /> : error ? <div className="empty-state"><p className="form-error" role="alert">{error}</p><button className="btn btn-ghost" onClick={() => setReload(value => value + 1)}>Try again</button></div>
      : tab === 'requests' ? requests.length ? <div className="ride-list">{requests.map(request => <RideCard key={request.id} ride={request} />)}</div>
      : <div className="empty-state"><h2>Your next trip starts here.</h2><p>No requests yet. Tell us where you’re headed.</p><Link to="/find" className="btn btn-primary">Find Co-Passengers</Link></div>
      : groups.length ? <div className="pool-grid">{groups.map(group => <div className="group-summary-card" key={group.id}><PoolCard pool={group} /><Link to={`/groups/${group.id}`} className="btn btn-primary btn-block open-group-btn">Open Group Room →</Link></div>)}</div>
      : <div className="empty-state"><h2>No shared trips yet.</h2><p>Find a compatible group and choose Join Group.</p><Link to="/find" className="btn btn-primary">Find Co-Passengers</Link></div>}
  </div>;
}
