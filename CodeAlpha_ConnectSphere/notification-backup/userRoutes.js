
const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

// =========================================================
// GET /api/users
// List registered accounts and follow status
// =========================================================
router.get('/', async (req, res) => {
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
           WHERE f.follower_id = $1 AND f.following_id = u.id
         ) AS is_following,
         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = u.id AND f.following_id = $1
         ) AS is_following_me
       FROM users u
       WHERE u.id <> $1
       ORDER BY u.created_at DESC, u.id DESC`,
      [req.user.id]
    );

    res.json({ status: 'success', users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Could not load accounts.'
    });
  }
});

// =========================================================
// GET /api/users/:username
// Get profile, counts, and follow status
// =========================================================
router.get('/:username', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.username,
         u.full_name,
         u.bio,
         u.avatar_url,
         u.created_at,

         (SELECT COUNT(*)::int
          FROM posts p
          WHERE p.user_id = u.id) AS posts_count,

         (SELECT COUNT(*)::int
          FROM follows f
          WHERE f.following_id = u.id) AS followers_count,

         (SELECT COUNT(*)::int
          FROM follows f
          WHERE f.follower_id = u.id) AS following_count,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = $1 AND f.following_id = u.id
         ) AS is_following,

         EXISTS (
           SELECT 1 FROM follows f
           WHERE f.follower_id = u.id AND f.following_id = $1
         ) AS is_following_me

       FROM users u
       WHERE LOWER(u.username) = LOWER($2)
       LIMIT 1`,
      [req.user.id, req.params.username]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        status: 'error',
        message: 'Account not found.'
      });
    }

    res.json({
      status: 'success',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not load this profile.'
    });
  }
});

// =========================================================
// GET /api/users/:username/posts
// Get posts belonging to a specific user
// =========================================================
router.get('/:username/posts', async (req, res) => {
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

         (SELECT COUNT(*)::int
          FROM likes l
          WHERE l.post_id = p.id) AS likes_count,

         (SELECT COUNT(*)::int
          FROM comments c
          WHERE c.post_id = p.id) AS comments_count,

         EXISTS (
           SELECT 1 FROM likes l
           WHERE l.post_id = p.id AND l.user_id = $2
         ) AS is_liked

       FROM posts p
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC, p.id DESC`,
      [user.id, req.user.id]
    );

    const posts = result.rows.map((post) => ({
      ...post,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        avatar_url: user.avatar_url
      }
    }));

    res.json({
      status: 'success',
      posts
    });
  } catch (error) {
    console.error('Get user posts error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not load this account’s posts.'
    });
  }
});

// =========================================================
// GET /api/users/:username/followers
// List accounts following this user
// =========================================================
router.get('/:username/followers', async (req, res) => {
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
         ) AS is_following,

         EXISTS (
           SELECT 1 FROM follows theirs
           WHERE theirs.follower_id = u.id
             AND theirs.following_id = $1
         ) AS is_following_me

       FROM users target
       JOIN follows f ON f.following_id = target.id
       JOIN users u ON u.id = f.follower_id
       WHERE LOWER(target.username) = LOWER($2)
       ORDER BY f.created_at DESC, u.username`,
      [req.user.id, req.params.username]
    );

    res.json({
      status: 'success',
      users: result.rows
    });
  } catch (error) {
    console.error('Get followers error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not load followers.'
    });
  }
});

// =========================================================
// GET /api/users/:username/following
// List accounts this user follows
// =========================================================
router.get('/:username/following', async (req, res) => {
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
         ) AS is_following,

         EXISTS (
           SELECT 1 FROM follows theirs
           WHERE theirs.follower_id = u.id
             AND theirs.following_id = $1
         ) AS is_following_me

       FROM users target
       JOIN follows f ON f.follower_id = target.id
       JOIN users u ON u.id = f.following_id
       WHERE LOWER(target.username) = LOWER($2)
       ORDER BY f.created_at DESC, u.username`,
      [req.user.id, req.params.username]
    );

    res.json({
      status: 'success',
      users: result.rows
    });
  } catch (error) {
    console.error('Get following error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not load following list.'
    });
  }
});

// =========================================================
// PUT /api/users/me
// Update the logged-in user's profile
// =========================================================
router.put('/me', async (req, res) => {
  const fullName =
    typeof req.body.full_name === 'string'
      ? req.body.full_name.trim()
      : '';

  const bio =
    typeof req.body.bio === 'string'
      ? req.body.bio.trim()
      : '';

  const avatarUrl =
    typeof req.body.avatar_url === 'string'
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
      [fullName, bio, avatarUrl || null, req.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        status: 'error',
        message: 'Your account was not found.'
      });
    }

    res.json({
      status: 'success',
      message: 'Profile updated successfully.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not update your profile.'
    });
  }
});

// =========================================================
// POST /api/users/:id/follow
// Follow an account only when the user clicks Follow
// =========================================================
router.post('/:id/follow', async (req, res) => {
  const targetId = req.params.id;

  if (!/^\d+$/.test(targetId) || targetId === '0') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid account ID.'
    });
  }

  if (String(req.user.id) === targetId) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot follow your own account.'
    });
  }

  try {
    const target = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [targetId]
    );

    if (!target.rowCount) {
      return res.status(404).json({
        status: 'error',
        message: 'Account not found.'
      });
    }

    await pool.query(
      `INSERT INTO follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, targetId]
    );

    res.json({
      status: 'success',
      message: 'Account followed successfully.'
    });
  } catch (error) {
    console.error('Follow error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not follow this account.'
    });
  }
});

// =========================================================
// DELETE /api/users/:id/follow
// Unfollow an account
// =========================================================
router.delete('/:id/follow', async (req, res) => {
  const targetId = req.params.id;

  if (!/^\d+$/.test(targetId) || targetId === '0') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid account ID.'
    });
  }

  if (String(req.user.id) === targetId) {
    return res.status(400).json({
      status: 'error',
      message: 'You cannot unfollow your own account.'
    });
  }

  try {
    await pool.query(
      `DELETE FROM follows
       WHERE follower_id = $1 AND following_id = $2`,
      [req.user.id, targetId]
    );

    res.json({
      status: 'success',
      message: 'Account unfollowed successfully.'
    });
  } catch (error) {
    console.error('Unfollow error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not unfollow this account.'
    });
  }
});

module.exports = router;
