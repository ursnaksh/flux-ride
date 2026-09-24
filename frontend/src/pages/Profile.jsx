import { useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';
import Loader from '../components/Loader';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [email, setEmail] = useState(
    localStorage.getItem('flux_student_email') || ''
  );
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('email');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    let active = true;

    Promise.all([
      axiosClient.get('/api/users/me'),
      axiosClient.get('/api/users/student-verification/config')
    ])
      .then(([me, verification]) => {
        if (!active) return;

        setUser(me.data);
        setConfig(verification.data);

        if (me.data?.studentEmail) {
          setEmail(me.data.studentEmail);
        }
      })
      .catch(err => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;

    const timer = window.setInterval(() => {
      setResendIn(value => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendIn]);

  async function requestCode(event) {
    event?.preventDefault();
    if (pending.current || !email.trim()) return;

    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await axiosClient.post(
        '/api/users/student-verification/request',
        { email: email.trim() }
      );

      setMaskedEmail(response.data.maskedEmail || email.trim());
      setResendIn(
        response.data.resendAfterSeconds
        || config?.resendAfterSeconds
        || 60
      );
      setCode('');
      setStage('code');
      setNotice('Verification code sent to your VIT inbox.');
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (pending.current) return;

    const length = config?.codeLength || 6;
    if (!new RegExp('^\\d{' + length + '}$').test(code)) {
      setError(`Enter the ${length}-digit verification code.`);
      return;
    }

    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await axiosClient.post(
        '/api/users/student-verification/verify',
        {
          email: email.trim(),
          code
        }
      );

      setUser(response.data);
      localStorage.setItem(
        'flux_student_verified',
        String(Boolean(response.data.studentVerified))
      );
      localStorage.setItem(
        'flux_student_email',
        response.data.studentEmail || email.trim()
      );
      setStage('email');
      setNotice('VIT student verification complete.');
    } catch (err) {
      setError(err.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="page-container profile-page">
      <Loader label="Loading your FLUX profile…" />
    </div>;
  }

  return <div className="page-container profile-page">
    <section className="profile-hero">
      <div className="profile-avatar">
        {user?.initials || user?.name?.slice(0, 1) || 'F'}
      </div>
      <div>
        <p className="eyebrow">YOUR FLUX PROFILE</p>
        <h1>{user?.name || 'FLUX passenger'}</h1>
        <p>Build trust before you share a ride.</p>
      </div>
    </section>

    <section className="profile-trust-grid">
      <article className="profile-trust-card">
        <div className="profile-trust-icon is-secure">✓</div>
        <div>
          <span>ACCOUNT SECURITY</span>
          <strong>Secure session active</strong>
          <p>Your private FLUX actions now require your signed login session.</p>
        </div>
      </article>

      <article className="profile-trust-card">
        <div className={`profile-trust-icon ${user?.phoneVerified ? 'is-verified' : ''}`}>
          {user?.phoneVerified ? '✓' : '•'}
        </div>
        <div>
          <span>PHONE</span>
          <strong>{user?.phoneVerified ? 'Phone verified' : 'Phone not verified yet'}</strong>
          <p>{user?.phoneVerified
            ? 'This account has completed phone ownership verification.'
            : 'SMS OTP verification will be required when production OTP is enabled.'}</p>
        </div>
      </article>

      <article className="profile-trust-card profile-student-card">
        <div className={`profile-trust-icon ${user?.studentVerified ? 'is-student' : ''}`}>
          {user?.studentVerified ? 'V' : '@'}
        </div>
        <div>
          <span>COLLEGE</span>
          <strong>{user?.studentVerified ? 'VIT student verified' : 'Verify your VIT identity'}</strong>
          <p>{user?.studentVerified
            ? user.studentEmail
            : `Use your @${config?.domain || 'vit.edu'} email to add a student badge.`}</p>
        </div>
      </article>
    </section>

    <section className="profile-verification-panel">
      <div className="profile-verification-copy">
        <p className="eyebrow">STUDENT VERIFICATION</p>
        <h2>{user?.studentVerified ? 'You’re verified.' : 'Prove you’re a VIT student.'}</h2>
        <p>{user?.studentVerified
          ? 'Passengers can now see that this FLUX profile belongs to a verified VIT email account.'
          : 'We send a one-time code to your college email. Your email address is not shown to other passengers.'}</p>
      </div>

      {user?.studentVerified ? <div className="profile-verified-success">
        <span>✓</span>
        <div>
          <strong>VIT student</strong>
          <small>{user.studentEmail}</small>
        </div>
      </div> : !config?.available ? <div className="profile-provider-note">
        <span>i</span>
        <div>
          <strong>Verification flow is ready.</strong>
          <p>Email delivery still needs to be connected on the FLUX server before codes can be sent.</p>
        </div>
      </div> : stage === 'email' ? <form className="form profile-verify-form" onSubmit={requestCode}>
        <label className="field next-field">
          <span>VIT email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder={`yourname@${config?.domain || 'vit.edu'}`}
            disabled={busy}
            required
          />
        </label>

        <button className="btn next-primary-btn" disabled={busy}>
          {busy ? 'Sending…' : 'Send verification code ↗'}
        </button>
      </form> : <form className="form profile-verify-form" onSubmit={verifyCode}>
        <div className="profile-code-target">
          <div>
            <small>CODE SENT TO</small>
            <strong>{maskedEmail}</strong>
          </div>
          <button type="button" onClick={() => {
            setStage('email');
            setCode('');
            setError('');
          }}>Change</button>
        </div>

        <label className="field next-field otp-field">
          <span>{config?.codeLength || 6}-digit code</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={config?.codeLength || 6}
            value={code}
            onChange={event =>
              setCode(
                event.target.value
                  .replace(/\D/g, '')
                  .slice(0, config?.codeLength || 6)
              )
            }
            placeholder="••••••"
            required
            autoFocus
            disabled={busy}
          />
        </label>

        <div className="profile-code-actions">
          <button className="btn next-primary-btn" disabled={busy}>
            {busy ? 'Checking…' : 'Verify student email ↗'}
          </button>
          <button
            type="button"
            className="btn next-secondary-btn"
            onClick={requestCode}
            disabled={busy || resendIn > 0}
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
        </div>
      </form>}

      {notice && <p className="profile-notice" role="status">{notice}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>

    <section className="profile-privacy-note">
      <span>◎</span>
      <div>
        <strong>Verification without oversharing.</strong>
        <p>Your phone number and VIT email are not automatically exposed to co-passengers. Badges only communicate verification status.</p>
      </div>
    </section>
  </div>;
}
