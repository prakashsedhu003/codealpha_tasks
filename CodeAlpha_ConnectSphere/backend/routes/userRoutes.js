
const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

// =========================================================
// HELPERS
// =========================================================

function getUserId(req) {
  const value =
    req.user?.id ??
    req.user?.userId ??
    req.user?.user_id;

  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function requireUserId(req, res) {
  const userId = getUserId(req);

  if (!userId) {
    res.status(401).json({
      status: 'error',
      message: 'Your login session is invalid. Please log in again.'
    });

    return null;
  }

  return userId;
}

function parseAccountId(value) {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const ACCEPTED_STATUS =
  "COALESCE(f.status, 'accepted') = 'accepted'";

// =========================================================
// GET /api/users
// List accounts and relationship/request statuses.
// =========================================================

router.get('/', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.full_name,
         u.bio,
         u.avatar_url,
         u.created_at,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = $1
             AND f.following_id = u.id
             AND COALESCE(f.status, 'accepted') = 'accepted'
         ) AS is_following,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = u.id
             AND f.following_id = $1
             AND COALESCE(f.status, 'accepted') = 'accepted'
         ) AS is_following_me,

         (
           SELECT f.status FROM follows f
           WHERE f.follower_id = $1
             AND f.following_id = u.id
           LIMIT 1
         ) AS follow_status,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = $1
             AND f.following_id = u.id
             AND f.status = 'pending'
         ) AS request_sent,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = u.id
             AND f.following_id = $1
             AND f.status = 'pending'
         ) AS request_received

       FROM users u
       WHERE u.id <> $1
       ORDER BY u.created_at DESC, u.id DESC`,
      [userId]
    );

    return res.json({
      status: 'success',
      users: result.rows
    });
  } catch (error) {
    console.error('Get users error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load accounts.'
    });
  }
});

// =========================================================
// GET /api/users/:username
// Profile and accepted relationship counts.
// =========================================================

router.get('/:username', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.full_name,
         u.bio,
         u.avatar_url,
         u.created_at,

         (
           SELECT COUNT(*)::int FROM posts p
           WHERE p.user_id = u.id
         ) AS posts_count,

         (
           SELECT COUNT(*)::int FROM follows f
           WHERE f.following_id = u.id
             AND ${ACCEPTED_STATUS}
         ) AS followers_count,

         (
           SELECT COUNT(*)::int FROM follows f
           WHERE f.follower_id = u.id
             AND ${ACCEPTED_STATUS}
         ) AS following_count,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = $1
             AND f.following_id = u.id
             AND COALESCE(f.status, 'accepted') = 'accepted'
         ) AS is_following,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = u.id
             AND f.following_id = $1
             AND COALESCE(f.status, 'accepted') = 'accepted'
         ) AS is_following_me,

         (
           SELECT f.status FROM follows f
           WHERE f.follower_id = $1
             AND f.following_id = u.id
           LIMIT 1
         ) AS follow_status,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = $1
             AND f.following_id = u.id
             AND f.status = 'pending'
         ) AS request_sent,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = u.id
             AND f.following_id = $1
             AND f.status = 'pending'
         ) AS request_received

       FROM users u
       WHERE LOWER(u.username) = LOWER($2)
       LIMIT 1`,
      [userId, req.params.username]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        status: 'error',
        message: 'Account not found.'
      });
    }

    return res.json({
      status: 'success',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load this profile.'
    });
  }
});

// =========================================================
// GET /api/users/:username/posts
// =========================================================

router.get('/:username/posts', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const userResult = await pool.query(
      `SELECT id, username, full_name, avatar_url
       FROM users
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [req.params.username]
    );

    if (!userResult.rowCount) {
      return res.status(404).json({
        status: 'error',
        message: 'Account not found.'
      });
    }

    const user = userResult.rows[0];

    const result = await pool.query(
      `SELECT
         p.id,
         p.user_id,
         p.content,
         p.image_url,
         p.created_at,

         (
           SELECT COUNT(*)::int FROM likes l
           WHERE l.post_id = p.id
         ) AS likes_count,

         (
           SELECT COUNT(*)::int FROM comments c
           WHERE c.post_id = p.id
         ) AS comments_count,

         EXISTS (
           SELECT 1 FROM likes l
           WHERE l.post_id = p.id
             AND l.user_id = $2
         ) AS is_liked

       FROM posts p
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC, p.id DESC`,
      [user.id, userId]
    );

    const posts = result.rows.map(post => ({
      ...post,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url
      }
    }));

    return res.json({
      status: 'success',
      posts
    });
  } catch (error) {
    console.error('Get user posts error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load this account’s posts.'
    });
  }
});

// =========================================================
// GET /api/users/:username/followers
// Accepted followers only.
// =========================================================

router.get('/:username/followers', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.full_name,
         u.bio,
         u.avatar_url,
         u.created_at,

         EXISTS (
           SELECT 1 FROM follows mine
           WHERE mine.follower_id = $1
             AND mine.following_id = u.id
             AND COALESCE(mine.status, 'accepted') = 'accepted'
         ) AS is_following,

         EXISTS (
           SELECT 1 FROM follows theirs
           WHERE theirs.follower_id = u.id
             AND theirs.following_id = $1
             AND COALESCE(theirs.status, 'accepted') = 'accepted'
         ) AS is_following_me

       FROM users target
       JOIN follows f ON f.following_id = target.id
       JOIN users u ON u.id = f.follower_id
       WHERE LOWER(target.username) = LOWER($2)
         AND COALESCE(f.status, 'accepted') = 'accepted'
       ORDER BY f.created_at DESC NULLS LAST, u.username`,
      [userId, req.params.username]
    );

    return res.json({
      status: 'success',
      users: result.rows
    });
  } catch (error) {
    console.error('Get followers error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load followers.'
    });
  }
});

