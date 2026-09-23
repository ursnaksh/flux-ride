import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function Login() {
  const navigate = useNavigate();
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
    pending.current = true; setLoading(true); setError('');
    try {
      const response = await axiosClient.post(`/api/users/${mode}`, mode === 'register'
        ? { name: name.trim(), phone: phone.trim() } : { phone: phone.trim() });
      localStorage.setItem('flux_user_id', response.data.id);
      localStorage.setItem('flux_user_name', response.data.name);
      localStorage.setItem('flux_role', 'USER');
      localStorage.removeItem('flux_driver_id');
      navigate('/');
    } catch (err) { setError(err.message); }
    finally { pending.current = false; setLoading(false); }
  }
  return <div className="auth-page"><section className="card auth-card">
    <p className="eyebrow">A BETTER WAY TO GO TOGETHER</p>
    <h1 className="auth-title">Your next trip,<br />in good company.</h1>
    <p className="auth-subtitle">Find co-passengers heading your way.</p>
    <div className="tab-switch" aria-label="Account options">{[['register', 'Create account'], ['login', 'Log in']].map(([value, label]) =>
      <button key={value} className={mode === value ? 'active' : ''} aria-pressed={mode === value} disabled={loading}
        onClick={() => { setMode(value); setError(''); }}>{label}</button>)}</div>
    <form onSubmit={submit} className="form">
      {mode === 'register' && <label className="field"><span>Your name</span><input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Nagesh" disabled={loading} /></label>}
      <label className="field"><span>Phone number</span><input required type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Your phone number" disabled={loading} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Please wait…' : mode === 'register' ? 'Create account →' : 'Log in →'}</button>
    </form>
    <p className="quiet-note">Choose your group here. Arrange transport separately.</p>
  </section></div>;
}
