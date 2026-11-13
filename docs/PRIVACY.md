# Veil Browser privacy policy

Preview policy, 13 November 2026.

Veil retrieves webpages and supported resources remotely. Requested URLs and responses are processed by the backend and its hosting provider. Destination sites see requests from the backend and may log them. Your network and frontend host can observe that you connect to Veil. This is not an anonymity service or a VPN.

The application does not write browsing-history records or destination request logs. Hosting providers can still retain request metadata, including IP addresses and URLs, under their own policies. Signed resource URLs encode a destination URL and are visible to the hosting provider; the signature prevents modification, not reading. Do not use the preview for confidential destinations or queries.

Normal and private tabs, URLs, document snapshots, navigation history and access keys are held in current page memory. Closing a tab removes it from application state; reloading clears open tabs. There is no server-side private history store. Private mode cannot prevent provider logging, destination logging, operating-system snapshots or browser-level page title handling.

Bookmarks and rendering/search/backend preferences are stored in this browser's localStorage. Private tabs cannot save bookmarks. Remove bookmarks within Veil, or clear site data to delete all stored preferences and bookmarks. The application has no accounts or synchronisation service and does not use Supabase.

Public previews issue short-lived browser-session tokens bound to the allowed frontend origin and a keyed IP pseudonym. Tokens remain only in current page memory. No user account or persistent identifier is created.

Rate limiting stores an anonymous global daily count and a keyed pseudonymous IP bucket with a roughly 70-second expiry. It does not contain browsing history. Redis and hosting providers may separately process connection metadata.

No advertising trackers or third-party analytics are included. There are no external fonts. Remote pages and their scripts, when run in server Chromium, may contact advertising/tracking domains from the backend. Veil is not a content-blocking guarantee. Scripts never execute within the user's retrieved-document viewport; only Veil's constrained navigation bridge does.

The preview does not support passwords, payment transactions, accounts on destination sites, file uploads or sensitive form submissions. GET query values are visible as requested URLs. Access keys are sent only to the configured backend; only configure origins you trust.

Before offering this to a broad public audience, the operator must publish their identity, contact information, applicable legal bases and hosting arrangements, retention rules and a procedure for privacy requests. This development policy is not evidence that a production service has launched.
