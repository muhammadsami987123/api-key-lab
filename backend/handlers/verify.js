'use strict';

const { guard, json, readBody } = require('../lib/guard');
const { sanitizeConfig, verifyKey, listModelsOnly, ProviderError } = require('../lib/providers');

module.exports = async function handler(req, res) {
  if (!guard(req, res, { limit: 40 })) return;

  const body = await readBody(req);
  if (!body || !body.config) {
    json(res, 400, { error: 'Missing configuration.' });
    return;
  }

  let cfg;
  try {
    cfg = sanitizeConfig(body.config);
  } catch (err) {
    json(res, 400, { error: err.message, code: err.code || 'BAD_CONFIG' });
    return;
  }

  const action = body.action === 'models' ? 'models' : 'verify';

  try {
    if (action === 'models') {
      const result = await listModelsOnly(cfg);
      json(res, 200, result);
      return;
    }

    const report = await verifyKey(cfg);
    json(res, 200, report);
  } catch (err) {
    const e = err instanceof ProviderError ? err : new ProviderError(0, 'UNKNOWN', err.message);
    /* Verified reports carry their own error object; this path is for hard failures
       such as an unreachable provider *list* endpoint during a model lookup. */
    json(res, 200, {
      ok: false,
      status: 'error',
      title: e.message,
      stages: [],
      error: {
        code: e.code,
        status: e.status || null,
        title: 'Check could not run',
        message: e.message,
        hint: e.hint || '',
        fix: e.fix || '',
        docs: e.docs || ''
      }
    });
  }
};
