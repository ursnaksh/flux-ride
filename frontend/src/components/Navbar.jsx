import { Link, NavLink, useNavigate } from 'react-router-dom';
import NotificationCenter from './NotificationCenter';

export default function Navbar() {
  const navigate = useNavigate();
  const name = localStorage.getItem('flux_user_name');
  const signedIn = localStorage.getItem('flux_role') === 'USER' && Number(localStorage.getItem('flux_user_id')) > 0;

  function logout() {
    ['flux_user_id', 'flux_user_name', 'flux_role', 'flux_driver_id'].forEach(key => localStorage.removeItem(key));
    navigate('/login');
  }

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="navbar">
      <Link to="/" className="navbar-brand" aria-label="FLUX RIDE home">
        <span className="brand-mark" aria-hidden="true">
          <span className="brand-node brand-node-a"></span>
          <span className="brand-route"></span>
          <span className="brand-node brand-node-b"></span>
        </span>
        <span className="brand-word">FLUX <span className="brand-light">RIDE</span></span>
      </Link>

      {signedIn && <nav className="navbar-links" aria-label="Main navigation">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/find">Find a ride</NavLink>
        <NavLink to="/my-trips">My trips</NavLink>
      </nav>}

      <div className="navbar-right">{signedIn ? <>
        <NotificationCenter />
        <span className="navbar-user">Hey, {name?.split(' ')[0] || 'there'}</span>
        <button className="btn btn-ghost nav-logout" onClick={logout}>Log out</button>
      </> : <Link className="btn btn-primary" to="/login">Get started</Link>}</div>
    </header>
  </>;
}
