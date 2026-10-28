
require('dotenv').config();
const pool = require('./config/db');

async function main() {
  try {
    const tables = [
      'notifications',
      'messages',
      'follows',
      'posts',
      'likes',
      'comments'
    ];

    for (const table of tables) {
      const result = await pool.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );

      console.log(`\n===== ${table.toUpperCase()} COLUMNS =====`);
      console.table(result.rows);
    }
  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await pool.end();
  }
}

main();
