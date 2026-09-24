import { useEffect, useState } from 'react';
import { wakeFluxServer } from '../api/axiosClient';

export default function BackendStatus() {
  const [state, setState] = useState('ready');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handle = event => {
      setState(event.detail?.state || 'ready');
      setMessage(event.detail?.message || '');
    };

    window.addEventListener('flux:server-state', handle);
    return () => window.removeEventListener('flux:server-state', handle);
  }, []);

  async function retry() {
    setState('waking');
    setMessage('');
    try {
      await wakeFluxServer(true);
      setState('ready');
    } catch (_) {
      setState('error');
      setMessage('FLUX backend is still waking. Try again shortly.');
    }
  }

  if (state === 'ready') return null;

  return <div className={'backend-status backend-status-' + state} role="status">
    <span className="backend-status-indicator"></span>
    <div>
      <strong>{state === 'waking' ? 'Waking FLUX server...' : 'Backend connection delayed'}</strong>
      <small>{state === 'waking'
        ? 'The free server may need about a minute after being idle. Keep this tab open.'
        : message || 'FLUX could not reconnect automatically.'}</small>
    </div>
    {state === 'error' && <button type="button" onClick={retry}>Retry</button>}
  </div>;
}
