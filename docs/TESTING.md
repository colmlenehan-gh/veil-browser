# Verification record

13 November 2026.

## Verified cloud run

https://github.com/colmlenehan-gh/veil-browser/actions/runs/43398734955

The verification job, Pages deployment job, and remote-verification job all completed successfully. The run verified:

1. Ten security unit tests, including a mocked pinned-transport test proving private redirect targets are rejected before a second connection.
2. Interface flow in actual Chrome: isolated processed documents, stable main URL, internal navigation and history, bookmarks, private-tab restrictions, and phone/tablet layout bounds.
3. Ten real-network integration checks: static HTML; linked CSS/images/relative links and GET form processing; remote Chromium JavaScript execution and script removal; GitHub pages with X-Frame-Options; response size rejection; actual API retrieval; SSRF rejection; unsigned resource rejection; complete browser-to-backend-to-remote-page display/navigation with no client destination traffic; and rate limiting.
4. A separately reported JavaScript-heavy Excalidraw compatibility probe retrieved a 7,029-character snapshot. Interactive canvas editing and continuing JavaScript sessions remain unsupported. This probe is not counted as successful interactive compatibility.

## Local verification

Ten unit/security tests pass. The fixture-based browser UI tests also pass using the bundled headless Chromium executable. System Chromium could not start in the restricted workspace, and public DNS requests return EAI_AGAIN; those limitations were resolved for testing by the independently hosted GitHub runner. No production network restriction was weakened or removed from the application.

Local tests also confirmed that bundled Chromium executes a controlled script through the guarded request-interception path. That controlled fixture test is not presented as a public-network test.

## Reproducing checks

- `npm test`: security helpers, decoding, document/CSS processing and redirect connection validation.
- `npm run test:ui`: against an already running local server; uses an intercepted API fixture to isolate shell behaviour. Requires Chrome/Chromium at `CHROMIUM_EXECUTABLE_PATH` or `/usr/bin/chromium`.
- `npm run test:live`: against the running local server, with public internet and this project's deployed Pages fixtures. Performs real remote fetching and actual browser display. Set `VEIL_USE_BUNDLED_CHROMIUM=1` to exercise the serverless engine and `CHROMIUM_EXECUTABLE_PATH` for the separate client-browser check.

Later commits repeat the workflow for final UI and request-budget improvements; consult their actual run results for those revisions. The successful run above establishes the core architecture. A successful runner does not establish Vercel bundle compatibility, production credentials or production API health.

## Unresolved deployment gate

Vercel project creation returned HTTP 403 because the connected integration cannot create the project. No Vercel deployment exists, and no production backend URL has been tested. Backend access/signing secrets and distributed Redis rate limiting must be configured before production browsing can operate.
