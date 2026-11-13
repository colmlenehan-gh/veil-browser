# Architecture

## Trust boundaries

The GitHub Pages shell never navigates the top-level tab to a destination. It sends an authenticated JSON POST to a Vercel Node Function. The returned document is loaded into an opaque-origin sandbox with only `allow-scripts`. Website scripts are removed; the single allowed script is Veil's generated, CSP-nonce-bound navigation bridge. It has no access to shell storage or DOM.

Destination links have no `href`. They carry validated HTTP(S) destinations in data attributes. Native form actions are removed and disabled by CSP and the iframe sandbox. Supported GET forms are relayed through Veil. The parent accepts messages only from the active viewport and with its random channel value. No destination page receives the backend key.

## Rendering modes

| Mode                            | Retrieval                                     | JavaScript                                                                     | Result                                           |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| HTML                            | Node HTTP(S) client                           | No destination scripts execute                                                 | Sanitised document and retrieved CSS/assets      |
| Chromium                        | Node fetch plus intercepted Chromium requests | Executes remotely for an initial snapshot                                      | Sanitised DOM snapshot, no continuing JS session |
| Full remote interactive browser | Not implemented                               | Would need persistent isolated sessions, input events and a streaming viewport | Not claimed                                      |

Chromium uses a fresh browser/context per request, blocks service workers and WebSockets, rejects non-GET network requests, and routes network loads through the pinned fetcher. Its configured network proxy is a closed loopback port; requests not fulfilled by interception should fail instead of directly reaching destinations. Contexts, cookies and local storage are discarded on close. Browser operations stop after their deadline and close in a finally block. Browser launch uses the serverless Chromium package on Vercel and the configured local executable elsewhere.

Snapshot mode uses a 1280×900 remote viewport and waits one second after DOM content loads. This is not a guarantee that asynchronous applications have finished. Redirected subresources may have incompatible URL bases. Relative script module imports, CSP-dependent code, CORS, document-domain assumptions and API requests can fail. Headers are deliberately reduced rather than replayed verbatim, and the browser context never receives user credentials. Exact fidelity is not promised.

## Network defence

Only HTTP and HTTPS with no credentials, maximum URL length 4096, and standard ports are allowed. All resolved addresses must be global unicast according to ipaddr.js; mapped IPv4 is evaluated as IPv4. A custom Node connection lookup pins the chosen validated address while retaining the original Host header and HTTPS certificate hostname. Redirects never use the HTTP client's automatic redirect behaviour. Each redirect is independently resolved, validated and pinned. Private and reserved targets fail closed, including mixed public/private DNS answers.

Per page: 2 MB HTML, four redirects, 12-second fetch deadline. Per resource: 1.5 MB and six seconds. CSS: up to eight linked stylesheets with a shared 600 KB budget, imports removed. Snapshot traffic: maximum 60 requests and 10 MB aggregate, an 18-second request admission window, per-request timeouts and a 20-second navigation deadline. Processed HTML is capped at 3 MB. Encoded response decompression has an output cap.

Resources require a five-minute HMAC capability binding URL, type and initiating page origin. Only image/font types are served; HTML, script and SVG resource responses are rejected. SVG is also removed from documents. Resource responses have `nosniff`, a restrictive CSP, no cache and no cookies. The capability is a temporary bearer credential and should not be shared. Expired resources require reload.

## Abuse controls

Production requires a shared access key and a server signing secret, neither embedded in source. Page requests require the access key. Signed resource requests cannot be used to choose arbitrary new URLs. Production rate limits use Redis atomic increments in one-minute buckets: 20 page requests and 200 resources per IP. IP bucket identifiers are HMAC pseudonyms and expire after 70 seconds. A missing or unavailable production limiter prevents remote requests. Operators must also use provider quotas to cap total costs; IP limits do not defeat botnets or stolen keys.

The access key is intended for a small authorised preview group. Broad public operation needs individual credentials, key rotation, per-account quotas and a stronger operational security review. CORS is an origin restriction for browser access, not authentication.

## Free-tier assessment, checked 13 November 2026

Vercel's published Node limits include 2 GB Hobby memory, up to 300 seconds with Fluid Compute and a 250 MB uncompressed bundle limit; nonstreamed bodies are capped at 4.5 MB. This app sets a 60-second function duration and keeps returned documents below that payload cap. Chromium's actual traced bundle and cold start must be verified during deployment, which has not succeeded yet. No claim that a Chromium deployment has passed Vercel's bundle checks is made.

Cloudflare Browser Run is an alternative managed engine: published Workers Free allowance is 10 minutes/day with three concurrent sessions, and a 60-second browser timeout. This is suitable for a small demonstration, not unlimited public browsing. It requires a separately configured account and service credentials. Browserless also has a limited free service; it is not silently substituted here. Chromium runs locally or in the intended Vercel Function when configured.

GitHub Pages serves the static frontend and provides no Node backend. Published limits include a 1 GB site and a soft 100 GB/month bandwidth limit. It is not intended for commercial SaaS or sensitive transactions. Vercel Hobby is for eligible personal, non-commercial use. Verify plan terms before changing the project into a commercial product. Redis free allowances vary by provider and were not provisioned here; the app does not assume an unlimited Redis tier.

Sources:

- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/plans/hobby
- https://developers.cloudflare.com/browser-run/pricing/
- https://developers.cloudflare.com/browser-run/limits/
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
