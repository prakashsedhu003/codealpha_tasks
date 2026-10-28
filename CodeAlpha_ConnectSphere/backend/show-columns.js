require('dotenv').config();
const pool = require('./config/db');

async function main() {
  const result = await pool.query(`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  for (const row of result.rows) {
    console.log(`${row.table_name}.${row.column_name} (${row.data_type})`);
  }
}

main()
  .catch(error => console.error(error.message))
  .finally(() => pool.end());
