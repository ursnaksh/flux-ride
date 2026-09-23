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

  return <div className="home-page flux-home-next">
    <section className="next-hero">
      <div className="next-hero-aurora aurora-one" aria-hidden="true"></div>
      <div className="next-hero-aurora aurora-two" aria-hidden="true"></div>
      <div className="next-hero-grain" aria-hidden="true"></div>

      <div className="next-hero-copy">
        <div className="next-status-pill"><span></span> Route matching is live</div>
        <p className="hero-eyebrow">HEY {name.split(' ')[0].toUpperCase()}</p>
        <h1 className="next-hero-title">
          Stop looking for a ride.<br />
          <span>Find your people.</span>
        </h1>
        <p className="next-hero-subtitle">
          FLUX matches students by real road overlap, timing and pickup detour — then gives the group one place to coordinate everything.
        </p>

        <div className="next-hero-actions">
          <Link to="/find" className="btn next-primary-btn">
            Find people on my route
            <span className="btn-arrow">↗</span>
          </Link>
          <Link to="/my-trips" className="btn next-secondary-btn">
            Open my trips
            <span>→</span>
          </Link>
        </div>

        <div className="next-proof-row">
          <div><strong>Real roads</strong><span>not text matching</span></div>
          <div><strong>Private by default</strong><span>you control sharing</span></div>
          <div><strong>Built for students</strong><span>fast, social, simple</span></div>
        </div>
      </div>

      <div className="next-hero-demo" aria-hidden="true">
        <div className="demo-phone-shell">
          <div className="demo-phone-top">
            <span>FLUX RIDE</span>
            <i></i>
          </div>
          <div className="demo-route-panel">
            <span className="demo-label">LIVE ROUTE</span>
            <strong>VIT Pune → Koregaon Park</strong>
            <div className="demo-route-line">
              <i className="demo-route-start"></i>
              <i className="demo-route-flow"></i>
              <i className="demo-route-end"></i>
            </div>
            <div className="demo-route-meta">
              <span>8.4 km</span>
              <span>24 min</span>
              <span>3 seats</span>
            </div>
          </div>

          <div className="demo-match-card">
            <div className="demo-match-score"><strong>92</strong><span>%</span></div>
            <div>
              <span>BEST MATCH</span>
              <strong>Swapnil + 1</strong>
              <small>84% shared route · +0.6 km detour</small>
            </div>
          </div>

          <div className="demo-people-row">
            <span>NS</span><span>SP</span><span>TS</span>
            <small>3 people ready to coordinate</small>
          </div>
        </div>

        <div className="floating-chip floating-chip-one">
          <span className="chip-pulse"></span>
          {typeof count === 'number' ? count + ' active shared ' + (count === 1 ? 'trip' : 'trips') : 'Matching live'}
        </div>

        <div className="floating-chip floating-chip-two">
          <strong>₹148</strong>
          <span>estimated savings</span>
        </div>
      </div>
    </section>

    {commute && <section className="next-commute-card">
      <div className="next-commute-icon" aria-hidden="true">↻</div>
      <div className="daily-commute-copy">
        <p className="eyebrow">YOUR DAILY COMMUTE</p>
        <h2>{shortPlace(commute.pickup?.label)} <span>→</span> {shortPlace(commute.destination?.label)}</h2>
        <p>Usual departure · {commute.departureClock || 'Saved time'}</p>
      </div>
      <div className="daily-commute-actions">
        <Link to="/find?commute=1" className="btn next-primary-btn compact">Find today’s people <span>↗</span></Link>
        <button type="button" className="btn next-secondary-btn compact" onClick={clearCommute}>Remove</button>
      </div>
    </section>}

    <section className="next-section-head">
      <div>
        <p className="eyebrow">WHY IT FEELS DIFFERENT</p>
        <h2>Less searching. More moving.</h2>
      </div>
      <Link to="/find" className="text-link">Try it now ↗</Link>
    </section>

    <section className="next-feature-grid">
      <article className="next-feature-card feature-violet">
        <div className="feature-card-number">01</div>
        <div className="feature-card-icon">⌖</div>
        <h3>Route-first matching</h3>
        <p>FLUX compares real roads, not just typed location names.</p>
        <div className="feature-card-metric"><strong>84%</strong><span>shared route</span></div>
      </article>

      <article className="next-feature-card feature-cyan">
        <div className="feature-card-number">02</div>
        <div className="feature-card-icon">≈</div>
        <h3>Know the trade-off</h3>
        <p>See route overlap, time difference and pickup detour before joining.</p>
        <div className="feature-card-metric"><strong>+0.8 km</strong><span>pickup detour</span></div>
      </article>

      <article className="next-feature-card feature-pink">
        <div className="feature-card-number">03</div>
        <div className="feature-card-icon">✦</div>
        <h3>One group room</h3>
        <p>Chat, readiness, live location, meeting point and invite links in one place.</p>
        <div className="feature-card-metric"><strong>1 room</strong><span>everything together</span></div>
      </article>
    </section>

    <section className="team-flux-home-credit">
      <span className="credit-line"></span>
      <p>Made with intent by <strong>Team FLUX</strong></p>
      <span className="credit-line"></span>
    </section>
  </div>;
}
