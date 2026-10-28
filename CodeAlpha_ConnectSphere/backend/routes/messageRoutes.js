
const express = require('express');
const pool = require('../config/db');
const authenticateToken = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken);

// Get the authenticated user's database ID.
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

// =====================================================
// GET /api/messages/conversations
// List all registered accounts and their latest messages.
// =====================================================
router.get('/conversations', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const result = await pool.query(
      `SELECT
         u.id,
         u.id AS participant_id,
         u.username,
         u.full_name,
         u.avatar_url,
         latest.content AS preview,
         latest.created_at AS updated_at,
         latest.sender_id AS last_sender_id,
         COALESCE(unread.total, 0)::int AS unread
       FROM users u
       LEFT JOIN LATERAL (
         SELECT m.content, m.created_at, m.sender_id
         FROM messages m
         WHERE
           (m.sender_id = $1 AND m.recipient_id = u.id)
           OR
           (m.sender_id = u.id AND m.recipient_id = $1)
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT 1
       ) latest ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total
         FROM messages m
         WHERE m.sender_id = u.id
           AND m.recipient_id = $1
           AND m.read_at IS NULL
       ) unread ON TRUE
       WHERE u.id <> $1
       ORDER BY
         latest.created_at DESC NULLS LAST,
         u.username ASC`,
      [userId]
    );

    const conversations = result.rows.map((row) => ({
      id: String(row.id),
      participant_id: row.participant_id,
      user: {
        id: row.participant_id,
        username: row.username,
        full_name: row.full_name || row.username,
        avatar_url: row.avatar_url || ''
      },
      preview: row.preview || '',
      updated_at: row.updated_at,
      unread: row.unread
    }));

    return res.json({
      status: 'success',
      conversations
    });
  } catch (error) {
    console.error('Load conversations error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load conversations.'
    });
  }
});

// =====================================================
// GET /api/messages/conversations/:id
// Load messages with another account and mark them read.
// =====================================================
router.get('/conversations/:id', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const participantId = Number(req.params.id);

  if (
    !Number.isSafeInteger(participantId) ||
    participantId <= 0 ||
    participantId === userId
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid conversation.'
    });
  }

  let client;

  try {
    client = await pool.connect();

    await client.query('BEGIN');

    const participant = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [participantId]
    );

    if (participant.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        status: 'error',
        message: 'Account not found.'
      });
    }

    // Mark incoming messages as read.
    await client.query(
      `UPDATE messages
       SET read_at = NOW()
       WHERE sender_id = $1
         AND recipient_id = $2
         AND read_at IS NULL`,
      [participantId, userId]
    );

    // Mark notifications for these incoming messages as read.
    await client.query(
      `UPDATE notifications n
       SET is_read = TRUE
       WHERE n.recipient_id = $1
         AND n.actor_id = $2
         AND n.type = 'message'
         AND n.is_read = FALSE
         AND n.message_id IN (
           SELECT m.id
           FROM messages m
           WHERE m.sender_id = $2
             AND m.recipient_id = $1
         )`,
      [userId, participantId]
    );

    const result = await client.query(
      `SELECT
         id,
         sender_id,
         recipient_id,
         content,
         created_at,
         read_at
       FROM messages
       WHERE
         (sender_id = $1 AND recipient_id = $2)
         OR
         (sender_id = $2 AND recipient_id = $1)
       ORDER BY created_at ASC, id ASC`,
      [userId, participantId]
    );

    await client.query('COMMIT');

    return res.json({
      status: 'success',
      messages: result.rows.map((message) => ({
        ...message,
        mine: Number(message.sender_id) === userId
      }))
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    console.error('Load conversation messages error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not load messages.'
    });
  } finally {
    if (client) client.release();
  }
});

// =====================================================
// POST /api/messages/conversations/:id
// Send a message and notify the recipient.
// =====================================================
router.post('/conversations/:id', async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  const participantId = Number(req.params.id);

  const content =
    typeof req.body?.content === 'string'
      ? req.body.content.trim()
      : '';

  if (
    !Number.isSafeInteger(participantId) ||
    participantId <= 0 ||
    participantId === userId
  ) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid recipient.'
    });
  }

  if (!content || content.length > 5000) {
    return res.status(400).json({
      status: 'error',
      message: 'Message must contain 1 to 5000 characters.'
    });
  }

  try {
    const recipient = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [participantId]
    );

    if (recipient.rowCount === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Recipient account not found.'
      });
    }

    // Save the message once.
    const result = await pool.query(
      `INSERT INTO messages (sender_id, recipient_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, recipient_id, content, created_at, read_at`,
      [userId, participantId, content]
    );

    const savedMessage = result.rows[0];

    // Create a notification for the recipient.
    // If notification creation fails, keep the saved message.
    try {
      await pool.query(
        `INSERT INTO notifications
           (recipient_id, actor_id, type, message_id, content, is_read)
         VALUES ($1, $2, 'message', $3, $4, FALSE)`,
        [
          participantId,
          userId,
          savedMessage.id,
          'sent you a message'
        ]
      );
    } catch (notificationError) {
      console.error(
        'Create message notification error:',
        notificationError.message
      );
    }

    const message = {
      ...savedMessage,
      mine: true
    };

    return res.status(201).json({
      status: 'success',
      message
    });
  } catch (error) {
    console.error('Send message error:', error.message);

    return res.status(500).json({
      status: 'error',
      message: 'Could not send message.'
    });
  }
});

module.exports = router;
