import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// We deliberately do NOT use a Vite dev-server proxy here - the frontend calls
// the backend directly at http://localhost:8080 (see src/api/axiosClient.js),
// and CORS is handled explicitly on the Spring Boot side (see CorsConfig.java).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
