import test from "node:test";
import assert from "node:assert/strict";
import { publicIP, validURL, resolvePublic } from "../lib/network.js";
import { sign, verify, access, rateLimit } from "../lib/security.js";
import { processHTML, css, decode } from "../lib/render.js";
test("blocks private, reserved, mapped and special IPs", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])
    assert.equal(publicIP(ip), false, ip);
  assert.equal(publicIP("93.184.216.34"), true);
});
test("restricts schemes, credentials, ports and encoded loopback", () => {
  for (const url of [
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://user:pass@example.com",
    "http://example.com:123",
    "http://2130706433",
    "http://0x7f000001",
    "http://127.1",
    "http://[::1]",
    "http://localhost",
  ])
    assert.throws(() => validURL(url));
});
test("rejects DNS mixed public/private answers", async () => {
  await assert.rejects(
    resolvePublic("example.com", async () => [
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]),
  );
});
test("signed resources reject tampering and expiry", () => {
  const token = sign({ url: "https://example.com/a", kind: "image" });
  assert.equal(verify(token).kind, "image");
  assert.throws(() => verify(token + "bad"));
  assert.throws(() => verify(sign({ url: "https://example.com" }, -10)));
});
test("strips hostile scripts and direct navigation; rewrites relative resources", async () => {
  const r = await processHTML(
    `<html><head><title>Test</title><style>@import 'https://evil.com';a{background:url('/a.png')}</style></head><body><script>alert(1)</script><iframe src="https://evil.com"></iframe><a href="../next" onclick="alert(2)">Next</a><img src="/x.png" onerror="alert(3)"><form action="/search"><input name="q"></form><form method="post"><input type="password"></form></body></html>`,
    "https://example.com/path/index",
    "https://veil.example",
  );
  assert.match(r.html, /data-veil-url="https:\/\/example.com\/next"/);
  assert.match(r.html, /data-veil-action="https:\/\/example.com\/search"/);
  assert.doesNotMatch(r.html, /alert\(|onclick|onerror|<iframe|@import/);
  assert.match(r.html, /https:\/\/veil.example\/api\/resource/);
  assert.match(r.html, /form-action 'none'/);
  assert.equal((r.html.match(/<script/g) || []).length, 1);
});
test("CSS removes import, expression and private resource URLs", () => {
  const out = css(
    '@import "http://evil.com";a{color:red;background:url(http://127.0.0.1/x);width:expression(x)}',
    "https://example.com",
    "https://veil.example",
    "https://example.com",
  );
  assert.doesNotMatch(out, /@import|expression|127\.0\.0\.1/);
  assert.match(out, /color:red/);
});
test("encoding handles declared windows-1252", () =>
  assert.equal(
    decode(
      Buffer.from([0x63, 0x61, 0x66, 0xe9]),
      "text/html;charset=windows-1252",
    ),
    "café",
  ));
test("production fails closed without security settings", async () => {
  const old = process.env.VERCEL;
  process.env.VERCEL = "1";
  try {
    assert.throws(() => access({ headers: {} }));
    await assert.rejects(rateLimit({ headers: {} }));
  } finally {
    if (old === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = old;
  }
});

test("CSS cannot break out of style element", () => {
  const out = css(
    'a{content:"</style><a href=https://evil.com>"}',
    "https://example.com",
    "https://veil.example",
    "https://example.com",
  );
  assert.doesNotMatch(out, /<\/style|<a/);
});

test("pinned transport revalidates redirect targets before connecting", async () => {
  const https = (await import("node:https")).default;
  const { EventEmitter } = await import("node:events");
  const { secureFetch } = await import("../lib/network.js");
  const original = https.request;
  let calls = 0;
  https.request = (url, options, callback) => {
    calls++;
    assert.equal(options.autoSelectFamily, false);
    options.lookup(url.hostname, {}, (error, address) => {
      assert.equal(error, null);
      assert.equal(address, "93.184.216.34");
    });
    const request = new EventEmitter();
    request.end = () =>
      queueMicrotask(() => {
        const response = new EventEmitter();
        response.statusCode = 302;
        response.headers = { location: "http://127.0.0.1/private" };
        callback(response);
        response.emit("end");
        request.emit("close");
      });
    request.destroy = (error) => {
      request.emit("error", error);
      request.emit("close");
    };
    return request;
  };
  try {
    await assert.rejects(
      secureFetch("https://93.184.216.34/"),
      (error) => error.status === 403,
    );
    assert.equal(
      calls,
      1,
      "No request may connect to the redirected private destination",
    );
  } finally {
    https.request = original;
  }
});

test("browser sessions bind origin, client and capability type", async () => {
  const { createSession } = await import("../lib/security.js");
  const names = [
    "VEIL_GUEST_ACCESS",
    "VEIL_ACCESS_KEY",
    "VEIL_ALLOWED_ORIGINS",
  ];
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  process.env.VEIL_GUEST_ACCESS = "1";
  delete process.env.VEIL_ACCESS_KEY;
  process.env.VEIL_ALLOWED_ORIGINS = "https://veil.example";
  try {
    const request = {
      headers: { origin: "https://veil.example" },
      socket: { remoteAddress: "203.0.113.8" },
    };
    const session = createSession(request);
    access({
      ...request,
      headers: { ...request.headers, authorization: "Bearer " + session.token },
    });
    assert.throws(() =>
      access({
        ...request,
        socket: { remoteAddress: "203.0.113.9" },
        headers: {
          ...request.headers,
          authorization: "Bearer " + session.token,
        },
      }),
    );
    assert.throws(() =>
      createSession({
        ...request,
        headers: { origin: "https://evil.example" },
      }),
    );
    assert.throws(() =>
      access({
        ...request,
        headers: {
          ...request.headers,
          authorization:
            "Bearer " + sign({ kind: "image", url: "https://example.com/a" }),
        },
      }),
    );
    process.env.VEIL_ACCESS_KEY = "test-only-owner-key";
    assert.throws(() => createSession(request));
    access({
      ...request,
      headers: { authorization: "Bearer test-only-owner-key" },
    });
  } finally {
    for (const name of names)
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
  }
});
test("Marketplace Redis aliases enforce global daily quota and fail closed", async () => {
  const names = [
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ];
  const saved = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  const original = globalThis.fetch;
  process.env.KV_REST_API_URL = "https://redis.invalid";
  process.env.KV_REST_API_TOKEN = "test-only-token";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://redis.invalid/pipeline");
      const commands = JSON.parse(options.body);
      assert.equal(commands.length, 4);
      return {
        ok: true,
        json: async () => [
          { result: 1 },
          { result: 1 },
          { result: 2001 },
          { result: 1 },
        ],
      };
    };
    await assert.rejects(
      rateLimit({ headers: {}, socket: { remoteAddress: "203.0.113.8" } }),
      (error) => error.status === 429,
    );
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => [
        { result: 1 },
        { result: 1 },
        { error: "unavailable" },
        { result: 1 },
      ],
    });
    await assert.rejects(
      rateLimit({ headers: {} }),
      (error) => error.status === 503,
    );
  } finally {
    globalThis.fetch = original;
    for (const name of names)
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
  }
});

test("Bing destination links resolve safely without a JavaScript redirect", async () => {
  const { navigationURL } = await import("../lib/render.js");
  const encode = (value) =>
    "https://www.bing.com/ck/a?u=a1" + Buffer.from(value).toString("base64url");
  assert.equal(
    navigationURL(encode("https://www.w3.org/"), "https://www.bing.com/search"),
    "https://www.w3.org/",
  );
  assert.equal(
    navigationURL(
      encode("http://127.0.0.1/private"),
      "https://www.bing.com/search",
    ),
    null,
  );
  assert.equal(
    navigationURL(
      "https://other.example/ck/a?u=a1abc",
      "https://www.bing.com/search",
    ),
    "https://other.example/ck/a?u=a1abc",
  );
});
