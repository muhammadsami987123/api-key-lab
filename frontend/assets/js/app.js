/* ============================================================
   API Key Lab — tester page
   ============================================================ */
(function () {
  'use strict';

  var P = window.AKLProviders;
  var $ = function (id) { return document.getElementById(id); };

  var el = {
    form: $('verify-form'),
    keyField: $('keyField'),
    keyInput: $('keyInput'),
    keyShell: $('keyShell'),
    toggleKey: $('toggleKey'),
    eyeIcon: $('eyeIcon'),
    pasteKey: $('pasteKey'),
    detectPill: $('detectPill'),
    detectNote: $('detectNote'),
    providerPicker: $('providerPicker'),
    providerNote: $('provider-note'),
    modelInput: $('modelInput'),
    modelList: $('modelList'),
    modelHint: $('modelHint'),
    loadModels: $('loadModels'),
    docsLink: $('docsLink'),
    baseUrlField: $('baseUrlField'),
    baseUrl: $('baseUrl'),
    secretField: $('secretField'),
    awsSecret: $('awsSecret'),
    regionField: $('regionField'),
    awsRegion: $('awsRegion'),
    deploymentField: $('deploymentField'),
    azureDeployment: $('azureDeployment'),
    versionField: $('versionField'),
    azureVersion: $('azureVersion'),
    vertexLocationField: $('vertexLocationField'),
    vertexLocation: $('vertexLocation'),
    jsonField: $('jsonField'),
    vertexJson: $('vertexJson'),
    verifyBtn: $('verifyBtn'),
    openChatBtn: $('openChatBtn'),
    resetBtn: $('resetBtn'),
    formError: $('formError'),
    pipelineSection: $('pipelineSection'),
    pipeline: $('pipeline'),
    progressBar: $('progressBar'),
    pipelineTimer: $('pipelineTimer'),
    reportSection: $('reportSection'),
    reportCard: $('reportCard'),
    privacyPill: $('privacy-pill')
  };

  var state = {
    detected: '',
    confidence: 'unknown',
    userTouchedProvider: false,
    models: [],
    lastConfig: null,
    running: false,
    controller: null,
    timer: null,
    startedAt: 0
  };

  var STAGES = [
    { id: 'auth', label: 'Authenticating key', pending: 'Sending an authenticated request' },
    { id: 'models', label: 'Listing models', pending: 'Reading the models this key can use' },
    { id: 'completion', label: 'Sending test completion', pending: 'Measuring latency and quota' }
  ];

  /* ---------------- icons ---------------- */
  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (node) {
      var size = node.getAttribute('data-icon-size');
      if (!node.childElementCount) node.innerHTML = window.AKL.icon(node.getAttribute('data-icon'), size ? Number(size) : 18);
    });
    (root || document).querySelectorAll('[data-icon-inline]').forEach(function (node) {
      if (node.querySelector('svg')) return;
      var span = document.createElement('span');
      span.innerHTML = window.AKL.icon(node.getAttribute('data-icon-inline'), 16);
      node.insertBefore(span.firstChild, node.firstChild);
    });
  }

  /* ---------------- provider picker ---------------- */
  function mountProviderPicker() {
    var control = window.AKLPicker.create({
      mount: el.providerPicker,
      items: window.AKLPicker.providers(),
      value: '',
      placeholder: 'Auto-detect',
      groups: P.groups,
      autoOption: {
        id: '',
        label: 'Auto-detect',
        hint: 'Pick the provider from the key format',
        group: '',
        short: 'A',
        color: '#C7CDD8'
      }
    });

    var handlers = [];

    control.onChange(function () {
      handlers.forEach(function (fn) {
        try { fn({ target: { value: control.getValue() } }); } catch (e) {}
      });
    });

    el.providerSelect = {
      get value() { return control.getValue(); },
      set value(next) { control.setValue(next); },
      addEventListener: function (type, fn) {
        if (type === 'change') handlers.push(fn);
      }
    };
  }

  function provider() {
    var id = el.providerSelect.value || state.detected;
    return id ? P.all[id] : null;
  }

  /* ---------------- detection ---------------- */
  function detect() {
    var key = el.keyInput.value.trim();
    var found = P.detect(key);

    el.keyShell.classList.remove('invalid');
    el.detectPill.className = 'pill';

    if (!key) {
      el.detectPill.textContent = 'Waiting for a key…';
      el.detectPill.className = 'pill';
      el.detectNote.textContent = '';
      if (!state.userTouchedProvider) el.providerSelect.value = '';
      state.detected = '';
      state.confidence = 'unknown';
      syncProviderFields();
      return;
    }

    if (found && found.confidence === 'high') {
      state.detected = found.provider;
      state.confidence = 'high';
      el.detectPill.className = 'pill pill-ok';
      el.detectPill.innerHTML = '<span class="pill-dot"></span>' + P.all[found.provider].name + ' key detected';
      el.detectNote.textContent = '';
      if (!state.userTouchedProvider) el.providerSelect.value = found.provider;
    } else if (found && found.provider) {
      state.detected = found.provider;
      state.confidence = found.confidence;
      el.detectPill.className = 'pill pill-warn';
      el.detectPill.innerHTML = '<span class="pill-dot"></span>Looks like ' + P.all[found.provider].name + ' — confirm below';
      el.detectNote.textContent = found.note;
      if (!state.userTouchedProvider) el.providerSelect.value = found.provider;
    } else {
      state.detected = '';
      state.confidence = 'unknown';
      el.detectPill.className = 'pill pill-warn';
      el.detectPill.innerHTML = '<span class="pill-dot"></span>Provider not recognised';
      el.detectNote.textContent = 'Choose your provider manually — we only send the key where you point us.';
      if (!state.userTouchedProvider) el.providerSelect.value = '';
    }

    syncProviderFields();
  }

  /* ---------------- field visibility ---------------- */
  function syncProviderFields() {
    var p = provider();
    var id = el.providerSelect.value || state.detected;

    el.keyField.hidden = !!(p && (p.needsJson || p.direct === true && p.needsKey === false));
    el.baseUrlField.hidden = !(p && (p.needsBaseUrl || p.direct));
    el.secretField.hidden = !(p && p.needsSecret);
    el.regionField.hidden = !(p && p.needsSecret);
    el.deploymentField.hidden = id !== 'azure';
    el.versionField.hidden = id !== 'azure';
    el.vertexLocationField.hidden = id !== 'vertex';
    el.jsonField.hidden = id !== 'vertex';

    if (p) {
      el.keyInput.placeholder = p.placeholder || 'Paste your API key…';
      el.modelInput.placeholder = p.defaultModel ? 'Auto — ' + p.defaultModel : 'Auto — best available model';
      if (p.needsBaseUrl || p.direct) el.baseUrl.placeholder = p.baseUrl || 'https://…';
      el.providerNote.textContent = p.note || 'Auto-detect picks the provider from the key format. You can always override.';
      el.docsLink.hidden = !p.docs;
      el.docsLink.href = p.docs || '#';
      el.docsLink.textContent = p.docs ? 'Get a key' : '';
    } else {
      el.keyInput.placeholder = 'Paste your API key…';
      el.providerNote.textContent = 'Auto-detect picks the provider from the key format. You can always override.';
      el.docsLink.hidden = true;
    }
  }

  /* ---------------- config ---------------- */
  function buildConfig() {
    var id = el.providerSelect.value || state.detected;
    var p = id ? P.all[id] : null;
    var model = el.modelInput.value.trim();

    return {
      provider: id,
      providerName: p ? p.name : '',
      apiKey: el.keyInput.value.trim(),
      baseUrl: el.baseUrl.value.trim(),
      model: model || (p && p.defaultModel) || '',
      modelIsAuto: !model,
      secret: el.awsSecret.value.trim(),
      region: el.awsRegion.value.trim() || 'us-east-1',
      deployment: el.azureDeployment.value.trim(),
      apiVersion: el.azureVersion.value.trim(),
      location: el.vertexLocation.value.trim() || 'us-central1',
      serviceAccount: el.vertexJson.value.trim()
    };
  }

  function validate(cfg) {
    if (!cfg.provider) return 'Choose a provider (or paste a key we can auto-detect).';
    var p = P.all[cfg.provider];
    if (p.needsJson && !cfg.serviceAccount) return 'Vertex AI needs a service-account JSON key.';
    if (!p.needsJson && !p.direct && p.needsKey !== false && !cfg.apiKey) return 'Enter your API key first.';
    if (p.needsSecret && !cfg.secret) return 'AWS Bedrock needs the secret access key too.';
    if (p.needsSecret && !cfg.apiKey) return 'AWS Bedrock needs the access key ID.';
    if (p.needsBaseUrl && !cfg.baseUrl) return 'This provider needs a base URL.';
    if (cfg.provider === 'azure' && !cfg.deployment) return 'Azure OpenAI needs the deployment name.';
    if (cfg.provider === 'custom' && !/^https:\/\//i.test(cfg.baseUrl)) return 'Custom endpoints must use https://';
    if (cfg.serviceAccount) {
      try { JSON.parse(cfg.serviceAccount); }
      catch (e) { return 'That service-account JSON could not be parsed.'; }
    }
    return '';
  }

  /* ---------------- pipeline rendering ---------------- */
  function renderPipeline() {
    el.pipeline.innerHTML = STAGES.map(function (s) {
      return '<div class="stage" data-stage="' + s.id + '" data-state="pending">' +
        '<span class="stage-icon">' + window.AKL.icon('clock', 15) + '</span>' +
        '<div class="stage-main"><div class="stage-label">' + s.label + '</div>' +
        '<div class="stage-detail">' + s.pending + '</div></div>' +
        '<span class="stage-time"></span></div>';
    }).join('');
    el.progressBar.style.width = '6%';
  }

  function setStage(id, stateName, detail, ms) {
    var node = el.pipeline.querySelector('[data-stage="' + id + '"]');
    if (!node) return;
    node.setAttribute('data-state', stateName);
    var iconHtml = stateName === 'done' ? window.AKL.icon('check', 15)
      : stateName === 'fail' ? window.AKL.icon('x', 15)
        : stateName === 'active' ? window.AKL.icon('loader', 15)
          : window.AKL.icon('clock', 15);
    node.querySelector('.stage-icon').innerHTML = iconHtml;
    if (detail) node.querySelector('.stage-detail').textContent = detail;
    if (ms != null) node.querySelector('.stage-time').textContent = window.AKL.fmtMs(ms);
  }

  function startTimer() {
    state.startedAt = Date.now();
    state.timer = setInterval(function () {
      el.pipelineTimer.textContent = ((Date.now() - state.startedAt) / 1000).toFixed(1) + ' s';
    }, 100);
  }

  function stopTimer() {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
  }

  /* ---------------- verify ---------------- */
  function verify() {
    if (state.running) return;

    var cfg = buildConfig();
    var problem = validate(cfg);
    el.formError.hidden = !problem;
    el.formError.textContent = problem ? window.AKL.icon('alert-circle', 14) + ' ' + problem : '';
    if (problem) {
      el.keyShell.classList.add('invalid');
      el.formError.innerHTML = window.AKL.icon('alert-circle', 15) + '<span>' + window.AKL.esc(problem) + '</span>';
      return;
    }

    state.lastConfig = cfg;
    window.AKL.store.save(configForStorage(cfg));

    state.running = true;
    el.verifyBtn.disabled = true;
    el.verifyBtn.innerHTML = '<span class="spinner"></span> Checking…';
    el.openChatBtn.disabled = true;
    el.reportSection.hidden = true;
    el.pipelineSection.hidden = false;
    renderPipeline();
    startTimer();
    setStage('auth', 'active', 'Sending an authenticated request');
    el.pipelineSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    var controller = new AbortController();
    state.controller = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 45000);

    var request = cfg.provider === 'ollama'
      ? verifyLocal(cfg, controller.signal)
      : fetchJson('/api/verify', { action: 'verify', config: safeConfig(cfg) }, controller.signal);

    request.then(function (data) {
      clearTimeout(timeout);
      revealStages(data, function () { finish(data, cfg, false); });
    }).catch(function (err) {
      clearTimeout(timeout);
      var aborted = err && err.name === 'AbortError';
      var report = {
        ok: false,
        status: 'error',
        title: aborted ? 'Check timed out' : 'Could not reach the checker',
        message: aborted
          ? 'The provider did not answer within 45 seconds. It may be slow or blocking the request.'
          : (err && err.message) || 'Network error',
        stages: STAGES.map(function (s) {
          return { id: s.id, label: s.label, status: 'skipped', detail: 'Not completed' };
        })
      };
      setStage('auth', 'fail', aborted ? 'Timed out' : 'Network error');
      setStage('models', 'idle', 'Skipped');
      setStage('completion', 'idle', 'Skipped');
      finish(report, cfg, true);
    });
  }

  function revealStages(data, done) {
    var stages = (data && data.stages) || [];
    var i = 0;

    function next() {
      if (i >= stages.length) { done(); return; }
      var s = stages[i];
      var stateName = s.status === 'ok' ? 'done' : (s.status === 'skipped' ? 'done' : 'fail');
      setStage(s.id, 'active', 'Working…');
      el.progressBar.style.width = (18 + i * 26) + '%';

      setTimeout(function () {
        setStage(s.id, stateName, s.detail || '', s.ms);
        if (s.status === 'fail') {
          for (var j = i + 1; j < stages.length; j++) setStage(stages[j].id, 'idle', 'Skipped');
          el.progressBar.style.width = '100%';
          done();
          return;
        }
        i++;
        next();
      }, 220);
    }
    next();
  }

  function finish(report, cfg, isClientError) {
    state.running = false;
    stopTimer();
    el.verifyBtn.disabled = false;
    el.verifyBtn.innerHTML = window.AKL.icon('zap', 18) + ' Verify connection';
    el.pipelineTimer.textContent = window.AKL.fmtMs(Date.now() - state.startedAt);

    if (report.models && report.models.length) fillModels(report.models, report.suggestedModel);

    var ok = report.status === 'valid';
    el.openChatBtn.disabled = !ok;
    el.resetBtn.hidden = false;

    if (ok) {
      el.progressBar.style.width = '100%';
      window.AKL.toast('Key verified — ' + (report.providerName || cfg.providerName) + ' is live.', 'ok');
    } else if (!isClientError) {
      window.AKL.toast(report.title || 'The key did not pass every check.', report.status === 'warning' ? 'info' : 'bad');
    }

    renderReport(report, cfg);
    el.reportSection.hidden = false;
    el.reportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- report ---------------- */
  function renderReport(r, cfg) {
    var ok = r.status === 'valid';
    var warn = r.status === 'warning';
    var orbClass = ok ? 'ok' : warn ? 'warn' : 'bad';
    var orbIcon = ok ? 'check' : warn ? 'alert-triangle' : 'x';
    var title = r.title || (ok ? 'Key is valid and generating' : warn ? 'Key works, with warnings' : 'Key check failed');

    var http = r.httpStatus != null ? 'HTTP ' + r.httpStatus : '—';
    var pillClass = ok ? 'pill-ok' : warn ? 'pill-warn' : 'pill-bad';

    var cells = [
      ['Provider', r.providerName || (P.all[cfg.provider] ? P.all[cfg.provider].name : '—')],
      ['Model', r.model || cfg.model || '—'],
      ['Latency', r.latencyMs != null ? window.AKL.fmtMs(r.latencyMs) : '—'],
      ['Status', http],
      ['Tokens', r.usage && r.usage.total ? r.usage.total + ' total' : '—'],
      ['Checked', r.checkedAt ? new Date(r.checkedAt).toLocaleTimeString() : new Date().toLocaleTimeString()]
    ];

    var html = '' +
      '<div class="report-head">' +
        '<div class="report-orb ' + orbClass + '">' + window.AKL.icon(orbIcon, 26) + '</div>' +
        '<div class="report-head-main">' +
          '<h2 class="report-title" id="report-title">' + window.AKL.esc(title) + '</h2>' +
          '<p class="report-sub">' + window.AKL.esc(r.subtitle || subtitleFor(r, cfg)) + '</p>' +
        '</div>' +
        '<span class="pill ' + pillClass + '">' + window.AKL.esc(http) + '</span>' +
      '</div>' +
      '<dl class="report-grid">' + cells.map(function (c) {
        return '<div class="report-cell"><dt>' + window.AKL.esc(c[0]) + '</dt><dd>' + window.AKL.esc(c[1]) + '</dd></div>';
      }).join('') + '</dl>';

    if (r.error) {
      var e = r.error;
      html += '<div class="alert alert-' + (warn ? 'warn' : 'bad') + ' mt-16">' +
        window.AKL.icon('alert-triangle', 18) +
        '<div><strong>' + window.AKL.esc(e.title || 'Error') + '</strong><br>' +
        window.AKL.esc(e.message || '') +
        (e.hint ? '<br><span class="muted">' + window.AKL.esc(e.hint) + '</span>' : '') +
        '</div></div>';
      if (e.fix || e.docs) {
        html += '<div class="kv">' +
          (e.fix ? '<div class="kv-row"><span class="k">How to fix</span><span class="v">' + window.AKL.esc(e.fix) + '</span></div>' : '') +
          (e.code ? '<div class="kv-row"><span class="k">Error code</span><span class="v"><code>' + window.AKL.esc(e.code) + '</code></span></div>' : '') +
          '</div>';
      }
    }

    if (r.preview) {
      html += '<div class="preview-block">' + window.AKL.esc(r.preview) + '</div>';
    }

    if (r.quota && (r.quota.remainingRequests != null || r.quota.remainingTokens != null || r.quota.reset)) {
      html += '<div class="kv">' +
        (r.quota.remainingRequests != null ? '<div class="kv-row"><span class="k">Requests left</span><span class="v">' + window.AKL.esc(r.quota.remainingRequests) + '</span></div>' : '') +
        (r.quota.remainingTokens != null ? '<div class="kv-row"><span class="k">Tokens left</span><span class="v">' + window.AKL.esc(r.quota.remainingTokens) + '</span></div>' : '') +
        (r.quota.reset ? '<div class="kv-row"><span class="k">Resets</span><span class="v">' + window.AKL.esc(r.quota.reset) + '</span></div>' : '') +
        '</div>';
    }

    if (r.notice) {
      html += '<div class="alert alert-info mt-16">' + window.AKL.icon('info', 18) + '<div>' + window.AKL.esc(r.notice) + '</div></div>';
    }

    html += '<div class="report-actions">';
    if (ok) {
      html += '<a class="btn btn-primary" href="chat.html">' + window.AKL.icon('chat', 18) + ' Open chatbot</a>';
    }
    html += '<button type="button" class="btn btn-glass" id="retryBtn">' + window.AKL.icon('refresh', 18) + ' Run again</button>' +
      '<button type="button" class="btn btn-glass" id="copyReportBtn">' + window.AKL.icon('copy', 18) + ' Copy report</button>';
    if (r.docs) {
      html += '<a class="btn btn-ghost" href="' + window.AKL.esc(r.docs) + '" target="_blank" rel="noopener noreferrer">' +
        window.AKL.icon('external', 16) + ' Provider docs</a>';
    }
    html += '</div>';

    html += '<details class="raw"><summary>Raw response</summary><pre>' +
      window.AKL.esc(JSON.stringify(r.raw != null ? r.raw : r, null, 2)) + '</pre></details>';

    el.reportCard.innerHTML = html;

    var retry = $('retryBtn');
    if (retry) retry.addEventListener('click', verify);

    var copyBtn = $('copyReportBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = [
          'API Key Lab report',
          'Provider: ' + (r.providerName || cfg.providerName || cfg.provider),
          'Model: ' + (r.model || cfg.model || 'auto'),
          'Status: ' + (r.status || 'unknown') + (r.httpStatus ? ' (HTTP ' + r.httpStatus + ')' : ''),
          'Latency: ' + (r.latencyMs != null ? window.AKL.fmtMs(r.latencyMs) : '—'),
          r.error ? 'Error: ' + (r.error.title || '') + ' — ' + (r.error.message || '') : '',
          'Checked: ' + new Date().toISOString()
        ].filter(Boolean).join('\n');
        window.AKL.copy(text).then(function (done) {
          window.AKL.toast(done ? 'Report copied.' : 'Copy failed — select the text manually.', done ? 'ok' : 'bad');
        });
      });
    }
  }

  function subtitleFor(r, cfg) {
    if (r.status === 'valid') {
      return 'This key authenticated, listed models and completed a real generation request.';
    }
    if (r.status === 'warning') return 'The key is accepted, but something will bite you in production.';
    return 'Fix the item below, then run the check again.';
  }

  /* ---------------- models ---------------- */
  function fillModels(models, suggested) {
    state.models = models;
    el.modelList.innerHTML = models.map(function (m) {
      return '<option value="' + window.AKL.esc(m) + '"></option>';
    }).join('');
    if (!el.modelInput.value && suggested) {
      el.modelInput.value = '';
      el.modelInput.placeholder = 'Auto — ' + suggested;
    }
    el.modelHint.textContent = models.length + ' available';
  }

  function loadModels() {
    var cfg = buildConfig();
    var problem = validate(cfg);
    if (problem) {
      el.formError.hidden = false;
      el.formError.innerHTML = window.AKL.icon('alert-circle', 15) + '<span>' + window.AKL.esc(problem) + '</span>';
      return;
    }
    var original = el.loadModels.innerHTML;
    el.loadModels.disabled = true;
    el.loadModels.innerHTML = '<span class="spinner"></span>';

    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 20000);

    var request = cfg.provider === 'ollama'
      ? verifyLocal(cfg, controller.signal, { modelsOnly: true })
      : fetchJson('/api/verify', { action: 'models', config: safeConfig(cfg) }, controller.signal);

    request.then(function (data) {
      clearTimeout(timeout);
      if (data.models && data.models.length) {
        fillModels(data.models, data.suggestedModel);
        window.AKL.toast(data.models.length + ' models available for this key.', 'ok');
      } else {
        window.AKL.toast(data.error ? data.error.message : 'No models were returned.', 'bad');
      }
    }).catch(function (err) {
      clearTimeout(timeout);
      window.AKL.toast(err && err.name === 'AbortError' ? 'Model lookup timed out.' : 'Could not load models.', 'bad');
    }).then(function () {
      el.loadModels.disabled = false;
      el.loadModels.innerHTML = original;
    });
  }

  /* ---------------- local (ollama) ---------------- */
  function verifyLocal(cfg, signal, opts) {
    var base = (cfg.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    var stages = [];
    var started = Date.now();

    return fetch(base + '/api/tags', { signal: signal })
      .then(function (res) {
        if (!res.ok) throw new Error('Ollama answered HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var models = (data.models || []).map(function (m) { return m.name; });
        stages.push({
          id: 'auth', label: 'Authenticating key', status: 'ok', ms: Date.now() - started,
          detail: 'Local server reachable — ' + models.length + ' model(s) installed'
        });
        stages.push({ id: 'models', label: 'Listing models', status: 'ok', ms: 0, detail: models.slice(0, 3).join(', ') });

        if (opts && opts.modelsOnly) {
          return { models: models, suggestedModel: models[0] || cfg.model, stages: stages };
        }

        var model = cfg.model || models[0];
        if (!model) throw new Error('No models are installed. Run `ollama pull llama3.1` first.');
        var chatStart = Date.now();

        return fetch(base + '/api/chat', {
          method: 'POST',
          signal: signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            stream: false,
            messages: [{ role: 'user', content: 'Reply with exactly: OK' }]
          })
        }).then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error((body && body.error) || 'HTTP ' + res.status);
            stages.push({
              id: 'completion', label: 'Sending test completion', status: 'ok',
              ms: Date.now() - chatStart, detail: 'Generated ' + ((body.message && body.message.content) || '').length + ' characters'
            });
            return {
              ok: true,
              status: 'valid',
              title: 'Local model is responding',
              subtitle: 'Ollama answered from this machine — your key never left the browser.',
              httpStatus: res.status,
              providerName: 'Ollama (local)',
              model: model,
              latencyMs: Date.now() - chatStart,
              stages: stages,
              models: models,
              suggestedModel: model,
              usage: {
                prompt: body.prompt_eval_count || 0,
                completion: body.eval_count || 0,
                total: (body.prompt_eval_count || 0) + (body.eval_count || 0)
              },
              preview: (body.message && body.message.content) || ''
            };
          });
        });
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') throw err;
        var failedStage = stages.length < 1 ? 'auth' : 'completion';
        return {
          ok: false,
          status: 'error',
          title: 'Local server not reachable',
          httpStatus: null,
          stages: STAGES.map(function (s) {
            return {
              id: s.id, label: s.label,
              status: s.id === failedStage ? 'fail' : 'skipped',
              detail: s.id === failedStage ? err.message : 'Skipped'
            };
          }),
          error: {
            title: 'Could not talk to Ollama',
            message: err.message,
            hint: 'Start Ollama and allow this origin.',
            fix: 'Run `OLLAMA_ORIGINS=* ollama serve` (or add this site’s origin), then try again.',
            code: 'LOCAL_NETWORK',
            docs: 'https://github.com/ollama/ollama/blob/main/docs/faq.md'
          }
        };
      });
  }

  /* ---------------- fetch helper ---------------- */
  function fetchJson(url, body, signal) {
    return fetch(url, {
      method: 'POST',
      signal: signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok && !data.stages) {
          throw new Error(data.error || data.message || 'Request failed (HTTP ' + res.status + ')');
        }
        return data;
      });
    });
  }

  function safeConfig(cfg) {
    return {
      provider: cfg.provider,
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model: cfg.modelIsAuto ? '' : cfg.model,
      secret: cfg.secret,
      region: cfg.region,
      deployment: cfg.deployment,
      apiVersion: cfg.apiVersion,
      location: cfg.location,
      serviceAccount: cfg.serviceAccount
    };
  }

  function configForStorage(cfg) {
    return {
      provider: cfg.provider,
      providerName: cfg.providerName,
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      region: cfg.region,
      deployment: cfg.deployment,
      apiVersion: cfg.apiVersion,
      location: cfg.location,
      savedAt: Date.now()
    };
  }

  /* ---------------- events ---------------- */
  function bind() {
    var detectTimer = null;
    el.keyInput.addEventListener('input', function () {
      if (!el.keyInput.value.trim()) {
        /* Emptying the field should also forget the stored key,
           so a later navigation cannot resurrect it. */
        window.AKL.store.clear();
        el.openChatBtn.disabled = true;
      }
      clearTimeout(detectTimer);
      detectTimer = setTimeout(detect, 90);
    });

    el.keyInput.addEventListener('paste', function () { setTimeout(detect, 30); });

    el.providerSelect.addEventListener('change', function () {
      state.userTouchedProvider = !!el.providerSelect.value;
      syncProviderFields();
      if (el.providerSelect.value) {
        el.detectPill.className = 'pill pill-info';
        el.detectPill.innerHTML = '<span class="pill-dot"></span>Using ' + P.all[el.providerSelect.value].name;
        el.detectNote.textContent = '';
      } else {
        detect();
      }
    });

    el.toggleKey.addEventListener('click', function () {
      var show = el.keyInput.type === 'password';
      el.keyInput.type = show ? 'text' : 'password';
      el.toggleKey.setAttribute('aria-pressed', String(show));
      el.toggleKey.setAttribute('aria-label', show ? 'Hide API key' : 'Show API key');
      el.eyeIcon.innerHTML = window.AKL.icon(show ? 'eye-off' : 'eye');
    });

    el.pasteKey.addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        el.keyInput.focus();
        window.AKL.toast('Clipboard access blocked — paste with Ctrl/⌘ + V.', 'info');
        return;
      }
      navigator.clipboard.readText().then(function (text) {
        if (!text) return;
        el.keyInput.value = text.trim();
        detect();
        window.AKL.toast('Pasted.', 'ok', 1600);
      }).catch(function () {
        el.keyInput.focus();
        window.AKL.toast('Clipboard access blocked — paste with Ctrl/⌘ + V.', 'info');
      });
    });

    el.form.addEventListener('submit', function (e) {
      e.preventDefault();
      verify();
    });

    el.loadModels.addEventListener('click', loadModels);

    el.openChatBtn.addEventListener('click', function () {
      if (state.lastConfig) window.AKL.store.save(configForStorage(state.lastConfig));
      location.href = 'chat.html';
    });

    el.resetBtn.addEventListener('click', function () {
      el.keyInput.value = '';
      el.modelInput.value = '';
      el.modelList.innerHTML = '';
      state.userTouchedProvider = false;
      el.providerSelect.value = '';
      el.reportSection.hidden = true;
      el.pipelineSection.hidden = true;
      el.resetBtn.hidden = true;
      el.openChatBtn.disabled = true;
      el.formError.hidden = true;
      window.AKL.store.clear();
      detect();
      el.keyInput.focus();
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        verify();
      }
    });
  }

  function restore() {
    var saved = window.AKL.store.load();
    if (!saved) return;
    if (saved.apiKey) el.keyInput.value = saved.apiKey;
    if (saved.baseUrl) el.baseUrl.value = saved.baseUrl;
    if (saved.model) el.modelInput.value = saved.model;
    if (saved.region) el.awsRegion.value = saved.region;
    if (saved.deployment) el.azureDeployment.value = saved.deployment;
    if (saved.apiVersion) el.azureVersion.value = saved.apiVersion;
    if (saved.provider) {
      el.providerSelect.value = saved.provider;
      state.userTouchedProvider = true;
    }
    detect();
  }

  /* ---------------- boot ---------------- */
  window.AKL.ready(function () {
    hydrate();
    mountProviderPicker();
    el.privacyPill.innerHTML = window.AKL.icon('shield', 14) + ' Session-only';
    bind();
    syncProviderFields();
    restore();
  });
})();
