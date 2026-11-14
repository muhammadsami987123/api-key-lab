/* ============================================================
   API Key Lab — provider picker (glass popover)
   Replaces the native <select> with a searchable, keyboard-friendly
   listbox that matches the design system.
   ============================================================ */
(function (global) {
  'use strict';

  var COLORS = {
    openai: '#10A37F',
    anthropic: '#D97757',
    gemini: '#4285F4',
    groq: '#F55036',
    mistral: '#FF7000',
    openrouter: '#6467F2',
    xai: '#111827',
    deepseek: '#4D6BFE',
    together: '#0F6FFF',
    perplexity: '#20808D',
    ollama: '#111827',
    custom: '#6B7280',
    azure: '#0078D4',
    bedrock: '#FF9900',
    vertex: '#34A853'
  };

  function hintFor(id, meta) {
    if (meta.note) return meta.note;
    if (meta.baseUrl) {
      try { return new URL(meta.baseUrl).host; } catch (e) {}
    }
    return meta.group || '';
  }

  function providerItems() {
    var P = global.AKLProviders;
    if (!P) return [];
    return Object.keys(P.all).map(function (id) {
      var meta = P.all[id];
      return {
        id: id,
        label: meta.name,
        hint: hintFor(id, meta),
        group: meta.group,
        short: meta.short,
        color: COLORS[id] || '#6B7280'
      };
    });
  }

  function create(opts) {
    var mount = opts.mount;
    var items = opts.items || [];
    var value = opts.value || '';
    var placeholder = opts.placeholder || 'Select';
    var groups = opts.groups || [];
    var auto = opts.autoOption || null;
    var changeHandlers = [];

    mount.innerHTML = '';
    mount.classList.add('picker');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.id = (mount.id || 'picker') + '-btn';

    var avatar = document.createElement('span');
    avatar.className = 'picker-avatar';
    avatar.setAttribute('aria-hidden', 'true');

    var label = document.createElement('span');
    label.className = 'picker-label';

    var chev = document.createElement('span');
    chev.className = 'picker-chev';
    chev.innerHTML = global.AKL ? global.AKL.icon('chevron-down', 16) : '';

    btn.appendChild(avatar);
    btn.appendChild(label);
    btn.appendChild(chev);

    var pop = document.createElement('div');
    pop.className = 'picker-pop';
    pop.hidden = true;

    var searchWrap = document.createElement('div');
    searchWrap.className = 'picker-search';
    var search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search providers…';
    search.setAttribute('aria-label', 'Search providers');
    search.setAttribute('autocomplete', 'off');
    search.spellcheck = false;
    searchWrap.appendChild(search);

    var list = document.createElement('ul');
    list.className = 'picker-list';
    list.setAttribute('role', 'listbox');
    list.id = (mount.id || 'picker') + '-list';

    var empty = document.createElement('div');
    empty.className = 'picker-empty';
    empty.textContent = 'No provider matches that search.';
    empty.hidden = true;

    pop.appendChild(searchWrap);
    pop.appendChild(list);
    pop.appendChild(empty);

    mount.appendChild(btn);
    mount.appendChild(pop);

    btn.setAttribute('aria-controls', list.id);
    search.setAttribute('role', 'combobox');
    search.setAttribute('aria-expanded', 'true');
    search.setAttribute('aria-controls', list.id);

    var activeIndex = -1;
    var visible = [];

    function optionById(id) {
      if (auto && id === '') return auto;
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === id) return items[i];
      }
      return null;
    }

    function paintButton() {
      var item = optionById(value);
      avatar.textContent = item ? (item.short || '') : '';
      avatar.style.background = item && item.color
        ? item.color
        : 'rgba(11,18,32,0.08)';
      avatar.style.color = item && item.color ? '#fff' : 'var(--muted)';

      if (item) {
        label.innerHTML = window.AKL.esc(item.label) +
          (item.hint ? '<small>' + window.AKL.esc(item.hint) + '</small>' : '');
        btn.setAttribute('aria-label', 'Provider: ' + item.label);
      } else {
        label.innerHTML = window.AKL.esc(placeholder);
        btn.setAttribute('aria-label', 'Provider: ' + placeholder);
      }
    }

    function makeRow(item) {
      var li = document.createElement('li');
      li.className = 'picker-item';
      li.setAttribute('role', 'option');
      li.id = (mount.id || 'picker') + '-opt-' + (item.id || 'auto');
      li.setAttribute('aria-selected', String(item.id === value));
      li.dataset.id = item.id;

      var chip = document.createElement('span');
      chip.className = 'picker-avatar picker-avatar-sm';
      chip.textContent = item.short || '';
      chip.style.background = item.color || 'rgba(11,18,32,0.08)';
      chip.style.color = item.color ? '#fff' : 'var(--muted)';

      var text = document.createElement('span');
      text.className = 'picker-item-text';
      text.innerHTML = '<span class="picker-item-label">' + window.AKL.esc(item.label) + '</span>' +
        (item.hint ? '<small>' + window.AKL.esc(item.hint) + '</small>' : '');

      li.appendChild(chip);
      li.appendChild(text);

      if (item.id === value) {
        var tick = document.createElement('span');
        tick.className = 'picker-check';
        tick.innerHTML = window.AKL.icon('check', 16);
        li.appendChild(tick);
      }

      li.addEventListener('click', function () { choose(item.id); });
      list.appendChild(li);
      visible.push(li);
    }

    function renderList(query) {
      var q = (query || '').trim().toLowerCase();
      list.innerHTML = '';
      visible = [];
      list.scrollTop = 0;

      var matches = function (item) {
        if (!q) return true;
        return (item.label + ' ' + (item.hint || '')).toLowerCase().indexOf(q) !== -1;
      };

      /* Auto-detect always sits on top, never buried in a group. */
      var autoShown = auto && matches(auto);
      if (autoShown) makeRow(auto);

      var grouped = {};
      items.forEach(function (item) {
        if (!matches(item)) return;
        var g = item.group || 'Other';
        (grouped[g] = grouped[g] || []).push(item);
      });

      var order = groups.filter(function (g) { return grouped[g] && grouped[g].length; });
      Object.keys(grouped).forEach(function (g) {
        if (order.indexOf(g) === -1) order.push(g);
      });

      if (!autoShown && !order.length) {
        empty.hidden = false;
        return;
      }
      empty.hidden = true;

      order.forEach(function (groupName) {
        var head = document.createElement('li');
        head.className = 'picker-group';
        head.setAttribute('role', 'presentation');
        head.textContent = groupName;
        list.appendChild(head);
        grouped[groupName].forEach(makeRow);
      });

      activeIndex = visible.findIndex(function (node) { return node.dataset.id === value; });
      if (activeIndex < 0 && visible.length) activeIndex = 0;
      highlight();
    }

    function highlight() {
      visible.forEach(function (node, i) {
        var on = i === activeIndex;
        node.dataset.active = on ? 'true' : 'false';
        if (on) {
          search.setAttribute('aria-activedescendant', node.id);
          var box = list.getBoundingClientRect();
          var el = node.getBoundingClientRect();
          if (el.top < box.top) list.scrollTop -= (box.top - el.top + 8);
          else if (el.bottom > box.bottom) list.scrollTop += (el.bottom - box.bottom + 8);
        }
      });
      if (!visible.length) search.removeAttribute('aria-activedescendant');
    }

    function open() {
      if (!pop.hidden) return;
      pop.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      search.value = '';
      renderList('');
      search.focus({ preventScroll: true });
      if (mount.closest('.chat-side') && window.innerWidth <= 900) {
        document.body.classList.add('picker-open');
      }
    }

    function close() {
      if (pop.hidden) return;
      pop.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('picker-open');
    }

    function choose(id) {
      value = id;
      paintButton();
      close();
      btn.focus({ preventScroll: true });
      changeHandlers.forEach(function (fn) {
        try { fn({ target: { value: value } }); } catch (e) {}
      });
    }

    btn.addEventListener('click', function () {
      if (pop.hidden) open(); else close();
    });

    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });

    search.addEventListener('input', function () {
      renderList(search.value);
    });

    search.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, visible.length - 1);
        highlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        highlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        var node = visible[activeIndex];
        if (node) choose(node.dataset.id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
        btn.focus({ preventScroll: true });
      } else if (e.key === 'Tab') {
        close();
      }
    });

    document.addEventListener('mousedown', function (e) {
      if (!mount.isConnected) return;
      if (!pop.hidden && !mount.contains(e.target)) close();
    });

    document.addEventListener('keydown', function (e) {
      if (!mount.isConnected) return;
      if (e.key === 'Escape' && !pop.hidden) close();
    });

    paintButton();
    renderList('');

    return {
      element: mount,
      getValue: function () { return value; },
      setValue: function (next) {
        value = next || '';
        paintButton();
      },
      onChange: function (fn) { changeHandlers.push(fn); },
      focus: function () { btn.focus(); },
      close: close
    };
  }

  global.AKLPicker = {
    create: create,
    providers: providerItems,
    colors: COLORS
  };
})(window);
