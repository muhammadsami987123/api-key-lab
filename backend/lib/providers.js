/* ============================================================
   API Key Lab — server-side provider adapters
   Stateless. No key is ever written to disk, logged or cached.
   ============================================================ */
'use strict';

const crypto = require('crypto');

const TIMEOUT_MS = 20000;
const TEST_PROMPT = 'Reply with exactly: OK';
const TEST_MAX_TOKENS = 24;

const PROVIDERS = {
  openai: {
    name: 'OpenAI', base: 'https://api.openai.com/v1', kind: 'openai',
    defaultModel: 'gpt-4o-mini', docs: 'https://platform.openai.com/docs/models'
  },
  groq: {
    name: 'Groq', base: 'https://api.groq.com/openai/v1', kind: 'openai',
    defaultModel: 'llama-3.1-8b-instant', docs: 'https://console.groq.com/docs/models'
  },
  mistral: {
    name: 'Mistral AI', base: 'https://api.mistral.ai/v1', kind: 'openai',
    defaultModel: 'mistral-small-latest', docs: 'https://docs.mistral.ai/getting-started/models/'
  },
  openrouter: {
    name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', kind: 'openai',
    defaultModel: 'openai/gpt-4o-mini', docs: 'https://openrouter.ai/docs'
  },
  xai: {
    name: 'xAI (Grok)', base: 'https://api.x.ai/v1', kind: 'openai',
    defaultModel: 'grok-2-latest', docs: 'https://docs.x.ai/docs/models'
  },
  deepseek: {
    name: 'DeepSeek', base: 'https://api.deepseek.com/v1', kind: 'openai',
    defaultModel: 'deepseek-chat', docs: 'https://api-docs.deepseek.com/quick_start/pricing'
  },
  together: {
    name: 'Together AI', base: 'https://api.together.xyz/v1', kind: 'openai',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', docs: 'https://docs.together.ai/docs/serverless-models'
  },
  perplexity: {
    name: 'Perplexity', base: 'https://api.perplexity.ai', kind: 'openai', noModels: true,
    defaultModel: 'sonar', docs: 'https://docs.perplexity.ai/getting-started/models'
  },
  anthropic: {
    name: 'Anthropic', base: 'https://api.anthropic.com/v1', kind: 'anthropic',
    defaultModel: 'claude-3-5-haiku-latest', docs: 'https://docs.anthropic.com/en/docs/about-claude/models'
  },
  gemini: {
    name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', kind: 'gemini',
    defaultModel: 'gemini-2.0-flash', docs: 'https://ai.google.dev/gemini-api/docs/models'
  },
  azure: {
    name: 'Azure OpenAI', kind: 'azure', noModels: true,
    defaultModel: '', docs: 'https://learn.microsoft.com/azure/ai-services/openai/'
  },
  bedrock: {
    name: 'AWS Bedrock', kind: 'bedrock',
    defaultModel: 'anthropic.claude-3-5-haiku-20241022-v1:0', noModels: true,
    docs: 'https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html'
  },
  vertex: {
    name: 'Google Vertex AI', kind: 'vertex', noModels: true,
    defaultModel: 'gemini-2.0-flash', docs: 'https://cloud.google.com/vertex-ai/generative-ai/docs/models'
  },
  custom: {
    name: 'Custom', kind: 'openai', defaultModel: '', docs: ''
  }
};

class ProviderError extends Error {
  constructor(status, code, message, hint, fix, docs) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.fix = fix;
    this.docs = docs;
  }
}

/* ---------------- helpers ---------------- */

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

function isPrivateHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h === '[::1]' || h === '0.0.0.0') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m = h.match(/^172\.(\d{1,3})\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (/^\[?f[cd][0-9a-f]{2}:/i.test(h)) return true;
  return false;
}

function normalizeBase(raw, providerId) {
  const p = PROVIDERS[providerId];
  let base = (raw || (p && p.base) || '').trim().replace(/\/+$/, '');
  if (!base) throw new ProviderError(400, 'MISSING_BASE_URL', 'This provider needs a base URL.');

  let url;
  try { url = new URL(base); }
  catch (e) { throw new ProviderError(400, 'BAD_BASE_URL', 'That base URL is not valid.'); }

  if (url.protocol !== 'https:') {
    throw new ProviderError(400, 'INSECURE_BASE_URL', 'Base URLs must use https://');
  }
  if (isPrivateHost(url.hostname)) {
    throw new ProviderError(400, 'PRIVATE_HOST', 'Private and local hosts cannot be reached from the proxy.',
      'Local endpoints must be tested directly from your browser.');
  }
  return base;
}

async function request(url, options) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new ProviderError(0, 'TIMEOUT', 'The provider did not answer in 20 seconds.',
        'Their API may be slow or unreachable right now.');
    }
    throw new ProviderError(0, 'NETWORK', 'Could not reach the provider.',
      'DNS or network failure on our side. Try again in a moment.');
  }

  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch (e) { body = null; }
  return { res, text, body };
}

function openAiHeaders(apiKey, providerId) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + apiKey
  };
  if (providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://apikeylab.vercel.app';
    headers['X-Title'] = 'API Key Lab';
  }
  return headers;
}

/* ---------------- error mapping ---------------- */

function mapError(providerId, status, body, rawText) {
  const p = PROVIDERS[providerId] || {};
  const docs = p.docs || '';
  const raw = rawText || '';
  const message =
    (body && body.error && (body.error.message || body.error)) ||
    (body && body.message) ||
    (body && Array.isArray(body) && body[0] && body[0].error && body[0].error.message) ||
    (typeof raw === 'string' && raw.slice(0, 300)) ||
    'Unknown provider error';

  const text = String(typeof message === 'string' ? message : JSON.stringify(message)).toLowerCase();
  const code = (body && body.error && body.error.code) || (body && body.error && body.error.type) || '';

  if (status === 401) {
    return new ProviderError(status, 'INVALID_KEY', 'The provider rejected this key.',
      'Invalid, revoked, or copied with an extra space or quote.',
      'Regenerate the key in your provider dashboard and paste it again.',
      docs);
  }
  if (/api[_ ]?key[_ ]?(not valid|invalid)|invalid api key|incorrect api key/.test(text)) {
    return new ProviderError(status, 'INVALID_KEY', 'The provider rejected this key.',
      'The key is not valid for this API.',
      'Regenerate the key in your provider dashboard and paste it again.',
      docs);
  }
  if (status === 402 || String(code).includes('insufficient_quota') || text.includes('insufficient_quota') || text.includes('exceeded your current quota')) {
    return new ProviderError(status, 'NO_CREDIT', 'The key is valid but the account has no credit.',
      'Billing is not set up, the balance is empty, or the spending limit is reached.',
      'Add credit or raise the usage limit in the provider dashboard, then retry.',
      docs);
  }
  if (status === 403) {
    if (/region|country|location|not available/.test(text)) {
      return new ProviderError(status, 'REGION', 'This model or account is not available in your region.',
        'The key itself is fine — the provider blocks the request by geography.',
        'Use a supported region or a different provider.', docs);
    }
    if (/model|permission|access|scope/.test(text)) {
      return new ProviderError(status, 'NO_ACCESS', 'The key works but has no access to this model.',
        'Model access was not granted to this key or project.',
        'Enable the model in the provider console, or pick another model from the list.', docs);
    }
    return new ProviderError(status, 'FORBIDDEN', 'The provider refused the request.',
      'Permission problem on the key or organisation.',
      'Check key permissions and organisation settings.', docs);
  }
  if (status === 404) {
    if (/model/.test(text)) {
      return new ProviderError(status, 'MODEL_NOT_FOUND', 'That model does not exist for this key.',
        'The model id may be renamed, deprecated, or region-specific.',
        'Pick a model from the fetched list instead of typing it.', docs);
    }
    return new ProviderError(status, 'NOT_FOUND', 'The endpoint was not found.',
      'The base URL or API version is probably wrong.', 'Double-check the base URL (it usually ends with /v1).', docs);
  }
  if (status === 429) {
    const retry = /try again in ([\d.]+)\s*s/i.exec(String(message));
    return new ProviderError(status, 'RATE_LIMIT', 'Rate limit or quota exhausted.',
      retry ? 'Retry after ' + retry[1] + ' seconds.' : 'Too many requests, or the daily/monthly quota is used up.',
      'Wait and retry, or check usage and limits in the provider dashboard.', docs);
  }
  if (status === 400) {
    if (/model/.test(text)) {
      return new ProviderError(status, 'BAD_MODEL', 'The request was rejected because of the model.',
        message,
        'Pick a model that this key can actually use.', docs);
    }
    return new ProviderError(status, 'BAD_REQUEST', 'The provider rejected the request.',
      message, 'Check the model id and request parameters.', docs);
  }
  if (status >= 500) {
    return new ProviderError(status, 'PROVIDER_DOWN', 'The provider had an internal error.',
      'This is on their side, not your key.', 'Wait a minute and run the check again.', docs);
  }
  return new ProviderError(status, 'UNKNOWN', 'The provider returned HTTP ' + status + '.',
    message, 'Check the raw response below.', docs);
}

