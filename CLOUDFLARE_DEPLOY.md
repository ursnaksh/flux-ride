# FLUX RIDE — Cloudflare Pages deployment

Primary frontend host: Cloudflare Pages
Backend: https://flux-ride-backend.onrender.com
Database: Aiven MySQL free tier

## Pages project settings

- Project name: `team-flux-ride`
- Git repository: `ursnaksh/flux-ride`
- Production branch: `main`
- Root directory: `frontend`
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

## Environment variables

- `VITE_API_BASE_URL=https://flux-ride-backend.onrender.com`
- `NODE_VERSION=20`

## Notes

Cloudflare Pages automatically treats this React app as a single-page application because the build has no top-level `404.html`, so routes such as `/find`, `/my-trips`, `/groups/:id`, and `/invite/:id` can be opened directly.

After the first Cloudflare deployment, copy the final `*.pages.dev` hostname and add it to the backend CORS allowlist.

Keep the Render Static Site as a fallback copy until Cloudflare has been tested end-to-end.
