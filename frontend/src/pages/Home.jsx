import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function Home() {
  const [count, setCount] = useState(null);
  const name = localStorage.getItem('flux_user_name') || 'there';
  useEffect(() => {
    const controller = new AbortController();
    axiosClient.get('/api/pools/active/count', { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setCount(response.data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return <div className="home-page">
    <section className="hero ride-hero">
      <div><p className="hero-eyebrow">WELCOME BACK, {name.split(' ')[0].toUpperCase()}</p>
        <h1 className="hero-title">Same direction.<br /><span>Better company.</span></h1>
        <p className="hero-subtitle">Find people travelling your way. Compare compatible groups, choose your company, and plan the journey together.</p>
        <Link to="/find" className="btn hero-button">Find Co-Passengers <span aria-hidden="true">↗</span></Link>
        {typeof count === 'number' && <p className="hero-live"><span aria-hidden="true">●</span> {count} active shared {count === 1 ? 'trip' : 'trips'}</p>}
      </div>
      <div className="journey-art" aria-hidden="true"><div className="journey-stop">01 <span>Your pickup</span></div><div className="journey-track"><span>↗</span></div><div className="journey-stop">02 <span>A shared destination</span></div><div className="journey-caption">A little planning.<br />A better journey.</div></div>
    </section>
    <div className="section-heading"><div><p className="eyebrow">HOW IT WORKS</p><h2>Your trip. Your choice.</h2></div><Link to="/my-trips" className="text-link">View my trips →</Link></div>
    <section className="how-grid" aria-label="How FLUX RIDE works">
      {[['01', 'Share your plans', 'Add your pickup, destination and departure time.'], ['02', 'Find your group', 'Compare match scores, reasons and available seats.'], ['03', 'Go together', 'Join the group you choose. Arrange your cab or auto separately.']].map(([step, title, text]) =>
        <article className="how-card" key={step}><span className="step-number">{step}</span><h3>{title}</h3><p>{text}</p></article>)}
    </section>
  </div>;
}
