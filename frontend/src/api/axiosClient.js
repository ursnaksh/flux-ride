import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
  timeout: 15000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('flux_auth_token');

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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

axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = 'Something went wrong. Please try again.';

    if (error.response) {
      message = error.response.data?.message
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
      message = 'Could not reach the FLUX server. Please try again in a moment.';
    }

    return Promise.reject(new Error(message));
  }
);

export { clearSession };
export default axiosClient;
