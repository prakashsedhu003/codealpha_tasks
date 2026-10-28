
/* ConnectSphere - real PostgreSQL notifications */
const Notifications = (() => {
  let items = [];
  let filter = 'all';
  let busy = false;

  const el = {};

  const ICONS = {
    follow_request: 'fa-user-plus',
    follow_accepted: 'fa-user-check',
    message: 'fa-message',
    new_post: 'fa-image',
    post_like: 'fa-heart',
    post_comment: 'fa-comment'
  };

  const LABELS = {
    follow_request: 'sent you a follow request',
    follow_accepted: 'accepted your follow request',
    message: 'sent you a message',
    new_post: 'published a new post',
    post_like: 'liked your post',
    post_comment: 'commented on your post'
  };

  function normalize(raw) {
    const actor = raw.actor || raw.user || {};

    const type = raw.type || 'message';

    return {
      id: String(raw.id ?? ''),
      type,
      actor_id: raw.actor_id ?? actor.id ?? null,
      actor: {
        id: raw.actor_id ?? actor.id ?? null,
        username: raw.actor_username || actor.username || 'unknown',
        full_name:
          raw.actor_full_name ||
          actor.full_name ||
          actor.name ||
          raw.actor_username ||
          'Unknown user',
        avatar_url: raw.actor_avatar_url || actor.avatar_url || ''
      },
      post_id: raw.post_id ?? null,
      message_id: raw.message_id ?? null,
      message: raw.content || raw.message || LABELS[type] || 'New activity',
      created_at: raw.created_at || '',
      is_read: Boolean(raw.is_read)
    };
  }

  function unreadCount() {
    return items.filter(n => !n.is_read).length;
  }

  function syncBadge() {
    if (window.Layout && typeof Layout.setUnread === 'function') {
      Layout.setUnread(unreadCount(), false);
    }

    el.summary.textContent = unreadCount()
      ? `${unreadCount()} unread`
      : 'You are all caught up';

    el.markAll.disabled = unreadCount() === 0 || busy;
  }

  function render() {
    const visible = filter === 'unread'
      ? items.filter(n => !n.is_read)
      : items;

    if (!visible.length) {
      el.list.innerHTML = `
        <li>
          ${UI.stateBlock({
            icon: filter === 'unread' ? 'fa-circle-check' : 'fa-bell',
            title: filter === 'unread'
              ? 'No unread notifications'
              : 'No notifications yet',
            text: 'Follow requests, messages and post activity will appear here.'
          })}
        </li>`;
      return;
    }

    el.list.innerHTML = visible.map(n => {
      const actorId = UI.esc(String(n.actor_id ?? ''));
      const notificationId = UI.esc(n.id);
      const username = encodeURIComponent(n.actor.username);

      const followActions = n.type === 'follow_request'
        ? `
          <div class="notif-actions">
            <button
              class="btn btn-primary btn-sm"
              type="button"
              data-action="accept"
              data-actor-id="${actorId}"
              data-notification-id="${notificationId}"
              ${busy ? 'disabled' : ''}>
              Accept
            </button>
            <button
              class="btn btn-outline btn-sm"
              type="button"
              data-action="reject"
              data-actor-id="${actorId}"
              data-notification-id="${notificationId}"
              ${busy ? 'disabled' : ''}>
              Reject
            </button>
          </div>`
        : '';

      const profileLink = n.actor.username !== 'unknown'
        ? `profile.html?user=${username}`
        : '#';

      return `
        <li class="notif-item">
          <div class="notif${n.is_read ? '' : ' is-unread'}"
               data-notification-row="${notificationId}">
            <a class="notif-avatar-link"
               href="${profileLink}"
               aria-label="View ${UI.esc(n.actor.full_name)}'s profile">
              <span class="notif-avatar">
                ${UI.avatar(n.actor, 'md')}
                <span class="notif-type notif-${UI.esc(n.type)}">
                  <i class="fa-solid ${ICONS[n.type] || 'fa-bell'}"
                     aria-hidden="true"></i>
                </span>
              </span>
            </a>

            <div class="notif-text">
              <button class="notif-message"
                      type="button"
                      data-action="read"
                      data-notification-id="${notificationId}">
                <span>
                  <strong>${UI.esc(n.actor.full_name)}</strong>
                  ${UI.esc(n.message)}
                </span>
                <small>${UI.esc(UI.timeAgo(n.created_at))}</small>
              </button>
              ${followActions}
            </div>

            ${n.is_read ? '' : '<span class="dot dot-inline" aria-label="Unread"></span>'}
          </div>
        </li>`;
    }).join('');
  }

  async function markRead(id) {
    const n = items.find(item => item.id === id);

    if (!n || n.is_read) return;

    try {
      await Api.post(`/notifications/${encodeURIComponent(id)}/read`);

      n.is_read = true;
      render();
      syncBadge();
    } catch (err) {
      UI.toast(err.message || 'Could not mark notification as read.', 'error');
    }
  }

  async function markAll() {
    if (busy || unreadCount() === 0) return;

    busy = true;
    syncBadge();

    try {
      await Api.post('/notifications/read-all');

      items.forEach(n => {
        n.is_read = true;
      });

      render();
      syncBadge();
    } catch (err) {
      UI.toast(err.message || 'Could not mark notifications as read.', 'error');
    } finally {
      busy = false;
      syncBadge();
    }
  }

  async function handleFollowAction(action, actorId, notificationId) {
    if (busy || !actorId) return;

    busy = true;
    syncBadge();

    try {
      if (action === 'accept') {
        await Api.post(`/users/${encodeURIComponent(actorId)}/follow/accept`);
        UI.toast('Follow request accepted.', 'success');
      } else {
        await Api.post(`/users/${encodeURIComponent(actorId)}/follow/reject`);
        UI.toast('Follow request rejected.', 'success');
      }

      const n = items.find(item => item.id === notificationId);

      if (n) {
        n.is_read = true;
      }

      await load(false);
    } catch (err) {
      UI.toast(err.message || 'Could not process follow request.', 'error');
    } finally {
      busy = false;
      render();
      syncBadge();
    }
  }

  async function load(showLoading = true) {
    if (showLoading) {
      el.list.innerHTML = `
        <li class="notif skeleton-row" aria-hidden="true">
          <span class="skeleton sk-circle"></span>
          <span class="sk-col">
            <span class="skeleton sk-line w70"></span>
            <span class="skeleton sk-line w25"></span>
          </span>
        </li>`;
    }

    el.banner.hidden = true;

    try {
      const data = await Api.get('/notifications');
      items = Api.list(data, 'notifications').map(normalize);
      render();
      syncBadge();
    } catch (err) {
      el.list.innerHTML = `
        <li>
          ${UI.stateBlock({
            icon: 'fa-triangle-exclamation',
            title: 'Could not load notifications',
            text: err.message || 'Please try again.',
            actionHTML: '<button class="btn btn-primary" type="button" data-action="retry">Try again</button>'
          })}
        </li>`;

      UI.toast('Notifications could not be loaded.', 'error');
    }
  }

  function init() {
    if (!Layout.mount()) return;

    Object.assign(el, {
      list: document.getElementById('notifList'),
      banner: document.getElementById('demoBanner'),
      summary: document.getElementById('notifSummary'),
      markAll: document.getElementById('markAll')
    });

    if (!el.list || !el.summary || !el.markAll || !el.banner) {
      console.error('ConnectSphere notification page elements are missing.');
      return;
    }

    el.list.addEventListener('click', async event => {
      const retry = event.target.closest('[data-action="retry"]');

      if (retry) {
        await load();
        return;
      }

      const actionButton = event.target.closest('[data-action]');

      if (!actionButton) return;

      const action = actionButton.dataset.action;
      const notificationId = actionButton.dataset.notificationId;

      if (action === 'accept' || action === 'reject') {
        await handleFollowAction(
          action,
          actionButton.dataset.actorId,
          notificationId
        );
        return;
      }

      if (action === 'read') {
        await markRead(notificationId);
      }
    });

    el.markAll.addEventListener('click', markAll);

    UI.qsa('[data-filter]').forEach(tab => {
      tab.addEventListener('click', () => {
        filter = tab.dataset.filter;

        UI.qsa('[data-filter]').forEach(otherTab => {
          const active = otherTab === tab;

          otherTab.classList.toggle('is-active', active);
          otherTab.setAttribute('aria-selected', String(active));
        });

        render();
      });
    });

    load();
  }

  return { init, load };
})();

document.addEventListener('DOMContentLoaded', Notifications.init);
