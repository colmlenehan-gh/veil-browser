import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { processHTML } from "../lib/render.js";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1360, height: 900 },
  });
  let requests = 0;
  await page.route("**/api/browse", async (route) => {
    requests++;
    const { url } = route.request().postDataJSON();
    const html = `<h1>${url.endsWith("/next") ? "Second page" : "Remote fixture"}</h1><a href="/next">Next page</a><form action="/search"><input name="q" value="test"><button>Search</button></form><script>parent.document.body.innerHTML='unsafe'</script>`;
    const result = await processHTML(html, url, "http://localhost:3000");
    await route.fulfill({ json: result });
  });
  await page.goto("http://localhost:3000");
  await page.locator("#address").fill("https://example.com");
  await page.locator("#address").press("Enter");
  const frame = page.frameLocator("#page");
  await frame.locator("h1").waitFor();
  assert.equal(await frame.locator("h1").textContent(), "Remote fixture");
  assert.equal(page.url(), "http://localhost:3000/");
  await frame.getByText("Next page", { exact: true }).click();
  try {
    await frame
      .getByText("Second page", { exact: true })
      .waitFor({ timeout: 10000 });
  } catch (e) {
    console.log(
      await page
        .locator("#page")
        .evaluate((el) => ({
          hidden: el.hidden,
          rect: el.getBoundingClientRect().toJSON(),
          style: getComputedStyle(el).cssText,
          parent: el.parentElement.getBoundingClientRect().toJSON(),
          body: document.body.getBoundingClientRect().toJSON(),
          html: document.documentElement.outerHTML.slice(0, 1500),
        })),
    );
    await page.screenshot({ path: "test-results/failure.png" });
    throw e;
  }
  assert.equal(
    await page.locator("#address").inputValue(),
    "https://example.com/next",
  );
  assert.equal(page.url(), "http://localhost:3000/");
  await page.locator("#back").click();
  await frame.getByText("Remote fixture", { exact: true }).waitFor();
  await page.locator("#bookmark").click();
  assert.match(
    await page.evaluate(() => localStorage.getItem("veil:bookmarks")),
    /example.com/,
  );
  await page.locator("#private").click();
  assert.equal(await page.locator("#privatebadge").isVisible(), true);
  await page.locator("#address").fill("https://example.com/private");
  await page.locator("#address").press("Enter");
  await frame.locator("h1").waitFor();
  assert.equal(await page.locator("#bookmark").isDisabled(), true);
  assert.doesNotMatch(
    await page.evaluate(() => localStorage.getItem("veil:bookmarks")),
    /private/,
  );
  await page.locator("#home").click();
  await page.screenshot({ path: "test-results/desktop.png" });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1180 },
  ]) {
    await page.setViewportSize(viewport);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: `test-results/${viewport.width}.png` });
  }
  assert.ok(requests >= 3);
  console.log(
    "PASS: isolated processed document, internal links, main URL stable, history, bookmarks, private tabs, mobile/tablet layout. UI test uses intercepted fixture API, not a live destination.",
  );
} finally {
  await browser.close();
}
