# FLUX RIDE deployment

Backend: Render Free, branch `feature/find-co-passengers`, external Aiven MySQL.
Frontend: Vercel Hobby, root directory `frontend`, framework Vite, output `dist`.

Set `VITE_API_BASE_URL=https://flux-ride-backend.onrender.com` on Vercel before building. This is a public API address, not a secret. Never put database credentials in frontend variables.

After the frontend URL is assigned, set `CORS_ALLOWED_ORIGINS` on Render to that exact HTTPS origin without a trailing slash. Multiple origins are comma-separated. The default remains localhost for development. Do not use a wildcard with credentials.

Use `feature/find-co-passengers` as the deployment branch; do not deploy the older main branch. The committed Vercel rewrite lets React Router handle saved request links and page refreshes.

Verification still required after deployment: API connectivity from the actual frontend origin, login, a future request, group creation or joining, and refresh persistence. Use Nagesh, Swapnil and Tanishka for test users. The current prototype trusts supplied user IDs; share it as a demonstration with test data, not as a secure service for real passenger information.
