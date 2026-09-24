import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStage, setOtpStage] = useState('details');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [authConfig, setAuthConfig] = useState({
    otpRequired: false,
    otpAvailable: false,
    codeLength: 6,
    resendAfterSeconds: 30
  });
  const [configLoading, setConfigLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    let active = true;

    axiosClient.get('/api/users/auth-config')
      .then(response => {
        if (active && response.data) setAuthConfig(response.data);
      })
      .catch(() => {
        // If config cannot be loaded, the normal server error handling will
        // surface when the user submits. Do not lock the UI here.
      })
      .finally(() => {
        if (active) setConfigLoading(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => {
      setResendIn(value => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  function resetVerification(nextMode = mode) {
    setMode(nextMode);
    setOtp('');
    setOtpStage('details');
    setMaskedPhone('');
    setResendIn(0);
    setError('');
  }

  function finishLogin(payload) {
    const user = payload?.user || payload;

    if (!user?.id || !payload?.token) {
      setError('FLUX could not create a secure session. Please try again.');
      return;
    }

    localStorage.setItem('flux_auth_token', payload.token);
    localStorage.setItem(
      'flux_auth_expires_at',
      String(payload.expiresAtEpochSeconds || '')
    );
    localStorage.setItem('flux_user_id', user.id);
    localStorage.setItem('flux_user_name', user.name);
    localStorage.setItem('flux_role', 'USER');
    localStorage.setItem(
      'flux_phone_verified',
      String(Boolean(user.phoneVerified))
    );
    localStorage.setItem(
      'flux_student_verified',
      String(Boolean(user.studentVerified))
    );

    if (user.studentEmail) {
      localStorage.setItem('flux_student_email', user.studentEmail);
    } else {
      localStorage.removeItem('flux_student_email');
    }

    localStorage.removeItem('flux_driver_id');

    const next = params.get('next');
    navigate(next && next.startsWith('/') ? next : '/');
  }

  function validateDetails() {
    if (mode === 'register' && name.trim().length < 2) {
      setError('Please enter your name.');
      return false;
    }

    if (phone.trim().length < 7) {
      setError('Please enter a valid phone number.');
      return false;
    }

    return true;
  }

  async function requestOtp() {
    if (!validateDetails()) return;

    pending.current = true;
    setLoading(true);
    setError('');

    try {
      const response = await axiosClient.post('/api/users/otp/request', {
        name: mode === 'register' ? name.trim() : null,
        phone: phone.trim(),
        purpose: mode.toUpperCase()
      });

      setMaskedPhone(response.data.maskedPhone || phone.trim());
      setResendIn(response.data.resendAfterSeconds || authConfig.resendAfterSeconds || 30);
      setOtp('');
      setOtpStage('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  async function verifyOtp() {
    const expectedLength = authConfig.codeLength || 6;
    if (!new RegExp('^\\d{' + expectedLength + '}$').test(otp)) {
      setError('Enter the ' + expectedLength + '-digit verification code.');
      return;
    }

    pending.current = true;
    setLoading(true);
    setError('');

    try {
      const response = await axiosClient.post('/api/users/otp/verify', {
        name: mode === 'register' ? name.trim() : null,
        phone: phone.trim(),
        purpose: mode.toUpperCase(),
        otp
      });

      finishLogin(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  async function directAuth() {
    if (!validateDetails()) return;

    pending.current = true;
    setLoading(true);
    setError('');

    try {
      const response = await axiosClient.post('/api/users/' + mode, mode === 'register'
        ? { name: name.trim(), phone: phone.trim() }
        : { phone: phone.trim() });

      finishLogin(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current || configLoading) return;

    if (authConfig.otpRequired) {
      if (otpStage === 'details') {
        await requestOtp();
      } else {
        await verifyOtp();
      }
      return;
    }

    await directAuth();
  }

  async function resendOtp() {
    if (loading || resendIn > 0 || pending.current) return;
    await requestOtp();
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
        <small>{authConfig.otpRequired ? 'Phone-verified student ride matching.' : 'Route-aware student ride matching.'}</small>
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

        <p className="eyebrow">
          {authConfig.otpRequired && otpStage === 'otp' ? 'VERIFY YOUR NUMBER' : 'WELCOME TO FLUX'}
        </p>

        <h1>
          {authConfig.otpRequired && otpStage === 'otp'
            ? 'Check your phone.'
            : mode === 'register'
              ? 'Make your commute less random.'
              : 'Good to see you again.'}
        </h1>

        <p className="next-auth-subtitle">
          {authConfig.otpRequired && otpStage === 'otp'
            ? <>We sent a one-time code to <strong>{maskedPhone}</strong>. Enter it below to verify this phone belongs to you.</>
            : mode === 'register'
              ? 'Create your profile and start matching with people on the same route.'
              : 'Jump back into your trips, matches and group rooms.'}
        </p>

        {otpStage === 'details' && <div className="next-auth-tabs" aria-label="Account options">
          <button className={mode === 'register' ? 'active' : ''} onClick={() => resetVerification('register')} disabled={loading}>Create account</button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => resetVerification('login')} disabled={loading}>Log in</button>
        </div>}

        <form onSubmit={submit} className="form next-auth-form">
          {otpStage === 'details' ? <>
            {mode === 'register' && <label className="field next-field">
              <span>Your name</span>
              <input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="What should we call you?" disabled={loading} />
            </label>}

            <label className="field next-field">
              <span>Phone number</span>
              <input
                required
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="10-digit number or +country code"
                disabled={loading}
              />
            </label>
          </> : <>
            <div className="otp-phone-chip">
              <span className="verified-shield" aria-hidden="true">✓</span>
              <div><small>VERIFYING</small><strong>{maskedPhone}</strong></div>
              <button type="button" onClick={() => resetVerification(mode)} disabled={loading}>Change</button>
            </div>

            <label className="field next-field otp-field">
              <span>{authConfig.codeLength || 6}-digit OTP</span>
              <input
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={authConfig.codeLength || 6}
                value={otp}
                onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, authConfig.codeLength || 6))}
                placeholder="••••••"
                disabled={loading}
              />
            </label>

            <div className="otp-resend-row">
              <span>Didn’t get it?</span>
              <button type="button" onClick={resendOtp} disabled={loading || resendIn > 0}>
                {resendIn > 0 ? 'Resend in ' + resendIn + 's' : 'Resend OTP'}
              </button>
            </div>
          </>}

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn next-primary-btn btn-block auth-submit" disabled={loading || configLoading}>
            {configLoading
              ? 'Checking security…'
              : loading
                ? authConfig.otpRequired && otpStage === 'otp'
                  ? 'Verifying…'
                  : authConfig.otpRequired
                    ? 'Sending code…'
                    : 'Getting things ready…'
                : authConfig.otpRequired
                  ? otpStage === 'otp'
                    ? 'Verify & enter FLUX ↗'
                    : 'Send verification code ↗'
                  : mode === 'register'
                    ? 'Create my FLUX account ↗'
                    : 'Enter FLUX RIDE ↗'}
          </button>
        </form>

        <div className="auth-security-note">
          <span className={authConfig.otpRequired ? 'is-on' : ''}>✓</span>
          <p>{authConfig.otpRequired
            ? 'Phone verification protects your account and gives other passengers a verified-user signal.'
            : 'FLUX helps you find co-passengers. Transport booking remains separate.'}</p>
        </div>
      </div>
    </section>
  </div>;
}
