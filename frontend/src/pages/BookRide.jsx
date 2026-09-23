import { Navigate } from 'react-router-dom';

export default function LegacyRedirect() {
  return <Navigate to="/find" replace />;
}