/* ---------------- model ranking ---------------- */

function bestModel(models) {
  if (!models || !models.length) return '';
  const blocked = /(embed|embedding|tts|whisper|transcri|audio|image|dall-e|moderation|rerank|guard|realtime|vision-preview|search-preview)/i;
  const cheap = /(mini|flash|haiku|small|instant|lite|nano|8b|7b|3b|1b)/i;
  const heavy = /(opus|pro|large|ultra|405b|70b|72b|o1|o3|reason)/i;

  const scored = models
    .filter((m) => typeof m === 'string' && m && !blocked.test(m))
    .map((m) => {
      let s = 50;
      if (cheap.test(m)) s += 22;
      if (heavy.test(m)) s -= 18;
      if (/^gpt-4o-mini/i.test(m)) s += 10;
      if (/gemini-2\.0-flash/i.test(m)) s += 8;
      if (/claude-3-5-haiku/i.test(m)) s += 8;
      if (/latest/i.test(m)) s += 3;
      if (/preview|experimental|beta/i.test(m)) s -= 6;
      return { m, s };
    })
    .sort((a, b) => b.s - a.s);

  return scored.length ? scored[0].m : models[0];
}

/* ---------------- auth / models ---------------- */

async function fetchModels(cfg) {
  const id = cfg.provider;
  const p = PROVIDERS[id];
  if (!p) throw new ProviderError(400, 'UNKNOWN_PROVIDER', 'Unknown provider.');

  if (p.kind === 'openai') {
    const base = normalizeBase(cfg.baseUrl, id);
    const { res, body, text } = await request(base + '/models', {
      headers: openAiHeaders(cfg.apiKey, id)
    });
    if (!res.ok) throw mapError(id, res.status, body, text);
    const list = (body && (body.data || body.models)) || [];
    return list.map((m) => m.id || m.name).filter(Boolean);
  }

  if (p.kind === 'anthropic') {
    const { res, body, text } = await request('https://api.anthropic.com/v1/models?limit=100', {
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
    if (!res.ok) throw mapError(id, res.status, body, text);
    return ((body && body.data) || []).map((m) => m.id).filter(Boolean);
  }

  if (p.kind === 'gemini') {
    const key = encodeURIComponent(cfg.apiKey);
    const { res, body, text } = await request(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${key}`,
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (!res.ok) throw mapError(id, res.status, body, text);
    return ((body && body.models) || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter(Boolean);
  }

  return [];
}

/* ---------------- chat ---------------- */

function buildChatRequest(cfg, messages, maxTokens) {
  const id = cfg.provider;
  const p = PROVIDERS[id];
  if (!p) throw new ProviderError(400, 'UNKNOWN_PROVIDER', 'Unknown provider.');

  if (p.kind === 'openai') {
    const base = normalizeBase(cfg.baseUrl, id);
    return {
      url: base + '/chat/completions',
      headers: openAiHeaders(cfg.apiKey, id),
      body: { model: cfg.model, messages, max_tokens: maxTokens, temperature: cfg.temperature }
    };
  }

  if (p.kind === 'anthropic') {
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: {
        model: cfg.model,
        max_tokens: maxTokens,
        temperature: cfg.temperature,
        system: cfg.system || undefined,
        messages: messages.filter((m) => m.role !== 'system')
      }
    };
  }

  if (p.kind === 'gemini' || p.kind === 'vertex') {
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: cfg.temperature
      }
    };
    if (p.kind === 'gemini') {
      const model = String(cfg.model || p.defaultModel).replace(/^models\//, '');
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
        headers: { 'Content-Type': 'application/json' },
        body,
        model
      };
    }
    return { url: '', headers: {}, body, pending: 'vertex' };
  }

  if (p.kind === 'azure') {
    const base = normalizeBase(cfg.baseUrl, id);
    const version = cfg.apiVersion || '2024-08-01-preview';
    return {
      url: `${base}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${encodeURIComponent(version)}`,
      headers: { 'Content-Type': 'application/json', 'api-key': cfg.apiKey },
      body: { messages, max_tokens: maxTokens, temperature: cfg.temperature }
    };
  }

  if (p.kind === 'bedrock') {
    const region = cfg.region || 'us-east-1';
    const body = JSON.stringify({
      messages: messages.filter((m) => m.role !== 'system').map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: [{ text: m.content }]
      })),
      inferenceConfig: { maxTokens, temperature: cfg.temperature }
    });
    return { bedrock: { region, body }, body, headers: {}, model: cfg.model, pending: 'bedrock' };
  }

  throw new ProviderError(400, 'UNSUPPORTED', 'This provider is not supported by the proxy.');
}

async function runChat(cfg, messages, maxTokens) {
  const req = buildChatRequest(cfg, messages, maxTokens);
  const id = cfg.provider;

  if (req.bedrock) {
    const { region, body } = req.bedrock;
    const host = `bedrock-runtime.${region}.amazonaws.com`;
    const path = `/model/${encodeURIComponent(cfg.model)}/converse`;
    const headers = awsSign({
      accessKeyId: cfg.apiKey,
      secretAccessKey: cfg.secret,
      region, service: 'bedrock',
      host, path, body, method: 'POST'
    });
    const { res, body: data, text } = await request(`https://${host}${path}`, { method: 'POST', headers, body });
    if (!res.ok) throw mapError(id, res.status, data, text);
    const blocks = (data && data.output && data.output.message && data.output.message.content) || [];
    return {
      text: blocks.map((b) => b.text || '').join(''),
      usage: {
        prompt: (data && data.usage && data.usage.inputTokens) || 0,
        completion: (data && data.usage && data.usage.outputTokens) || 0,
        total: ((data && data.usage && data.usage.inputTokens) || 0) + ((data && data.usage && data.usage.outputTokens) || 0)
      },
      model: cfg.model,
      status: 200
    };
  }

  if (req.pending === 'vertex') {    const token = await vertexToken(cfg.serviceAccount);
    const location = cfg.location || 'us-central1';
    const model = String(cfg.model || 'gemini-2.0-flash').replace(/^models\//, '');
    const project = token.projectId;
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
    const { res, body: data, text } = await request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token.accessToken },
      body: JSON.stringify(req.body)
    });
    if (!res.ok) throw mapError(id, res.status, data, text);
    const candidate = data && data.candidates && data.candidates[0];
    return {
      text: candidate && candidate.content && candidate.content.parts
        ? candidate.content.parts.map((x) => x.text || '').join('') : '',
      usage: {
        prompt: (data && data.usageMetadata && data.usageMetadata.promptTokenCount) || 0,
        completion: (data && data.usageMetadata && data.usageMetadata.candidatesTokenCount) || 0,
        total: (data && data.usageMetadata && data.usageMetadata.totalTokenCount) || 0
      },
      model,
      status: 200
    };
  }

  const { res, body, text } = await request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(req.body)
  });

  if (!res.ok) {
    const mapped = mapError(id, res.status, body, text);
    mapped.quota = readQuota(res.headers);
    throw mapped;
  }

  return { ...parseChat(id, body), quota: readQuota(res.headers), status: res.status };
}

