
const pool = require('./config/db');

async function setupNotifications() {
  const queries = [
    // Existing relationships remain accepted.
    `ALTER TABLE follows
       ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'accepted'`,

    `ALTER TABLE follows
       ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,

    `ALTER TABLE follows
       ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ`,

    // Direct messages between registered users.
    `CREATE TABLE IF NOT EXISTS messages (
       id BIGSERIAL PRIMARY KEY,
       sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       content TEXT NOT NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       read_at TIMESTAMPTZ,
       CONSTRAINT messages_not_self CHECK (sender_id <> recipient_id),
       CONSTRAINT messages_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
    )`,

    // Notifications received by a registered user.
    `CREATE TABLE IF NOT EXISTS notifications (
       id BIGSERIAL PRIMARY KEY,
       recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       actor_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
       type VARCHAR(30) NOT NULL,
       post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
       message_id BIGINT REFERENCES messages(id) ON DELETE CASCADE,
       content TEXT,
       is_read BOOLEAN NOT NULL DEFAULT FALSE,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       CONSTRAINT notifications_valid_type CHECK (
         type IN (
           'follow_request',
           'follow_accepted',
           'message',
           'new_post',
           'post_like',
           'post_comment'
         )
       )
    )`,

    `CREATE INDEX IF NOT EXISTS idx_follows_following_status
       ON follows(following_id, status)`,

    `CREATE INDEX IF NOT EXISTS idx_follows_follower_status
       ON follows(follower_id, status)`,

    `CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
       ON notifications(recipient_id, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_notifications_unread
       ON notifications(recipient_id, is_read)`,

    `CREATE INDEX IF NOT EXISTS idx_messages_recipient_created
       ON messages(recipient_id, created_at DESC)`
  ];

  try {
    for (const query of queries) {
      await pool.query(query);
    }

    console.log('Notification database setup completed successfully.');

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'follows', 'messages', 'notifications')
      ORDER BY table_name
    `);

    console.log('Verified tables:');
    result.rows.forEach(row => console.log('- ' + row.table_name));
  } catch (error) {
    console.error('Database setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupNotifications();
