#!/usr/bin/env node
/**
 * API Key Lab — local development server.
 *
 * Zero dependencies. Serves the static site from `frontend/` and mounts the
 * same handlers Vercel uses (`backend/handlers/*`) behind `/api/*`, so the
 * tester and the chatbot behave exactly like production without installing
 * or running the Vercel CLI.
 *
 *   npm start            → http://localhost:3000
 *   PORT=8080 npm start  → http://localhost:8080
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const STATIC_ROOT = path.join(__dirname, 'frontend');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

const ROUTES = {
  '/api/verify': require('./backend/handlers/verify'),
  '/api/chat': require('./backend/handlers/chat')
};

const COMMON_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

function sendJson(res, status, payload) {
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0'
  }, COMMON_HEADERS));
  res.end(JSON.stringify(payload));
}

function notFound(res, pathname) {
  res.writeHead(404, Object.assign({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0'
  }, COMMON_HEADERS));
  res.end(
    '<!doctype html><meta charset="utf-8"><title>404 — API Key Lab</title>' +
    '<style>body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'max-width:44rem;margin:12vh auto;padding:0 24px;color:#0B1220}' +
    'code{background:#f1f3f7;padding:2px 6px;border-radius:6px}</style>' +
    '<h1>404 — not found</h1><p><code>' + escapeHtml(pathname) + '</code> does not exist.</p>' +
    '<p><a href="/">Back to the tester</a></p>'
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

/* Resolve a URL path to a file inside frontend/. Supports the same clean
   URLs Vercel produces, so /chat and /chat.html both work locally. */
function resolveFile(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    return null;
  }

  if (rel.endsWith('/')) rel += 'index.html';

  const candidates = [rel];
  if (!path.extname(rel)) {
    candidates.push(rel + '.html');
    candidates.push(path.posix.join(rel, 'index.html'));
  }

  for (const candidate of candidates) {
    const full = path.normalize(path.join(STATIC_ROOT, candidate));
    if (!full.startsWith(STATIC_ROOT + path.sep)) continue;
    try {
      if (fs.statSync(full).isFile()) return full;
    } catch (e) {
      /* keep trying */
    }
  }
  return null;
}

function serveStatic(req, res, pathname, startedAt) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Use GET for static files.' });
    return;
  }

  const file = resolveFile(pathname);
  if (!file) {
    notFound(res, pathname);
    return;
  }

  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = Object.assign({
    'Content-Type': type,
    /* HTML stays fresh; assets are cacheable like on Vercel. */
    'Cache-Control': type.startsWith('text/html')
      ? 'no-store, max-age=0'
      : 'public, max-age=3600, must-revalidate'
  }, COMMON_HEADERS);

  fs.stat(file, (err, stat) => {
    if (err) {
      notFound(res, pathname);
      return;
    }
    res.writeHead(200, Object.assign({ 'Content-Length': stat.size }, headers));
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(file);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
    log(req, res.statusCode, startedAt);
  });
}

function log(req, status, startedAt) {
  const ms = Date.now() - startedAt;
  const mark = status >= 500 ? '!!' : status >= 400 ? ' !' : '  ';
  process.stdout.write(
    mark + ' ' + String(status) + '  ' + (req.method || 'GET').padEnd(4) + ' ' +
    decodeURI(req.url || '/') + '  ' + ms + 'ms\n'
  );
}

const server = http.createServer((req, res) => {
  const startedAt = Date.now();
  let pathname;

  try {
    pathname = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost')).pathname;
  } catch (e) {
    sendJson(res, 400, { error: 'Malformed URL.' });
    return;
  }

  res.on('finish', () => {
    if (!res.localsLogged) {
      log(req, res.statusCode, startedAt);
      res.localsLogged = true;
    }
  });

  /* API routes — the exact handlers Vercel runs. */
  const apiPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const handler = ROUTES[apiPath];

  if (handler) {
    noStore(res);
    Object.keys(COMMON_HEADERS).forEach((key) => res.setHeader(key, COMMON_HEADERS[key]));
    Promise.resolve(handler(req, res)).catch((err) => {
      if (!res.writableEnded) {
        sendJson(res, 500, { error: 'Unexpected server error.', detail: String(err && err.message) });
      }
    });
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(res, 404, { error: 'Unknown API route. Available: /api/verify, /api/chat' });
    return;
  }

  serveStatic(req, res, pathname, startedAt);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' is already in use.');
    console.error('  Try:  PORT=8080 npm start\n');
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  API Key Lab — local server');
  console.log('  → http://localhost:' + PORT);
  console.log('');
  console.log('  Tester    http://localhost:' + PORT + '/');
  console.log('  Chatbot   http://localhost:' + PORT + '/chat');
  console.log('  API       POST /api/verify  ·  POST /api/chat');
  console.log('');
  console.log('  Ctrl+C to stop.');
  console.log('');
});
