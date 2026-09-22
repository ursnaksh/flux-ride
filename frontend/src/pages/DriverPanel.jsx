import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';

export default function DriverPanel() {
  const [requests, setRequests] = useState([]);
  const driverId = localStorage.getItem('flux_driver_id');
  const driverName = localStorage.getItem('flux_user_name');
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get('/api/driver/requests');
      setRequests(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const confirm = async (rideId) => {
    if (!driverId) {
      setError('Your driver session has expired. Please log in again.');
      return;
    }
    setConfirmingId(rideId);
    setError('');
    try {
      const response = await axiosClient.post(`/api/driver/${driverId}/requests/${rideId}/confirm`);
      setNotice(`${response.data.driverName} confirmed this ride.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="page-container driver-page">
      <div className="driver-heading">
        <div>
          <p className="card-eyebrow">Dispatch workspace</p>
          <h1 className="page-title">Driver panel</h1>
          <p className="page-subtitle">Review incoming requests and accept the next ride.</p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={loading}>Refresh</button>
      </div>

      <section className="card driver-selector">
        <div>
          <h2 className="card-title">You are driving as {driverName}</h2>
          <p className="selector-help">Confirming a ride marks your driver account busy.</p>
        </div>
      </section>

      {notice && <p className="success-message">{notice}</p>}
      {error && <p className="form-error">{error}</p>}
      {loading ? <Loader label="Loading ride requests..." /> : (
        requests.length === 0 ? <p className="empty-state">No open ride requests right now.</p> : (
          <div className="request-grid">
            {requests.map((ride) => (
              <article className="card request-card" key={ride.id}>
                <div className="card-row">
                  <div>
                    <p className="card-eyebrow">New request #{ride.id}</p>
                    <h2 className="card-title">{ride.pickup} → {ride.drop}</h2>
                  </div>
                  <span className="status-badge status-requested">Requested</span>
                </div>
                <div className="request-details">
                  <span>{ride.distanceKm} km</span><span>₹{ride.fare.toFixed(2)}</span>
                </div>
                <button className="btn btn-primary btn-block" onClick={() => confirm(ride.id)} disabled={confirmingId === ride.id || !driverId}>
                  {confirmingId === ride.id ? 'Confirming…' : 'Confirm request'}
                </button>
              </article>
            ))}
          </div>
        )
      )}
    </div>
  );
}
