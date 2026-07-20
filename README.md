# Codepilot Console

A front end for Codepilot, an agentic coding IDE. Users create an account, launch an
isolated coding workspace machine on demand, and connect to it in a new browser tab.

## Stack

- React 18 + TypeScript, built with Vite
- React Router for `/login`, `/register`, and `/workspace`
- No backend of its own: all data comes from the Codepilot API at
  `https://codepilot-api.fly.dev` (FastAPI, hosted on Fly.io)
- Auth token, email, and the active machine name persist in `localStorage`

## How it works

1. A visitor registers (`POST /auth/register`) or signs in (`POST /auth/login`) and the
   returned access token is stored locally.
2. On the workspace screen, "Launch workspace" calls `POST /machines/launch`, which
   returns a `machine_name` that's shown in the UI and saved locally.
3. The app polls `GET /machines/status` every few seconds until the status is `ready`.
4. "Open workspace" calls `POST /machines/connect-ticket` for a short-lived ticket and
   opens `https://codepilot-api.fly.dev/machines/connect?ticket=...` in a new tab (no
   iframe).
5. "Delete workspace" calls the delete endpoint and clears the stored machine name.

The UI theme follows the browser/OS light-dark preference automatically via
`prefers-color-scheme` — there is no manual toggle.

## Running locally

```bash
npm install
npm run dev
```

This starts Vite on `http://localhost:5173`. The app talks directly to the production
Codepilot API, so no local backend or environment variables are required.

## Building

```bash
npm run build
```

Type-checks with `tsc` and outputs a static bundle to `dist/`, which Netlify serves with
a SPA fallback (see `netlify.toml`) so client-side routes like `/workspace` work on
refresh and direct navigation.
