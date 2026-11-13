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

## Production verification, 13 November 2026

Both the GitHub Pages shell and the Vercel production service were tested in an actual browser. Verified observations:

- A public external HTML document displayed inside Veil while the main tab remained on the Veil URL.
- CSS and an image rendered from the remote fixture; the image's actual source origin was the Vercel resource endpoint.
- Relative-link navigation and GET form submission remained inside Veil.
- The production Chromium function executed the fixture script and returned `JavaScript executed remotely` in its snapshot.
- GitHub's public page rendered through Veil despite its X-Frame-Options header.
- The link-local metadata destination was rejected with `Private or reserved destinations are blocked`.
- Bing results rendered in both HTML and Chromium modes. Brave returned HTTP 429. Bing's encoded result links are handled without relying on its JavaScript-only redirect.

The production runtime initially failed when loading the sanitizer's ESM parser through the host's CommonJS loader. The maintained dependency tree is now bundled for compatibility. The test command disables require(ESM), and all security tests still pass. The engine remains Node.js 24.

The successful bundled-build workflow is https://github.com/colmlenehan-gh/veil-browser/actions/runs/43405429730. Later source changes repeat the workflow. Current tests include browser-session binding, Marketplace Redis aliases, the daily quota and safe Bing result URL handling in addition to the original security cases.
