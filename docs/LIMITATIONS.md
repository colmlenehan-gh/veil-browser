# Compatibility and limitations

- This is a remote document browser with an optional JavaScript-generated DOM snapshot. It does not offer a persistent interactive browser session.
- HTML mode never executes destination JavaScript. Chromium mode executes it only remotely while generating an initial snapshot. Later clicks, dynamic controls and JavaScript-only navigation do not work unless represented as conventional links or GET forms.
- CSS imports, SVG, canvas, audio/video, WebSockets, WebRTC, service workers, downloads, uploads, POST requests, HTTP authentication, client certificates, DRM, geolocation and persistent cookies are unsupported or deliberately blocked.
- Search engines may block automated requests, present challenges, or require unsupported scripts. Engine selection is not a guarantee of reachable results.
- JavaScript-heavy applications such as maps, social feeds, webmail, editors and streaming services are not supported as interactive applications. Some initial public content may render as a snapshot.
- Remote API responses are routed through a bounded GET-only fetcher without cookies and with reduced response headers. Some CORS, module, redirect and security-policy assumptions break. This is disclosed rather than represented as transparent compatibility.
- Relative HTML/CSS/image URLs are handled. A base element is resolved then removed. srcset is removed in favour of img src. Legacy encodings are decoded, but complex content negotiation is not reproduced. CSS imports are removed rather than recursively loading unbounded trees.
- Fonts/images must pass MIME allowlists and size checks. Inline data images and SVG images are not displayed. Resources expire after five minutes; reload to refresh them. No external resource URL is intentionally sent directly to the client.
- Site X-Frame-Options does not govern a backend-retrieved srcdoc, but a destination may independently deny backend requests. No anti-bot or login bypass is supplied.
- Website appearance may change after sanitisation. Accessibility semantics are preserved where possible, not guaranteed.
- Chromium is a substantial server dependency. Its Vercel build/runtime and independent production security review remain deployment gates. Keep the binary and Node dependencies patched. Browser process compromise is beyond what HTML sanitisation can prevent.
- The shared-key preview is not ready for anonymous public proxy operation. Distributed rate limits must be configured; they alone do not cap a coordinated distributed attack. Use platform quotas, rotate credentials and monitor usage without adding browsing-history logs.
