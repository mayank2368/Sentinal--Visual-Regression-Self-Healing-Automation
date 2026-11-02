// Zero-dependency static server for the Sentinel demo app (system under test).
// The app is a tiny login + dashboard. Variants are driven entirely client-side
// via URL query params, so screenshots stay deterministic:
//   ?ui=v2   -> a visible visual change (for visual-regression detection)
//   ?dom=v2  -> changed element attributes/selectors (for self-healing)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "public");
const PORT = Number(process.env.PORT ?? 4300);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = join(PUBLIC, path);
    if (!file.startsWith(PUBLIC)) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
});

server.listen(PORT, () => console.log(`Sentinel demo app on http://localhost:${PORT}`));
