/* ============================================================
   API Key Lab — animated accordion
   Native <details> toggles instantly and allows every panel to
   stay open at once. This upgrades a group of them to a smooth,
   height-animated, single-open accordion.
   ============================================================ */
(function (global) {
  'use strict';

  var OPEN_MS = 300;
  var CLOSE_MS = 240;
  var EASE = 'cubic-bezier(.22,1,.36,1)';

  function prefersReduced() {
    return !!(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function bodyOf(details) {
    var children = details.children;
    for (var i = 0; i < children.length; i++) {
      if (children[i].tagName !== 'SUMMARY') return children[i];
    }
    return null;
  }

  function supportsAnimation() {
    return typeof global.Element !== 'undefined' &&
      typeof global.Element.prototype.animate === 'function';
  }

  function openItem(details, body) {
    details.open = true;

    if (!body || prefersReduced() || !supportsAnimation()) return;

    var height = body.offsetHeight;

    body.style.overflow = 'hidden';
    var anim = body.animate(
      [
        { height: '0px', opacity: 0, transform: 'translateY(-4px)' },
        { height: height + 'px', opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: OPEN_MS, easing: EASE }
    );

    var done = function () {
      body.style.overflow = '';
      body.style.height = '';
      body.style.opacity = '';
      body.style.transform = '';
    };
    anim.onfinish = done;
    anim.oncancel = done;
  }

  function closeItem(details, body) {
    if (!body || prefersReduced() || !supportsAnimation()) {
      details.open = false;
      return;
    }

    var height = body.offsetHeight;

    body.style.overflow = 'hidden';
    var anim = body.animate(
      [
        { height: height + 'px', opacity: 1, transform: 'translateY(0)' },
        { height: '0px', opacity: 0, transform: 'translateY(-4px)' }
      ],
      { duration: CLOSE_MS, easing: EASE, fill: 'forwards' }
    );

    anim.onfinish = function () {
      details.open = false;
      body.style.overflow = '';
      body.style.height = '';
      body.style.opacity = '';
      body.style.transform = '';
      anim.cancel();
    };
  }

  function setup(nodes, exclusive) {
    var items = nodes.filter(function (node) {
      return node && node.tagName === 'DETAILS';
    });

    items.forEach(function (details) {
      var summary = details.querySelector('summary');
      if (!summary) return;

      summary.addEventListener('click', function (event) {
        /* Take over the native toggle so both directions animate. */
        event.preventDefault();

        if (details.open) {
          closeItem(details, bodyOf(details));
          return;
        }

        if (exclusive) {
          items.forEach(function (other) {
            if (other !== details && other.open) {
              closeItem(other, bodyOf(other));
            }
          });
        }

        openItem(details, bodyOf(details));
      });
    });

    /* Keep the layout stable while the first panel is already open. */
    items.forEach(function (details) {
      if (!details.hasAttribute('data-settled')) {
        details.setAttribute('data-settled', '');
      }
    });
  }

  function init() {
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-accordion]'),
      function (group) {
        var mode = group.getAttribute('data-accordion');
        setup(
          Array.prototype.slice.call(group.querySelectorAll('details')),
          mode !== 'single'
        );
      }
    );

    /* Standalone panels (e.g. "Advanced options") animate too,
       they just have no siblings to close. */
    var solo = document.querySelectorAll('[data-animated-details]');
    Array.prototype.forEach.call(solo, function (node) {
      setup([node], false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  global.AKLAccordion = { init: init, setup: setup };
})(window);
