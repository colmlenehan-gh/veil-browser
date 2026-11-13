# Veil Browser

A web interface backed by **remote HTTP retrieval** and optional **server-side Chromium snapshots**. This is a limited remote document browser, not a drop-in replacement for Chrome.

## Current delivery status

- Live frontend: https://colmlenehan-gh.github.io/veil-browser/
- Live backend and alternative app URL: https://veil-browser-omega.vercel.app/
- Production remote HTML, CSS/images, relative links, GET forms, remote Chromium JavaScript snapshots, and private-destination blocking were verified in the live browser on 13 November 2026.
- Public preview sessions are issued automatically, held only in memory and restricted to configured origins and the requesting client. Redis enforces per-IP limits and a global 2,000-request daily service quota. There is no shared secret embedded in the frontend.
- Bing is the default search engine. Brave returned HTTP 429 during production testing. Third-party search availability is not guaranteed.
- Supabase is unused. No accounts or server-side browsing-history database are required.
- Node.js 24 and the bundled maintained sanitizer are required for the deployed runtime. See the verification record for runner and production evidence.

## How remote browsing works

1. The shell posts a destination URL to `/api/browse`.
2. Node validates the URL, resolves and checks all DNS answers, and pins the connection to an approved public address. Each redirect is checked again.
3. HTML mode fetches the document directly. Chromium mode executes the document remotely in a fresh, ephemeral context; browser requests are intercepted and fulfilled through the same secured Node fetcher.
4. Veil removes destination scripts, active embeds and unsafe attributes; retrieves CSS; and issues short-lived signed URLs for image/font requests.
5. The response contains a processed HTML document. A sandboxed **`srcdoc`** viewport displays those returned bytes. It never has a destination `src`, same-origin access, popup permission, form submission permission or top-navigation permission.
6. A nonce-authorised Veil bridge sends supported links and GET form destinations to the shell. The shell validates source and per-document channel and sends another backend request.

The iframe is a containment boundary for backend-produced content, not ordinary external URL embedding. All page and supported resource traffic comes from the backend. Destination HTML does not share the shell origin.

## Features

Address/search bar; in-memory multiple tabs and history; back, forward, reload and home; local bookmarks; private tabs; three search engines; HTML and Chromium snapshot modes; dark responsive shell; privacy disclosure; explicit errors.

## Run locally

Requires Node.js 24, npm, and a Chromium/Chrome installation for snapshot mode. On Linux, the default executable is `/usr/bin/chromium`. On other systems set `CHROMIUM_EXECUTABLE_PATH` to the full browser executable path. Windows example: `C:\Program Files\Google\Chrome\Application\chrome.exe`.

```sh
npm ci
npm start
```

Open `http://localhost:3000`. No access key is required in local development unless `VEIL_ACCESS_KEY` is set. The local server deliberately uses an in-memory limiter; production requires Redis and fails closed without it.

```sh
npm test
npm run test:ui    # start the app first; requires Chromium
npm run test:live  # start app first; needs public internet and deployed fixture pages
```

## Deploy

See [deployment instructions](docs/DEPLOYMENT.md), [architecture](docs/ARCHITECTURE.md), [privacy policy](docs/PRIVACY.md), [test record](docs/TESTING.md), and [limitations](docs/LIMITATIONS.md).

Production requires a signing secret and distributed Redis rate limiter. Set `VEIL_GUEST_ACCESS=1` for automatic short-lived preview sessions, or configure `VEIL_ACCESS_KEY` for a private deployment. The renderer supports only bounded GET requests and sanitised document delivery, not arbitrary methods, credentials or raw proxy responses.

## Licence

MIT for Veil source. Retrieved third-party content remains subject to its owners' rights and service terms. Veil does not grant access to content the operator is not authorised to retrieve.