function parseChat(providerId, data) {
  const kind = PROVIDERS[providerId] ? PROVIDERS[providerId].kind : 'openai';

  if (kind === 'anthropic') {
    return {
      text: ((data && data.content) || []).map((c) => c.text || '').join(''),
      usage: {
        prompt: (data && data.usage && data.usage.input_tokens) || 0,
        completion: (data && data.usage && data.usage.output_tokens) || 0,
        total: ((data && data.usage && data.usage.input_tokens) || 0) + ((data && data.usage && data.usage.output_tokens) || 0)
      },
      model: (data && data.model) || ''
    };
  }

  if (kind === 'gemini' || kind === 'vertex') {
    const candidate = data && data.candidates && data.candidates[0];
    return {
      text: candidate && candidate.content && candidate.content.parts
        ? candidate.content.parts.map((x) => x.text || '').join('') : '',
      usage: {
        prompt: (data && data.usageMetadata && data.usageMetadata.promptTokenCount) || 0,
        completion: (data && data.usageMetadata && data.usageMetadata.candidatesTokenCount) || 0,
        total: (data && data.usageMetadata && data.usageMetadata.totalTokenCount) || 0
      },
      model: (data && data.modelVersion) || ''
    };
  }

  const choice = data && data.choices && data.choices[0];
  return {
    text: (choice && choice.message && choice.message.content) || '',
    usage: {
      prompt: (data && data.usage && data.usage.prompt_tokens) || 0,
      completion: (data && data.usage && data.usage.completion_tokens) || 0,
      total: (data && data.usage && data.usage.total_tokens) || 0
    },
    model: (data && data.model) || ''
  };
}

