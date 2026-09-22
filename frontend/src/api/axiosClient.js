import axios from 'axios';

// Direct calls to the Spring Boot backend - CORS is handled there (CorsConfig.java),
// so we do NOT need a Vite proxy or credentials here.
const axiosClient = axios.create({
  baseURL: 'http://localhost:8080',
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Every response is unwrapped to just the `data` payload of our
// { success, message, data } envelope. Errors are normalized into a plain
// string message so every page can show the same kind of inline error text.
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = 'Something went wrong. Please try again.';

    if (error.response) {
      // Server responded with a non-2xx status - use our API's own message if present.
      message = error.response.data?.message || `Request failed (${error.response.status})`;
    } else if (error.request) {
      // Request was made but no response received - almost always means the
      // backend isn't running on port 8080.
      message = 'Could not reach the Flux server. Is the backend running on port 8080?';
    }

    return Promise.reject(new Error(message));
  }
);

export default axiosClient;
