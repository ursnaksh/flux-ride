import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import RouteMap from '../components/RouteMap';
import Loader from '../components/Loader';

const BASE_FARE = 15;
const RATE_PER_KM = 12;

export default function BookRide() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('flux_user_id');

  const [pickup, setPickup] = useState('');
  const [drop, setDrop] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState(null);

  const estimatedFare = distanceKm && !isNaN(distanceKm)
    ? (BASE_FARE + RATE_PER_KM * parseFloat(distanceKm)).toFixed(2)
    : null;

  const validate = () => {
    if (!pickup.trim() || !drop.trim()) return 'Please enter both pickup and drop locations.';
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
    setLoading(true);
    try {
      const response = await axiosClient.post('/api/rides', {
        userId: Number(userId),
        pickup,
        drop,
        distanceKm: parseFloat(distanceKm)
      });
      setBooked(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (booked) {
    return (
      <div className="page-container">
        <div className="card confirmation-card">
          <h2>Request sent 🎉</h2>
          <p>Your ride request is waiting for an available driver to confirm it.</p>
          <div className="card-meta">
            <span>{booked.distanceKm} km</span>
            <span className="dot">•</span>
            <span>₹{booked.fare.toFixed(2)}</span>
          </div>
          <div className="card-actions">
            <button className="btn btn-ghost" onClick={() => setBooked(null)}>Book another</button>
            <button className="btn btn-primary" onClick={() => navigate('/my-rides')}>View my rides</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container two-column">
      <div className="card form-panel">
        <p className="card-eyebrow">Solo ride</p>
        <h1 className="page-title">Where to?</h1>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Pickup location</span>
            <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="MG Road" />
          </label>

          <label className="field">
            <span>Drop location</span>
            <input value={drop} onChange={(e) => setDrop(e.target.value)} placeholder="Airport Terminal 2" />
          </label>

          <label className="field">
            <span>Distance (km)</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="12.5"
            />
          </label>

          {estimatedFare && (
            <p className="fare-estimate">Estimated fare: <strong>₹{estimatedFare}</strong></p>
          )}

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? <Loader label="Sending request..." /> : 'Request ride'}
          </button>
        </form>
      </div>

      <div className="map-panel">
        <RouteMap
          points={[
            { label: pickup || 'Pickup', kind: 'pickup' },
            { label: drop || 'Drop', kind: 'drop' }
          ]}
        />
      </div>
    </div>
  );
}
