import { headers, rateLimit, createSession } from "../lib/security.js";
import { VeilError } from "../lib/network.js";
export default async function handler(req, res) {
  headers(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (req.method !== "POST") throw new VeilError("Use POST.", 405);
    const session = createSession(req);
    await rateLimit(req, "session");
    res.status(200).json(session);
  } catch (error) {
    res
      .status(error.status || 503)
      .json({
        error:
          error instanceof VeilError
            ? error.message
            : "The browser service is temporarily unavailable.",
      });
  }
}
