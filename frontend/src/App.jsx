import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import FindCoPassengers from './pages/FindCoPassengers.jsx';
import MyRides from './pages/MyRides.jsx';
import Login from './pages/Login.jsx';
import GroupRoom from './pages/GroupRoom.jsx';

function RequireUser() {
  const id = Number(localStorage.getItem('flux_user_id'));
  return Number.isSafeInteger(id) && id > 0 && localStorage.getItem('flux_role') === 'USER'
    ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return <div className="app-shell">
    <Navbar />
    <main className="app-main" id="main-content">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireUser />}>
          <Route path="/" element={<Home />} />
          <Route path="/find" element={<FindCoPassengers />} />
          <Route path="/my-trips" element={<MyRides />} />
          <Route path="/groups/:groupId" element={<GroupRoom />} />
          <Route path="/book" element={<Navigate to="/find" replace />} />
          <Route path="/pool" element={<Navigate to="/find" replace />} />
          <Route path="/my-rides" element={<Navigate to="/my-trips" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
    <footer className="app-footer"><strong>FLUX RIDE</strong><span>Find your people. Plan your ride.</span></footer>
  </div>;
}
