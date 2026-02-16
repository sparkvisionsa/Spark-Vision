# Spark Vision Frontend

Standalone Next.js frontend for Spark Vision.

## Run

```bash
npm install
npm run dev
```

Default port: `3000` (fallback script uses `3001` or `3002` if occupied).

## Environment

Set `NEXT_PUBLIC_API_BASE_URL` to your backend origin (default `http://167.71.231.64:5000`).

All `/api/*` frontend calls are proxied to the backend through Next rewrites.
