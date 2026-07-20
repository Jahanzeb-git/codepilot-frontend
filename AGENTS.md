# AGENTS.md

## Architecture

Static single-page app, no server-side code. Every data operation is a direct `fetch`
from the browser to the external Codepilot API (`https://codepilot-api.fly.dev`); there
are no Netlify Functions and no database in this project.

- `src/lib/api.ts` — typed wrappers around every Codepilot API call
  (`/auth/register`, `/auth/login`, `/machines/launch`, `/machines/status`,
  `/machines/connect-ticket`, `/machines/delete`). All requests and error parsing go
  through the single `request()` helper; add new endpoints there rather than calling
  `fetch` directly from components.
- `src/lib/storage.ts` — the only place that touches `localStorage`. Keys: auth token,
  email, active `machine_name`, and a "seen first-launch notice" flag.
- `src/hooks/useAuth.tsx` — React context wrapping the auth token/email and
  `localStorage` persistence. `App.tsx` uses `isAuthenticated` to guard `/workspace`.
- `src/pages/AuthPage.tsx` — combined login/register screen (`mode` prop switches
  copy and the confirm-password field).
- `src/pages/WorkspacePage.tsx` — the workspace launcher: launch, poll status,
  connect (opens the connect URL in a new tab, deliberately not an iframe), and
  delete, with a one-time "first launch can take a minute" notice tracked in
  `localStorage`.

## Conventions

- Each page owns a co-located CSS file (`AuthPage.css`, `WorkspacePage.css`); no CSS
  framework or CSS-in-JS.
- Design tokens (colors, fonts, radii, shadows) live in `src/styles/global.css` as CSS
  custom properties, with a `prefers-color-scheme: dark` override block. Do not
  hardcode colors in component CSS — reference the variables so both themes stay in
  sync.
- `ApiError` (in `src/lib/api.ts`) carries the HTTP status and server-provided message;
  catch it specifically to show user-facing error text instead of a generic failure.
- Status polling in `WorkspacePage.tsx` uses a self-rescheduling `setTimeout` (not
  `setInterval`) so a slow response can't overlap the next poll; always clear the
  pending timeout in the effect cleanup when adding similar polling logic elsewhere.

## Non-obvious decisions

- No manual theme toggle: theming is intentionally just `prefers-color-scheme`, per
  the product requirement to follow the browser/OS setting.
- The connect step never renders the workspace in an iframe — it always
  `window.open()`s the ticketed connect URL in a new tab, since the remote runtime is
  expected to run its own full page (e.g. an embedded IDE) that shouldn't be framed.
- `netlify.toml` redirects all paths to `index.html` (SPA fallback) since routing is
  entirely client-side via React Router.
