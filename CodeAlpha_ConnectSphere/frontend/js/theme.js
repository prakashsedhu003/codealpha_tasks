/* ConnectSphere – light / dark theme
 * Loaded in <head> (not deferred) so the saved theme is applied before the
 * page paints. Any element with [data-theme-toggle] switches the theme.
 */
(function () {
  var KEY = 'cs_theme';

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function current() {
    var s = saved();
    if (s === 'dark' || s === 'light') return s;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a1020' : '#eef2f9');
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      buttons[i].setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function set(theme) {
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: theme just won't persist */ }
    apply(theme);
  }

  window.Theme = {
    get: current,
    set: set,
    toggle: function () { set(current() === 'dark' ? 'light' : 'dark'); },
    refresh: function () { apply(current()); }
  };

  apply(current());

  // One delegated listener handles every toggle button, including ones added later.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (btn) window.Theme.toggle();
  });
})();