// =========================================================
// GET /api/users/:username/following
// Accepted following relationships only.
// =========================================================

router.get('/:username/following', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.full_name,
         u.bio,
         u.avatar_url,
         u.created_at,

         EXISTS (
           SELECT 1 FROM follows mine
           WHERE mine.follower_id = $1
             AND mine.following_id = u.id
             AND COALESCE(mine.status, 'accepted') = 'accepted'
         ) AS is_following,

         EXISTS (
           SELECT 1 FROM follows theirs
           WHERE theirs.follower_id = u.id
             AND theirs.following_id = $1
             AND COALESCE(theirs.status, 'accepted') = 'accepted'
         ) AS is_following_me

       FROM users target
       JOIN follows f ON f.follower_id = target.id
       JOIN users u ON u.id = f.following_id
       WHERE LOWER(target.username) = LOWER($2)
         AND COALESCE(f.status, 'accepted') = 'accepted'
       ORDER BY f.created_at DESC NULLS LAST, u.username`,
      [userId, req.params.username]
    );

    return res.json({
      status: 'success',
      users: result.rows
    });
  } catch (error) {
    console.error('Get following error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load following list.'
    });
  }
});

// =========================================================
// PUT /api/users/me
// Update current user's profile.
// =========================================================

router.put('/me', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const fullName =
    typeof req.body?.full_name === 'string'
      ? req.body.full_name.trim()
      : '';

  const bio =
    typeof req.body?.bio === 'string'
      ? req.body.bio.trim()
      : '';

  const avatarUrl =
    typeof req.body?.avatar_url === 'string'
      ? req.body.avatar_url.trim()
      : '';

  if (fullName.length < 2 || fullName.length > 100) {
    return res.status(400).json({
      status: 'error',
      message: 'Full name must contain 2 to 100 characters.'
    });
  }

  if (bio.length > 500) {
    return res.status(400).json({
      status: 'error',
      message: 'Bio cannot exceed 500 characters.'
    });
  }

  if (
    avatarUrl &&
    (!/^https?:\/\//i.test(avatarUrl) || avatarUrl.length > 2000)
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'Enter a valid HTTP or HTTPS avatar URL.'
    });
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           bio = $2,
           avatar_url = $3
       WHERE id = $4
       RETURNING id, username, full_name, bio, avatar_url, created_at`,
      [fullName, bio, avatarUrl || null, userId]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        status: 'error',
        message: 'Your account was not found.'
      });
    }

    return res.json({
      status: 'success',
      message: 'Profile updated successfully.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not update your profile.'
    });
  }
});

// =========================================================
// POST /api/users/:id/follow
// Send a request. Does NOT automatically follow the target.
// =========================================================

