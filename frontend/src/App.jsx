import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import BookRide from './pages/BookRide.jsx';
import PoolRide from './pages/PoolRide.jsx';
import MyRides from './pages/MyRides.jsx';
import Login from './pages/Login.jsx';
import DriverPanel from './pages/DriverPanel.jsx';

function RequireDriver({ children }) {
  const role = localStorage.getItem('flux_role');
  if (role !== 'DRIVER') return <Navigate to="/" replace />;
  return children;
}

function RequireUser({ children }) {
  const role = localStorage.getItem('flux_role');
  if (role !== 'USER') return <Navigate to={role === 'DRIVER' ? '/driver' : '/login'} replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireUser><Home /></RequireUser>} />
          <Route path="/book" element={<RequireUser><BookRide /></RequireUser>} />
          <Route path="/pool" element={<RequireUser><PoolRide /></RequireUser>} />
          <Route path="/my-rides" element={<RequireUser><MyRides /></RequireUser>} />
          <Route path="/driver" element={<RequireDriver><DriverPanel /></RequireDriver>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