function readQuota(headers) {
  if (!headers) return null;
  const get = (k) => (typeof headers.get === 'function' ? headers.get(k) : null);
  const remainingRequests = get('x-ratelimit-remaining-requests') || get('anthropic-ratelimit-requests-remaining');
  const remainingTokens = get('x-ratelimit-remaining-tokens') || get('anthropic-ratelimit-tokens-remaining');
  const reset = get('x-ratelimit-reset-requests') || get('anthropic-ratelimit-requests-reset');
  if (!remainingRequests && !remainingTokens && !reset) return null;
  return { remainingRequests, remainingTokens, reset };
}

/* ---------------- AWS SigV4 + Vertex JWT ---------------- */

function awsSign({ accessKeyId, secretAccessKey, region, service, host, path, body, method }) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);

  const canonicalHeaders =
    `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-date';
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

  let signingKey = hmac('AWS4' + secretAccessKey, dateStamp);
  signingKey = hmac(signingKey, region);
  signingKey = hmac(signingKey, service);
  signingKey = hmac(signingKey, 'aws4_request');

  const signature = hmac(signingKey, stringToSign).toString('hex');
  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    'Content-Type': 'application/json',
    Host: host,
    'X-Amz-Date': amzDate,
    Authorization: authorization
  };
}

const tokenCache = new Map();

async function vertexToken(rawJson) {
  let sa;
  try { sa = JSON.parse(rawJson); }
  catch (e) { throw new ProviderError(400, 'BAD_JSON', 'The service-account JSON could not be parsed.'); }

  if (!sa.client_email || !sa.private_key) {
    throw new ProviderError(400, 'BAD_JSON', 'The JSON is not a service-account key.',
      'It must contain client_email and private_key.');
  }

  const cacheKey = sha256(sa.client_email + sa.private_key.slice(-40));
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expires > Date.now() + 60000) {
    return { accessToken: cached.token, projectId: sa.project_id };
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  let signature;
  try {
    signature = crypto.createSign('RSA-SHA256').update(`${header}.${claim}`).sign(sa.private_key, 'base64url');
  } catch (e) {
    throw new ProviderError(400, 'BAD_KEY', 'The private key in the JSON could not be used.',
      'Make sure you downloaded a JSON key (not P12) and it is not expired.');
  }

  const assertion = `${header}.${claim}.${signature}`;
  const { res, body, text } = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${encodeURIComponent(assertion)}`
  });

  if (!res.ok) {
    const mapped = mapError('vertex', res.status, body, text);
    mapped.title = 'Google rejected the service account';
    mapped.fix = 'Check that the key is active, the service account has Vertex AI access and the project has the API enabled.';
    throw mapped;
  }

  tokenCache.set(cacheKey, { token: body.access_token, expires: Date.now() + (body.expires_in || 3600) * 1000 });
  return { accessToken: body.access_token, projectId: sa.project_id };
}

