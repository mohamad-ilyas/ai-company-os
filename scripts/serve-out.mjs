// Serves the static export the way GitHub Pages does: under a base path,
// directory URLs resolve to index.html, unknown paths get 404.html.
// Usage: node scripts/serve-out.mjs [port]   (BASE_PATH env, default /ai-company-os)
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "out");
const base = (process.env.BASE_PATH ?? "/ai-company-os").replace(/\/$/, "");
const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".png": "image/png",
};

async function resolve(path) {
  const safe = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, "");
  let file = join(root, safe);
  if (!file.startsWith(root)) return null;
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, "index.html");
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (base && url.pathname === base) {
    res.writeHead(301, { Location: `${base}/` }).end();
    return;
  }
  if (base && !url.pathname.startsWith(`${base}/`)) {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not under base path");
    return;
  }
  const rel = url.pathname.slice(base.length) || "/";
  // GitHub Pages redirects /dir to /dir/ when dir/index.html exists.
  if (!rel.endsWith("/") && !extname(rel)) {
    const asDir = await resolve(join(rel, "index.html"));
    if (asDir) {
      res.writeHead(301, { Location: `${base}${rel}/${url.search}` }).end();
      return;
    }
  }
  const file = await resolve(rel);
  if (!file) {
    const notFound = await readFile(join(root, "404.html")).catch(() => "Not found");
    res.writeHead(404, { "content-type": types[".html"] }).end(notFound);
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  res.end(await readFile(file));
}).listen(port, () => console.log(`Serving out/ at http://localhost:${port}${base}/`));
