# Deployment instructions

## Status

The public repository was created and Pages was enabled. Pages publication and all three verification jobs succeeded in run https://github.com/colmlenehan-gh/veil-browser/actions/runs/43398734955. Vercel creation was denied with HTTP 403 by the existing integration. There is no verified Vercel backend deployment or live end-to-end production browsing result.

## Backend

1. Connect a Vercel account/team that permits creating projects. Import `colmlenehan-gh/veil-browser`. Select framework Other, root directory repository root, install command `npm ci`, empty build command, output directory `public`. Keep `api/` as Vercel Node Functions. The project already includes `vercel.json`.
2. Use an eligible free/personal plan if the application remains non-commercial. Do not activate paid usage without making that decision explicitly.
3. Provision an Upstash-compatible Redis REST database with a suitable free allowance and no paid overages, or bring an existing compatible database. The limiter needs `INCR` and `EXPIRE` via `/pipeline`. No data model or persistent browsing history is stored.
4. Set server environment variables in the Vercel dashboard. Generate strong random values for `VEIL_ACCESS_KEY` and `VEIL_SIGNING_SECRET` (at least 32 random bytes each). Do not commit them. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Set `VEIL_API_ORIGIN` to the exact HTTPS backend origin, without a path. Set `VEIL_ALLOWED_ORIGINS` to `https://colmlenehan-gh.github.io,https://YOUR-BACKEND.vercel.app`.
5. Deploy. Inspect logs for missing dependencies and Chromium bundle/cold-start failures. The Chromium binary is included through `@sparticuz/chromium`, and launch is lazy. Do not declare success before HTML and Chromium smoke tests pass on the deployment.
6. If Vercel Deployment Protection is enabled, configure a deliberately accessible production API suitable for the intended audience. A GitHub Pages cross-origin client cannot pass a Vercel login wall using the Veil access key. Do not embed a Vercel protection-bypass secret in frontend code.
7. In Veil Settings, enter the backend origin and Veil access key. The key stays only in current page memory. The origin and rendering/search preferences persist locally. Only enter a key for a backend you control and trust.
8. To preconfigure the frontend origin for everyone, edit `public/config.js` with the non-secret backend origin and commit. Never place access keys or Redis credentials in frontend files.

## Frontend

Pages uses the `.github/workflows/pages.yml` workflow. It runs unit/interface checks, uploads `public/`, and deploys via GitHub Pages. Set Pages source to GitHub Actions. Public frontend URL: `https://colmlenehan-gh.github.io/veil-browser/` (use the observed deployment status before calling it live).

If workflow publishing is unavailable to an integration, upload the source using GitHub with Actions workflow write permission. Do not omit checks and call the project verified.

## Production verification

- Load example.com in HTML mode and verify the main URL remains on Pages.
- Verify CSS, images, relative links and a GET form against `/fixtures/` on Pages.
- Enable Chromium and verify the fixture says `JavaScript executed remotely`.
- Retrieve github.com, which normally supplies X-Frame-Options, through HTML mode. Sites may reject automated fetches, so record actual status.
- Confirm no client request goes to a destination host. Only Pages and your backend should receive network requests.
- Verify missing access key = 401; private URL = 403; bad capability = 403; exceeded limits = 429; absent rate-limiter configuration = 503.
- Test both normal and private tabs, closing/reopening, viewport resizing and resource expiry.
- Check hosting logs and configure retention and spending limits. Application code avoids destination logging; host-level records remain outside the application's control.

## Failure recovery

If the API is unavailable, the shell displays a retrieval error and does not fall back to external navigation. To revoke resource links, rotate the signing secret. To revoke page access, rotate the access key and notify authorised users separately. Deleting Redis credentials causes fail-closed behaviour. Revert a bad frontend using GitHub commit history and redeploy; use Vercel's deployment rollback for the backend.
