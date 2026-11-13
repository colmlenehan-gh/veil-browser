import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import browse from "./api/browse.js";
import resource from "./api/resource.js";
const root = new URL("./public/", import.meta.url).pathname;
const server = http.createServer(async (req, res) => {
  res.status = (n) => {
    res.statusCode = n;
    return res;
  };
  res.json = (value) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(value));
  };
  res.send = (value) => res.end(value);
  const u = new URL(req.url, "http://localhost");
  req.query = Object.fromEntries(u.searchParams);
  if (u.pathname === "/api/browse") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16000) {
        res.status(413).end();
        return;
      }
    }
    try {
      req.body = JSON.parse(body || "{}");
    } catch {
      res.status(400).json({ error: "Invalid JSON" });
      return;
    }
    return browse(req, res);
  }
  if (u.pathname === "/api/resource") return resource(req, res);
  try {
    const file = path.resolve(
      root,
      "." + (u.pathname === "/" ? "/index.html" : u.pathname),
    );
    if (!file.startsWith(root)) throw 0;
    const data = await readFile(file);
    const ext = path.extname(file);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".svg": "image/svg+xml",
      }[ext] || "text/plain",
    );
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(data);
  } catch {
    res.status(404).end("Not found");
  }
});
server.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log("Veil listening on configured port"),
);
