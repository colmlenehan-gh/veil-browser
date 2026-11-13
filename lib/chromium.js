import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";
import { secureFetch, validURL, VeilError } from "./network.js";
export async function remoteSnapshot(url, { fetcher = secureFetch } = {}) {
  validURL(url);
  const initial = await fetcher(url);
  if (
    !/text\/html|application\/xhtml\+xml/.test(
      String(initial.headers["content-type"] || ""),
    )
  )
    throw new VeilError("This URL is not a supported HTML document.", 415);
  if (initial.status >= 400)
    throw new VeilError(`Destination returned HTTP ${initial.status}.`, 502);
  const bundled =
    process.env.VERCEL || process.env.VEIL_USE_BUNDLED_CHROMIUM === "1";
  const executablePath = bundled
    ? await chromium.executablePath()
    : process.env.CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium";
  const unsafeFlags = new Set([
    "--disable-web-security",
    "--disable-site-isolation-trials",
    "--allow-running-insecure-content",
  ]);
  const launchArgs = bundled
    ? chromium.args.filter(
        (arg) =>
          !unsafeFlags.has(arg) &&
          !arg.startsWith("--disable-features=AudioServiceOutOfProcess"),
      )
    : ["--no-sandbox"];
  const browser = await playwright.launch({
    executablePath,
    headless: true,
    timeout: 10000,
    args: [
      ...launchArgs,
      "--disable-background-networking",
      "--disable-quic",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--proxy-bypass-list=<-loopback>",
    ],
    proxy: { server: "http://127.0.0.1:9" },
  });
  try {
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
      viewport: { width: 1280, height: 900 },
      javaScriptEnabled: true,
    });
    context.on("page", (page) => {
      if (context.pages().length > 1) page.close().catch(() => {});
    });
    await context.routeWebSocket("**/*", (ws) => ws.close());
    let count = 0,
      total = 0;
    const started = Date.now();
    let seeded = false;
    await context.route("**/*", async (route) => {
      const req = route.request();
      try {
        if (
          req.method() !== "GET" ||
          ++count > 60 ||
          Date.now() - started > 18000 ||
          total > 10000000
        )
          throw 0;
        validURL(req.url());
        let r;
        if (!seeded && req.isNavigationRequest()) {
          seeded = true;
          r = initial;
        } else r = await fetcher(req.url(), { limit: 1500000, timeout: 5000 });
        total += r.body.length;
        if (total > 10000000) throw 0;
        const type = String(
          r.headers["content-type"] || "application/octet-stream",
        );
        if (
          !/^(text\/|application\/(javascript|x-javascript|json)|image\/(png|jpeg|gif|webp|avif|svg\+xml)|font\/)/i.test(
            type,
          )
        )
          throw 0;
        await route.fulfill({
          status: r.status,
          headers: {
            "content-type": type,
            "access-control-allow-origin": "*",
            "x-content-type-options": "nosniff",
          },
          body: r.body,
        });
      } catch {
        await route.abort().catch(() => {});
      }
    });
    const page = await context.newPage();
    await page.goto(initial.url, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    const html = await Promise.race([
      page.content(),
      new Promise((_, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new VeilError(
                "Remote script execution exceeded the snapshot deadline.",
                504,
              ),
            ),
          3000,
        );
        timer.unref();
      }),
    ]);
    return { html, url: page.url() };
  } finally {
    await browser.close();
  }
}
