/* ConnectSphere – messages page (messages.html)
 * Endpoints this file expects (NOT confirmed to exist – see README):
 *   GET  /api/messages/conversations
 *   GET  /api/messages/conversations/:id        -> messages in that conversation
 *   POST /api/messages/conversations/:id {content}
 * With no messages API, SAMPLE conversations are shown (read-only) and the
 * message box is disabled with an explanation.
 */
const Messages = (() => {
  let conversations = [];
  let demo = false;
  let activeId = null;
  const el = {};

  function normalizeConversation(raw) {
    const u = raw.user || raw.participant || raw.with_user || {};
    const last = raw.last_message;
    return {
      id: String(raw.id ?? ''),
      user: {
        username: u.username || 'unknown',
        full_name: u.full_name || u.name || u.username || 'Unknown user',
        avatar_url: u.avatar_url || u.avatar || '',
        online: Boolean(u.online)
      },
      unread: Number(raw.unread ?? raw.unread_count ?? 0) || 0,
      updated_at: raw.updated_at || (last && last.created_at) || '',
      preview: raw.preview || (last && (last.content || last.text)) || '',
      messages: Array.isArray(raw.messages) ? raw.messages.map(normalizeMessage) : null
    };
  }

  function normalizeMessage(m) {
    return {
      id: String(m.id ?? ''),
      mine: Boolean(m.mine ?? m.is_mine ?? (Auth.getUser() && String(m.sender_id) === String(Auth.getUser().id))),
      content: m.content ?? m.text ?? '',
      created_at: m.created_at || m.createdAt || ''
    };
  }

  function previewOf(c) {
    if (c.preview) return c.preview;
    const last = c.messages && c.messages[c.messages.length - 1];
    return last ? last.content : 'No messages yet';
  }

  function renderList(filterText = '') {
    const q = filterText.toLowerCase();
    const list = conversations.filter((c) => !q || `${c.user.full_name} ${c.user.username}`.toLowerCase().includes(q));
    if (!list.length) {
      el.list.innerHTML = `<li>${UI.stateBlock({ icon: 'fa-envelope', title: q ? 'No matches' : 'No conversations yet',
        text: q ? 'Try a different name.' : 'When you message someone, the conversation will show up here.' })}</li>`;
      return;
    }
    el.list.innerHTML = list.map((c) => `
      <li><button class="convo${c.id === activeId ? ' is-active' : ''}" type="button" data-id="${UI.esc(c.id)}">
        <span class="convo-avatar">${UI.avatar(c.user, 'md')}${c.user.online ? '<span class="online"></span>' : ''}</span>
        <span class="convo-text"><strong>${UI.esc(c.user.full_name)}</strong><small>${UI.esc(previewOf(c))}</small></span>
        <span class="convo-side"><small>${UI.esc(UI.timeAgo(c.updated_at))}</small>${c.unread ? `<span class="count-badge" aria-label="${c.unread} unread">${c.unread}</span>` : ''}</span>
      </button></li>`).join('');
  }

  function renderThread(c) {
    el.thread.hidden = false;
    el.empty.hidden = true;
    document.body.classList.add('thread-open');
    el.threadHead.innerHTML = `<button class="icon-btn thread-back" type="button" data-back aria-label="Back to conversations"><i class="fa-solid fa-arrow-left"></i></button>
      <a class="thread-user" href="profile.html?user=${encodeURIComponent(c.user.username)}">${UI.avatar(c.user, 'sm')}<span><strong>${UI.esc(c.user.full_name)}</strong><small>@${UI.esc(c.user.username)}</small></span></a>`;
    const msgs = c.messages || [];
    el.messages.innerHTML = msgs.length
      ? msgs.map((m) => `<li class="bubble ${m.mine ? 'mine' : 'theirs'}"><p>${UI.esc(m.content)}</p><time>${UI.esc(UI.timeAgo(m.created_at))}</time></li>`).join('')
      : '<li class="comments-empty">Say hello to start the conversation.</li>';
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  async function open(id) {
    const c = conversations.find((x) => x.id === id);
    if (!c) return;
    activeId = id;
    c.unread = 0;
    if (c.messages === null && !demo) {
      el.messages.innerHTML = '<li class="comments-loading"><span class="spinner"></span> Loading…</li>';
      el.thread.hidden = false;
      try {
        const data = await Api.get(`/messages/conversations/${encodeURIComponent(id)}`);
        c.messages = Api.list(data, 'messages').map(normalizeMessage);
      } catch (err) {
        c.messages = [];
        UI.toast(err.isMissing ? 'Reading messages needs GET /api/messages/conversations/:id.' : err.message, 'error');
      }
    }
    renderThread(c);
    renderList(el.search.value);
    el.input.focus({ preventScroll: true });
  }

  function setupComposer() {
    const form = el.composer;
    if (demo) {
      el.input.disabled = true;
      el.sendBtn.disabled = true;
      el.input.placeholder = 'Sending messages needs backend support';
      el.composerNote.hidden = false;
    } else {
      el.input.disabled = false;
      el.sendBtn.disabled = false;
      el.composerNote.hidden = true;
    }
    form.onsubmit = async (e) => {
      e.preventDefault();
      const c = conversations.find((x) => x.id === activeId);
      const text = el.input.value.trim();
      if (!c || !text || demo) return;
      UI.setLoading(el.sendBtn, true, '');
      try {
        const data = await Api.post(`/messages/conversations/${encodeURIComponent(c.id)}`, { content: text });
        const saved = Api.item(data, 'message');
        c.messages = [...(c.messages || []), normalizeMessage({ ...(saved || {}), mine: true, content: (saved && saved.content) || text, created_at: (saved && saved.created_at) || new Date().toISOString() })];
        c.updated_at = new Date().toISOString();
        el.input.value = '';
        renderThread(c);
        renderList(el.search.value);
      } catch (err) {
        UI.toast(err.isMissing ? 'Sending needs POST /api/messages/conversations/:id on the backend.' : err.message, 'error');
      } finally {
        UI.setLoading(el.sendBtn, false);
      }
    };
  }

  async function load() {
    el.list.innerHTML = Array.from({ length: 4 }, () => '<li class="convo skeleton-row" aria-hidden="true"><span class="skeleton sk-circle"></span><span class="sk-col"><span class="skeleton sk-line w40"></span><span class="skeleton sk-line w70"></span></span></li>').join('');
    try {
      const data = await Api.get('/messages/conversations');
      conversations = Api.list(data, 'conversations').map(normalizeConversation);
      demo = false;
    } catch (err) {
      if (err.isMissing) {
        conversations = SAMPLE.conversations.map(normalizeConversation);
        demo = true;
        el.banner.hidden = false;
      } else {
        el.list.innerHTML = `<li>${UI.stateBlock({ icon: 'fa-triangle-exclamation', title: 'Could not load messages', text: err.message,
          actionHTML: '<button class="btn btn-primary" type="button" data-retry>Try again</button>' })}</li>`;
        return;
      }
    }
    setupComposer();
    renderList();
  }

  function init() {
    if (!Layout.mount()) return;
    Object.assign(el, {
      list: document.getElementById('convoList'), banner: document.getElementById('demoBanner'),
      thread: document.getElementById('thread'), threadHead: document.getElementById('threadHead'),
      messages: document.getElementById('threadMessages'), empty: document.getElementById('threadEmpty'),
      composer: document.getElementById('composer'), input: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'), composerNote: document.getElementById('composerNote'),
      search: document.getElementById('convoSearch')
    });
    el.list.addEventListener('click', (e) => {
      if (e.target.closest('[data-retry]')) { load(); return; }
      const row = e.target.closest('.convo[data-id]');
      if (row) open(row.dataset.id);
    });
    el.threadHead.addEventListener('click', (e) => {
      if (e.target.closest('[data-back]')) { document.body.classList.remove('thread-open'); activeId = null; renderList(el.search.value); }
    });
    el.search.addEventListener('input', () => renderList(el.search.value));
    load();
  }
  return { init };
})();

document.addEventListener('DOMContentLoaded', Messages.init);
