
const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

// All notification routes require login.
router.use(authenticateToken);

// GET /api/notifications
// Get notifications for the logged-in user.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         n.id,
         n.type,
         n.content,
         n.post_id,
         n.message_id,
         n.is_read,
         n.created_at,
         u.id AS actor_id,
         u.username AS actor_username,
         u.full_name AS actor_full_name,
         u.avatar_url AS actor_avatar_url
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [req.user.id]
    );

    return res.json({
      status: 'success',
      notifications: result.rows
    });
  } catch (error) {
    console.error('Get notifications error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load notifications.'
    });
  }
});

// GET /api/notifications/unread-count
// Get unread notification count.
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notifications
       WHERE recipient_id = $1
         AND is_read = FALSE`,
      [req.user.id]
    );

    return res.json({
      status: 'success',
      unread_count: result.rows[0].unread_count
    });
  } catch (error) {
    console.error('Unread count error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load unread count.'
    });
  }
});

// POST /api/notifications/:id/read
// Mark one notification as read.
router.post('/:id/read', async (req, res) => {
  try {
    const notificationId = Number(req.params.id);

    if (
      !Number.isSafeInteger(notificationId) ||
      notificationId <= 0
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid notification ID.'
      });
    }

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1
         AND recipient_id = $2
       RETURNING id, is_read`,
      [notificationId, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found.'
      });
    }

    return res.json({
      status: 'success',
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Mark notification read error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not update notification.'
    });
  }
});

// POST /api/notifications/read-all
// Mark all notifications as read.
router.post('/read-all', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE recipient_id = $1
         AND is_read = FALSE`,
      [req.user.id]
    );

    return res.json({
      status: 'success',
      updated_count: result.rowCount
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not update notifications.'
    });
  }
});

// POST /api/notifications/messages
// Send a direct message and notify its recipient.
router.post('/messages', async (req, res) => {
  const senderId = Number(req.user.id);
  const recipientId = Number(req.body.recipient_id);

  const content =
    typeof req.body.content === 'string'
      ? req.body.content.trim()
      : '';

  if (
    !Number.isSafeInteger(recipientId) ||
    recipientId <= 0 ||
    recipientId === senderId
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'Choose a valid recipient.'
    });
  }

  if (!content || content.length > 5000) {
    return res.status(400).json({
      status: 'error',
      message: 'Message must contain 1 to 5000 characters.'
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query('BEGIN');

    // Verify that the recipient exists.
    const recipient = await client.query(
      `SELECT id
       FROM users
       WHERE id = $1`,
      [recipientId]
    );

    if (recipient.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        status: 'error',
        message: 'Recipient account not found.'
      });
    }

    // Save the actual message.
    const messageResult = await client.query(
      `INSERT INTO messages
         (sender_id, recipient_id, content)
       VALUES ($1, $2, $3)
       RETURNING
         id,
         sender_id,
         recipient_id,
         content,
         created_at`,
      [senderId, recipientId, content]
    );

    const savedMessage = messageResult.rows[0];

    // Create a notification for the recipient.
    await client.query(
      `INSERT INTO notifications
         (recipient_id, actor_id, type, message_id, content)
       VALUES ($1, $2, 'message', $3, $4)`,
      [
        recipientId,
        senderId,
        savedMessage.id,
        'sent you a message'
      ]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      status: 'success',
      message: savedMessage
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError.message);
      }
    }

    console.error('Send message error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not send message.'
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
