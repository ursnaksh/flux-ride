import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    if (mode === 'register' && name.trim().length < 2) return setError('Please enter your name.');
    if (phone.trim().length < 7) return setError('Please enter a valid phone number.');

    pending.current = true;
    setLoading(true);
    setError('');

    try {
      const response = await axiosClient.post('/api/users/' + mode, mode === 'register'
        ? { name: name.trim(), phone: phone.trim() }
        : { phone: phone.trim() });

      localStorage.setItem('flux_user_id', response.data.id);
      localStorage.setItem('flux_user_name', response.data.name);
      localStorage.setItem('flux_role', 'USER');
      localStorage.removeItem('flux_driver_id');

      const next = params.get('next');
      navigate(next && next.startsWith('/') ? next : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return <div className="next-auth-page">
    <section className="next-auth-visual">
      <div className="auth-visual-aurora auth-a"></div>
      <div className="auth-visual-aurora auth-b"></div>

      <div className="auth-brand-lockup">
        <span className="flux-logo auth-logo" aria-hidden="true">
          <i className="flux-logo-orbit"></i>
          <i className="flux-logo-core"></i>
        </span>
        <div><strong>FLUX RIDE</strong><small>by Team FLUX</small></div>
      </div>

      <div className="auth-visual-copy">
        <p>MOVE WITH PEOPLE<br />WHO ARE ALREADY<br /><span>GOING YOUR WAY.</span></p>
        <small>Route-aware student ride matching.</small>
      </div>

      <div className="auth-floating-route">
        <div><i></i><span>VIT Pune</span></div>
        <b></b>
        <div><i></i><span>Koregaon Park</span></div>
      </div>

      <div className="auth-team-credit">Designed &amp; built by <strong>Team FLUX</strong></div>
    </section>

    <section className="next-auth-panel">
      <div className="next-auth-card">
        <div className="auth-mobile-brand">
          <span className="flux-logo" aria-hidden="true"><i className="flux-logo-orbit"></i><i className="flux-logo-core"></i></span>
          <strong>FLUX RIDE</strong>
        </div>

        <p className="eyebrow">WELCOME TO FLUX</p>
        <h1>{mode === 'register' ? 'Make your commute less random.' : 'Good to see you again.'}</h1>
        <p className="next-auth-subtitle">
          {mode === 'register'
            ? 'Create your profile and start matching with people on the same route.'
            : 'Jump back into your trips, matches and group rooms.'}
        </p>

        <div className="next-auth-tabs" aria-label="Account options">
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }} disabled={loading}>Create account</button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }} disabled={loading}>Log in</button>
        </div>

        <form onSubmit={submit} className="form next-auth-form">
          {mode === 'register' && <label className="field next-field">
            <span>Your name</span>
            <input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" disabled={loading} />
          </label>}

          <label className="field next-field">
            <span>Phone number</span>
            <input required type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone number" disabled={loading} />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn next-primary-btn btn-block auth-submit" disabled={loading}>
            {loading ? 'Getting things ready…' : mode === 'register' ? 'Create my FLUX account ↗' : 'Enter FLUX RIDE ↗'}
          </button>
        </form>

        <p className="next-auth-note">FLUX helps you find co-passengers. Transport booking remains separate.</p>
      </div>
    </section>
  </div>;
}
