'use strict';

const { guard, json, readBody } = require('../lib/guard');
const { sanitizeConfig, runChat, streamChat, ProviderError } = require('../lib/providers');

function cleanMessages(input) {
  if (!Array.isArray(input) || !input.length) {
    throw new ProviderError(400, 'BAD_MESSAGES', 'Send at least one message.');
  }
  return input.slice(-40).map((m) => {
    const role = m && m.role === 'assistant' ? 'assistant' : m && m.role === 'system' ? 'system' : 'user';
    const content = String((m && m.content) || '').slice(0, 8000);
    return { role, content };
  }).filter((m) => m.content.trim().length > 0);
}

module.exports = async function handler(req, res) {
  if (!guard(req, res, { limit: 60 })) return;

  const body = await readBody(req);
  if (!body || !body.config) {
    json(res, 400, { error: 'Missing configuration.' });
    return;
  }

  let cfg;
  let messages;
  try {
    cfg = sanitizeConfig(body.config);
    cfg.temperature = Math.max(0, Math.min(2, Number(body.temperature) || 0.7));
    messages = cleanMessages(body.messages);
  } catch (err) {
    json(res, 400, { error: err.message, code: err.code || 'BAD_REQUEST' });
    return;
  }

  const maxTokens = Math.max(16, Math.min(2048, Number(body.maxTokens) || 512));
  const wantsStream = body.stream !== false;

  if (!wantsStream) {
    try {
      const result = await runChat(cfg, messages, maxTokens);
      json(res, 200, {
        ok: true,
        text: result.text,
        model: result.model || cfg.model,
        usage: result.usage,
        quota: result.quota || null,
        httpStatus: result.status || 200
      });
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError(0, 'UNKNOWN', err.message);
      json(res, 200, {
        ok: false,
        error: {
          code: e.code,
          status: e.status || null,
          title: 'The model did not answer',
          message: e.message,
          hint: e.hint || '',
          fix: e.fix || ''
        }
      });
    }
    return;
  }

  /* ---- streaming ---- */
  let started = false;

  const start = () => {
    if (started || res.writableEnded) return;
    started = true;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    if (typeof res.flushHeaders === 'function') res.flushHeaders();
  };

  const write = (delta) => {
    if (res.writableEnded) return;
    start();
    try { res.write('data: ' + JSON.stringify({ delta }) + '\n\n'); } catch (e) {}
  };

  const end = () => {
    if (res.writableEnded) return;
    start();
    try {
      res.write('data: ' + JSON.stringify({ done: true, model: cfg.model }) + '\n\n');
      res.end();
    } catch (e) {}
  };

  req.on('close', () => { started = true; });

  try {
    await streamChat(cfg, messages, maxTokens, write, end);
  } catch (err) {
    const e = err instanceof ProviderError ? err : new ProviderError(0, 'UNKNOWN', err.message);
    if (!started && !res.writableEnded) {
      json(res, 200, {
        ok: false,
        error: {
          code: e.code,
          status: e.status || null,
          title: 'The model did not answer',
          message: e.message,
          hint: e.hint || '',
          fix: e.fix || ''
        }
      });
      return;
    }
    if (!res.writableEnded) {
      try {
        res.write('data: ' + JSON.stringify({
          error: {
            code: e.code,
            status: e.status || null,
            title: 'The model did not answer',
            message: e.message,
            hint: e.hint || '',
            fix: e.fix || ''
          }
        }) + '\n\n');
        res.end();
      } catch (e2) {}
    }
  }
};