router.post('/:id/follow', async (req, res) => {
  const followerId = requireUserId(req, res);
  if (!followerId) return;

  const targetId = parseAccountId(req.params.id);

  if (!targetId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid account ID.'
    });
  }

  if (followerId === targetId) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot follow your own account.'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const target = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [targetId]
    );

    if (!target.rowCount) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        status: 'error',
        message: 'Account not found.'
      });
    }

    const existing = await client.query(
      `SELECT status
       FROM follows
       WHERE follower_id = $1 AND following_id = $2
       FOR UPDATE`,
      [followerId, targetId]
    );

    if (existing.rowCount) {
      const currentStatus = existing.rows[0].status;

      if (currentStatus == null || currentStatus === 'accepted') {
        await client.query('COMMIT');

        return res.json({
          status: 'success',
          message: 'You already follow this account.',
          follow_status: 'accepted'
        });
      }

      if (currentStatus === 'pending') {
        await client.query('COMMIT');

        return res.json({
          status: 'success',
          message: 'Your follow request is already pending.',
          follow_status: 'pending'
        });
      }

      // Resend a previously rejected request.
      await client.query(
        `UPDATE follows
         SET status = 'pending',
             requested_at = NOW(),
             responded_at = NULL
         WHERE follower_id = $1 AND following_id = $2`,
        [followerId, targetId]
      );

      await client.query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE recipient_id = $1
           AND actor_id = $2
           AND type = 'follow_request'`,
        [targetId, followerId]
      );
    } else {
      await client.query(
        `INSERT INTO follows
           (follower_id, following_id, status, requested_at)
         VALUES ($1, $2, 'pending', NOW())`,
        [followerId, targetId]
      );
    }

    await client.query(
      `INSERT INTO notifications
         (recipient_id, actor_id, type, content, is_read)
       VALUES ($1, $2, 'follow_request', $3, FALSE)`,
      [targetId, followerId, 'sent you a follow request']
    );

    await client.query('COMMIT');

    return res.status(201).json({
      status: 'success',
      message: 'Follow request sent.',
      follow_status: 'pending'
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('Follow request error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not send follow request.'
    });
  } finally {
    client.release();
  }
});

// =========================================================
// POST /api/users/:id/follow/accept
// Accept only the incoming request.
// No reverse follow is created.
// =========================================================

router.post('/:id/follow/accept', async (req, res) => {
  const recipientId = requireUserId(req, res);
  if (!recipientId) return;

  const requesterId = parseAccountId(req.params.id);

  if (!requesterId || requesterId === recipientId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid follow request.'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Requester follows recipient after acceptance.
    // Do not insert or update the reverse relationship.
    const result = await client.query(
      `UPDATE follows
       SET status = 'accepted',
           responded_at = NOW()
       WHERE follower_id = $1
         AND following_id = $2
         AND status = 'pending'
       RETURNING follower_id, following_id`,
      [requesterId, recipientId]
    );

    if (!result.rowCount) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        status: 'error',
        message: 'Pending follow request not found.'
      });
    }

    await client.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE recipient_id = $1
         AND actor_id = $2
         AND type = 'follow_request'`,
      [recipientId, requesterId]
    );

    await client.query(
      `INSERT INTO notifications
         (recipient_id, actor_id, type, content, is_read)
       VALUES ($1, $2, 'follow_accepted', $3, FALSE)`,
      [requesterId, recipientId, 'accepted your follow request']
    );

    await client.query('COMMIT');

    return res.json({
      status: 'success',
      message: 'Follow request accepted. No follow-back was created.',
      follow_status: 'accepted'
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('Accept follow request error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not accept follow request.'
    });
  } finally {
    client.release();
  }
});

// =========================================================
// POST /api/users/:id/follow/reject
// Reject only the incoming request.
// Rejected requests are not follower relationships.
// =========================================================

router.post('/:id/follow/reject', async (req, res) => {
  const recipientId = requireUserId(req, res);
  if (!recipientId) return;

  const requesterId = parseAccountId(req.params.id);

  if (!requesterId || requesterId === recipientId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid follow request.'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE follows
       SET status = 'rejected',
           responded_at = NOW()
       WHERE follower_id = $1
         AND following_id = $2
         AND status = 'pending'
       RETURNING follower_id, following_id`,
      [requesterId, recipientId]
    );

    if (!result.rowCount) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        status: 'error',
        message: 'Pending follow request not found.'
      });
    }

    await client.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE recipient_id = $1
         AND actor_id = $2
         AND type = 'follow_request'`,
      [recipientId, requesterId]
    );

    await client.query('COMMIT');

    return res.json({
      status: 'success',
      message: 'Follow request rejected. No follow relationship was created.',
      follow_status: 'rejected'
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('Reject follow request error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not reject follow request.'
    });
  } finally {
    client.release();
  }
});

// =========================================================
// DELETE /api/users/:id/follow
// Unfollow an accepted relationship only.
// =========================================================

router.delete('/:id/follow', async (req, res) => {
  const followerId = requireUserId(req, res);
  if (!followerId) return;

  const targetId = parseAccountId(req.params.id);

  if (!targetId) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid account ID.'
    });
  }

  if (followerId === targetId) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot unfollow your own account.'
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM follows
       WHERE follower_id = $1
         AND following_id = $2
         AND COALESCE(status, 'accepted') = 'accepted'
       RETURNING follower_id`,
      [followerId, targetId]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        status: 'error',
        message: 'No accepted follow relationship was found.'
      });
    }

    return res.json({
      status: 'success',
      message: 'Account unfollowed successfully.',
      follow_status: null
    });
  } catch (error) {
    console.error('Unfollow error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not unfollow this account.'
    });
  }
});

module.exports = router;
