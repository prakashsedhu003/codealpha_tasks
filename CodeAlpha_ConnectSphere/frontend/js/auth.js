/* ConnectSphere – authentication
 * Part 1: Auth (token storage + page guard) used by every page.
 * Part 2: login.html and register.html form handlers.
 *
 * The backend's login response format was not available while building this,
 * so the token / user are read defensively (see extractToken / extractUser).
 * If your response uses another field name, add it in those two functions.
 */
const Auth = (() => {
  const read = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ } };
  const remove = (key) => { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } };

  function extractToken(data) {
    if (!data || typeof data !== 'object') return null;
    const inner = data.data && typeof data.data === 'object' ? data.data : {};
    const t = data.token || data.accessToken || data.access_token || data.jwt ||
              inner.token || inner.accessToken || inner.access_token || inner.jwt;
    return typeof t === 'string' && t ? t : null;
  }

  function extractUser(data) {
    if (!data || typeof data !== 'object') return null;
    const inner = data.data && typeof data.data === 'object' ? data.data : null;
    const u = data.user || (inner && inner.user) || null;
    if (u && typeof u === 'object') return u;
    // Some APIs return the user fields at the top level next to the token.
    if (data.username || data.email) {
      const { token, accessToken, access_token, jwt, password, ...rest } = data;
      return rest;
    }
    return null;
  }

  return {
    getToken: () => read(STORAGE.token),
    getUser() {
      try { return JSON.parse(read(STORAGE.user) || 'null'); } catch (e) { return null; }
    },
    setUser(user) { if (user) write(STORAGE.user, JSON.stringify(user)); },
    isLoggedIn: () => Boolean(read(STORAGE.token) || read(STORAGE.session) === 'cookie'),

    /** Save what the login response gives us. Returns false if it gave us nothing usable. */
    saveSession(data) {
      const token = extractToken(data);
      const user = extractUser(data);
      if (token) {
        write(STORAGE.token, token);
        remove(STORAGE.session);
      } else {
        write(STORAGE.session, 'cookie'); // server may have set an httpOnly cookie instead
      }
      if (user) {
        const { password, ...safeUser } = user; // never keep a password field around
        write(STORAGE.user, JSON.stringify(safeUser));
      }
      return true;
    },

    clear() {
      remove(STORAGE.token);
      remove(STORAGE.user);
      remove(STORAGE.session);
      try { sessionStorage.removeItem(STORAGE.unread); } catch (e) { /* ignore */ }
    },

    expireSession() {
      Auth.clear();
      window.location.replace('login.html?expired=1');
    },

    logout() {
      Auth.clear();
      window.location.href = 'login.html';
    },

    /** Call at the top of every protected page. */
    requireLogin() {
      if (!Auth.isLoggedIn()) {
        window.location.replace('login.html');
        return false;
      }
      return true;
    },

    /** Best-effort username of whoever is logged in. */
    currentUsername() {
      const u = Auth.getUser();
      return (u && (u.username || u.user_name)) || null;
    },

    /** Is this user object the logged-in user? */
    isMe(user) {
      const me = Auth.getUser();
      if (!me || !user) return false;
      if (me.id != null && user.id != null) return String(me.id) === String(user.id);
      return Boolean(me.username && user.username && me.username === user.username);
    }
  };
})();

