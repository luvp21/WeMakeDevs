// Serves the built web app (site/dist, copied from frontend/dist by
// `npm run build:site`) from Lambda, behind the same HTTP API as /api/*.
// Plain JS on purpose: this function is zipped as-is, with no bundling step.
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/;

// Warm invocations reuse these, so a file is read and compressed once.
const cache = new Map();

function response(statusCode, headers, body, isBase64Encoded = false) {
  return { statusCode, headers, body, isBase64Encoded };
}

// Maps a request path to a file inside dist, or null if it can't be one.
// A path with no extension is a page of the single-page app, so it gets
// index.html and the router takes over in the browser.
export function resolveFile(rawPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath || "/");
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  let rel = path.posix.normalize(decoded);
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.posix.extname(rel) ? rel : "/index.html";
  const full = path.join(ROOT, file);
  return full.startsWith(ROOT + path.sep) ? { full, file } : null;
}

async function load(full, file, acceptsGzip) {
  const key = `${full}|${acceptsGzip}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const raw = await readFile(full);
  const contentType = CONTENT_TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream";
  const gzip = acceptsGzip && COMPRESSIBLE.test(contentType);
  const body = gzip ? gzipSync(raw) : raw;
  const headers = {
    "content-type": contentType,
    // Vite fingerprints everything under /assets/, so it can be cached for good.
    // Everything else (index.html above all) must be re-checked so a new deploy shows up.
    "cache-control": file.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    vary: "accept-encoding",
    // The private judge link puts its key in the address; never pass that on to
    // another site as a referrer.
    "referrer-policy": "no-referrer",
    ...(gzip ? { "content-encoding": "gzip" } : {}),
  };
  const entry = { headers, body: body.toString("base64") };
  cache.set(key, entry);
  return entry;
}

export async function handler(event) {
  const target = resolveFile(event.rawPath);
  if (!target) return response(404, { "content-type": "text/plain" }, "Not found");

  const acceptsGzip = /\bgzip\b/.test(event.headers?.["accept-encoding"] ?? "");
  try {
    const { headers, body } = await load(target.full, target.file, acceptsGzip);
    return response(200, headers, body, true);
  } catch (err) {
    if (err && err.code === "ENOENT") return response(404, { "content-type": "text/plain" }, "Not found");
    throw err;
  }
}