/* ---------------- public API ---------------- */

function sanitizeConfig(input) {
  if (!input || typeof input !== 'object') {
    throw new ProviderError(400, 'BAD_CONFIG', 'Missing request configuration.');
  }
  const provider = String(input.provider || '');
  if (!PROVIDERS[provider] && provider !== 'ollama') {
    throw new ProviderError(400, 'UNKNOWN_PROVIDER', 'That provider is not supported.');
  }
  const clean = {
    provider,
    apiKey: String(input.apiKey || '').slice(0, 20000),
    baseUrl: String(input.baseUrl || '').slice(0, 400),
    model: String(input.model || '').slice(0, 200),
    secret: String(input.secret || '').slice(0, 400),
    region: String(input.region || 'us-east-1').slice(0, 40),
    deployment: String(input.deployment || '').slice(0, 120),
    apiVersion: String(input.apiVersion || '').slice(0, 40),
    location: String(input.location || 'us-central1').slice(0, 40),
    serviceAccount: String(input.serviceAccount || '').slice(0, 12000),
    temperature: 0
  };

  const meta = PROVIDERS[provider];
  if (provider === 'ollama') {
    throw new ProviderError(400, 'LOCAL_PROVIDER', 'Local providers run from your browser, not the proxy.');
  }
  if (!meta.noModels && meta.kind !== 'vertex' && meta.kind !== 'bedrock' && !clean.apiKey) {
    throw new ProviderError(400, 'MISSING_KEY', 'Enter your API key first.');
  }
  if (meta.kind === 'bedrock' && (!clean.apiKey || !clean.secret)) {
    throw new ProviderError(400, 'MISSING_KEY', 'AWS Bedrock needs both the access key ID and the secret access key.');
  }
  if (meta.kind === 'vertex' && !clean.serviceAccount) {
    throw new ProviderError(400, 'MISSING_KEY', 'Vertex AI needs a service-account JSON key.');
  }
  if (provider === 'azure' && !clean.deployment) {
    throw new ProviderError(400, 'MISSING_KEY', 'Azure OpenAI needs the deployment name.');
  }
  if (!clean.model && meta.defaultModel) clean.model = meta.defaultModel;
  return clean;
}

