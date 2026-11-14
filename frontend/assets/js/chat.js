/* ============================================================
   API Key Lab — chatbot page
   ============================================================ */
(function () {
  'use strict';

  var P = window.AKLProviders;
  var $ = function (id) { return document.getElementById(id); };
  var STORE_KEY = 'akl.chat.v2';

  var ui = {
    messages: $('messages'),
    form: $('chatForm'),
    input: $('chatInput'),
    sendBtn: $('sendBtn'),
    status: $('chatStatus'),
    pill: $('modelPill'),
    providerPicker: $('chatProviderPicker'),
    model: $('chatModel'),
    modelList: $('chatModelList'),
    modelMeta: $('chatModelMeta'),
    loadModels: $('chatLoadModels'),
    system: $('chatSystem'),
    temp: $('chatTemp'),
    tempValue: $('chatTempValue'),
    tokens: $('chatTokens'),
    connCard: $('connCard'),
    connName: $('connName'),
    connKey: $('connKey'),
    clear: $('clearChat'),
    newChat: $('newChat'),
    side: $('chatSide'),
    scrim: $('sideScrim'),
    sideToggle: $('sideToggle')
  };

  var state = {
    cfg: null,
    convo: [],
    streaming: false,
    controller: null,
    models: []
  };

  /* ---------------- helpers ---------------- */
  /* ---------------- provider UI ---------------- */
  function mountProviderPicker() {
    var control = window.AKLPicker.create({
      mount: ui.providerPicker,
      items: window.AKLPicker.providers(),
      value: '',
      placeholder: 'Choose a provider',
      groups: P.groups
    });

    var handlers = [];
    control.onChange(function () {
      handlers.forEach(function (fn) {
        try { fn({ target: { value: control.getValue() } }); } catch (e) {}
      });
    });

    ui.provider = {
      get value() { return control.getValue(); },
      set value(next) { control.setValue(next); },
      addEventListener: function (type, fn) {
        if (type === 'change') handlers.push(fn);
      }
    };
  }

  function providerMeta(id) { return id ? P.all[id] : null; }

  function format(text) {
    var s = window.AKL.esc(text || '');
    s = s.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, function (m, code) {
      return '<pre><code>' + code.replace(/\n$/, '') + '</code></pre>';
    });
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    return s;
  }

  function scrollDown() {
    ui.messages.scrollTop = ui.messages.scrollHeight;
  }

  function sessionCfg() {
    if (!state.cfg) return null;
    var p = providerMeta(state.cfg.provider);
    return {
      provider: state.cfg.provider,
      apiKey: state.cfg.apiKey || '',
      baseUrl: state.cfg.baseUrl || '',
      model: state.cfg.model || (p && p.defaultModel) || '',
      region: state.cfg.region || 'us-east-1',
      secret: state.cfg.secret || '',
      deployment: state.cfg.deployment || '',
      apiVersion: state.cfg.apiVersion || '',
      location: state.cfg.location || 'us-central1'
    };
  }

  function persistConvo() {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({
        convo: state.convo.slice(-40),
        model: state.cfg ? state.cfg.model : '',
        system: ui.system.value,
        temperature: ui.temp.value,
        tokens: ui.tokens.value
      }));
    } catch (e) {}
  }

  function restoreConvo() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      state.convo = (data.convo || []).filter(function (m) { return m && m.content; });
      if (data.system) ui.system.value = data.system;
      if (data.temperature) { ui.temp.value = data.temperature; ui.tempValue.textContent = Number(data.temperature).toFixed(1); }
      if (data.tokens) ui.tokens.value = data.tokens;
      if (data.model && state.cfg && !state.cfg.model) state.cfg.model = data.model;
      state.convo.forEach(function (m) { appendMessage(m.role, m.content, true); });
      scrollDown();
    } catch (e) {}
  }

  /* ---------------- connection UI ---------------- */
  function updateConnection() {
    var p = providerMeta(state.cfg && state.cfg.provider);
    var has = !!(state.cfg && (state.cfg.apiKey || (p && p.direct) || (p && p.needsJson)));
    ui.connCard.classList.toggle('off', !has);
    ui.connName.textContent = has && p ? p.name : 'No key connected';
    ui.connKey.textContent = has && state.cfg.apiKey
      ? window.AKL.maskKey(state.cfg.apiKey)
      : has ? (p && p.direct ? 'Local server' : 'Service account') : 'Add a key to start';

    var meta = providerMeta(state.cfg && state.cfg.provider);
    var model = (state.cfg && state.cfg.model) || (meta && meta.defaultModel) || '';
    ui.pill.textContent = model || 'Auto model';
    ui.pill.title = model;
    if (state.cfg) {
      ui.provider.value = state.cfg.provider || '';
      if (!ui.model.value) ui.model.value = state.cfg.model || '';
    }
  }

  function showConnect() {
    ui.messages.innerHTML = '' +
      '<div class="empty-state">' +
        '<span class="feature-icon">' + window.AKL.icon('key', 22) + '</span>' +
        '<h3>Connect your key</h3>' +
        '<p>Add a key once and this tab can chat with the model. Nothing is saved after you close it.</p>' +
        '<form id="connectForm" class="connect-form">' +
          '<div class="field"><label class="label" for="connectKey">API key</label>' +
            '<div class="input-shell">' + window.AKL.icon('key', 18) +
              '<input id="connectKey" type="password" spellcheck="false" autocomplete="off" placeholder="Paste your API key…">' +
            '</div>' +
          '</div>' +
          '<div class="field"><label class="label" id="connectProviderLabel">Provider</label>' +
            '<div class="picker" id="connectProviderPicker"></div>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary btn-block">' + window.AKL.icon('chat', 18) + ' Start chatting</button>' +
        '</form>' +
        '<p class="helper">' +
          window.AKL.icon('info', 14) +
          '<span>Already checked a key? <a href="index.html">Run the tester</a> and it carries over automatically.</span>' +
        '</p>' +
      '</div>';

    var form = $('connectForm');
    var providerPicker = window.AKLPicker.create({
      mount: $('connectProviderPicker'),
      items: window.AKLPicker.providers(),
      value: '',
      placeholder: 'Choose a provider',
      groups: P.groups
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var provider = providerPicker.getValue();
      var key = $('connectKey').value.trim();
      var meta = providerMeta(provider);
      if (!provider) { window.AKL.toast('Choose a provider first.', 'bad'); return; }
      if (meta.needsKey !== false && !key && !meta.needsJson) {
        window.AKL.toast('Paste your API key first.', 'bad');
        return;
      }
      state.cfg = {
        provider: provider,
        providerName: meta.name,
        apiKey: key,
        model: meta.defaultModel || '',
        baseUrl: meta.baseUrl || ''
      };
      window.AKL.store.save(state.cfg);
      ui.messages.innerHTML = '';
      updateConnection();
      renderEmpty();
      window.AKL.toast('Connected. Say hello.', 'ok');
    });
  }

  function renderEmpty() {
    if (state.convo.length) return;
    if (!state.cfg || (!state.cfg.apiKey && !providerMeta(state.cfg.provider).direct)) {
      showConnect();
      return;
    }
    ui.messages.innerHTML = '' +
      '<div class="empty-state">' +
        '<span class="feature-icon">' + window.AKL.icon('sparkles', 22) + '</span>' +
        '<h3>Say something</h3>' +
        '<p>You are talking to <strong>' + window.AKL.esc(((providerMeta(state.cfg.provider) || {}).name) || 'the model') + '</strong>' +
        ' via your own key. Responses stream in live.</p>' +
        '<div class="suggestions">' +
          '<button type="button" class="suggestion" data-prompt="Say hi in five words.">Say hi in five words.</button>' +
          '<button type="button" class="suggestion" data-prompt="Which model are you, and who made you?">Which model are you, and who made you?</button>' +
          '<button type="button" class="suggestion" data-prompt="Reply with a tiny JSON object containing ok: true.">Reply with a tiny JSON object.</button>' +
        '</div>' +
      '</div>';

    ui.messages.querySelectorAll('.suggestion').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ui.input.value = btn.getAttribute('data-prompt');
        ui.input.focus();
        autoGrow();
      });
    });
  }

  /* ---------------- message rendering ---------------- */
  function appendMessage(role, content, silent) {
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (role === 'user' ? 'user' : 'ai');

    var avatar = document.createElement('span');
    avatar.className = 'avatar ' + (role === 'user' ? 'user' : 'ai');
    avatar.textContent = role === 'user' ? 'You' : 'AI';

    var body = document.createElement('div');
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = format(content);

    var meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.hidden = true;

    body.appendChild(bubble);
    body.appendChild(meta);
    wrap.appendChild(avatar);
    wrap.appendChild(body);
    ui.messages.appendChild(wrap);

    if (!silent) {
      state.convo.push({ role: role, content: content });
      persistConvo();
    }
    scrollDown();

    return { wrap: wrap, bubble: bubble, meta: meta, body: body, content: content };
  }

  function addMeta(node, text, extraButton) {
    node.meta.hidden = false;
    node.meta.innerHTML = '';

    var span = document.createElement('span');
    span.textContent = text;
    node.meta.appendChild(span);

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.innerHTML = window.AKL.icon('copy', 12) + ' Copy';
    copyBtn.addEventListener('click', function () {
      window.AKL.copy(node.content || node.bubble.textContent).then(function (ok) {
        window.AKL.toast(ok ? 'Copied.' : 'Copy blocked.', ok ? 'ok' : 'bad', 1800);
      });
    });
    node.meta.appendChild(copyBtn);

    if (extraButton) node.meta.appendChild(extraButton);
  }

  function errorBubble(title, message, fix) {
    var wrap = document.createElement('div');
    wrap.className = 'msg ai error';
    wrap.innerHTML = '' +
      '<span class="avatar ai">' + window.AKL.icon('alert-circle', 16) + '</span>' +
      '<div><div class="bubble"><strong>' + window.AKL.esc(title) + '</strong><br>' +
      window.AKL.esc(message) + (fix ? '<br><span class="muted">' + window.AKL.esc(fix) + '</span>' : '') +
      '</div><div class="msg-meta"><a href="index.html">Run a full key check →</a></div></div>';
    ui.messages.appendChild(wrap);
    scrollDown();
  }

  /* ---------------- sending ---------------- */
  function setStreaming(on) {
    state.streaming = on;
    ui.sendBtn.innerHTML = on ? window.AKL.icon('minus', 18) : window.AKL.icon('send', 18);
    ui.sendBtn.setAttribute('aria-label', on ? 'Stop generating' : 'Send message');
    ui.status.textContent = on ? 'Generating…' : 'Ready';
    ui.input.disabled = false;
  }

  function autoGrow() {
    ui.input.style.height = 'auto';
    ui.input.style.height = Math.min(ui.input.scrollHeight, 160) + 'px';
  }

  function send(regenerate) {
    if (state.streaming) { stop(); return; }
    var text;
    if (regenerate) {
      var lastUser = null;
      for (var i = state.convo.length - 1; i >= 0; i--) {
        if (state.convo[i].role === 'user') { lastUser = state.convo[i]; break; }
      }
      if (!lastUser) return;
      if (state.convo.length && state.convo[state.convo.length - 1].role === 'assistant') state.convo.pop();
      text = lastUser.content;
    } else {
      text = ui.input.value.trim();
      if (!text) return;
    }

    if (!state.cfg || (!state.cfg.apiKey && !providerMeta(state.cfg.provider).direct && !providerMeta(state.cfg.provider).needsJson)) {
      showConnect();
      window.AKL.toast('Connect a key first.', 'bad');
      return;
    }

    if (state.convo.length === 0) ui.messages.innerHTML = '';

    if (!regenerate) {
      ui.input.value = '';
      autoGrow();
      appendMessage('user', text);
    }

    var node = appendMessage('assistant', '', true);
    node.bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';

    setStreaming(true);
    var controller = new AbortController();
    state.controller = controller;
    var started = Date.now();
    var accumulated = '';
    var firstTokenAt = 0;
    persistConvo();

    var cfg = sessionCfg();
    if (ui.model.value.trim()) cfg.model = ui.model.value.trim();

    var messages = state.convo.map(function (m) { return { role: m.role, content: m.content }; });
    if (ui.system.value.trim()) messages.unshift({ role: 'system', content: ui.system.value.trim() });

    var finish = function (ok, detail) {
      setStreaming(false);
      if (!ok && !accumulated) {
        node.wrap.remove();
      } else if (accumulated) {
        state.convo.push({ role: 'assistant', content: accumulated });
        node.content = accumulated;
        node.bubble.innerHTML = format(accumulated);
        var latency = Date.now() - started;
        var metaText = window.AKL.fmtMs(latency) + (firstTokenAt ? ' · first token ' + window.AKL.fmtMs(firstTokenAt - started) : '');
        var regen = document.createElement('button');
        regen.type = 'button';
        regen.innerHTML = window.AKL.icon('refresh', 12) + ' Retry';
        regen.addEventListener('click', function () {
          if (state.streaming) return;
          node.wrap.remove();
          send(true);
        });
        addMeta(node, metaText + (detail ? ' · ' + detail : ''), regen);
        persistConvo();
      }
      scrollDown();
    };

    if (cfg.provider === 'ollama') {
      streamLocal(cfg, messages, node, function (delta) {
        if (!firstTokenAt) firstTokenAt = Date.now();
        accumulated += delta;
        node.bubble.innerHTML = format(accumulated) + '<span class="cursor"></span>';
        scrollDown();
      }, function (err) {
        if (err) {
          finish(false);
          errorBubble('Local model did not answer', err.message || String(err),
            'Check that Ollama is running and allows this origin.');
          return;
        }
        finish(true, null);
      });
      return;
    }

    fetch('/api/chat', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: cfg,
        messages: messages,
        stream: true,
        maxTokens: Number(ui.tokens.value) || 512,
        temperature: Number(ui.temp.value) || 0.7
      })
    }).then(function (res) {
      var type = res.headers.get('content-type') || '';

      if (type.indexOf('text/event-stream') === -1) {
        return res.json().then(function (data) {
          if (data && data.ok && data.text != null) {
            accumulated = data.text;
            node.bubble.innerHTML = format(accumulated);
            finish(true, data.usage && data.usage.total ? data.usage.total + ' tokens' : null);
          } else {
            finish(false);
            var err = (data && data.error) || {};
            errorBubble(err.title || 'The model did not answer', err.message || 'Unknown error', err.fix || err.hint || '');
          }
        });
      }

      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { finish(true, null); return; }
          buffer += decoder.decode(r.value, { stream: true });
          var blocks = buffer.split('\n\n');
          buffer = blocks.pop();

          for (var i = 0; i < blocks.length; i++) {
            var lines = blocks[i].split('\n');
            for (var j = 0; j < lines.length; j++) {
              var line = lines[j].trim();
              if (!line || line.indexOf('data:') !== 0) continue;
              var payload = line.slice(5).trim();
              if (!payload) continue;
              var json;
              try { json = JSON.parse(payload); } catch (e) { continue; }

              if (json.delta) {
                if (!firstTokenAt) firstTokenAt = Date.now();
                accumulated += json.delta;
                node.bubble.innerHTML = format(accumulated) + '<span class="cursor"></span>';
                scrollDown();
              }
              if (json.error) {
                finish(false);
                errorBubble(json.error.title || 'The model did not answer', json.error.message || '', json.error.fix || '');
                return;
              }
            }
          }
          return pump();
        });
      }
      return pump();
    }).catch(function (err) {
      if (err && err.name === 'AbortError') {
        if (accumulated) {
          finish(true, 'stopped');
        } else {
          node.wrap.remove();
          setStreaming(false);
          window.AKL.toast('Stopped.', 'info', 1500);
        }
        return;
      }
      finish(false);
      errorBubble('Could not reach the checker', err.message || 'Network error', 'Try again, or run a full key check.');
    });
  }

  function streamLocal(cfg, messages, node, onDelta, onDone) {
    var base = (cfg.baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, messages: messages, stream: true })
    }).then(function (res) {
      if (!res.ok) throw new Error('Ollama answered HTTP ' + res.status);
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { onDone(null); return; }
          buffer += decoder.decode(r.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop();
          lines.forEach(function (line) {
            if (!line.trim()) return;
            try {
              var json = JSON.parse(line);
              if (json.message && json.message.content) onDelta(json.message.content);
            } catch (e) {}
          });
          return pump();
        });
      }
      return pump();
    }).catch(function (err) { onDone(err); });
  }

  function stop() {
    if (state.controller) {
      state.controller.abort();
      state.controller = null;
    }
  }

  /* ---------------- models ---------------- */
  function loadModels() {
    if (!state.cfg) { showConnect(); return; }
    var cfg = sessionCfg();
    var original = ui.loadModels.innerHTML;
    ui.loadModels.disabled = true;
    ui.loadModels.innerHTML = '<span class="spinner"></span>';

    fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'models', config: cfg })
    }).then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.models && data.models.length) {
          state.models = data.models;
          ui.modelList.innerHTML = data.models.map(function (m) {
            return '<option value="' + window.AKL.esc(m) + '"></option>';
          }).join('');
          ui.modelMeta.textContent = data.models.length + ' models available';
          if (!ui.model.value && data.suggestedModel) {
            ui.model.placeholder = 'Auto — ' + data.suggestedModel;
          }
          window.AKL.toast(data.models.length + ' models loaded.', 'ok');
        } else {
          window.AKL.toast((data && data.error && (data.error.message || data.error)) || 'No models returned.', 'bad');
        }
      })
      .catch(function () { window.AKL.toast('Could not load models.', 'bad'); })
      .then(function () {
        ui.loadModels.disabled = false;
        ui.loadModels.innerHTML = original;
      });
  }

  /* ---------------- events ---------------- */
  function bind() {
    ui.form.addEventListener('submit', function (e) { e.preventDefault(); send(); });

    ui.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
      if (e.key === 'Escape' && state.streaming) stop();
    });
    ui.input.addEventListener('input', autoGrow);

    ui.temp.addEventListener('input', function () {
      ui.tempValue.textContent = Number(ui.temp.value).toFixed(1);
      persistConvo();
    });

    ui.provider.addEventListener('change', function () {
      var id = ui.provider.value;
      var meta = providerMeta(id);
      if (!state.cfg) state.cfg = {};
      state.cfg.provider = id;
      state.cfg.model = meta ? meta.defaultModel : '';
      if (meta && meta.baseUrl && !state.cfg.baseUrl) state.cfg.baseUrl = meta.baseUrl;
      ui.model.value = '';
      ui.modelList.innerHTML = '';
      ui.modelMeta.textContent = 'Leave empty to use the provider default.';
      updateConnection();
      window.AKL.store.save(state.cfg);
      renderEmpty();
    });

    ui.model.addEventListener('change', function () {
      if (!state.cfg) return;
      state.cfg.model = ui.model.value.trim();
      updateConnection();
      window.AKL.store.save(state.cfg);
    });

    ui.loadModels.addEventListener('click', loadModels);

    ui.clear.addEventListener('click', function () {
      state.convo = [];
      ui.messages.innerHTML = '';
      persistConvo();
      renderEmpty();
      closeSide();
    });

    ui.newChat.addEventListener('click', function () {
      state.convo = [];
      ui.messages.innerHTML = '';
      persistConvo();
      renderEmpty();
    });

    ui.sideToggle.addEventListener('click', function () {
      var open = !ui.side.classList.contains('open');
      ui.side.classList.toggle('open', open);
      ui.scrim.hidden = !open;
      ui.scrim.classList.toggle('open', open);
      ui.sideToggle.setAttribute('aria-expanded', String(open));
    });

    ui.scrim.addEventListener('click', closeSide);

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSide();
    });

    ui.system.addEventListener('input', persistConvo);
    ui.tokens.addEventListener('change', persistConvo);
  }

  function closeSide() {
    ui.side.classList.remove('open');
    ui.scrim.classList.remove('open');
    ui.scrim.hidden = true;
    ui.sideToggle.setAttribute('aria-expanded', 'false');
  }

  /* ---------------- boot ---------------- */
  window.AKL.ready(function () {
    window.AKL.hydrate();
    mountProviderPicker();

    var saved = window.AKL.store.load();
    if (saved && saved.provider) {
      state.cfg = saved;
      ui.provider.value = saved.provider;
      if (saved.model) ui.model.value = saved.model;
      if (saved.baseUrl) state.cfg.baseUrl = saved.baseUrl;
    }

    bind();
    updateConnection();
    restoreConvo();
    renderEmpty();
  });
})();
