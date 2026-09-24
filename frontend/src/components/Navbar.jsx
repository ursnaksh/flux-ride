import { Link, NavLink, useNavigate } from 'react-router-dom';
import NotificationCenter from './NotificationCenter';

export default function Navbar() {
  const navigate = useNavigate();
  const name = localStorage.getItem('flux_user_name');
  const signedIn =
    localStorage.getItem('flux_role') === 'USER'
    && Number(localStorage.getItem('flux_user_id')) > 0
    && Boolean(localStorage.getItem('flux_auth_token'));
  const verified = localStorage.getItem('flux_phone_verified') === 'true';
  const studentVerified =
    localStorage.getItem('flux_student_verified') === 'true';

  function logout() {
    [
      'flux_auth_token',
      'flux_auth_expires_at',
      'flux_user_id',
      'flux_user_name',
      'flux_role',
      'flux_driver_id',
      'flux_phone_verified',
      'flux_student_verified',
      'flux_student_email'
    ].forEach(key => localStorage.removeItem(key));
    navigate('/login');
  }

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="navbar flux-nav">
      <Link to="/" className="navbar-brand flux-brand" aria-label="FLUX RIDE home">
        <span className="flux-logo" aria-hidden="true">
          <i className="flux-logo-orbit"></i>
          <i className="flux-logo-core"></i>
        </span>
        <span className="flux-brand-copy">
          <strong>FLUX RIDE</strong>
          <small>by Team FLUX</small>
        </span>
      </Link>

      {signedIn && <nav className="navbar-links flux-nav-links" aria-label="Main navigation">
        <NavLink to="/" end><span>Home</span></NavLink>
        <NavLink to="/find"><span>Find ride</span></NavLink>
        <NavLink to="/my-trips"><span>My trips</span></NavLink>
      </nav>}

      <div className="navbar-right flux-nav-actions">{signedIn ? <>
        <NotificationCenter />
        <Link to="/profile" className="flux-user-chip flux-user-chip-link" aria-label="Open my profile">
          <span className="flux-user-avatar">{(name?.trim()?.[0] || 'F').toUpperCase()}</span>
          <span>{name?.split(' ')[0] || 'there'}</span>
          {verified && <span className="nav-verified-badge" title="Phone verified" aria-label="Phone verified">✓</span>}
          {studentVerified && <span className="nav-student-badge" title="VIT student verified" aria-label="VIT student verified">V</span>}
        </Link>
        <button className="btn btn-ghost nav-logout" onClick={logout}>Log out</button>
      </> : <Link className="btn btn-primary nav-cta" to="/login">Get started <span>↗</span></Link>}</div>
    </header>

    {signedIn && <nav className="flux-mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/" end>
        <span className="mobile-nav-icon" aria-hidden="true">⌂</span>
        <span>Home</span>
      </NavLink>
      <NavLink to="/find">
        <span className="mobile-nav-icon" aria-hidden="true">⌖</span>
        <span>Find</span>
      </NavLink>
      <NavLink to="/my-trips">
        <span className="mobile-nav-icon" aria-hidden="true">↗</span>
        <span>Trips</span>
      </NavLink>
    </nav>}
  </>;
}
