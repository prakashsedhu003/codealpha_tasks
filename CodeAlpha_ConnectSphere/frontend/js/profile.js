
/* =========================================================
   ConnectSphere - Profile Page
   File: frontend/js/profile.js

   Required backend endpoints:
   GET    /api/users
   GET    /api/users/:username
   GET    /api/users/:username/posts
   GET    /api/users/:username/followers
   GET    /api/users/:username/following
   POST   /api/users/:id/follow
   DELETE /api/users/:id/follow
   PUT    /api/users/me
========================================================= */

const Profile = (() => {
  const params = new URLSearchParams(window.location.search);
  const el = {};

  let profile = null;
  let isMe = false;
  let notes = [];
  let gridPosts = [];

  // ---------------------------------------------------------
  // Normalize user data returned by the backend
  // ---------------------------------------------------------

  function normalizeUser(raw) {
    const r = raw || {};

    return {
      id: r.id ?? null,
      username: r.username || r.user_name || '',
      full_name: r.full_name || r.name || r.username || 'Unknown user',
      bio: r.bio || '',
      avatar_url: r.avatar_url || r.avatar || '',
      cover_url: r.cover_url || r.cover || '',
      posts_count: r.posts_count ?? r.post_count ?? null,
      followers_count: r.followers_count ?? r.follower_count ?? null,
      following_count: r.following_count ?? null,

      is_following:
        r.is_following === true || r.is_following === 'true',

      is_following_me:
        r.is_following_me === true || r.is_following_me === 'true'
    };
  }

  function count(value) {
    return value === null || value === undefined
      ? '–'
      : UI.formatCount(value);
  }

  function getCurrentUsername() {
    return Auth.currentUsername() || '';
  }

  function getResponseUser(data) {
    return Api.item(data, 'user') || data?.profile || data?.data || null;
  }

  // ---------------------------------------------------------
  // Render profile header
  // ---------------------------------------------------------

  function renderHeader() {
    if (!profile || !el.header) return;

    const p = profile;
    const cover = UI.safeUrl(p.cover_url);

    const actionButtons = isMe
      ? `
        <button class="btn btn-outline"
          type="button"
          data-edit-profile>
          <i class="fa-regular fa-pen-to-square"></i>
          Edit profile
        </button>
      `
      : `
        <button
          class="btn ${p.is_following ? 'btn-outline is-following' : 'btn-primary'}"
          type="button"
          data-follow
          aria-pressed="${p.is_following}"
        >
          ${
            p.is_following
              ? 'Following'
              : p.is_following_me
                ? 'Follow Back'
                : 'Follow'
          }
        </button>

        <a class="btn btn-outline" href="messages.html">
          <i class="fa-regular fa-envelope"></i>
          Message
        </a>
      `;

    el.header.innerHTML = `
      <div class="cover"
        ${cover ? `style="background-image:url('${UI.esc(cover)}')"` : ''}>
      </div>

      <div class="profile-main">
        <div class="profile-avatar">
          ${UI.avatar(p, 'xl')}
        </div>

        <div class="profile-actions">
          ${actionButtons}
        </div>

        <h1 class="profile-name">${UI.esc(p.full_name)}</h1>

        <p class="profile-handle">
          @${UI.esc(p.username)}
        </p>

        <p class="profile-bio">
          ${
            p.bio
              ? UI.esc(p.bio)
              : isMe
                ? 'Add a short bio so people know who you are.'
                : ''
          }
        </p>

        <dl class="profile-stats">
          <div>
            <dt>Posts</dt>
            <dd data-stat="posts">${count(p.posts_count)}</dd>
          </div>

          <div>
            <dt>Followers</dt>
            <dd>
              <button
                type="button"
                class="connection-stat"
                data-show-connections="followers"
                aria-label="View followers">
                ${count(p.followers_count)}
              </button>
            </dd>
          </div>

          <div>
            <dt>Following</dt>
            <dd>
              <button
                type="button"
                class="connection-stat"
                data-show-connections="following"
                aria-label="View following">
                ${count(p.following_count)}
              </button>
            </dd>
          </div>
        </dl>
      </div>
    `;

    document.title =
      `${p.full_name} (@${p.username}) · ConnectSphere`;

    if (el.notes) {
      el.notes.innerHTML = notes
        .map(
          (note) => `
            <p class="notice">
              <i class="fa-solid fa-circle-info"></i>
              <span>${UI.esc(note)}</span>
            </p>
          `
        )
        .join('');

      el.notes.hidden = notes.length === 0;
    }
  }

  // ---------------------------------------------------------
  // Render the user's post grid
  // ---------------------------------------------------------

  function gridTile(post) {
    const image = UI.safeUrl(post.image_url);
    const content = post.content || '';

    return `
      <li>
        <button
          class="grid-tile"
          type="button"
          data-open-post="${UI.esc(String(post.id))}"
          aria-label="Open post">

          ${
            image
              ? UI.mediaImage(image, '')
              : `<span class="tile-text">${UI.esc(content.slice(0, 90))}</span>`
          }

          <span class="tile-meta">
            <i class="fa-solid fa-heart"></i>
            ${UI.formatCount(post.likes_count || 0)}

            <i class="fa-solid fa-comment"></i>
            ${UI.formatCount(post.comments_count || 0)}
          </span>
        </button>
      </li>
    `;
  }

  function renderGrid(posts, emptyText) {
    gridPosts = Array.isArray(posts) ? posts : [];

    if (!el.grid) return;

    if (gridPosts.length === 0) {
      el.grid.innerHTML = `
        <li class="grid-empty">
          ${UI.stateBlock({
            icon: 'fa-camera',
            title: 'No posts to show',
            text: emptyText
          })}
        </li>
      `;
      return;
    }

    el.grid.innerHTML = gridPosts.map(gridTile).join('');
  }

  // ---------------------------------------------------------
  // Open an individual post
  // ---------------------------------------------------------

  function openPost(id) {
    const post = gridPosts.find(
      (item) => String(item.id) === String(id)
    );

    if (!post) return;

    const dlg = document.createElement('dialog');
    dlg.className = 'dialog lightbox';
    dlg.setAttribute('aria-label', 'Post');

    const image = UI.safeUrl(post.image_url);

    dlg.innerHTML = `
      ${image ? UI.mediaImage(image, '') : ''}

      <div class="lightbox-body">
        <p>${UI.esc(post.content || '')}</p>

        <small>
          ${UI.formatCount(post.likes_count || 0)} likes ·
          ${UI.formatCount(post.comments_count || 0)} comments ·
          ${UI.esc(UI.timeAgo(post.created_at))}
        </small>
      </div>

      <button class="btn btn-ghost" type="button" data-close>
        Close
      </button>
    `;

    dlg.addEventListener('click', (event) => {
      if (
        event.target === dlg ||
        event.target.closest('[data-close]')
      ) {
        dlg.close();
      }
    });

    dlg.addEventListener('close', () => dlg.remove());

    document.body.appendChild(dlg);
    dlg.showModal();
  }

  // ---------------------------------------------------------
  // Load profile and that user's posts
  // ---------------------------------------------------------

  async function load() {
    const requestedUsername = params.get('user');
    const myUsername = getCurrentUsername();
    const username = requestedUsername || myUsername;

    isMe =
      !requestedUsername ||
      requestedUsername.toLowerCase() === myUsername.toLowerCase();

    notes = [];
    profile = null;
    gridPosts = [];

    el.header.innerHTML = `
      <div class="cover skeleton"></div>
      <div class="profile-main">
        <span class="skeleton sk-circle xl"></span>
        <span class="skeleton sk-line w40"></span>
        <span class="skeleton sk-line w25"></span>
      </div>
    `;

    el.grid.innerHTML = '';

    if (!username) {
      el.header.innerHTML = UI.stateBlock({
        icon: 'fa-user',
        title: 'Profile unavailable',
        text: 'Please log in to view your profile.',
        actionHTML: '<a class="btn btn-primary" href="login.html">Log in</a>'
      });
      return;
    }

    try {
      const data = await Api.get(
        `/users/${encodeURIComponent(username)}`
      );

      const rawUser = getResponseUser(data);

      if (!rawUser) {
        throw new Error('The server returned no profile data.');
      }

      profile = normalizeUser(rawUser);

      if (!profile.username) {
        profile.username = username;
      }

      if (profile.id === null) {
        throw new Error('The profile response is missing the user ID.');
      }
    } catch (error) {
      console.error('Load profile error:', error);

      if (isMe) {
        const currentUser = Auth.getUser();

        if (currentUser) {
          profile = normalizeUser(currentUser);

          if (!profile.username) {
            profile.username = myUsername;
          }

          notes.push(
            'Some profile information may be unavailable because the profile API could not be loaded.'
          );
        } else {
          el.header.innerHTML = UI.stateBlock({
            icon: 'fa-user',
            title: 'Profile unavailable',
            text: error.message || 'Could not load your profile.',
            actionHTML: '<button class="btn btn-primary" type="button" data-retry>Try again</button>'
          });

          return;
        }
      } else {
        el.header.innerHTML = UI.stateBlock({
          icon: 'fa-user-slash',
          title: 'Profile not found',
          text: error.message || 'This account could not be loaded.',
          actionHTML: '<button class="btn btn-primary" type="button" data-retry>Try again</button>'
        });

        return;
      }
    }

    renderHeader();

    // Load posts for the selected user.
    try {
      const response = await Api.get(
        `/users/${encodeURIComponent(profile.username)}/posts`
      );

      const rawPosts = Api.list(response, 'posts');

      const posts = rawPosts.map((rawPost) =>
        Posts.normalize({
          ...rawPost,
          user: rawPost.user || profile
        })
      );

      if (typeof profile.posts_count !== 'number') {
        profile.posts_count = posts.length;
        renderHeader();
      }

      renderGrid(
        posts,
        isMe
          ? 'When you share your first post, it will show up here.'
          : 'This person has not posted yet.'
      );
    } catch (error) {
      console.error('Load profile posts error:', error);

      renderGrid(
        [],
        error.message ||
          'Could not load posts. Check the profile-post API endpoint.'
      );
    }
  }

  // ---------------------------------------------------------
  // Follow / unfollow an account
  // ---------------------------------------------------------

  async function toggleFollow(button) {
    if (!profile || profile.id === null) {
      UI.toast('Could not identify this account.', 'error');
      return;
    }

    const wasFollowing = profile.is_following;

    button.disabled = true;

    try {
      if (wasFollowing) {
        await Api.del(
          `/users/${encodeURIComponent(profile.id)}/follow`
        );
      } else {
        await Api.post(
          `/users/${encodeURIComponent(profile.id)}/follow`
        );
      }

      profile.is_following = !wasFollowing;

      if (typeof profile.followers_count === 'number') {
        profile.followers_count += wasFollowing ? -1 : 1;
      }

      renderHeader();

      UI.toast(
        wasFollowing ? 'Account unfollowed.' : 'Account followed.',
        'success'
      );
    } catch (error) {
      console.error('Toggle follow error:', error);

      button.disabled = false;

      UI.toast(
        error.message || 'Could not update follow status.',
        'error'
      );
    }
  }

  // ---------------------------------------------------------
  // Followers / following dialog
  // ---------------------------------------------------------

  async function openConnections(type) {
    if (!profile || !profile.username) {
      UI.toast('Profile information is unavailable.', 'error');
      return;
    }

    if (type !== 'followers' && type !== 'following') {
      return;
    }

    const heading =
      type === 'followers' ? 'Followers' : 'Following';

    const dialog = document.createElement('dialog');
    dialog.className = 'dialog';
    dialog.setAttribute('aria-label', heading);

    dialog.innerHTML = `
      <div class="dialog-form">
        <h2 class="dialog-title">${heading}</h2>

        <div data-connections-list>
          Loading accounts...
        </div>

        <div class="dialog-actions">
          <button class="btn btn-ghost" type="button" data-close>
            Close
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.addEventListener('click', (event) => {
      if (
        event.target === dialog ||
        event.target.closest('[data-close]')
      ) {
        dialog.close();
      }
    });

    dialog.addEventListener('close', () => dialog.remove());
    dialog.showModal();

    const list = dialog.querySelector('[data-connections-list]');

    async function refreshConnections() {
      list.textContent = 'Loading accounts...';

      try {
        const response = await Api.get(
          `/users/${encodeURIComponent(profile.username)}/${type}`
        );

        const users = Api.list(response, 'users');

        if (!users.length) {
          list.textContent =
            type === 'followers'
              ? 'No followers yet.'
              : 'This account is not following anyone yet.';

          return;
        }

        list.innerHTML = users.map((rawUser) => {
          const user = normalizeUser(rawUser);

          const following = user.is_following;
          const followsMe = user.is_following_me;

          const label = following
            ? 'Following'
            : followsMe
              ? 'Follow Back'
              : 'Follow';

          const followClass = following
            ? 'btn-outline is-following'
            : 'btn-primary';

          return `
            <div class="suggest-item">
              <a href="profile.html?user=${encodeURIComponent(user.username)}">
                ${UI.avatar(user, 'md')}
              </a>

              <div class="suggest-text">
                <strong>${UI.esc(user.full_name)}</strong>
                <small>@${UI.esc(user.username)}</small>
              </div>

              ${
                String(user.id) === String(Auth.getUser()?.id)
                  ? ''
                  : `
                    <button
                      class="btn ${followClass} btn-sm"
                      type="button"
                      data-connection-follow="${UI.esc(String(user.id))}"
                      aria-pressed="${following}">
                      ${label}
                    </button>
                  `
              }
            </div>
          `;
        }).join('');
      } catch (error) {
        console.error('Load connections error:', error);
        list.textContent =
          error.message || `Could not load ${type}.`;
      }
    }

    list.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-connection-follow]');

      if (!button) return;

      const userId = button.dataset.connectionFollow;
      const wasFollowing = button.getAttribute('aria-pressed') === 'true';

      button.disabled = true;

      try {
        if (wasFollowing) {
          await Api.del(
            `/users/${encodeURIComponent(userId)}/follow`
          );
        } else {
          await Api.post(
            `/users/${encodeURIComponent(userId)}/follow`
          );
        }

        await refreshConnections();

        // Reload counts and follow status for the displayed profile.
        await load();

        UI.toast(
          wasFollowing ? 'Account unfollowed.' : 'Account followed.',
          'success'
        );
      } catch (error) {
        console.error('Update connection error:', error);

        button.disabled = false;

        UI.toast(
          error.message || 'Could not update follow status.',
          'error'
        );
      }
    });

    await refreshConnections();
  }

  // ---------------------------------------------------------
  // Edit profile dialog
  // ---------------------------------------------------------

  function editProfile() {
    if (!profile) return;

    const dialog = document.getElementById('editDialog');
    const form = document.getElementById('editForm');
    const error = document.getElementById('editError');

    if (!dialog || !form || !error) {
      UI.toast('The edit-profile form could not be found.', 'error');
      return;
    }

    form.elements.full_name.value = profile.full_name || '';
    form.elements.bio.value = profile.bio || '';
    form.elements.avatar_url.value = profile.avatar_url || '';

    error.hidden = true;
    dialog.showModal();
  }

  function bindEditForm() {
    const dialog = document.getElementById('editDialog');
    const form = document.getElementById('editForm');
    const error = document.getElementById('editError');

    if (!dialog || !form || !error) return;

    const saveButton = form.querySelector('[type="submit"]');
    const cancelButton = form.querySelector('[data-cancel]');

    cancelButton?.addEventListener('click', () => dialog.close());

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const values = {
        full_name: form.elements.full_name.value.trim(),
        bio: form.elements.bio.value.trim(),
        avatar_url: form.elements.avatar_url.value.trim()
      };

      error.hidden = true;

      if (values.full_name.length < 2) {
        error.textContent = 'Enter your full name.';
        error.hidden = false;
        return;
      }

      if (
        values.avatar_url &&
        !UI.safeUrl(values.avatar_url)
      ) {
        error.textContent =
          'The photo link must start with http:// or https://';

        error.hidden = false;
        return;
      }

      UI.setLoading(saveButton, true, 'Saving…');

      try {
        const response = await Api.put('/users/me', values);
        const updated = getResponseUser(response) || {};

        profile = normalizeUser({
          ...profile,
          ...values,
          ...updated
        });

        Auth.setUser({
          ...(Auth.getUser() || {}),
          ...values,
          username: profile.username,
          id: profile.id
        });

        notes = notes.filter(
          (note) => !note.startsWith('Some profile information')
        );

        renderHeader();
        dialog.close();

        UI.toast('Profile updated.', 'success');
      } catch (err) {
        console.error('Save profile error:', err);

        error.textContent =
          err.message ||
          'Could not save your profile. Check PUT /api/users/me.';

        error.hidden = false;
      } finally {
        UI.setLoading(saveButton, false);
      }
    });
  }

  // ---------------------------------------------------------
  // Initialize page events
  // ---------------------------------------------------------

  function init() {
    if (!Layout.mount()) return;

    el.header = document.getElementById('profileHeader');
    el.grid = document.getElementById('postGrid');
    el.notes = document.getElementById('profileNotes');

    if (!el.header || !el.grid) {
      console.error('Profile page elements were not found.');
      return;
    }

    bindEditForm();

    document
      .getElementById('profileRoot')
      ?.addEventListener('click', (event) => {
        const editButton = event.target.closest('[data-edit-profile]');
        const followButton = event.target.closest('[data-follow]');
        const retryButton = event.target.closest('[data-retry]');
        const postButton = event.target.closest('[data-open-post]');
        const connectionButton = event.target.closest('[data-show-connections]');

        if (editButton) {
          editProfile();
        } else if (followButton) {
          toggleFollow(followButton);
        } else if (retryButton) {
          load();
        } else if (postButton) {
          openPost(postButton.dataset.openPost);
        } else if (connectionButton) {
          openConnections(connectionButton.dataset.showConnections);
        }
      });

    load();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Profile.init);
