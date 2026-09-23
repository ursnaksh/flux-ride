import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

const COMMUTE_KEY = 'flux_daily_commute';

function loadCommute() {
  try {
    return JSON.parse(localStorage.getItem(COMMUTE_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

function shortPlace(label) {
  if (!label) return 'Saved place';
  return label.split(',').slice(0, 2).join(',').trim();
}

export default function Home() {
  const [count, setCount] = useState(null);
  const [commute, setCommute] = useState(loadCommute);
  const name = localStorage.getItem('flux_user_name') || 'there';

  useEffect(() => {
    const controller = new AbortController();
    axiosClient.get('/api/pools/active/count', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setCount(response.data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function clearCommute() {
    localStorage.removeItem(COMMUTE_KEY);
    setCommute(null);
  }

  return <div className="home-page flux-home-v2">
    <section className="hero ride-hero">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="live-pulse"></span> ROUTE-AWARE CO-PASSENGER MATCHING</div>
        <p className="hero-eyebrow">HEY {name.split(' ')[0].toUpperCase()}</p>
        <h1 className="hero-title">Your route.<br /><span>Your people.</span></h1>
        <p className="hero-subtitle">Find people already moving your way. Match by real route overlap, time and detour — then plan the ride together.</p>

        <div className="hero-actions">
          <Link to="/find" className="btn hero-button">Find my people <span aria-hidden="true">↗</span></Link>
          <Link to="/my-trips" className="hero-secondary">My active trips <span aria-hidden="true">→</span></Link>
        </div>

        <div className="hero-proof">
          <span><strong>Route-aware</strong><small>real road matching</small></span>
          <span><strong>You choose</strong><small>no forced joining</small></span>
          <span><strong>Private</strong><small>contact details stay hidden</small></span>
        </div>
      </div>

      <div className="journey-art" aria-hidden="true">
        <div className="hero-map-grid"></div>
        <div className="hero-route-glow"></div>
        <div className="hero-map-card hero-map-card-a">
          <span className="mini-avatar">NS</span>
          <div><strong>You</strong><small>VIT Pune</small></div>
        </div>
        <div className="hero-map-card hero-map-card-b">
          <span className="mini-avatar accent">SP</span>
          <div><strong>82% route match</strong><small>+0.8 km detour</small></div>
        </div>
        <div className="hero-destination"><span></span><strong>Destination</strong></div>
        <div className="hero-route-dot dot-1"></div>
        <div className="hero-route-dot dot-2"></div>
        <div className="hero-route-dot dot-3"></div>
        {typeof count === 'number' && <div className="hero-live-card"><span className="live-pulse"></span><strong>{count}</strong><small>active shared {count === 1 ? 'trip' : 'trips'}</small></div>}
      </div>
    </section>

    {commute && <section className="daily-commute-card">
      <div className="daily-commute-icon" aria-hidden="true">↻</div>
      <div className="daily-commute-copy">
        <p className="eyebrow">YOUR DAILY COMMUTE</p>
        <h2>{shortPlace(commute.pickup?.label)} <span>→</span> {shortPlace(commute.destination?.label)}</h2>
        <p>Usual departure · {commute.departureClock || 'Saved time'}</p>
      </div>
      <div className="daily-commute-actions">
        <Link to="/find?commute=1" className="btn btn-primary">Find today’s match <span>↗</span></Link>
        <button type="button" className="btn btn-ghost" onClick={clearCommute}>Remove</button>
      </div>
    </section>}

    <div className="section-heading home-section-heading">
      <div><p className="eyebrow">BUILT AROUND YOUR JOURNEY</p><h2>From “I need a ride” to “we’re leaving”.</h2></div>
      <Link to="/my-trips" className="text-link">View my trips →</Link>
    </div>

    <section className="how-grid" aria-label="How FLUX RIDE works">
      <article className="how-card"><span className="step-number">01</span><div className="how-icon">⌖</div><h3>Drop your route</h3><p>Pick your start, destination and time. FLUX understands the real road route.</p></article>
      <article className="how-card"><span className="step-number">02</span><div className="how-icon">≈</div><h3>See why you match</h3><p>Route overlap, pickup detour, timing and seats — visible before you join.</p></article>
      <article className="how-card"><span className="step-number">03</span><div className="how-icon">↗</div><h3>Move together</h3><p>Meet in the Group Room, get ready, chat and coordinate the actual booking.</p></article>
    </section>
  </div>;
}
