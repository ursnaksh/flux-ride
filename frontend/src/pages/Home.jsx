import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function Home() {
  const [activeCount, setActiveCount] = useState(null);
  const [countError, setCountError] = useState('');
  const userName = localStorage.getItem('flux_user_name') || 'there';

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const response = await axiosClient.get('/api/pools/active/count');
        if (!cancelled) setActiveCount(response.data.count);
      } catch (err) {
        if (!cancelled) setCountError(err.message);
      }
    }

    fetchCount();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="home-page">
      <section className="hero">
        <p className="hero-eyebrow">Welcome back, {userName.split(' ')[0]}</p>
        <h1 className="hero-title">Your ride dashboard.</h1>
        <p className="hero-subtitle">
          Request a cab, then follow its status as a driver accepts it. Or pool
          your route with riders headed the same way and split the fare.
        </p>

        <div className="hero-stat">
          {countError ? (
            <span className="hero-stat-error">Couldn't load live pool count</span>
          ) : (
            <>
              <span className="hero-stat-number">{activeCount === null ? '—' : activeCount}</span>
              <span className="hero-stat-label">active pools right now</span>
            </>
          )}
        </div>
      </section>

      <section className="cta-grid">
        <Link to="/book" className="cta-card cta-solo">
          <h2>Ride Now</h2>
          <p>Send a solo ride request with an instant fare estimate, then wait for a driver to accept.</p>
          <span className="cta-arrow-text">Request a solo ride</span>
        </Link>

        <Link to="/pool" className="cta-card cta-pool">
          <h2>Pool &amp; Save</h2>
          <p>Match with riders on your route and split the fare — up to 4 people per pool.</p>
          <span className="cta-arrow-text">Find or start a pool</span>
        </Link>
      </section>
    </div>
  );
}
