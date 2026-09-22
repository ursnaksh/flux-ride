import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('register'); // 'register' | 'login' | 'driver'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [driverUsername, setDriverUsername] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUserResolved = (user) => {
    localStorage.setItem('flux_user_id', user.id);
    localStorage.setItem('flux_user_name', user.name);
    localStorage.setItem('flux_role', 'USER');
    navigate('/');
  };

  const handleDriverResolved = (driver) => {
    localStorage.setItem('flux_user_id', `driver-${driver.id}`);
    localStorage.setItem('flux_user_name', driver.name);
    localStorage.setItem('flux_driver_id', driver.id);
    localStorage.setItem('flux_role', 'DRIVER');
    navigate('/driver');
  };

  const validate = () => {
    if (mode === 'driver') {
      if (!driverUsername.trim() || !driverPassword) return 'Enter your driver username and password.';
      return '';
    }
    if (mode === 'register' && name.trim().length < 2) {
      return 'Please enter your full name.';
    }
    if (phone.trim().length < 7) {
      return 'Please enter a valid phone number.';
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
      const response = mode === 'driver'
        ? await axiosClient.post('/api/driver/login', { username: driverUsername, password: driverPassword })
        : mode === 'register'
        ? await axiosClient.post('/api/users/register', { name, phone })
        : await axiosClient.post('/api/users/login', { phone });
      if (mode === 'driver') handleDriverResolved(response.data);
      else handleUserResolved(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="auth-title">Welcome to Flux</h1>
        <p className="auth-subtitle">Ride together. Save together.</p>

        <div className="tab-switch">
          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
            type="button"
          >
            New here
          </button>
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            I have an account
          </button>
          <button
            className={mode === 'driver' ? 'active' : ''}
            onClick={() => { setMode('driver'); setError(''); }}
            type="button"
          >
            Driver login
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          {mode === 'register' && (
            <label className="field">
              <span>Full name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ananya Sharma"
              />
            </label>
          )}

          {mode !== 'driver' && <label className="field">
            <span>Phone number</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
            />
          </label>}

          {mode === 'driver' && <>
            <label className="field">
              <span>Driver username</span>
              <input value={driverUsername} onChange={(e) => setDriverUsername(e.target.value)} placeholder="aisha" autoComplete="username" />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={driverPassword} onChange={(e) => setDriverPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            </label>
          </>}

          {error && <p className="form-error">{error}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? <Loader label="Please wait..." /> : mode === 'register' ? 'Create account' : mode === 'driver' ? 'Log in as driver' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}
