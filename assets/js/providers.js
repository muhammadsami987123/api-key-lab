/* ============================================================
   API Key Lab — provider registry + key detection (client)
   ============================================================ */
(function (global) {
  'use strict';

  var PROVIDERS = {
    openai: {
      name: 'OpenAI',
      short: 'OA',
      group: 'Popular',
      prefixes: ['sk-proj-', 'sk-svcacct-', 'sk-admin-', 'sk-'],
      placeholder: 'sk-proj-…  or  sk-…',
      docs: 'https://platform.openai.com/api-keys',
      defaultModel: 'gpt-4o-mini',
      needsKey: true,
      baseUrl: 'https://api.openai.com/v1'
    },
    anthropic: {
      name: 'Anthropic',
      short: 'AN',
      group: 'Popular',
      prefixes: ['sk-ant-'],
      placeholder: 'sk-ant-api03-…',
      docs: 'https://console.anthropic.com/settings/keys',
      defaultModel: 'claude-3-5-haiku-latest',
      needsKey: true,
      baseUrl: 'https://api.anthropic.com/v1'
    },
    gemini: {
      name: 'Google Gemini',
      short: 'GE',
      group: 'Popular',
      prefixes: ['AIza'],
      placeholder: 'AIza…',
      docs: 'https://aistudio.google.com/app/apikey',
      defaultModel: 'gemini-2.0-flash',
      needsKey: true,
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
    },
    groq: {
      name: 'Groq',
      short: 'GQ',
      group: 'Popular',
      prefixes: ['gsk_'],
      placeholder: 'gsk_…',
      docs: 'https://console.groq.com/keys',
      defaultModel: 'llama-3.1-8b-instant',
      needsKey: true,
      baseUrl: 'https://api.groq.com/openai/v1'
    },
    mistral: {
      name: 'Mistral AI',
      short: 'MI',
      group: 'Popular',
      prefixes: [],
      placeholder: 'Paste your Mistral key',
      docs: 'https://console.mistral.ai/api-keys',
      defaultModel: 'mistral-small-latest',
      needsKey: true,
      baseUrl: 'https://api.mistral.ai/v1'
    },
    openrouter: {
      name: 'OpenRouter',
      short: 'OR',
      group: 'Extras',
      prefixes: ['sk-or-'],
      placeholder: 'sk-or-v1-…',
      docs: 'https://openrouter.ai/keys',
      defaultModel: 'openai/gpt-4o-mini',
      needsKey: true,
      baseUrl: 'https://openrouter.ai/api/v1'
    },
    xai: {
      name: 'xAI (Grok)',
      short: 'XA',
      group: 'Extras',
      prefixes: ['xai-'],
      placeholder: 'xai-…',
      docs: 'https://console.x.ai',
      defaultModel: 'grok-2-latest',
      needsKey: true,
      baseUrl: 'https://api.x.ai/v1'
    },
    deepseek: {
      name: 'DeepSeek',
      short: 'DS',
      group: 'Extras',
      prefixes: ['sk-'],
      placeholder: 'sk-…',
      docs: 'https://platform.deepseek.com/api_keys',
      defaultModel: 'deepseek-chat',
      needsKey: true,
      baseUrl: 'https://api.deepseek.com/v1'
    },
    together: {
      name: 'Together AI',
      short: 'TG',
      group: 'Extras',
      prefixes: [],
      placeholder: 'Paste your Together key',
      docs: 'https://api.together.ai/settings/api-keys',
      defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      needsKey: true,
      baseUrl: 'https://api.together.xyz/v1'
    },
    perplexity: {
      name: 'Perplexity',
      short: 'PX',
      group: 'Extras',
      prefixes: ['pplx-'],
      placeholder: 'pplx-…',
      docs: 'https://www.perplexity.ai/settings/api',
      defaultModel: 'sonar',
      needsKey: true,
      baseUrl: 'https://api.perplexity.ai',
      noModels: true
    },
    ollama: {
      name: 'Ollama (local)',
      short: 'OL',
      group: 'Local',
      prefixes: [],
      placeholder: 'No key needed',
      docs: 'https://ollama.com',
      defaultModel: 'llama3.1',
      needsKey: false,
      direct: true,
      baseUrl: 'http://localhost:11434',
      note: 'Runs from your browser. The server cannot reach your machine.'
    },
    custom: {
      name: 'Custom (OpenAI-compatible)',
      short: 'CU',
      group: 'Local',
      prefixes: [],
      placeholder: 'sk-… or any token',
      docs: '',
      defaultModel: '',
      needsKey: true,
      needsBaseUrl: true,
      baseUrl: ''
    },
    azure: {
      name: 'Azure OpenAI',
      short: 'AZ',
      group: 'Enterprise',
      prefixes: [],
      placeholder: 'Azure api-key',
      docs: 'https://portal.azure.com',
      defaultModel: '',
      needsKey: true,
      needsBaseUrl: true,
      baseUrl: 'https://YOUR-RESOURCE.openai.azure.com',
      note: 'Needs your resource name and a deployment name.'
    },
    bedrock: {
      name: 'AWS Bedrock',
      short: 'BR',
      group: 'Enterprise',
      prefixes: ['AKIA', 'ASIA'],
      placeholder: 'AWS access key ID',
      docs: 'https://console.aws.amazon.com/bedrock',
      defaultModel: 'anthropic.claude-3-5-haiku-20241022-v1:0',
      needsKey: true,
      needsSecret: true,
      baseUrl: '',
      note: 'Needs an access key + secret key and a region.'
    },
    vertex: {
      name: 'Google Vertex AI',
      short: 'VX',
      group: 'Enterprise',
      prefixes: [],
      placeholder: 'Paste service-account JSON',
      docs: 'https://console.cloud.google.com/apis/credentials',
      defaultModel: 'gemini-2.0-flash',
      needsKey: false,
      needsJson: true,
      baseUrl: '',
      note: 'Needs a service-account JSON key with Vertex access.'
    }
  };

  // Order matters: most specific prefixes first.
  var DETECT_ORDER = [
    'anthropic',
    'openai',
    'openrouter',
    'xai',
    'groq',
    'gemini',
    'perplexity',
    'bedrock'
  ];

  function detect(rawKey) {
    var key = (rawKey || '').trim();
    if (!key) return null;

    for (var i = 0; i < DETECT_ORDER.length; i++) {
      var id = DETECT_ORDER[i];
      var p = PROVIDERS[id];
      for (var j = 0; j < p.prefixes.length; j++) {
        var pre = p.prefixes[j];
        if (key.indexOf(pre) === 0) {
          // "sk-" is shared by OpenAI, DeepSeek and other compatible APIs.
          if (pre === 'sk-' && !/^sk-(proj|svcacct|admin)-/.test(key)) {
            return {
              provider: 'openai',
              confidence: 'low',
              note: 'Starts with sk- — that prefix is shared by OpenAI and other compatible APIs. Confirm the provider.'
            };
          }
          return { provider: id, confidence: 'high', note: '' };
        }
      }
    }

    if (/^[A-Za-z0-9_\-]{32,}$/.test(key) && !key.indexOf('AIza')) {
      return {
        provider: 'custom',
        confidence: 'low',
        note: 'No known prefix. Pick the provider, or use Custom with a base URL.'
      };
    }

    return { provider: '', confidence: 'unknown', note: 'Unrecognised format — choose the provider manually.' };
  }

  function bestModel(providerId, models) {
    var p = PROVIDERS[providerId];
    if (!models || !models.length) return (p && p.defaultModel) || '';

    var blocked = /(embed|embedding|tts|whisper|transcri|audio|image|dall-e|moderation|rerank|guard|realtime|vision-preview|search-preview)/i;
    var cheap = /(mini|flash|haiku|small|instant|lite|nano|8b|7b|3b|1b)/i;
    var heavy = /(opus|pro|large|ultra|405b|70b|72b|o1|o3|reason)/i;

    var scored = models
      .filter(function (m) { return m && !blocked.test(m); })
      .map(function (m) {
        var s = 50;
        if (cheap.test(m)) s += 22;
        if (heavy.test(m)) s -= 18;
        if (/^gpt-4o-mini/i.test(m)) s += 10;
        if (/gemini-2\.0-flash/i.test(m)) s += 8;
        if (/claude-3-5-haiku/i.test(m)) s += 8;
        if (/latest/i.test(m)) s += 3;
        if (/preview|experimental|beta/i.test(m)) s -= 6;
        s -= Math.min(m.length, 60) / 10;
        return { m: m, s: s };
      })
      .sort(function (a, b) { return b.s - a.s; });

    return scored.length ? scored[0].m : models[0];
  }

  global.AKLProviders = {
    all: PROVIDERS,
    detect: detect,
    bestModel: bestModel,
    groups: ['Popular', 'Extras', 'Local', 'Enterprise']
  };
})(window);
