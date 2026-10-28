
const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// All post routes require login.
router.use(authenticateToken);

// =====================================================
// GET /api/posts
// Load posts from all accounts.
// =====================================================
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
         p.id,
         p.user_id,
         p.content,
         p.image_url,
         p.created_at,
         u.username,
         u.full_name,
         u.avatar_url,
         (SELECT COUNT(*)::int
          FROM likes l
          WHERE l.post_id = p.id) AS likes_count,
         (SELECT COUNT(*)::int
          FROM comments c
          WHERE c.post_id = p.id) AS comments_count,
         EXISTS (
           SELECT 1
           FROM likes l
           WHERE l.post_id = p.id AND l.user_id = $1
         ) AS is_liked
       FROM posts p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 100`,
      [userId]
    );

    return res.json({
      status: 'success',
      posts: result.rows
    });
  } catch (error) {
    console.error('Load posts error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load posts.'
    });
  }
});

// =====================================================
// POST /api/posts
// Create a post and notify accepted followers.
// =====================================================
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const content = typeof req.body.content === 'string'
      ? req.body.content.trim()
      : '';

    const imageUrl = typeof req.body.image_url === 'string'
      ? req.body.image_url.trim()
      : null;

    if (!content && !imageUrl) {
      return res.status(400).json({
        status: 'error',
        message: 'Write something or provide an image.'
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        status: 'error',
        message: 'Post content must be 5000 characters or fewer.'
      });
    }

    const result = await pool.query(
      `INSERT INTO posts (user_id, content, image_url)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, content, image_url, created_at`,
      [userId, content, imageUrl || null]
    );

    const post = result.rows[0];

    const userResult = await pool.query(
      `SELECT username, full_name, avatar_url
       FROM users
       WHERE id = $1`,
      [userId]
    );

    // Notify users who already follow this account.
    // Notification failure must not undo the saved post.
    try {
      await pool.query(
        `INSERT INTO notifications
           (recipient_id, actor_id, type, post_id, content, is_read)
         SELECT
           f.follower_id,
           $1,
           'new_post',
           $2,
           'published a new post',
           FALSE
         FROM follows f
         WHERE f.following_id = $1
           AND f.follower_id <> $1
           AND COALESCE(f.status, 'accepted') = 'accepted'`,
        [userId, post.id]
      );
    } catch (notificationError) {
      console.error(
        'Create post notifications error:',
        notificationError.message
      );
    }

    return res.status(201).json({
      status: 'success',
      message: 'Post created successfully.',
      post: {
        ...post,
        ...(userResult.rows[0] || {}),
        likes_count: 0,
        comments_count: 0,
        is_liked: false
      }
    });
  } catch (error) {
    console.error('Create post error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not create post.'
    });
  }
});

// =====================================================
// POST /api/posts/:id/like
// Like a post and notify its owner.
// =====================================================
router.post('/:id/like', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.id;

    if (!Number.isInteger(postId) || postId < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid post ID.'
      });
    }

    const postResult = await pool.query(
      'SELECT id, user_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found.'
      });
    }

    const postOwnerId = postResult.rows[0].user_id;

    // Insert only if the user has not already liked this post.
    const likeResult = await pool.query(
      `INSERT INTO likes (user_id, post_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1
         FROM likes
         WHERE user_id = $1 AND post_id = $2
       )
       RETURNING post_id`,
      [userId, postId]
    );

    // Notify only when a new like was created.
    // Do not notify the owner for liking their own post.
    if (likeResult.rowCount > 0 && String(userId) !== String(postOwnerId)) {
      try {
        await pool.query(
          `INSERT INTO notifications
             (recipient_id, actor_id, type, post_id, content, is_read)
           VALUES ($1, $2, 'post_like', $3, 'liked your post', FALSE)`,
          [postOwnerId, userId, postId]
        );
      } catch (notificationError) {
        console.error(
          'Create like notification error:',
          notificationError.message
        );
      }
    }

    const count = await pool.query(
      'SELECT COUNT(*)::int AS likes_count FROM likes WHERE post_id = $1',
      [postId]
    );

    return res.json({
      status: 'success',
      is_liked: true,
      likes_count: count.rows[0].likes_count
    });
  } catch (error) {
    console.error('Like post error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not like post.'
    });
  }
});

// =====================================================
// DELETE /api/posts/:id/like
// Unlike a post.
// =====================================================
router.delete('/:id/like', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.id;

    if (!Number.isInteger(postId) || postId < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid post ID.'
      });
    }

    await pool.query(
      'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
      [userId, postId]
    );

    const count = await pool.query(
      'SELECT COUNT(*)::int AS likes_count FROM likes WHERE post_id = $1',
      [postId]
    );

    return res.json({
      status: 'success',
      is_liked: false,
      likes_count: count.rows[0].likes_count
    });
  } catch (error) {
    console.error('Unlike post error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not unlike post.'
    });
  }
});

// =====================================================
// GET /api/posts/:id/comments
// Load comments for a post.
// =====================================================
router.get('/:id/comments', async (req, res) => {
  try {
    const postId = Number(req.params.id);

    if (!Number.isInteger(postId) || postId < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid post ID.'
      });
    }

    const result = await pool.query(
      `SELECT
         c.id,
         c.post_id,
         c.user_id,
         c.content,
         c.created_at,
         u.username,
         u.full_name,
         u.avatar_url
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );

    return res.json({
      status: 'success',
      comments: result.rows
    });
  } catch (error) {
    console.error('Load comments error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load comments.'
    });
  }
});

