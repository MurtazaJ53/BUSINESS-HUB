# Deploying the admin website

The backend is already deployed on the DigitalOcean droplet. This is about the
Next.js admin site, which so far has only ever run on a laptop.

## What it needs

One environment variable:

| Variable | Value | Why |
|---|---|---|
| `BUSINESS_HUB_API_BASE_URL` | `https://api.indianwasteportal.com/api/v1` | The live backend |

That is the whole configuration. Every API call is made **server-side** by the
proxy routes in `src/app/api`, which attach the session token from an HTTP-only
cookie. Browser code never holds a credential.

**Do not rename this to `NEXT_PUBLIC_API_BASE_URL`.** A `NEXT_PUBLIC_` variable
is inlined into the JavaScript bundle and served to every visitor. The earlier
`render.yaml` declared `NEXT_PUBLIC_API_URL`, which nothing in the codebase
read — deploying it as written would have left the site falling back to
`http://127.0.0.1:8000/api/v1` and failing every request.

## Vercel

1. New Project → import `MurtazaJ53/BUSINESS-HUB`
2. **Root Directory: `apps/admin_web`** — this is a monorepo; without this the
   build will not find the app
3. Framework preset: Next.js (detected)
4. Environment Variables → add `BUSINESS_HUB_API_BASE_URL`
5. Deploy

`vercel.json` already pins pnpm. `npm install` fails against `pnpm-lock.yaml`.

## Render

`render.yaml` is committed and sets the root directory, pnpm and a health check
on `/login`. Create a Blueprint from the repo and supply
`BUSINESS_HUB_API_BASE_URL` when prompted.

## Before you point customers at it

**CORS is not a concern** — the browser only ever talks to the Next.js server,
never directly to Django. But two things on the backend do need attention:

1. **`DJANGO_ALLOWED_HOSTS`** currently contains `*`. Once the web host is
   known, replace it with the real hostnames.
2. **`DJANGO_CSRF_TRUSTED_ORIGINS`** lists only `localhost`. Add the deployed
   origin.

## After deploying

```bash
pnpm smoke https://your-deployed-url
```

That requests every page and API route and fails on any 5xx. It exists because
a build that compiles is not a page that works: the Hindi/Gujarati change
compiled cleanly and then returned 500 on every page, because `"use client"`
marks every export of a module client-only and the server layout was calling
one of them. Only a real request caught it.

Signed out, expect `307` (redirect to `/login`) for pages and `401` for API
routes. Anything `5xx` is a genuine failure.

## Known limitation

The site has no custom domain and the backend is served from
`api.indianwasteportal.com`, a domain belonging to an unrelated project. That
works, but it is visible in the address bar during payment flows and should be
replaced with a Business Hub domain before customers use it.
