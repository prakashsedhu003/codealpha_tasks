
/* ============================================================
   ConnectSphere - Home Feed
   Real registered users, manual follow/unfollow, posts,
   search, Explore, Saved posts, and stories.
   ============================================================ */

const Feed = (() => {
  const view =
    new URLSearchParams(window.location.search).get('view') || 'home';

  let allPosts = [];
  let query = new URLSearchParams(window.location.search).get('q') || '';
  let demo = false;
  let loaded = false;

  const el = {};

  /* ---------- Stories ---------- */

  function seenStories() {
    try {
      return new Set(
        JSON.parse(sessionStorage.getItem(STORAGE.seenStories) || '[]')
      );
    } catch (err) {
      return new Set();
    }
  }

  function renderStories() {
    if (!el.stories) return;

    const me = Auth.getUser() || {};
    const seen = seenStories();

    const items = SAMPLE.stories.map((s, i) => `
      <li>
        <button
          class="story${seen.has(s.user.username) ? ' is-seen' : ''}"
          type="button"
          data-story="${i}"
          aria-label="View ${UI.esc(s.user.full_name)}'s story"
        >
          <span class="story-ring">
            ${UI.avatar(s.user, 'story')}
            ${s.user.online
              ? '<span class="online" title="Online"></span>'
              : ''}
          </span>
          <span class="story-name">${UI.esc(s.user.username)}</span>
        </button>
      </li>
    `).join('');

    el.stories.innerHTML = `
      <li>
        <button
          class="story story-add"
          type="button"
          data-story-add
          aria-label="Add to your story"
        >
          <span class="story-ring is-own">
            ${UI.avatar(me, 'story')}
            <span class="story-plus">
              <i class="fa-solid fa-plus" aria-hidden="true"></i>
            </span>
          </span>
          <span class="story-name">Your story</span>
        </button>
      </li>
      ${items}
    `;
  }

  function openStory(index) {
    const stories = SAMPLE.stories;

    if (!stories.length || !stories[index]) return;

    let i = index;
    let timer = null;

    const dlg = document.createElement('dialog');
    dlg.className = 'story-viewer';
    dlg.setAttribute('aria-label', 'Story viewer');

    function markSeen(username) {
      const set = seenStories();
      set.add(username);

      try {
        sessionStorage.setItem(
          STORAGE.seenStories,
          JSON.stringify([...set])
        );
      } catch (err) {
        // Storage is optional.
      }
    }

    function next() {
      if (i < stories.length - 1) {
        i += 1;
        show();
      } else {
        dlg.close();
      }
    }

    function prev() {
      if (i > 0) {
        i -= 1;
        show();
      }
    }

    function show() {
      clearTimeout(timer);

      const s = stories[i];
      if (!s) return;

      markSeen(s.user.username);

      dlg.innerHTML = `
        <div class="sv-bars">
          ${stories.map((_, n) => `
            <span class="sv-bar${n < i ? ' done' : ''}${n === i ? ' active' : ''}"></span>
          `).join('')}
        </div>

        <header class="sv-head">
          ${UI.avatar(s.user, 'sm')}
          <strong>${UI.esc(s.user.username)}</strong>
          <button
            class="icon-btn sv-close"
            type="button"
            aria-label="Close story"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </header>

        ${UI.mediaImage(s.image, `${s.user.full_name}'s story`)}

        <button class="sv-nav sv-prev" type="button"
          aria-label="Previous story"></button>
        <button class="sv-nav sv-next" type="button"
          aria-label="Next story"></button>
      `;

      timer = setTimeout(next, 5000);
    }

    dlg.addEventListener('click', (e) => {
      if (e.target.closest('.sv-close')) {
        dlg.close();
      } else if (e.target.closest('.sv-next')) {
        next();
      } else if (e.target.closest('.sv-prev')) {
        prev();
      }
    });

    dlg.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    });

    dlg.addEventListener('close', () => {
      clearTimeout(timer);
      dlg.remove();
      renderStories();
    });

    document.body.appendChild(dlg);
    dlg.showModal();
    show();
  }

  /* ---------- Post loading ---------- */

  function sampleToRaw() {
    const me = Auth.getUser() || {
      username: 'you',
      full_name: 'You'
    };

    return SAMPLE.posts.map((p) => ({
      ...p,
      user: p.owner === 'me' ? me : p.user
    }));
  }

  async function loadPosts() {
    if (!el.list) return;

    loaded = false;
    el.list.innerHTML = UI.skeletonPosts(3);

    if (el.banner) el.banner.hidden = true;

    let raw = [];

    try {
      const data = await Api.get('/posts');
      raw = Api.list(data, 'posts');

      demo = false;
      Posts.setMode('live');
    } catch (err) {
      if (err.isMissing) {
        // Only use sample posts when the posts API is unavailable.
        raw = sampleToRaw();
        demo = true;

        Posts.setMode('demo');

        if (el.banner) el.banner.hidden = false;
      } else {
        el.list.innerHTML = UI.stateBlock({
          icon: 'fa-triangle-exclamation',
          title: 'Could not load your feed',
          text: err.message,
          actionHTML:
            '<button class="btn btn-primary" type="button" data-retry>Try again</button>'
        });

        return;
      }
    }

    // Add a newly created post if it has not appeared in the response.
    try {
      const justPosted = JSON.parse(
        sessionStorage.getItem(STORAGE.justPosted) || 'null'
      );

      sessionStorage.removeItem(STORAGE.justPosted);

      if (
        justPosted &&
        !raw.some((p) => String(p.id) === String(justPosted.id))
      ) {
        raw = [justPosted, ...raw];
      }
    } catch (err) {
      // Ignore unavailable session storage.
    }

    // Local previews are only used while the posts API is unavailable.
    if (demo) {
      raw = [...Posts.localPreviews(), ...raw];
    }

    allPosts = raw.map(Posts.normalize);

    loaded = true;
    Posts.register(allPosts);

    renderPosts();
    scrollToLinkedPost();
  }

  /* ---------- Search and feed filtering ---------- */

  function matches(post, q) {
    const hay = `
      ${post.content || ''}
      ${post.user?.username || ''}
      ${post.user?.full_name || ''}
    `.toLowerCase();

    return hay.includes(q.toLowerCase());
  }

  function visiblePosts() {
    let list = allPosts;

    if (view === 'saved') {
      const ids = Posts.savedIds();
      list = list.filter((p) => ids.has(p.id));
    }

    if (query) {
      list = list.filter((p) => matches(p, query));
    }

    return list;
  }

  function renderPosts() {
    if (!loaded || !el.list) return;

    const list = visiblePosts();

    if (!list.length) {
      el.list.innerHTML = emptyState();
      return;
    }

    el.list.innerHTML = list.map(Posts.render).join('');
  }

  function emptyState() {
    if (query) {
      return UI.stateBlock({
        icon: 'fa-magnifying-glass',
        title: 'No results',
        text: `Nothing matches "${query}". Try a different word or username.`
      });
    }

    if (view === 'saved') {
      return UI.stateBlock({
        icon: 'fa-bookmark',
        title: 'Nothing saved yet',
        text: 'Tap the bookmark on any post to keep it here. Saved posts stay on this device.',
        actionHTML:
          '<a class="btn btn-primary" href="index.html">Browse the feed</a>'
      });
    }

    return UI.stateBlock({
      icon: 'fa-pen-to-square',
      title: 'No posts yet',
      text: 'Be the first to share something with your network.',
      actionHTML:
        '<a class="btn btn-primary" href="create-post.html">Create a post</a>'
    });
  }

  function scrollToLinkedPost() {
    const id = new URLSearchParams(window.location.search).get('post');

    if (!id || !el.list) return;

    const card = el.list.querySelector(
      `.post-card[data-id="${CSS.escape(id)}"]`
    );

    if (card) {
      card.scrollIntoView({ block: 'center' });
      card.classList.add('is-highlighted');
    }
  }

  /* ---------- Real registered account suggestions ---------- */

  async function renderRail() {
    if (!el.suggested) return;

    el.suggested.innerHTML =
      '<li class="suggest-item">Loading registered accounts...</li>';

    try {
      // This API returns real users except the currently logged-in user.
      const data = await Api.get('/users');
      const users = Api.list(data, 'users');

      if (!users.length) {
        el.suggested.innerHTML =
          '<li class="suggest-item">No other registered accounts yet.</li>';
      } else {
        el.suggested.innerHTML = users.map((u) => {
          const id = UI.esc(String(u.id));
          const username = UI.esc(u.username || 'user');
          const fullName = UI.esc(
            u.full_name || u.username || 'User'
          );

          const following =
            u.is_following === true ||
            u.is_following === 'true';

          return `
            <li class="suggest-item">
              <a href="profile.html?user=${encodeURIComponent(u.username || '')}">
                ${UI.avatar(u, 'md')}
              </a>

              <div class="suggest-text">
                <a href="profile.html?user=${encodeURIComponent(u.username || '')}">
                  <strong>${fullName}</strong>
                </a>
                <small>@${username}</small>
              </div>

              <button
                class="btn ${following ? 'btn-outline is-following' : 'btn-primary'} btn-sm"
                type="button"
                data-follow="${id}"
                aria-pressed="${following}"
              >${following ? 'Following' : 'Follow'}</button>
            </li>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('Could not load account suggestions:', err);

      el.suggested.innerHTML = `
        <li class="suggest-item">
          <span>Could not load accounts.</span>
          <button type="button" data-retry-users>Try again</button>
        </li>
      `;
    }

    // Keep existing trending topics if configured.
    if (el.trending) {
      el.trending.innerHTML = SAMPLE.trending.map((t) => `
        <li>
          <button class="trend" type="button"
            data-trend="${UI.esc(t.tag)}">
            <strong>#${UI.esc(t.tag)}</strong>
            <small>${UI.esc(t.posts)} posts</small>
          </button>
        </li>
      `).join('');
    }
  }

  /* ---------- Follow / unfollow ---------- */

  async function toggleFollow(btn) {
    const userId = btn.dataset.follow;

    if (!userId || !/^\d+$/.test(userId)) {
      UI.toast('Invalid account ID.', 'error');
      return;
    }

    const following = btn.classList.contains('is-following');

    btn.disabled = true;

    try {
      // The backend routes use numeric user IDs, not usernames.
      if (following) {
        await Api.del(`/users/${encodeURIComponent(userId)}/follow`);
      } else {
        await Api.post(`/users/${encodeURIComponent(userId)}/follow`);
      }

      const newFollowing = !following;

      btn.classList.toggle('is-following', newFollowing);
      btn.classList.toggle('btn-outline', newFollowing);
      btn.classList.toggle('btn-primary', !newFollowing);
      btn.textContent = newFollowing ? 'Following' : 'Follow';
      btn.setAttribute('aria-pressed', String(newFollowing));

      UI.toast(
        newFollowing
          ? 'Account followed successfully.'
          : 'Account unfollowed successfully.',
        'success'
      );
    } catch (err) {
      console.error('Follow action failed:', err);

      UI.toast(
        err.message || 'Could not update following status.',
        'error'
      );
    } finally {
      btn.disabled = false;
    }
  }

  /* ---------- Page setup ---------- */

  function setupView() {
    const titles = {
      home: 'Home feed',
      explore: 'Explore',
      saved: 'Saved posts'
    };

    const heading = document.getElementById('viewTitle');

    if (heading) {
      heading.textContent = titles[view] || 'Home feed';
      heading.classList.toggle('sr-only', view === 'home');
    }

    const storiesSection = document.getElementById('storiesSection');

    if (storiesSection) {
      storiesSection.hidden = view !== 'home';
    }

    const topics = document.getElementById('exploreTopics');

    if (topics && view === 'explore') {
      topics.innerHTML = SAMPLE.trending.map((t) => `
        <button class="chip" type="button"
          data-trend="${UI.esc(t.tag)}">#${UI.esc(t.tag)}</button>
      `).join('');

      topics.hidden = false;

      topics.addEventListener('click', (e) => {
        const trend = e.target.closest('[data-trend]');

        if (trend) {
          document.dispatchEvent(
            new CustomEvent('cs:set-search', {
              detail: { q: trend.dataset.trend }
            })
          );
        }
      });
    }
  }

  /* ---------- Initialize page ---------- */

  function init() {
    if (!Layout.mount()) return;

    el.stories = document.getElementById('stories');
    el.list = document.getElementById('postList');
    el.banner = document.getElementById('demoBanner');
    el.suggested = document.getElementById('suggestedList');
    el.trending = document.getElementById('trendingList');

    setupView();
    renderStories();
    renderRail();

    Posts.bind(el.list);
    loadPosts();

    if (el.stories) {
      el.stories.addEventListener('click', (e) => {
        const story = e.target.closest('[data-story]');

        if (story) {
          openStory(Number(story.dataset.story));
        } else if (e.target.closest('[data-story-add]')) {
          UI.toast(
            'Creating stories requires a stories API on the backend.',
            'info'
          );
        }
      });
    }

    if (el.list) {
      el.list.addEventListener('click', (e) => {
        if (e.target.closest('[data-retry]')) {
          loadPosts();
        }
      });
    }

    document.addEventListener('cs:search', (e) => {
      query = e.detail.q || '';
      renderPosts();
    });

    document.addEventListener('cs:saved-changed', () => {
      if (view === 'saved') renderPosts();
    });

    document.addEventListener('cs:post-removed', () => {
      allPosts = allPosts.filter((p) => Posts.store.has(p.id));

      if (
        el.list &&
        !el.list.querySelector('.post-card')
      ) {
        renderPosts();
      }
    });

    const rail = document.getElementById('rail');

    if (rail) {
      rail.addEventListener('click', (e) => {
        const retryUsers = e.target.closest('[data-retry-users]');

        if (retryUsers) {
          renderRail();
          return;
        }

        const follow = e.target.closest('[data-follow]');

        if (follow) {
          toggleFollow(follow);
          return;
        }

        const trend = e.target.closest('[data-trend]');

        if (trend) {
          document.dispatchEvent(
            new CustomEvent('cs:set-search', {
              detail: { q: trend.dataset.trend }
            })
          );
        }
      });
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Feed.init);
