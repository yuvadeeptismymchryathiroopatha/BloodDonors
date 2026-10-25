/**
 * Yuva Blood Forum — Theme (light / dark)
 * Persists preference in localStorage; falls back to system preference.
 */
(function () {
  const STORAGE_KEY = 'ybf-theme';
  const LOGO_LIGHT = 'images/logo-light.png';
  const LOGO_DARK = 'images/logo-dark.png';
  const SPONSOR_LOGO_LIGHT = 'images/STH-LOGO-light.svg';
  const SPONSOR_LOGO_DARK = 'images/STH-LOGO-dark.svg';

  function getPreferredTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateLogos(theme) {
    const src = theme === 'dark' ? LOGO_DARK : LOGO_LIGHT;
    document.querySelectorAll('[data-site-logo]').forEach((img) => {
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
    const sponsorSrc = theme === 'dark' ? SPONSOR_LOGO_DARK : SPONSOR_LOGO_LIGHT;
    document.querySelectorAll('[data-sponsor-logo]').forEach((img) => {
      if (img.getAttribute('src') !== sponsorSrc) img.setAttribute('src', sponsorSrc);
    });
    document.querySelectorAll('link[rel="icon"]').forEach((link) => {
      link.setAttribute('href', src);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#121010' : '#faf7f4');
    }
    updateLogos(theme);
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      const isDark = theme === 'dark';
      btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.setAttribute('title', isDark ? 'Light mode' : 'Dark mode');
      btn.setAttribute('aria-pressed', String(isDark));
    });
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  // Apply immediately (also safe if called from head inline bootstrap)
  applyTheme(getPreferredTheme());

  window.YBFTheme = { applyTheme, toggleTheme, getPreferredTheme };

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getPreferredTheme());
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.addEventListener('click', toggleTheme);
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // --- Automatic Lightweight Site Visitor Tracking ---
  (function initVisitorTracking() {
    try {
      function getOrSetId(key, storage) {
        try {
          var id = storage.getItem(key);
          if (!id) {
            id = 'v-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
            storage.setItem(key, id);
          }
          return id;
        } catch (e) {
          return 'v-' + Math.random().toString(36).substring(2, 10);
        }
      }

      function cleanReferrer(ref) {
        if (!ref) return 'Direct';
        try {
          var url = new URL(ref);
          if (url.hostname === window.location.hostname) return 'Internal';
          var host = url.hostname.replace(/^www\./, '');
          if (/google\./i.test(host)) return 'Google Search';
          if (/bing\./i.test(host)) return 'Bing Search';
          if (/yahoo\./i.test(host)) return 'Yahoo';
          if (/facebook\.com|fb\.com/i.test(host)) return 'Facebook';
          if (/instagram\.com/i.test(host)) return 'Instagram';
          if (/whatsapp\.com|wa\.me/i.test(host)) return 'WhatsApp';
          if (/t\.co|twitter\.com|x\.com/i.test(host)) return 'X / Twitter';
          if (/linkedin\.com/i.test(host)) return 'LinkedIn';
          if (/youtube\.com/i.test(host)) return 'YouTube';
          return host;
        } catch (e) {
          return 'External Link';
        }
      }

      function sendVisitorPing() {
        try {
          var vid = getOrSetId('ybf_vid', localStorage);
          var sid = getOrSetId('ybf_sid', sessionStorage);
          var path = window.location.pathname || '/';
          var payload = {
            visitorId: vid,
            sessionId: sid,
            path: path,
            pageTitle: document.title || 'Yuva Blood Forum',
            referrer: cleanReferrer(document.referrer),
            screenRes: (window.screen ? window.screen.width + 'x' + window.screen.height : '')
          };

          var jsonStr = JSON.stringify(payload);
          if (navigator.sendBeacon) {
            var blob = new Blob([jsonStr], { type: 'application/json' });
            navigator.sendBeacon('/api/analytics/visit', blob);
          } else {
            fetch('/api/analytics/visit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: jsonStr,
              keepalive: true
            }).catch(function () {});
          }
        } catch (err) {}
      }

      if (document.readyState === 'complete') {
        setTimeout(sendVisitorPing, 100);
      } else {
        window.addEventListener('load', function () {
          setTimeout(sendVisitorPing, 100);
        });
      }
    } catch (e) {}
  })();
})();

