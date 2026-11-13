import { access, rateLimit, headers } from "../lib/security.js";
import { secureFetch, VeilError } from "../lib/network.js";
import { decode, processHTML } from "../lib/render.js";
export default async function handler(req, res) {
  headers(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method !== "POST") throw new VeilError("Use POST.", 405);
    access(req);
    await rateLimit(req);
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body.url !== "string")
      throw new VeilError("A URL is required.");
    const api = process.env.VEIL_API_ORIGIN || "http://localhost:3000";
    let result;
    if (body.mode === "chromium") {
      const { remoteSnapshot } = await import("../lib/chromium.js");
      const snapshot = await remoteSnapshot(body.url);
      result = await processHTML(snapshot.html, snapshot.url, api, {
        mode: "chromium",
      });
    } else {
      const r = await secureFetch(body.url);
      if (r.status >= 400)
        throw new VeilError(`Destination returned HTTP ${r.status}.`, 502);
      const type = String(r.headers["content-type"] || "");
      if (!/text\/html|application\/xhtml\+xml/.test(type))
        throw new VeilError("This URL is not a supported HTML document.", 415);
      result = await processHTML(decode(r.body, type), r.url, api);
    }
    res.status(200).json(result);
  } catch (e) {
    res
      .status(e.status || 502)
      .json({
        error:
          e instanceof VeilError
            ? e.message
            : "The remote page could not be retrieved. It may be unavailable or block automated requests.",
      });
  }
}