/* ---------- Form helpers (login + register) ---------- */
const AuthForms = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function fieldOf(input) { return input.closest('.field'); }

  function setError(input, message) {
    const field = fieldOf(input);
    const note = field && field.querySelector('.field-error');
    if (!note) return;
    note.textContent = message || '';
    note.hidden = !message;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    field.classList.toggle('has-error', Boolean(message));
  }

  function showFormError(form, message) {
    const box = form.querySelector('.form-alert');
    if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
  }

  /** Show / hide password buttons: <button data-toggle-password="inputId"> */
  function bindPasswordToggles() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-toggle-password]');
      if (!btn) return;
      const input = document.getElementById(btn.dataset.togglePassword);
      if (!input) return;
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.setAttribute('aria-pressed', String(show));
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      btn.querySelector('i').className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    });
  }

  function clearOnInput(form) {
    form.addEventListener('input', (e) => {
      if (e.target.matches('input')) setError(e.target, '');
      showFormError(form, '');
    });
  }

  function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    const email = form.elements.email;
    const password = form.elements.password;
    const button = form.querySelector('button[type="submit"]');
    clearOnInput(form);

    const params = new URLSearchParams(window.location.search);
    const notice = document.getElementById('pageNotice');
    if (notice) {
      if (params.get('registered')) {
        notice.textContent = 'Account created. Log in to continue.';
        notice.hidden = false;
      } else if (params.get('expired')) {
        notice.textContent = 'Your session expired. Please log in again.';
        notice.hidden = false;
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showFormError(form, '');
      let firstBad = null;
      const mark = (input, msg) => { setError(input, msg); if (msg && !firstBad) firstBad = input; };

      const emailValue = email.value.trim();
      mark(email, !emailValue ? 'Enter your email address.' : !EMAIL_RE.test(emailValue) ? 'Enter a valid email address.' : '');
      mark(password, !password.value ? 'Enter your password.' : '');
      if (firstBad) { firstBad.focus(); return; }

      UI.setLoading(button, true, 'Logging in…');
      try {
        const data = await Api.post('/auth/login', { email: emailValue, password: password.value }, { auth: false });
        if (data && data.success === false) throw new ApiError(data.message || 'Login failed.', 400, data);
        Auth.saveSession(data);
        window.location.href = 'index.html';
      } catch (err) {
        UI.setLoading(button, false);
        if (err.status === 400 || err.status === 401 || err.status === 403) {
          // Prefer the server's own wording; otherwise stay generic (never reveal if an email exists).
          const serverMsg = err.data && (err.data.message || err.data.error);
          showFormError(form, typeof serverMsg === 'string' ? serverMsg : 'Incorrect email or password.');
        } else {
          showFormError(form, err.message);
        }
        password.value = '';
        password.focus();
      }
    });
  }

  function initRegister() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    const f = form.elements;
    const button = form.querySelector('button[type="submit"]');
    clearOnInput(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showFormError(form, '');
      let firstBad = null;
      const mark = (input, msg) => { setError(input, msg); if (msg && !firstBad) firstBad = input; };

      const username = f.username.value.trim();
      const fullName = f.full_name.value.trim();
      const email = f.email.value.trim();
      const pw = f.password.value;

      mark(f.username, !username ? 'Choose a username.'
        : !/^[A-Za-z0-9_.]{3,30}$/.test(username) ? 'Use 3–30 letters, numbers, dots or underscores.' : '');
      mark(f.full_name, fullName.length < 2 ? 'Enter your full name.' : '');
      mark(f.email, !email ? 'Enter your email address.' : !EMAIL_RE.test(email) ? 'Enter a valid email address.' : '');
      mark(f.password, pw.length < MIN_PASSWORD_LENGTH ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
        : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Include at least one letter and one number.' : '');
      mark(f.confirm_password, f.confirm_password.value !== pw ? 'Passwords do not match.' : '');
      if (firstBad) { firstBad.focus(); return; }

      UI.setLoading(button, true, 'Creating account…');
      try {
        const data = await Api.post('/auth/register',
          { username, full_name: fullName, email, password: pw }, { auth: false });
        if (data && data.success === false) throw new ApiError(data.message || 'Registration failed.', 400, data);
        // Only now has the server confirmed the account exists.
        window.location.href = 'login.html?registered=1';
      } catch (err) {
        UI.setLoading(button, false);
        showFormError(form, err.message);
        if (err.status === 409) {
          const text = (err.message || '').toLowerCase();
          if (text.includes('email')) { mark(f.email, 'This email is already registered.'); f.email.focus(); }
          else if (text.includes('user')) { mark(f.username, 'This username is taken.'); f.username.focus(); }
        }
      }
    });
  }

  function init() {
    bindPasswordToggles();
    // Logged-in visitors don't need the login / register pages.
    if (document.body.dataset.page === 'login' || document.body.dataset.page === 'register') {
      if (Auth.isLoggedIn() && !new URLSearchParams(window.location.search).get('expired')) {
        window.location.replace('index.html');
        return;
      }
    }
    initLogin();
    initRegister();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', AuthForms.init);
