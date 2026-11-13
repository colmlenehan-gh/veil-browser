# Verification record

13 November 2026.

## Observed locally

Eight unit/security tests passed initially: reserved IPs, unsafe URL syntax, mixed DNS records, resource signature tampering/expiry, hostile HTML removal, relative URL/resource rewriting, unsafe CSS handling, encoding, and production fail-closed configuration (some grouped in one test). Additional tests may be added; the current test runner output is authoritative.

The workspace's public DNS lookup for example.com returned EAI_AGAIN. Local Chromium startup failed because the workspace disallows its required socket operation. Therefore no claim of local external-network or visual-browser success is made.

## Reproducible automated checks

`npm test` tests security helpers and document processing.

`npm run test:ui` starts Chromium against an already running local shell with a controlled intercepted API fixture. It verifies the opaque srcdoc viewport, stable main URL, internal link navigation, back history, bookmarking, private tab restrictions and mobile/iPad layout overflow. These tests do not prove remote fetching; they specifically test the shell and isolation contract.

`npm run test:live` uses the real pinned Node fetcher, actual remote resources and actual server Chromium, plus the local API. It tests static HTML, CSS/images/relative links, remote JavaScript execution, a site with X-Frame-Options, private redirects, size rejection, SSRF API errors, signed resource rejection and rate limits. The live fixture is hosted on this project's Pages site. External failures are reported as failures, not silently skipped.

GitHub Actions deploys the frontend after unit and UI tests, then runs the live retrieval suite on a hosted runner. Successful tests on a GitHub runner prove that code path in that runner; they do not prove a Vercel deployment works. A production Vercel smoke test remains required.

No tested production backend URL exists at this point. Consult the linked repository Actions results for observed cloud test and Pages deployment status.
