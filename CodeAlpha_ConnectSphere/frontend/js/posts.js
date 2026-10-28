/* ConnectSphere – posts
 * Part 1: Posts – builds post cards and handles every action on them.
 * Part 2: CreatePost – the create-post.html page.
 *
 * Endpoints this file expects (NOT confirmed to exist – see README):
 *   GET    /api/posts                      list posts for the feed
 *   POST   /api/posts            {content, image_url}
 *   PUT    /api/posts/:id        {content}
 *   DELETE /api/posts/:id
 *   POST   /api/posts/:id/like           DELETE /api/posts/:id/like
 *   GET    /api/posts/:id/comments       POST /api/posts/:id/comments {content}
 */
const Posts = (() => {
  const LONG_TEXT = 120;      // captions longer than this get a "see more" button
  const store = new Map();    // id -> normalized post
  let mode = 'live';          // 'live' = real API data, 'demo' = sample data (nothing is saved)

  /* ---------- Saved posts (bookmarks) are kept on this device ---------- */
  function savedIds() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE.saved) || '[]')); } catch (e) { return new Set(); }
  }
  function writeSaved(set) {
    try { localStorage.setItem(STORAGE.saved, JSON.stringify([...set])); } catch (e) { /* ignore */ }
  }
  const isSaved = (id) => savedIds().has(String(id));

  /* ---------- Turn whatever the API returns into one predictable shape ---------- */
  function normalize(raw) {
    const r = raw || {};
    const u = r.user || r.author || r.owner_user || {};
    const user = {
      id: u.id ?? r.user_id ?? r.author_id ?? null,
      username: u.username || r.username || 'unknown',
      full_name: u.full_name || u.name || r.full_name || r.author_name || u.username || r.username || 'Unknown user',
      avatar_url: u.avatar_url || u.avatar || r.avatar_url || ''
    };
    return {
      id: String(r.id ?? r.post_id ?? ''),
      user,
      content: r.content ?? r.caption ?? r.text ?? '',
      image_url: r.image_url || r.image || r.media_url || '',
      video_url: r.video_url || '',
      type: r.type || (r.video_url ? 'video' : 'image'),
      created_at: r.created_at || r.createdAt || r.timestamp || '',
      likes_count: Number(r.likes_count ?? r.like_count ?? r.likes ?? 0) || 0,
      comments_count: Number(r.comments_count ?? r.comment_count ?? (Array.isArray(r.comments) ? r.comments.length : r.comments) ?? 0) || 0,
      shares_count: Number(r.shares_count ?? 0) || 0,
      liked: Boolean(r.liked ?? r.liked_by_me ?? r.is_liked ?? r.has_liked ?? false),
      comments: Array.isArray(r.comments) ? r.comments.map(normalizeComment) : null, // null = not loaded yet
      local: Boolean(r.local)
    };
  }

  function normalizeComment(c) {
    const u = c.user || c.author || {};
    return {
      id: String(c.id ?? ''),
      user: {
        username: u.username || c.username || 'unknown',
        full_name: u.full_name || u.name || c.full_name || u.username || c.username || 'Unknown user',
        avatar_url: u.avatar_url || u.avatar || ''
      },
      content: c.content ?? c.text ?? c.comment ?? '',
      created_at: c.created_at || c.createdAt || ''
    };
  }

  function register(posts) {
    posts.forEach((p) => store.set(p.id, p));
  }

  /* ---------- HTML ---------- */
  function mediaHTML(p) {
    const img = UI.safeUrl(p.image_url);
    if (p.type === 'video' && p.video_url) {
      return `<div class="post-media is-video" data-action="play" role="button" tabindex="0" aria-label="Play video">
        ${img ? UI.mediaImage(img, 'Video preview') : '<div class="media-fallback"><i class="fa-solid fa-film"></i></div>'}
        <span class="play-btn" aria-hidden="true"><i class="fa-solid fa-play"></i></span></div>`;
    }
    return img ? `<div class="post-media">${UI.mediaImage(img, 'Post image')}</div>` : '';
  }

  function commentHTML(c) {
    return `<li class="comment">
      <a href="profile.html?user=${encodeURIComponent(c.user.username)}">${UI.avatar(c.user, 'xs')}</a>
      <div class="comment-bubble"><a class="comment-name" href="profile.html?user=${encodeURIComponent(c.user.username)}">${UI.esc(c.user.full_name)}</a>
      <span class="comment-time">${UI.esc(UI.timeAgo(c.created_at))}</span>
      <p>${UI.esc(c.content)}</p></div></li>`;
  }

  function render(p) {
    const own = Auth.isMe(p.user);
    const long = p.content.length > LONG_TEXT;
    const saved = isSaved(p.id);
    const profileHref = `profile.html?user=${encodeURIComponent(p.user.username)}`;
    return `
    <article class="post-card" data-id="${UI.esc(p.id)}" aria-label="Post by ${UI.esc(p.user.full_name)}">
      <header class="post-head">
        <a href="${profileHref}" class="post-avatar" aria-label="${UI.esc(p.user.full_name)}'s profile">${UI.avatar(p.user, 'md')}</a>
        <div class="post-who">
          <a class="post-name" href="${profileHref}">${UI.esc(p.user.full_name)}</a>
          <span class="post-meta">@${UI.esc(p.user.username)} · <time datetime="${UI.esc(p.created_at)}">${UI.esc(UI.timeAgo(p.created_at) || 'recently')}</time>${
            p.local ? ' · <span class="badge-local">Not saved</span>' : ''}</span>
        </div>
        <div class="menu-wrap">
          <button class="icon-btn" type="button" data-action="menu" aria-haspopup="menu" aria-expanded="false" aria-label="Post options">
            <i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>
          <div class="menu" role="menu" hidden>
            <button class="menu-item" role="menuitem" type="button" data-action="copy-link"><i class="fa-regular fa-copy"></i>Copy link</button>
            <button class="menu-item" role="menuitem" type="button" data-action="save"><i class="fa-regular fa-bookmark"></i><span data-save-label>${saved ? 'Remove from saved' : 'Save post'}</span></button>
            ${own ? `<button class="menu-item" role="menuitem" type="button" data-action="edit"><i class="fa-regular fa-pen-to-square"></i>Edit post</button>
            <button class="menu-item danger" role="menuitem" type="button" data-action="delete"><i class="fa-regular fa-trash-can"></i>Delete post</button>` : ''}
          </div>
        </div>
      </header>
      ${p.content ? `<div class="post-body"><p class="post-text${long ? ' is-clamped' : ''}">${UI.esc(p.content)}</p>${
        long ? '<button class="see-more" type="button" data-action="more" aria-expanded="false">see more</button>' : ''}</div>` : ''}
      ${mediaHTML(p)}
      <div class="post-actions">
        <button class="act act-like${p.liked ? ' is-on' : ''}" type="button" data-action="like" aria-pressed="${p.liked}" aria-label="Like">
          <span class="act-chip"><i class="${p.liked ? 'fa-solid' : 'fa-regular'} fa-heart" aria-hidden="true"></i></span><span class="act-count" data-like-count>${UI.formatCount(p.likes_count)}</span></button>
        <button class="act act-comment" type="button" data-action="comments" aria-expanded="false" aria-label="Comments">
          <span class="act-chip"><i class="fa-regular fa-comment" aria-hidden="true"></i></span><span class="act-count" data-comment-count>${UI.formatCount(p.comments_count)}</span></button>
        <button class="act act-share" type="button" data-action="share" aria-label="Share">
          <span class="act-chip"><i class="fa-regular fa-paper-plane" aria-hidden="true"></i></span>${p.shares_count ? `<span class="act-count">${UI.formatCount(p.shares_count)}</span>` : ''}</button>
        <button class="act act-save${saved ? ' is-on' : ''}" type="button" data-action="save" aria-pressed="${saved}" aria-label="Save post">
          <span class="act-chip"><i class="${saved ? 'fa-solid' : 'fa-regular'} fa-bookmark" aria-hidden="true"></i></span></button>
      </div>
      <section class="comments" hidden aria-label="Comments">
        <ul class="comment-list"></ul>
        <p class="comments-note" hidden></p>
        <form class="comment-form" autocomplete="off">
          <input class="input" type="text" name="comment" maxlength="500" placeholder="Write a comment…" aria-label="Write a comment" required>
          <button class="btn btn-primary btn-sm" type="submit">Post</button>
        </form>
      </section>
    </article>`;
  }

  /* ---------- Actions ---------- */
  function cardOf(el) { return el.closest('.post-card'); }
  function postOf(card) { return store.get(card.dataset.id); }

  function closeMenus(except) {
    UI.qsa('.menu:not([hidden])').forEach((m) => {
      if (m === except) return;
      m.hidden = true;
      const btn = m.parentElement.querySelector('[data-action="menu"]');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  function toggleMenu(btn) {
    const menu = btn.parentElement.querySelector('.menu');
    const open = menu.hidden;
    closeMenus(open ? menu : null);
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) { const first = menu.querySelector('.menu-item'); if (first) first.focus(); }
  }

  function updateLikeUI(card, p) {
    const btn = card.querySelector('.act-like');
    btn.classList.toggle('is-on', p.liked);
    btn.setAttribute('aria-pressed', String(p.liked));
    btn.querySelector('i').className = `${p.liked ? 'fa-solid' : 'fa-regular'} fa-heart`;
    card.querySelector('[data-like-count]').textContent = UI.formatCount(p.likes_count);
  }

  async function like(card) {
    const p = postOf(card);
    if (!p || card.dataset.busy) return;
    // Update the screen right away, then tell the server; undo if the server says no.
    p.liked = !p.liked;
    p.likes_count = Math.max(0, p.likes_count + (p.liked ? 1 : -1));
    updateLikeUI(card, p);
    if (mode === 'demo' || p.local) return;
    card.dataset.busy = '1';
    try {
      if (p.liked) await Api.post(`/posts/${encodeURIComponent(p.id)}/like`);
      else await Api.del(`/posts/${encodeURIComponent(p.id)}/like`);
    } catch (err) {
      p.liked = !p.liked;
      p.likes_count = Math.max(0, p.likes_count + (p.liked ? 1 : -1));
      updateLikeUI(card, p);
      UI.toast(err.isMissing ? 'Likes need a backend endpoint (POST /api/posts/:id/like).' : err.message, 'error');
    } finally {
      delete card.dataset.busy;
    }
  }

  function toggleSave(card) {
    const p = postOf(card);
    const set = savedIds();
    const nowSaved = !set.has(p.id);
    nowSaved ? set.add(p.id) : set.delete(p.id);
    writeSaved(set);
    const btn = card.querySelector('.act-save');
    btn.classList.toggle('is-on', nowSaved);
    btn.setAttribute('aria-pressed', String(nowSaved));
    btn.querySelector('i').className = `${nowSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark`;
    card.querySelector('[data-save-label]').textContent = nowSaved ? 'Remove from saved' : 'Save post';
    UI.toast(nowSaved ? 'Saved to this device.' : 'Removed from saved.', 'success', 2200);
    document.dispatchEvent(new CustomEvent('cs:saved-changed', { detail: { id: p.id, saved: nowSaved } }));
  }

  function postUrl(p) {
    return `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, '')}index.html?post=${encodeURIComponent(p.id)}`;
  }

  async function share(card) {
    const p = postOf(card);
    const url = postUrl(p);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${p.user.full_name} on ConnectSphere`, text: p.content.slice(0, 100), url });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // person closed the share sheet
      }
    }
    UI.toast((await UI.copyText(url)) ? 'Link copied to clipboard.' : 'Could not copy the link.', 'success', 2500);
  }

  async function openComments(card, btn) {
    const section = card.querySelector('.comments');
    const open = section.hidden;
    section.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (!open) return;
    const p = postOf(card);
    const list = section.querySelector('.comment-list');
    const note = section.querySelector('.comments-note');
    if (p.comments === null && mode === 'live' && !p.local) {
      list.innerHTML = '<li class="comments-loading"><span class="spinner"></span> Loading comments…</li>';
      try {
        const data = await Api.get(`/posts/${encodeURIComponent(p.id)}/comments`);
        p.comments = Api.list(data, 'comments').map(normalizeComment);
      } catch (err) {
        p.comments = [];
        note.hidden = false;
        note.textContent = err.isMissing
          ? 'Existing comments cannot be loaded yet (needs GET /api/posts/:id/comments).'
          : `Could not load comments. ${err.message}`;
      }
    }
    const comments = p.comments || [];
    list.innerHTML = comments.length ? comments.map(commentHTML).join('') : '<li class="comments-empty">No comments yet. Start the conversation.</li>';
    section.querySelector('input').focus();
  }

  async function submitComment(form) {
    const card = cardOf(form);
    const p = postOf(card);
    const input = form.elements.comment;
    const text = input.value.trim();
    if (!text) return;
    const button = form.querySelector('button');
    const me = Auth.getUser() || {};
    let comment = normalizeComment({ id: `local-${Date.now()}`, user: me, content: text, created_at: new Date().toISOString() });

    if (mode === 'live' && !p.local) {
      UI.setLoading(button, true, 'Posting');
      try {
        const data = await Api.post(`/posts/${encodeURIComponent(p.id)}/comments`, { content: text });
        const saved = Api.item(data, 'comment');
        if (saved && (saved.content || saved.text)) comment = normalizeComment({ ...saved, user: saved.user || me });
      } catch (err) {
        UI.setLoading(button, false);
        UI.toast(err.isMissing ? 'Comments need a backend endpoint (POST /api/posts/:id/comments).' : err.message, 'error');
        return;
      }
      UI.setLoading(button, false);
    }
    p.comments = [...(p.comments || []), comment];
    p.comments_count += 1;
    const list = card.querySelector('.comment-list');
    list.innerHTML = p.comments.map(commentHTML).join('');
    card.querySelector('[data-comment-count]').textContent = UI.formatCount(p.comments_count);
    input.value = '';
    input.focus();
  }

  async function edit(card) {
    const p = postOf(card);
    const text = await UI.promptText({ title: 'Edit post', label: 'Caption', value: p.content, confirmLabel: 'Save changes' });
    if (text === null || text === p.content) return;
    if (mode === 'live' && !p.local) {
      try {
        await Api.put(`/posts/${encodeURIComponent(p.id)}`, { content: text });
      } catch (err) {
        UI.toast(err.isMissing ? 'Editing needs a backend endpoint (PUT /api/posts/:id).' : err.message, 'error');
        return;
      }
    }
    p.content = text;
    card.outerHTML = render(p);
    UI.toast('Post updated.', 'success', 2200);
  }

  async function remove(card) {
    const p = postOf(card);
    if (!(await UI.confirmDialog('Delete this post?', 'This cannot be undone.', 'Delete', true))) return;
    if (mode === 'live' && !p.local) {
      try {
        await Api.del(`/posts/${encodeURIComponent(p.id)}`);
      } catch (err) {
        UI.toast(err.isMissing ? 'Deleting needs a backend endpoint (DELETE /api/posts/:id).' : err.message, 'error');
        return;
      }
    }
    if (p.local) removeLocalPreview(p.id);
    store.delete(p.id);
    card.remove();
    UI.toast('Post deleted.', 'success', 2200);
    document.dispatchEvent(new CustomEvent('cs:post-removed'));
  }

  function playVideo(wrap, p) {
    const video = document.createElement('video');
    video.className = 'media-video';
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.src = UI.safeUrl(p.video_url);
    video.poster = UI.safeUrl(p.image_url);
    video.addEventListener('error', () => {
      UI.toast('This video could not be played.', 'error');
      video.replaceWith(wrap.cloneNode(true));
    });
    wrap.replaceWith(video);
  }

  /** One delegated listener handles every post on the page. */
  function bind(container) {
    container.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target || !container.contains(target)) return;
      const card = cardOf(target);
      if (!card) return;
      const action = target.dataset.action;
      if (action !== 'menu') closeMenus();
      switch (action) {
        case 'menu': toggleMenu(target); break;
        case 'like': like(card); break;
        case 'comments': openComments(card, target); break;
        case 'share': share(card); break;
        case 'save': toggleSave(card); break;
        case 'copy-link': UI.copyText(postUrl(postOf(card))).then((ok) => UI.toast(ok ? 'Link copied.' : 'Could not copy the link.', ok ? 'success' : 'error', 2200)); break;
        case 'edit': edit(card); break;
        case 'delete': remove(card); break;
        case 'play': playVideo(target, postOf(card)); break;
        case 'more': {
          const text = card.querySelector('.post-text');
          const expanded = text.classList.toggle('is-clamped') === false;
          target.textContent = expanded ? 'see less' : 'see more';
          target.setAttribute('aria-expanded', String(expanded));
          break;
        }
        default: break;
      }
    });
    container.addEventListener('submit', (e) => {
      if (e.target.matches('.comment-form')) { e.preventDefault(); submitComment(e.target); }
    });
    container.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-action="play"]')) {
        e.preventDefault();
        e.target.click();
      }
    });
  }

  document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) closeMenus(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.menu:not([hidden])');
      if (open) { const btn = open.parentElement.querySelector('[data-action="menu"]'); closeMenus(); if (btn) btn.focus(); }
    }
  });

  /* ---------- Local-only previews (used when POST /api/posts does not exist) ---------- */
  function localPreviews() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE.localPosts) || '[]'); } catch (e) { return []; }
  }
  function addLocalPreview(raw) {
    try { sessionStorage.setItem(STORAGE.localPosts, JSON.stringify([raw, ...localPreviews()])); } catch (e) { /* ignore */ }
  }
  function removeLocalPreview(id) {
    try { sessionStorage.setItem(STORAGE.localPosts, JSON.stringify(localPreviews().filter((p) => String(p.id) !== String(id)))); } catch (e) { /* ignore */ }
  }

  return {
    normalize, register, render, bind, store, savedIds, isSaved, localPreviews, addLocalPreview, removeLocalPreview,
    setMode(m) { mode = m; },
    getMode: () => mode
  };
})();

/* =====================================================================
 * Create-post page (create-post.html)
 * ===================================================================== */
const CreatePost = (() => {
  function init() {
    const form = document.getElementById('postForm');
    if (!form) return;
    const caption = form.elements.content;
    const imageUrl = form.elements.image_url;
    const counter = document.getElementById('charCount');
    const preview = document.getElementById('imagePreview');
    const alertBox = document.getElementById('postAlert');
    const submit = form.querySelector('button[type="submit"]');
    const previewBtn = document.getElementById('localPreviewBtn');
    caption.maxLength = MAX_POST_LENGTH;

    const me = Auth.getUser() || {};
    document.getElementById('composerUser').innerHTML = `${UI.avatar(me, 'md')}<div><strong>${UI.esc(me.full_name || me.username || 'You')}</strong><small>${me.username ? '@' + UI.esc(me.username) : ''}</small></div>`;

    const showAlert = (message, withPreview = false) => {
      alertBox.textContent = message;
      alertBox.hidden = !message;
      previewBtn.hidden = !withPreview;
    };

    function updateCounter() {
      const left = MAX_POST_LENGTH - caption.value.length;
      counter.textContent = `${caption.value.length} / ${MAX_POST_LENGTH}`;
      counter.classList.toggle('is-near', left < 50);
    }
    caption.addEventListener('input', () => { updateCounter(); showAlert(''); });
    updateCounter();

    function validImageUrl(value) {
      if (!value) return true;
      return Boolean(UI.safeUrl(value)) && /^https?:\/\//i.test(value);
    }

    const showPreview = UI.debounce(() => {
      const value = imageUrl.value.trim();
      preview.innerHTML = '';
      preview.hidden = true;
      const note = document.getElementById('imageError');
      note.hidden = true;
      if (!value) return;
      if (!validImageUrl(value)) { note.textContent = 'Enter a link that starts with http:// or https://'; note.hidden = false; return; }
      preview.innerHTML = UI.mediaImage(value, 'Image preview');
      preview.hidden = false;
    }, 350);
    imageUrl.addEventListener('input', () => { showPreview(); showAlert(''); });

    function readValues() {
      const content = caption.value.trim();
      const image = imageUrl.value.trim();
      if (!content && !image) { showAlert('Write something or add an image link before posting.'); caption.focus(); return null; }
      if (!validImageUrl(image)) { showAlert('The image link must start with http:// or https://'); imageUrl.focus(); return null; }
      return { content, image_url: image || undefined };
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showAlert('');
      const values = readValues();
      if (!values) return;
      UI.setLoading(submit, true, 'Posting…');
      try {
        const data = await Api.post('/posts', values);
        const created = Api.item(data, 'post');
        if (created && created.id != null) {
          try { sessionStorage.setItem(STORAGE.justPosted, JSON.stringify(created)); } catch (err) { /* ignore */ }
        }
        window.location.href = 'index.html';
      } catch (err) {
        UI.setLoading(submit, false);
        if (err.isMissing) {
          showAlert('Your backend does not have POST /api/posts yet, so this post was NOT saved. Add that endpoint to publish posts. You can still preview how it will look in the feed on this device.', true);
        } else {
          showAlert(err.message);
        }
      }
    });

    previewBtn.addEventListener('click', () => {
      const values = readValues();
      if (!values) return;
      Posts.addLocalPreview({
        id: `local-${Date.now()}`, local: true, user: me, content: values.content, image_url: values.image_url || '',
        created_at: new Date().toISOString(), likes_count: 0, comments_count: 0, comments: []
      });
      window.location.href = 'index.html';
    });

    document.getElementById('cancelPost').addEventListener('click', async () => {
      const dirty = caption.value.trim() || imageUrl.value.trim();
      if (dirty && !(await UI.confirmDialog('Discard this post?', 'Your draft will be lost.', 'Discard', true))) return;
      window.location.href = 'index.html';
    });
  }
  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'create' && Layout.mount()) CreatePost.init();
});
