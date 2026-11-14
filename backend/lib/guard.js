/* Shared request guards for the /api routes. */
'use strict';

const hits = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_BYTES = 256 * 1024;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // curl / server-to-server
  try {
    const host = new URL(origin).host;
    const self = req.headers['x-forwarded-host'] || req.headers.host;
    return host === self;
  } catch (e) {
    return false;
  }
}

function guard(req, res, options) {
  const opts = options || {};
  const limit = opts.limit || 40;

  if (req.method !== 'POST') {
    json(res, 405, { error: 'Use POST for this endpoint.' });
    return false;
  }

  if (!sameOrigin(req)) {
    json(res, 403, { error: 'Cross-origin requests are not allowed.' });
    return false;
  }

  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BYTES) {
    json(res, 413, { error: 'Request body is too large.' });
    return false;
  }

  const ip = clientIp(req);
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
    if (entry.count > limit) {
      res.setHeader('Retry-After', '60');
      json(res, 429, { error: 'Too many checks from this network. Try again in a minute.' });
      return false;
    }
  }

  if (hits.size > 5000) hits.clear();
  return true;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > MAX_BYTES) req.destroy();
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : null); }
      catch (e) { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

module.exports = { guard, json, readBody };
