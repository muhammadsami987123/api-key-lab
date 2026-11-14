/* ============================================================
   API Key Lab — shared UI helpers
   ============================================================ */
(function (global) {
  'use strict';

  var ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
    'alert-triangle': '<path d="M10.3 3.9 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 8-8M17 4h4v4M14.5 6.5 17 9"/>',
    zap: '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z"/>',
    shield: '<path d="M12 3 5 6v6c0 4.4 3 8.2 7 9 4-.8 7-4.6 7-9V6l-7-3Z"/><path d="m9.5 12 1.8 1.8L15 10"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a3 3 0 0 0-3 3v6.5A2.5 2.5 0 0 0 5.5 15"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.4 3.2M6.6 6.7A17.6 17.6 0 0 0 2.5 12S6 18 12 18a9.5 9.5 0 0 0 4.1-.9"/><path d="m3 3 18 18M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    external: '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 11a2 2 0 1 1 0 4Z"/>',
    trash: '<path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    sparkles: '<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9 12 3.5Z"/><path d="M19 4v3M17.5 5.5h3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    'chevron-right': '<path d="m9 5 7 7-7 7"/>',
    'chevron-down': '<path d="m5 9 7 7 7-7"/>',
    send: '<path d="M21.5 12 3.5 4l2.6 8-2.6 8 18-8Z"/><path d="M6 12h9"/>',
    layers: '<path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9.5 2.5v3M14.5 2.5v3M9.5 18.5v3M14.5 18.5v3M2.5 9.5h3M2.5 14.5h3M18.5 9.5h3M18.5 14.5h3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3.2 9h17.6M3.2 15h17.6M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    activity: '<path d="M3 12h4l2.5-6 4 12L16 12h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    'loader': '<path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m7.5 9 3 3-3 3M13 15h3.5"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5V4.5Z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>',
    heart: '<path d="M12 20.5s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 3.3c0 5-7.5 9.6-7.5 9.6Z"/>',
    'shield-alert': '<path d="M12 3 5 6v6c0 4.4 3 8.2 7 9 4-.8 7-4.6 7-9V6l-7-3Z"/><path d="M12 8v4M12 15.5h.01"/>',
    'dollar': '<path d="M12 3v18M16 7.5C16 5.6 14.2 4.5 12 4.5S8 5.5 8 7.5s1.8 2.6 4 3.2 4 1.2 4 3.3-1.8 3-4 3-4-1.1-4-3"/>',
    'wifi-off': '<path d="m2 2 20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.5a11 11 0 0 1 4.2-2.7M19 12.5a11 11 0 0 0-3.3-2.3M2.5 8.8a16 16 0 0 1 4.6-2.6M21.5 8.8a16 16 0 0 0-7-3.2"/><path d="M12 20h.01"/>',
    'history': '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V10h5.5"/><path d="M12 8v4.5l3 1.8"/>',
    'wrench': '<path d="M14.5 6.5a4.5 4.5 0 0 0 5.9 5.9L11 21.8a3 3 0 0 1-4.2 0L3.2 18a3 3 0 0 1 0-4.2L12.6 4.3a4.5 4.5 0 0 0 1.9 2.2Z"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.6 7.2 8.4 5.8 8.4-5.8"/>',
    'code': '<path d="m9 18-6-6 6-6M15 6l6 6-6 6"/>',
    'briefcase': '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12.5h18"/>',
    'github': '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48l.01-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.48-1.11-1.48-.9-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.34-1.09.62-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.56 9.56 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85l.01 2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/>',
    'linkedin': '<path fill="currentColor" stroke="none" d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9.2h4V21H3V9.2Zm7 0h3.83v1.62h.05c.53-1 1.84-2.06 3.78-2.06 4.04 0 4.79 2.66 4.79 6.11V21h-4v-5.32c0-1.27-.02-2.9-1.77-2.9-1.77 0-2.04 1.38-2.04 2.81V21H10V9.2Z"/>',
    'x': '<path fill="currentColor" stroke="none" d="M17.53 3H21l-7.19 8.21L22 21h-6.56l-5.15-6.73L4.3 21H1l7.6-8.68L2 3h6.73l4.74 6.27L17.53 3Zm-1.15 16h1.9L7.7 4.9h-1.8L16.38 19Z"/>'
  };

  function icon(name, size) {
    var body = ICONS[name] || '';
    var s = size || 18;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body + '</svg>';
  }

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---- key/session storage (cleared when the tab closes) ---- */
  var SESSION_KEY = 'akl.session.v2';

  var store = {
    save: function (config) {
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(config)); } catch (e) {}
    },
    load: function () {
      try {
        var raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    clear: function () {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    }
  };

  /* ---- toasts ---- */
  function stack() {
    var el = document.querySelector('.toast-stack');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast-stack';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function toast(message, type, timeout) {
    var t = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast ' + t;
    el.innerHTML = icon(t === 'ok' ? 'check-circle' : t === 'bad' ? 'alert-circle' : 'info', 17) +
      '<span>' + esc(message) + '</span>';
    stack().appendChild(el);
    var life = timeout || 4200;
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 240);
    }, life);
  }

  /* ---- clipboard ---- */
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return fallback(); });
    }
    return Promise.resolve(fallback());

    function fallback() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e) { return false; }
    }
  }

  function fmtMs(n) {
    if (n == null) return '—';
    if (n < 1000) return Math.round(n) + ' ms';
    return (n / 1000).toFixed(n < 10000 ? 2 : 1) + ' s';
  }

  function maskKey(k) {
    if (!k) return '—';
    if (k.length <= 12) return k.slice(0, 3) + '••••';
    return k.slice(0, 7) + ' •••• ' + k.slice(-4);
  }

  /* ---- pointer spotlight on glass cards ---- */
  function bindSpotlight() {
    if (window.matchMedia('(hover: none)').matches) return;
    document.addEventListener('pointermove', function (e) {
      var card = e.target.closest ? e.target.closest('.spotlight') : null;
      if (!card) return;
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---- header / nav active state ---- */
  function markNav() {
    var here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav a[data-page]').forEach(function (a) {
      if (a.getAttribute('data-page') === here) a.setAttribute('aria-current', 'page');
    });
  }

  /* ---- hydrate declarative icon placeholders ---- */
  function hydrate(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-icon]').forEach(function (node) {
      if (node.childElementCount) return;
      var size = node.getAttribute('data-icon-size');
      node.innerHTML = icon(node.getAttribute('data-icon'), size ? Number(size) : 18);
    });
    scope.querySelectorAll('[data-icon-inline]').forEach(function (node) {
      if (node.querySelector('svg')) return;
      var size = node.getAttribute('data-icon-size');
      var span = document.createElement('span');
      span.innerHTML = icon(node.getAttribute('data-icon-inline'), size ? Number(size) : 16);
      node.insertBefore(span.firstChild, node.firstChild);
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    /* A full page reload means "start clean". Navigation between
       tester and chatbot keeps the session so the key carries over. */
    var entry = null;
    try { entry = performance.getEntriesByType('navigation')[0]; } catch (e) {}
    var legacy = typeof performance.navigation !== 'undefined' ? performance.navigation.type : 0;
    var isReload = (entry && entry.type === 'reload') || legacy === 1;

    if (isReload) {
      store.clear();
      try { sessionStorage.removeItem('akl.chat.v2'); } catch (e) {}
    }

    hydrate();
    bindSpotlight();
    markNav();
  });

  global.AKL = {
    icon: icon,
    hydrate: hydrate,
    esc: esc,
    store: store,
    toast: toast,
    copy: copy,
    fmtMs: fmtMs,
    maskKey: maskKey,
    ready: ready
  };
})(window);
