# Deployment

## Verified deployment

- Frontend: https://colmlenehan-gh.github.io/veil-browser/
- Backend / alternate frontend: https://veil-browser-omega.vercel.app/
- Source: https://github.com/colmlenehan-gh/veil-browser

Vercel project creation through the API connection returned 403. The operator completed secure dashboard sign-in and verification; the project was imported and deployed through the dashboard instead. Upstash terms were accepted with explicit user consent. The free `veil-rate-limits` database is connected to production. No paid plan was selected.

## Runtime and build

Use Node.js 24, framework Other, repository root, output directory `public`, and the committed `vercel.json`. `npm ci` invokes the postinstall build. `npm run build` bundles the maintained sanitizer and its ESM parser into `lib/generated/sanitize.cjs` for compatibility with the host's CommonJS loader. That generated file is not committed. The parser is not downgraded. Unit tests run with require(ESM) disabled to detect regressions in that compatibility path.

Pushes to `main` deploy the Vercel project. GitHub Actions verifies the frontend, deploys Pages and runs real-network integration checks. No Vercel access token is embedded in source or workflows.

## Required production environment

| Variable                               | Purpose                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `VEIL_SIGNING_SECRET`                  | Strong randomly generated server-only signing secret, stored as a secret variable |
| `VEIL_API_ORIGIN`                      | Exact production backend origin without a trailing slash                          |
| `VEIL_ALLOWED_ORIGINS`                 | Comma-separated allowed frontend origins                                          |
| `VEIL_GUEST_ACCESS`                    | `1` for automatic preview sessions                                                |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Automatically provisioned Redis REST credentials                                  |

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are supported aliases for an external compatible database. An optional `VEIL_ACCESS_KEY` switches to private shared-key operation and disables guest session issuance. Keep all credential values out of frontend files, screenshots and source control.

The current allowed origins are the GitHub Pages account origin and the exact Vercel production origin. Configure production API access deliberately: an unrelated provider sign-in wall cannot be crossed using a Veil session token.

## Service limits

Each IP may issue 20 page requests, 200 resource requests and 5 session requests per minute. All successful limiter admissions also count towards the shared 2,000-request UTC-day quota. Redis errors or missing production configuration prevent remote requests. This small free preview quota is not an unlimited service promise.

The installed Upstash free plan showed 500,000 monthly commands. Each limiter check uses four commands. The application's daily cap helps keep this preview within that allowance; other uses of the same database and provider-policy changes must still be considered. Do not upgrade to paid usage automatically.

## Smoke tests

1. Load a public HTML page through Pages and confirm the main address stays on Pages.
2. Load `/fixtures/`, verify the image comes from the Vercel resource endpoint, follow a relative link and submit a GET form.
3. Select Chromium and confirm `JavaScript executed remotely` appears.
4. Retrieve GitHub, which sends X-Frame-Options, through the backend.
5. Verify private/reserved destinations return a blocked-destination error.
6. Verify search results and destination links through the selected engine. Third-party engines may block automated requests.
7. Check recent runtime logs for new errors. Earlier failed deployments may retain historical errors and are not evidence that the current deployment is unhealthy.

## Recovery

Rotate the signing secret to revoke all active sessions and resource capabilities. Set an owner access key to require private access. Missing Redis credentials cause fail-closed behaviour. Revert a bad Git commit or use the normal Vercel rollback controls. Resource capabilities expire after five minutes; browser sessions after fifteen minutes.
