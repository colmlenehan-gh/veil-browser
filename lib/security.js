import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { VeilError } from "./network.js";
const production = () =>
  Boolean(process.env.VERCEL || process.env.NODE_ENV === "production");
const localKey = randomBytes(32).toString("hex");
function key() {
  if (production() && !process.env.VEIL_SIGNING_SECRET)
    throw new VeilError("Server signing configuration is missing.", 503);
  return process.env.VEIL_SIGNING_SECRET || localKey;
}
export function sign(payload, ttl = 300) {
  const data = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttl }),
  ).toString("base64url");
  return `${data}.${createHmac("sha256", key()).update(data).digest("base64url")}`;
}
export function verify(token) {
  try {
    if (typeof token !== "string" || token.length > 12000) throw 0;
    const [data, sig, ...extra] = token.split(".");
    const expected = createHmac("sha256", key()).update(data).digest();
    const supplied = Buffer.from(sig || "", "base64url");
    if (
      extra.length ||
      supplied.length !== expected.length ||
      !timingSafeEqual(expected, supplied)
    )
      throw 0;
    const p = JSON.parse(Buffer.from(data, "base64url"));
    if (p.exp < Math.floor(Date.now() / 1000)) throw 0;
    return p;
  } catch {
    throw new VeilError(
      "This resource link expired or is invalid. Reload the page.",
      403,
    );
  }
}
export function access(req) {
  const expected = process.env.VEIL_ACCESS_KEY;
  const value = (req.headers.authorization || "").replace(/^Bearer /, "");
  if (process.env.VEIL_GUEST_ACCESS === "1" && !expected) {
    requireOrigin(req);
    const session = verify(value);
    if (session.kind !== "session" || session.client !== clientId(req))
      throw new VeilError(
        "Your browser session expired. Reload and try again.",
        401,
      );
    return;
  }
  if (!expected) {
    if (production())
      throw new VeilError("Server access control is not configured.", 503);
    return;
  }
  const a = Buffer.from(value),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new VeilError("Enter the Veil access key in Settings.", 401);
}
export function requireOrigin(req) {
  const origins = (
    process.env.VEIL_ALLOWED_ORIGINS || "http://localhost:3000"
  ).split(",");
  if (!origins.includes(req.headers.origin))
    throw new VeilError("This browser origin is not allowed.", 403);
}
function clientId(req) {
  const ip =
    (process.env.VERCEL
      ? String(req.headers["x-vercel-forwarded-for"] || "unknown").split(",")[0]
      : req.socket?.remoteAddress) || "local";
  return createHmac("sha256", key()).update(ip).digest("hex").slice(0, 24);
}
export function createSession(req) {
  requireOrigin(req);
  if (process.env.VEIL_GUEST_ACCESS !== "1" || process.env.VEIL_ACCESS_KEY)
    throw new VeilError(
      "This service requires an access key in Settings.",
      401,
    );
  return {
    token: sign(
      {
        kind: "session",
        client: clientId(req),
        nonce: randomBytes(12).toString("hex"),
      },
      900,
    ),
    expiresIn: 900,
  };
}
const counters = new Map();
export async function rateLimit(req, kind = "page") {
  const slot = Math.floor(Date.now() / 60000);
  const id = clientId(req);
  const bucket = `veil:${kind}:${id}:${slot}`;
  const max = kind === "page" ? 20 : kind === "session" ? 5 : 200;
  const redisURL =
    process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken =
    process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const dailyBucket = `veil:daily:${Math.floor(Date.now() / 86400000)}`;
  if (redisURL && redisToken) {
    const r = await fetch(redisURL + "/pipeline", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", bucket],
        ["EXPIRE", bucket, 70],
        ["INCR", dailyBucket],
        ["EXPIRE", dailyBucket, 172800],
      ]),
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) throw new VeilError("Rate limiter unavailable.", 503);
    const data = await r.json();
    if (
      data.some((item) => item.error) ||
      typeof data[0]?.result !== "number" ||
      typeof data[2]?.result !== "number"
    )
      throw new VeilError("Rate limiter unavailable.", 503);
    if (data[2].result > 2000)
      throw new VeilError(
        "The service has reached its daily free-tier quota. Please try again tomorrow.",
        429,
      );
    if (data[0].result > max)
      throw new VeilError("Rate limit reached. Please wait one minute.", 429);
  } else {
    if (production())
      throw new VeilError("Distributed rate limiting is not configured.", 503);
    for (const [k, v] of counters) if (v.slot < slot) counters.delete(k);
    const value = counters.get(bucket) || { slot, count: 0 };
    value.count++;
    counters.set(bucket, value);
    if (value.count > max)
      throw new VeilError("Rate limit reached. Please wait one minute.", 429);
  }
}
export function headers(req, res) {
  const origins = (
    process.env.VEIL_ALLOWED_ORIGINS || "http://localhost:3000"
  ).split(",");
  const origin = req.headers.origin;
  if (origin && origins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
}