// =====================================================
// POST /api/posts/:id/comments
// Add a comment and notify the post owner.
// =====================================================
router.post('/:id/comments', async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.id;

    const content = typeof req.body.content === 'string'
      ? req.body.content.trim()
      : '';

    if (!Number.isInteger(postId) || postId < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid post ID.'
      });
    }

    if (!content || content.length > 2000) {
      return res.status(400).json({
        status: 'error',
        message: 'Comment must contain 1–2000 characters.'
      });
    }

    const postResult = await pool.query(
      'SELECT id, user_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found.'
      });
    }

    const postOwnerId = postResult.rows[0].user_id;

    const result = await pool.query(
      `INSERT INTO comments (post_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, content, created_at`,
      [postId, userId, content]
    );

    const user = await pool.query(
      `SELECT username, full_name, avatar_url
       FROM users
       WHERE id = $1`,
      [userId]
    );

    // Do not notify a user about their own comment.
    try {
      if (String(userId) !== String(postOwnerId)) {
        await pool.query(
          `INSERT INTO notifications
             (recipient_id, actor_id, type, post_id, content, is_read)
           VALUES ($1, $2, 'post_comment', $3, 'commented on your post', FALSE)`,
          [postOwnerId, userId, postId]
        );
      }
    } catch (notificationError) {
      console.error(
        'Create comment notification error:',
        notificationError.message
      );
    }

    return res.status(201).json({
      status: 'success',
      message: 'Comment added successfully.',
      comment: {
        ...result.rows[0],
        ...(user.rows[0] || {})
      }
    });
  } catch (error) {
    console.error('Add comment error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not add comment.'
    });
  }
});

// =====================================================
// PUT /api/posts/:id
// Edit a post owned by the logged-in user.
// =====================================================
router.put('/:id', async (req, res) => {
  const postId = Number(req.params.id);
  const userId = req.user.id;

  const content = typeof req.body.content === 'string'
    ? req.body.content.trim()
    : '';

  if (!Number.isSafeInteger(postId) || postId < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid post ID.'
    });
  }

  if (!content) {
    return res.status(400).json({
      status: 'error',
      message: 'Post content cannot be empty.'
    });
  }

  if (content.length > 5000) {
    return res.status(400).json({
      status: 'error',
      message: 'Post content must be 5000 characters or fewer.'
    });
  }

  try {
    const result = await pool.query(
      `UPDATE posts
       SET content = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, content, image_url, created_at`,
      [content, postId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found or you do not own this post.'
      });
    }

    return res.json({
      status: 'success',
      message: 'Post updated successfully.',
      post: result.rows[0]
    });
  } catch (error) {
    console.error('Edit post error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not update post.'
    });
  }
});

// =====================================================
// DELETE /api/posts/:id
// Delete an owned post and its related records.
// =====================================================
router.delete('/:id', async (req, res) => {
  const postId = Number(req.params.id);
  const userId = req.user.id;

  if (!Number.isSafeInteger(postId) || postId < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid post ID.'
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query('BEGIN');

    const ownedPost = await client.query(
      `SELECT id
       FROM posts
       WHERE id = $1 AND user_id = $2
       FOR UPDATE`,
      [postId, userId]
    );

    if (ownedPost.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        status: 'error',
        message: 'Post not found or you do not own this post.'
      });
    }

    // Remove notifications linked to this post first.
    await client.query(
      'DELETE FROM notifications WHERE post_id = $1',
      [postId]
    );

    await client.query(
      'DELETE FROM comments WHERE post_id = $1',
      [postId]
    );

    await client.query(
      'DELETE FROM likes WHERE post_id = $1',
      [postId]
    );

    await client.query(
      'DELETE FROM posts WHERE id = $1 AND user_id = $2',
      [postId, userId]
    );

    await client.query('COMMIT');

    return res.json({
      status: 'success',
      message: 'Post deleted successfully.'
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Post deletion rollback error:', rollbackError.message);
      }
    }

    console.error('Delete post error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not delete post.'
    });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
