# Veil Browser

A web interface backed by **remote HTTP retrieval** and optional **server-side Chromium snapshots**. This is a limited remote document browser, not a drop-in replacement for Chrome.

## Current delivery status

- Source is published and the frontend has deployed successfully to GitHub Pages: https://colmlenehan-gh.github.io/veil-browser/
- The Vercel backend project was deployed through the authenticated dashboard on 13 November 2026 at https://veil-browser-omega.vercel.app. The API connection still lacks project access.
- Production browsing is **not enabled yet**: Redis provisioning requires the operator to accept the Marketplace/Upstash terms, and server access/signing secrets and allowed origins still need configuration. The backend fails closed until configuration is complete. The frontend now has the deployed backend origin preconfigured.
- Ten security tests pass. The GitHub-hosted UI and ten real-network integration checks passed, including remote JavaScript execution, HTML/CSS/images, X-Frame-Options handling, and actual backend-to-browser rendering with no client destination requests. The tested run is https://github.com/colmlenehan-gh/veil-browser/actions/runs/43398734955. This is runner verification, not a Vercel production deployment.
- Supabase is intentionally unused. No accounts or server-side history database are required.

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

Requires Node 22.17+ or 24+, npm, and a Chromium/Chrome installation for snapshot mode. On Linux, the default executable is `/usr/bin/chromium`. On other systems set `CHROMIUM_EXECUTABLE_PATH` to the full browser executable path. Windows example: `C:\Program Files\Google\Chrome\Application\chrome.exe`.

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

Do not expose the backend without an access key, signing secret, distributed rate limiter and provider spending controls. The app is not anonymously open to the public: users need the operator's access key. Keys are kept only in memory in the shell.

## Licence

MIT for Veil source. Retrieved third-party content remains subject to its owners' rights and service terms. Veil does not grant access to content the operator is not authorised to retrieve.
