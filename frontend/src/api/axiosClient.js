import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const LAST_OK_KEY = 'flux_backend_last_ok';
const WAKE_AFTER_MS = 8 * 60 * 1000;
const WAKE_TIMEOUT_MS = 130000;

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

const wakeClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: WAKE_TIMEOUT_MS,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

let wakePromise = null;

function emitServerState(state, detail = {}) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('flux:server-state', {
      detail: { state, ...detail }
    })
  );
}

function markServerReady() {
  try {
    localStorage.setItem(
      LAST_OK_KEY,
      String(Date.now())
    );
  } catch (_) {
    // Storage can be unavailable in strict/private browser modes.
  }

  emitServerState('ready');
}

function lastServerSuccess() {
  try {
    return Number(
      localStorage.getItem(LAST_OK_KEY) || 0
    );
  } catch (_) {
    return 0;
  }
}

function serverMayBeAsleep() {
  const lastOk = lastServerSuccess();
  return !lastOk || Date.now() - lastOk > WAKE_AFTER_MS;
}

export async function wakeFluxServer(force = false) {
  if (!force && !serverMayBeAsleep()) {
    return true;
  }

  if (wakePromise) {
    return wakePromise;
  }

  emitServerState('waking');

  wakePromise = wakeClient
    .get('/api/users/auth-config', {
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
    .then(() => {
      markServerReady();
      return true;
    })
    .catch(error => {
      emitServerState('error', {
        message:
          'FLUX backend did not wake up. Please retry in a moment.'
      });
      throw error;
    })
    .finally(() => {
      wakePromise = null;
    });

  return wakePromise;
}

function clearSession() {
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
}

axiosClient.interceptors.request.use(async config => {
  const token = localStorage.getItem('flux_auth_token');

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  const isWakeRequest =
    String(config.url || '').includes(
      '/api/users/auth-config'
    );

  if (!isWakeRequest && serverMayBeAsleep()) {
    await wakeFluxServer();
  }

  return config;
});

axiosClient.interceptors.response.use(
  response => {
    markServerReady();
    return response.data;
  },
  async error => {
    const config = error.config || {};
    const status = error.response?.status;
    const isCancelled =
      axios.isCancel(error)
      || error.code === 'ERR_CANCELED'
      || error.name === 'CanceledError';

    const method =
      String(config.method || 'get').toLowerCase();

    const safeToRetry =
      method === 'get'
      || method === 'head'
      || method === 'options';

    const transient =
      !isCancelled
      && (
        !error.response
        || [502, 503, 504].includes(status)
      );

    if (
      transient
      && safeToRetry
      && !config._fluxWakeRetried
    ) {
      try {
        config._fluxWakeRetried = true;
        await wakeFluxServer(true);
        config.timeout = 30000;
        return axiosClient(config);
      } catch (_) {
        // Fall through to the normal user-facing error.
      }
    }

    let message =
      'Something went wrong. Please try again.';

    if (error.response) {
      message =
        error.response.data?.message
        || `Request failed (${error.response.status})`;

      const details = error.response.data?.data;

      if (
        error.response.status === 400
        && details
        && typeof details === 'object'
        && !Array.isArray(details)
      ) {
        message = Object.values(details).join(' ');
      }

      if (
        error.response.status === 401
        && typeof window !== 'undefined'
        && window.location.pathname !== '/login'
      ) {
        const next =
          window.location.pathname
          + window.location.search
          + window.location.hash;

        clearSession();

        window.location.assign(
          `/login?next=${encodeURIComponent(next)}`
        );
      }
    } else if (error.request) {
      emitServerState('error', {
        message:
          'FLUX backend could not be reached after trying to wake it.'
      });

      message =
        navigator.onLine === false
          ? 'You appear to be offline. Check your internet connection.'
          : 'FLUX server is taking longer than expected to wake up. Tap retry and try again.';
    }

    return Promise.reject(
      new Error(message)
    );
  }
);

export { clearSession };
export default axiosClient;