async function verifyKey(cfg) {
  const meta = PROVIDERS[cfg.provider];
  const started = Date.now();
  const stages = [];
  let models = [];
  let suggested = cfg.model || meta.defaultModel || '';

  const finish = (extra) => ({
    checkedAt: new Date().toISOString(),
    provider: cfg.provider,
    providerName: meta.name,
    model: suggested,
    stages,
    models,
    suggestedModel: suggested,
    docs: meta.docs,
    ...extra
  });

  /* Stage 1 + 2: auth + models (where the provider exposes them) */
  if (!meta.noModels) {
    const authStart = Date.now();
    try {
      models = await fetchModels(cfg);
      suggested = cfg.model || bestModel(models) || meta.defaultModel;
      stages.push({
        id: 'auth', label: 'Authenticating key', status: 'ok',
        ms: Date.now() - authStart,
        detail: 'Credentials accepted by ' + meta.name
      });
      stages.push({
        id: 'models', label: 'Listing models', status: 'ok',
        ms: 0,
        detail: models.length + ' model(s) available to this key'
      });
    } catch (err) {
      const e = err instanceof ProviderError ? err : new ProviderError(0, 'UNKNOWN', err.message);
      stages.push({
        id: 'auth', label: 'Authenticating key', status: 'fail',
        ms: Date.now() - authStart,
        detail: e.code === 'INVALID_KEY' ? 'Key rejected' : e.message
      });
      stages.push({ id: 'models', label: 'Listing models', status: 'skipped', ms: 0, detail: 'Skipped' });
      return finish({
        ok: false,
        status: 'invalid',
        httpStatus: e.status || null,
        title: e.code === 'INVALID_KEY' ? 'This key is not valid' : e.code === 'NO_CREDIT' ? 'Valid key, no credit' : 'The key could not be verified',
        subtitle: 'Authenticating the key failed, so the live completion was not attempted.',
        error: toError(e),
        latencyMs: null,
        raw: null
      });
    }
  } else {
    stages.push({
      id: 'auth', label: 'Authenticating key', status: 'skipped', ms: 0,
      detail: meta.name + ' has no key-info endpoint — verified by a real request'
    });
    stages.push({
      id: 'models', label: 'Listing models', status: 'skipped', ms: 0,
      detail: 'Not offered by this provider'
    });
  }

  /* Stage 3: live completion */
  const chatStart = Date.now();
  const messages = [{ role: 'user', content: TEST_PROMPT }];

  try {
    let result = await runChat(cfg, messages, TEST_MAX_TOKENS);

    if (!result.text && models.length) {
      // Some gateways return an empty body for a restricted model; try the best available one.
      const retryModel = models.find((m) => m !== suggested);
      if (retryModel) {
        cfg.model = retryModel;
        suggested = retryModel;
        result = await runChat(cfg, messages, TEST_MAX_TOKENS);
      }
    }

    stages.push({
      id: 'completion', label: 'Sending test completion', status: 'ok',
      ms: Date.now() - chatStart,
      detail: 'Model generated ' + (result.text || '').length + ' characters'
    });

    return finish({
      ok: true,
      status: 'valid',
      httpStatus: result.status || 200,
      title: 'Key is valid and generating',
      subtitle: 'Authenticated, models listed and a live completion came back.',
      latencyMs: Date.now() - chatStart,
      usage: result.usage,
      quota: result.quota || null,
      preview: (result.text || '').slice(0, 400),
      model: result.model || suggested,
      raw: null,
      notice: suggested ? null : 'No model id was supplied — the provider chose its default.'
    });
  } catch (err) {
    let e = err instanceof ProviderError ? err : new ProviderError(0, 'UNKNOWN', err.message);

    /* auto-retry once with another model when the picked one is unavailable */
    if ((e.code === 'MODEL_NOT_FOUND' || e.code === 'NO_ACCESS' || e.code === 'BAD_MODEL') && models.length > 1) {
      const retryModel = models.find((m) => m !== suggested);
      if (retryModel) {
        const retryStart = Date.now();
        try {
          cfg.model = retryModel;
          const result = await runChat(cfg, messages, TEST_MAX_TOKENS);
          stages.push({
            id: 'completion', label: 'Sending test completion', status: 'ok',
            ms: Date.now() - retryStart,
            detail: 'Fell back to ' + retryModel + ' — generated ' + (result.text || '').length + ' characters'
          });
          return finish({
            ok: true,
            status: 'warning',
            httpStatus: result.status || 200,
            title: 'Working — but the first model was unavailable',
            subtitle: 'We switched to ' + retryModel + '. Update your default model id.',
            latencyMs: Date.now() - retryStart,
            usage: result.usage,
            quota: result.quota || null,
            preview: (result.text || '').slice(0, 400),
            model: retryModel,
            error: {
              title: 'First model was not available',
              message: e.message,
              hint: 'The key is fine; the model id was rejected.',
              fix: 'Use ' + retryModel + ' (or another model from the list) as your default.',
              code: e.code,
              docs: meta.docs
            }
          });
        } catch (e2) {
          e = e2 instanceof ProviderError ? e2 : e;
        }
      }
    }

    stages.push({
      id: 'completion', label: 'Sending test completion', status: 'fail',
      ms: Date.now() - chatStart,
      detail: e.code === 'NO_CREDIT' ? 'No credit on the account' : e.message.slice(0, 120)
    });

    const warning = e.code === 'RATE_LIMIT';
    return finish({
      ok: false,
      status: warning ? 'warning' : 'invalid',
      httpStatus: e.status || null,
      title: e.code === 'NO_CREDIT' ? 'Key works, but the account is out of credit'
        : warning ? 'Key works, but it is rate limited'
          : 'The live completion failed',
      subtitle: warning
        ? 'The key authenticated, but the provider is throttling requests right now.'
        : 'Authentication passed — the generation request is what failed.',
      latencyMs: Date.now() - chatStart,
      error: toError(e),
      quota: e.quota || null,
      raw: null
    });
  }
}

