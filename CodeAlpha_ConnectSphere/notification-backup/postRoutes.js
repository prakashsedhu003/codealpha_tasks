
const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// All post routes require login
router.use(authenticateToken);

// GET /api/posts — load posts from all accounts
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
           SELECT 1 FROM likes l
           WHERE l.post_id = p.id AND l.user_id = $1
         ) AS is_liked
       FROM posts p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 100`,
      [userId]
    );

    res.json({
      status: 'success',
      posts: result.rows
    });
  } catch (error) {
    console.error('Load posts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Could not load posts.'
    });
  }
});

// POST /api/posts — create a post
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

    res.status(201).json({
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
    res.status(500).json({
      status: 'error',
      message: 'Could not create post.'
    });
  }
});

// POST /api/posts/:id/like — like a post
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

    const post = await pool.query(
      'SELECT id FROM posts WHERE id = $1',
      [postId]
    );

    if (post.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found.'
      });
    }

    await pool.query(
      `INSERT INTO likes (user_id, post_id)
       SELECT $1, $2
       WHERE NOT EXISTS (
         SELECT 1 FROM likes
         WHERE user_id = $1 AND post_id = $2
       )`,
      [userId, postId]
    );

    const count = await pool.query(
      'SELECT COUNT(*)::int AS likes_count FROM likes WHERE post_id = $1',
      [postId]
    );

    res.json({
      status: 'success',
      is_liked: true,
      likes_count: count.rows[0].likes_count
    });
  } catch (error) {
    console.error('Like post error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not like post.'
    });
  }
});

// DELETE /api/posts/:id/like — unlike a post
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

    res.json({
      status: 'success',
      is_liked: false,
      likes_count: count.rows[0].likes_count
    });
  } catch (error) {
    console.error('Unlike post error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not unlike post.'
    });
  }
});

// GET /api/posts/:id/comments — load comments
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

    res.json({
      status: 'success',
      comments: result.rows
    });
  } catch (error) {
    console.error('Load comments error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not load comments.'
    });
  }
});

// POST /api/posts/:id/comments — add a comment
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

    const post = await pool.query(
      'SELECT id FROM posts WHERE id = $1',
      [postId]
    );

    if (post.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Post not found.'
      });
    }

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

    res.status(201).json({
      status: 'success',
      message: 'Comment added successfully.',
      comment: {
        ...result.rows[0],
        ...(user.rows[0] || {})
      }
    });
  } catch (error) {
    console.error('Add comment error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Could not add comment.'
    });
  }
});


/* EDIT A POST — only its owner can edit it */
router.put('/:id', authenticateToken, async (req, res) => {
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


/* DELETE A POST — only its owner can delete it */
router.delete('/:id', authenticateToken, async (req, res) => {
  const postId = Number(req.params.id);
  const userId = req.user.id;

  if (!Number.isSafeInteger(postId) || postId < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid post ID.'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Confirm that this post belongs to the logged-in user.
    const ownedPost = await client.query(
      `SELECT id FROM posts
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

    // Remove related records first to avoid foreign-key errors.
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
    await client.query('ROLLBACK');
    console.error('Delete post error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not delete post.'
    });
  } finally {
    client.release();
  }
});


module.exports = router;
