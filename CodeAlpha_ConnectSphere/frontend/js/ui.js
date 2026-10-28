/* ConnectSphere – shared UI helpers */
const UI = (() => {
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /** Escape text before putting it into an HTML string (prevents XSS). */
  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Only allow http(s) URLs (blocks javascript: and data: URLs). Returns '' when unsafe. */
  function safeUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), window.location.origin);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (e) {
      return '';
    }
  }

  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p.charAt(0).toUpperCase()).join('') || '?';
  }

  /** Avatar markup. If the image fails to load, the initials show instead. */
  function avatar(user, size = 'md') {
    const name = (user && (user.full_name || user.name || user.username)) || '?';
    const url = safeUrl(user && (user.avatar_url || user.avatar));
    const ini = initials(name);
    return `<span class="avatar avatar-${size}" data-initials="${esc(ini)}">${
      url ? `<img src="${esc(url)}" alt="" loading="lazy" data-avatar>` : esc(ini)
    }</span>`;
  }

  /** Media markup (image) that falls back to a friendly placeholder. */
  function mediaImage(url, alt = '') {
    const safe = safeUrl(url);
    if (!safe) return '';
    return `<img class="media-img" src="${esc(safe)}" alt="${esc(alt)}" loading="lazy" data-media>`;
  }

  // Handle broken images anywhere on the page (error events don't bubble, so use capture).
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG') return;
      if (img.hasAttribute('data-avatar')) {
        const wrap = img.parentElement;
        img.remove();
        if (wrap) wrap.textContent = wrap.dataset.initials || '?';
      } else if (img.hasAttribute('data-media')) {
        const fb = document.createElement('div');
        fb.className = 'media-fallback';
        fb.innerHTML = '<i class="fa-regular fa-image" aria-hidden="true"></i><span>Image unavailable</span>';
        img.replaceWith(fb);
      }
    },
    true
  );

  function timeAgo(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (seconds < 45) return 'just now';
    if (seconds < 3600) return plural(Math.round(seconds / 60), 'min');
    if (seconds < 86400) return plural(Math.round(seconds / 3600), 'hour');
    if (seconds < 604800) return plural(Math.round(seconds / 86400), 'day');
    if (seconds < 2592000) return plural(Math.round(seconds / 604800), 'week');
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    function plural(n, unit) {
      return `${n} ${unit}${n === 1 || unit === 'min' ? '' : 's'} ago`;
    }
  }

  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  }

  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  /** Small pop-up message. type: 'info' | 'success' | 'error' */
  function toast(message, type = 'info', duration = 4200) {
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      root.className = 'toast-root';
      root.setAttribute('aria-live', 'polite');
      document.body.appendChild(root);
    }
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', error: 'fa-circle-exclamation' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}" aria-hidden="true"></i><span></span>`;
    el.querySelector('span').textContent = message; // textContent = safe
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /** Generic modal built on the native <dialog> element. Resolves { ok, value }. */
  function openDialog({ title, bodyHTML, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'dialog';
      dlg.setAttribute('aria-labelledby', 'dlg-title');
      dlg.innerHTML = `
        <form method="dialog" class="dialog-form">
          <h2 class="dialog-title" id="dlg-title">${esc(title)}</h2>
          <div class="dialog-body">${bodyHTML}</div>
          <div class="dialog-actions">
            <button class="btn btn-ghost" type="submit" value="cancel" formnovalidate>${esc(cancelLabel)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="submit" value="ok">${esc(confirmLabel)}</button>
          </div>
        </form>`;
      document.body.appendChild(dlg);
      dlg.addEventListener('close', () => {
        const field = dlg.querySelector('textarea, input');
        resolve({ ok: dlg.returnValue === 'ok', value: field ? field.value : '' });
        dlg.remove();
      });
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close('cancel'); }); // click on backdrop
      dlg.showModal();
    });
  }

  async function confirmDialog(title, message, confirmLabel = 'Confirm', danger = false) {
    const { ok } = await openDialog({ title, bodyHTML: `<p>${esc(message)}</p>`, confirmLabel, danger });
    return ok;
  }

  async function promptText({ title, label, value = '', maxLength = MAX_POST_LENGTH, confirmLabel = 'Save' }) {
    const { ok, value: text } = await openDialog({
      title,
      confirmLabel,
      bodyHTML: `<label class="field-label" for="dlg-text">${esc(label)}</label>
        <textarea id="dlg-text" class="input textarea" rows="5" maxlength="${maxLength}" required autofocus>${esc(value)}</textarea>`
    });
    return ok ? text.trim() : null;
  }

  /** Put a button into / out of a loading state. */
  function setLoading(button, loading, label) {
    if (!button) return;
    if (loading) {
      button.dataset.label = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${esc(label || 'Please wait…')}</span>`;
    } else {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (button.dataset.label) button.innerHTML = button.dataset.label;
    }
  }

  function skeletonPosts(n = 2) {
    return Array.from({ length: n }, () => `
      <div class="post-card skeleton-card" aria-hidden="true">
        <div class="sk-row"><span class="skeleton sk-circle"></span><div class="sk-col"><span class="skeleton sk-line w40"></span><span class="skeleton sk-line w25"></span></div></div>
        <span class="skeleton sk-line w90"></span><span class="skeleton sk-line w70"></span>
        <span class="skeleton sk-media"></span>
      </div>`).join('');
  }

  /** Empty / error state block. */
  function stateBlock({ icon, title, text, actionHTML = '' }) {
    return `<div class="state-block">
      <span class="state-icon"><i class="fa-solid ${esc(icon)}" aria-hidden="true"></i></span>
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      ${actionHTML}
    </div>`;
  }

  return { qs, qsa, esc, safeUrl, initials, avatar, mediaImage, timeAgo, formatCount, debounce, toast, copyText,
           openDialog, confirmDialog, promptText, setLoading, skeletonPosts, stateBlock };
})();
