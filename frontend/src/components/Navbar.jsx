import { Link, useNavigate, useLocation } from 'react-router-dom';

function FluxLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#4F46E5" />
      <path d="M17.5 7L10 18h5l-1 7 8-11h-5l0.5-7z" fill="#14B8A6" />
    </svg>
  );
}

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const userName = localStorage.getItem('flux_user_name');
  const role = localStorage.getItem('flux_role');

  const handleLogout = () => {
    localStorage.removeItem('flux_user_id');
    localStorage.removeItem('flux_user_name');
    localStorage.removeItem('flux_role');
    localStorage.removeItem('flux_driver_id');
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <FluxLogo />
        <span>Flux</span>
      </Link>

      {userName && (
        <nav className="navbar-links">
          {role === 'DRIVER' ? (
            <Link className={isActive('/driver') ? 'active' : ''} to="/driver">Driver panel</Link>
          ) : <>
            <Link className={isActive('/') ? 'active' : ''} to="/">Home</Link>
            <Link className={isActive('/book') ? 'active' : ''} to="/book">Book Solo</Link>
            <Link className={isActive('/pool') ? 'active' : ''} to="/pool">Pool a Ride</Link>
            <Link className={isActive('/my-rides') ? 'active' : ''} to="/my-rides">My Rides</Link>
          </>}
        </nav>
      )}

      <div className="navbar-right">
        {userName ? (
          <>
            <span className="navbar-user">Hi, {userName.split(' ')[0]}</span>
            <button className="btn btn-ghost" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <Link className="btn btn-primary" to="/login">Log in</Link>
        )}
      </div>
    </header>
  );
}