function toError(e) {
  return {
    code: e.code || 'UNKNOWN',
    status: e.status || null,
    title: e.code === 'INVALID_KEY' ? 'Invalid or revoked key'
      : e.code === 'NO_CREDIT' ? 'No credit on this account'
        : e.code === 'RATE_LIMIT' ? 'Rate limited'
          : e.code === 'NO_ACCESS' ? 'Model access not granted'
            : e.code === 'MODEL_NOT_FOUND' ? 'Model not found'
              : 'Request failed',
    message: e.message,
    hint: e.hint || '',
    fix: e.fix || '',
    docs: e.docs || ''
  };
}

async function listModelsOnly(cfg) {
  const meta = PROVIDERS[cfg.provider];
  const models = await fetchModels(cfg);
  return {
    ok: true,
    provider: cfg.provider,
    providerName: meta.name,
    models,
    suggestedModel: bestModel(models),
    docs: meta.docs
  };
}

/* ---------------- streaming chat ---------------- */

async function streamChat(cfg, messages, maxTokens, write, end) {
  const req = buildChatRequest(cfg, messages, maxTokens);
  const id = cfg.provider;

  const streamBody = (() => {
    if (req.body && typeof req.body === 'object') {
      const copy = { ...req.body, stream: true };
      if (id === 'openai' || id === 'azure') {
        copy.stream_options = { include_usage: true };
      }
      return JSON.stringify(copy);
    }
    return req.body;
  })();

  if (req.pending === 'vertex') {
    const token = await vertexToken(cfg.serviceAccount);
    const location = cfg.location || 'us-central1';
    const model = String(cfg.model || 'gemini-2.0-flash').replace(/^models\//, '');
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${token.projectId}/locations/${location}/publishers/google/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
    const body = { ...req.body };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token.accessToken },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) {}
      throw mapError(id, res.status, parsed, text);
    }
    await pumpSse(res, 'gemini', write, end);
    return;
  }

  if (req.pending === 'bedrock') {
    const e = new ProviderError(400, 'NO_STREAM', 'Streaming is not supported for AWS Bedrock on this deployment.');
    throw e;
  }

  if (PROVIDERS[id] && PROVIDERS[id].kind === 'gemini') {
    req.url = req.url.replace(':generateContent?', ':streamGenerateContent?alt=sse&');
    const res = await fetch(req.url, {
      method: 'POST',
      headers: req.headers,
      body: JSON.stringify({ ...req.body, generationConfig: { ...(req.body.generationConfig || {}), maxOutputTokens: maxTokens } }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) {
      const text = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) {}
      throw mapError(id, res.status, parsed, text);
    }
    await pumpSse(res, 'gemini', write, end);
    return;
  }

  const { res, body, text } = await request(req.url, {
    method: 'POST',
    headers: { ...req.headers, Accept: 'text/event-stream' },
    body: streamBody
  });

  if (!res.ok) {
    throw mapError(id, res.status, body, text);
  }

  const kind = PROVIDERS[id] ? PROVIDERS[id].kind : 'openai';
  await pumpSse(res, kind, write, end);
}

async function pumpSse(res, kind, write, end) {
  if (!res.body) {
    end();
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        let json;
        try { json = JSON.parse(payload); } catch (e) { continue; }
        const delta = extractDelta(kind, json);
        if (delta) write(delta);
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (e) {}
    end();
  }
}

function extractDelta(kind, json) {
  if (kind === 'anthropic') {
    if (json.type === 'content_block_delta' && json.delta) return json.delta.text || '';
    return '';
  }
  if (kind === 'gemini') {
    const parts = json.candidates && json.candidates[0] && json.candidates[0].content
      && json.candidates[0].content.parts;
    return parts ? parts.map((p) => p.text || '').join('') : '';
  }
  const choice = json.choices && json.choices[0];
  return (choice && choice.delta && choice.delta.content) || '';
}

module.exports = {
  PROVIDERS,
  ProviderError,
  sanitizeConfig,
  verifyKey,
  listModelsOnly,
  runChat,
  streamChat,
  bestModel
};
