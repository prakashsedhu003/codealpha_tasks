/* ConnectSphere – shared layout
 * Builds the sidebar, top bar and mobile bottom navigation so every page
 * shares one copy of the navigation instead of repeating it.
 * Each page needs: <aside id="sidebar">, <header id="topbar">, <nav id="bottomNav">.
 */
const Layout = (() => {
  const NAV = [
    { key: 'home', label: 'Home', href: 'index.html', icon: 'fa-house' },
    { key: 'explore', label: 'Explore', href: 'index.html?view=explore', icon: 'fa-compass' },
    { key: 'messages', label: 'Messages', href: 'messages.html', icon: 'fa-envelope' },
    { key: 'notifications', label: 'Notifications', href: 'notifications.html', icon: 'fa-bell', badge: true },
    { key: 'saved', label: 'Saved', href: 'index.html?view=saved', icon: 'fa-bookmark' },
    { key: 'profile', label: 'Profile', href: 'profile.html', icon: 'fa-user' }
  ];

  const LOGO = `<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">
    <rect width="32" height="32" rx="10" fill="#2563EB"/>
    <circle cx="16" cy="16" r="7" fill="none" stroke="#fff" stroke-width="2.4"/>
    <circle cx="23" cy="9" r="2.6" fill="#fff"/></svg>`;

  const params = new URLSearchParams(window.location.search);

  function activeKey() {
    const page = document.body.dataset.page;
    if (page === 'home') return params.get('view') || 'home';
    if (page === 'profile') return params.get('user') && params.get('user') !== Auth.currentUsername() ? '' : 'profile';
    return page;
  }

  function navLink(item, active) {
    const current = item.key === active ? ' aria-current="page"' : '';
    return `<li><a class="side-link${item.key === active ? ' is-active' : ''}" href="${item.href}"${current}>
      <span class="side-icon"><i class="fa-solid ${item.icon}" aria-hidden="true"></i>${
        item.badge ? '<span class="dot" data-unread-dot hidden></span>' : ''}</span>
      <span class="side-label">${item.label}</span></a></li>`;
  }

  function renderSidebar(active) {
    const el = document.getElementById('sidebar');
    if (!el) return;
    const me = Auth.getUser() || {};
    el.innerHTML = `
      <a class="brand" href="index.html" aria-label="ConnectSphere home">${LOGO}<span class="brand-name">ConnectSphere</span></a>
      <nav aria-label="Primary"><ul class="side-nav">${NAV.map((n) => navLink(n, active)).join('')}</ul></nav>
      <a class="btn btn-primary btn-block side-create" href="create-post.html"><i class="fa-solid fa-plus" aria-hidden="true"></i><span class="side-label">New post</span></a>
      <div class="side-foot">
        <a class="side-user" href="profile.html" aria-label="Your profile">
          ${UI.avatar(me, 'sm')}
          <span class="side-label side-user-text"><strong>${UI.esc(me.full_name || me.name || me.username || 'You')}</strong>
          <small>${me.username ? '@' + UI.esc(me.username) : ''}</small></span>
        </a>
        <div class="side-tools">
          <button class="icon-btn" type="button" data-theme-toggle aria-label="Switch theme">
            <i class="fa-solid fa-moon icon-moon" aria-hidden="true"></i><i class="fa-solid fa-sun icon-sun" aria-hidden="true"></i>
          </button>
          <button class="icon-btn" type="button" data-logout aria-label="Log out"><i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i></button>
        </div>
      </div>`;
  }

  function renderTopbar() {
    const el = document.getElementById('topbar');
    if (!el) return;
    const me = Auth.getUser() || {};
    el.innerHTML = `
      <div class="topbar-inner">
        <button class="icon-btn topbar-search-btn" type="button" data-search-toggle aria-label="Search" aria-expanded="false" aria-controls="searchForm">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button>
        <a class="wordmark" href="index.html" aria-label="ConnectSphere home">Connect<span>Sphere</span></a>
        <form class="search-box" id="searchForm" role="search" autocomplete="off">
          <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input id="globalSearch" type="search" name="q" placeholder="Search posts and people" aria-label="Search posts and people" maxlength="80">
          <button class="icon-btn search-close" type="button" data-search-close aria-label="Close search"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </form>
        <div class="topbar-actions">
          <a class="icon-btn mobile-only" href="messages.html" aria-label="Messages"><i class="fa-regular fa-comment-dots" aria-hidden="true"></i></a>
          <button class="icon-btn mobile-only" type="button" data-theme-toggle aria-label="Switch theme">
            <i class="fa-solid fa-moon icon-moon" aria-hidden="true"></i><i class="fa-solid fa-sun icon-sun" aria-hidden="true"></i></button>
          <a class="icon-btn desktop-only has-dot" href="notifications.html" aria-label="Notifications">
            <i class="fa-regular fa-bell" aria-hidden="true"></i><span class="dot" data-unread-dot hidden></span></a>
          <a class="btn btn-primary create-btn" href="create-post.html" aria-label="Create post"><i class="fa-solid fa-plus" aria-hidden="true"></i><span class="create-label">Create</span></a>
          <a class="avatar-link desktop-only" href="profile.html" aria-label="Your profile">${UI.avatar(me, 'sm')}</a>
        </div>
      </div>`;
  }

  function renderBottomNav(active) {
    const el = document.getElementById('bottomNav');
    if (!el) return;
    const item = (key, label, href, icon, extra = '') =>
      `<a class="bn-item${active === key ? ' is-active' : ''}" href="${href}"${active === key ? ' aria-current="page"' : ''}>
        <span class="bn-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i>${extra}</span><span>${label}</span></a>`;
    el.innerHTML = `
      ${item('home', 'Home', 'index.html', 'fa-house')}
      ${item('explore', 'Search', 'index.html?view=explore&focus=1', 'fa-magnifying-glass')}
      <a class="bn-create" href="create-post.html" aria-label="Create post"><i class="fa-solid fa-plus" aria-hidden="true"></i></a>
      ${item('notifications', 'Alerts', 'notifications.html', 'fa-bell', '<span class="dot" data-unread-dot hidden></span>')}
      ${item('profile', 'Profile', 'profile.html', 'fa-user')}`;
  }

  /* ---- Search box (expands on mobile, always open on desktop) ---- */
  function bindSearch() {
    const topbar = document.getElementById('topbar');
    const form = document.getElementById('searchForm');
    const input = document.getElementById('globalSearch');
    if (!topbar || !form || !input) return;
    const toggle = topbar.querySelector('[data-search-toggle]');

    const setOpen = (open) => {
      topbar.classList.toggle('search-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) input.focus();
    };
    toggle.addEventListener('click', () => setOpen(true));
    topbar.querySelector('[data-search-close]').addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input'));
      setOpen(false);
      toggle.focus();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') topbar.querySelector('[data-search-close]').click(); });

    const initial = params.get('q');
    if (initial) { input.value = initial; setOpen(true); }
    if (params.get('focus')) setOpen(true);

    // Home page listens to this event and filters the feed live.
    input.addEventListener('input', UI.debounce(() => {
      document.dispatchEvent(new CustomEvent('cs:search', { detail: { q: input.value.trim() } }));
    }, 200));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (document.body.dataset.page === 'home') {
        document.dispatchEvent(new CustomEvent('cs:search', { detail: { q } }));
      } else {
        window.location.href = `index.html?view=explore${q ? '&q=' + encodeURIComponent(q) : ''}`;
      }
    });

    // Trending topics and other widgets can call this.
    document.addEventListener('cs:set-search', (e) => {
      setOpen(true);
      input.value = e.detail.q;
      input.dispatchEvent(new Event('input'));
    });
  }

  /* ---- Unread notification dot ---- */
  function readUnread() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE.unread) || 'null'); } catch (e) { return null; }
  }

  function setUnread(count, demo = false) {
    try { sessionStorage.setItem(STORAGE.unread, JSON.stringify({ count, demo })); } catch (e) { /* ignore */ }
    UI.qsa('[data-unread-dot]').forEach((dot) => { dot.hidden = !(count > 0); });
  }

  /** Ask the server once per session; later pages reuse the cached answer. */
  async function refreshUnread() {
    const cached = readUnread();
    if (cached) { setUnread(cached.count, cached.demo); return; }
    if (document.body.dataset.page === 'notifications') return; // that page sets it itself
    try {
      const data = await Api.get('/notifications');
      const list = Api.list(data, 'notifications');
      setUnread(list.filter((n) => n.is_read === false || n.read === false || n.read_at === null).length);
    } catch (err) {
      if (err.isMissing) setUnread(3, true); // matches the sample notifications shown on that page
    }
  }

  function bindLogout() {
    document.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-logout]')) return;
      if (await UI.confirmDialog('Log out?', 'You will need to log in again to use ConnectSphere.', 'Log out')) Auth.logout();
    });
  }

  function mount() {
    if (document.body.dataset.auth !== 'public' && !Auth.requireLogin()) return false;
    const active = activeKey();
    renderSidebar(active);
    renderTopbar();
    renderBottomNav(active);
    Theme.refresh();
    bindSearch();
    bindLogout();
    refreshUnread();
    return true;
  }

  return { mount, setUnread };
})();
