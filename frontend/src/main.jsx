import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/index.css';
import './styles/flux-v2.css';
import './styles/flux-next.css';

// Note: React 18 StrictMode intentionally double-invokes effects/renders in
// development to help surface side-effect bugs. This is expected behavior,
// not a bug - it does NOT happen in production builds (`npm run build`).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
