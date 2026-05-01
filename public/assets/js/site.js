/* Cosmos site — shared interactivity (reveal-on-scroll, footer year) */
(function () {
  'use strict';

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
  );

  const reveal = (selector) => {
    document.querySelectorAll(selector).forEach((el) => observer.observe(el));
  };

  document.addEventListener('DOMContentLoaded', () => {
    reveal('[data-reveal]');
    reveal('[data-reveal-stagger]');

    const yearEl = document.querySelector('[data-current-year]');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  });

  // Lightweight track stub — drop in Umami later, same .trackEvent() signature as RoB.
  window.cosmos = window.cosmos || {};
  window.cosmos.trackEvent = function (name, payload) {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(name, payload);
    } else if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.debug('[track]', name, payload);
    }
  };
})();
