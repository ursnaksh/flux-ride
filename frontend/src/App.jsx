import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import FindCoPassengers from './pages/FindCoPassengers.jsx';
import MyRides from './pages/MyRides.jsx';
import Login from './pages/Login.jsx';
import GroupRoom from './pages/GroupRoom.jsx';
import InviteGroup from './pages/InviteGroup.jsx';
import Profile from './pages/Profile.jsx';
import AmbientGlow from './components/AmbientGlow.jsx';
import BackendStatus from './components/BackendStatus.jsx';

function RequireUser() {
  const id = Number(localStorage.getItem('flux_user_id'));
  const location = useLocation();
  const token = localStorage.getItem('flux_auth_token');
  const signedIn =
    Number.isSafeInteger(id)
    && id > 0
    && localStorage.getItem('flux_role') === 'USER'
    && Boolean(token);

  if (signedIn) return <Outlet />;

  const next = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/login?next=${next}`} replace />;
}

export default function App() {
  const location = useLocation();
  return <div className="app-shell">
    <AmbientGlow />
    <BackendStatus />
    <Navbar />
    <main key={location.pathname + location.search} className="app-main" id="main-content">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireUser />}>
          <Route path="/" element={<Home />} />
          <Route path="/find" element={<FindCoPassengers />} />
          <Route path="/my-trips" element={<MyRides />} />
          <Route path="/groups/:groupId" element={<GroupRoom />} />
          <Route path="/invite/:groupId" element={<InviteGroup />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/book" element={<Navigate to="/find" replace />} />
          <Route path="/pool" element={<Navigate to="/find" replace />} />
          <Route path="/my-rides" element={<Navigate to="/my-trips" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <footer className="app-footer flux-footer">
      <div className="footer-brand">
        <span className="footer-logo-dot" aria-hidden="true"></span>
        <strong>FLUX RIDE</strong>
        <span>Shared routes. Better rides.</span>
      </div>
      <div className="team-flux-credit">
        <span className="team-flux-spark" aria-hidden="true">✦</span>
        Designed &amp; built by <strong>Team FLUX</strong>
      </div>
    </footer>
  </div>;
}
