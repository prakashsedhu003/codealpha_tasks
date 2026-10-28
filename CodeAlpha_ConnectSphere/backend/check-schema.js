const pool = require("./config/db");

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'posts', 'follows', 'likes', 'comments')
      ORDER BY table_name, ordinal_position
    `);

    let currentTable = "";

    for (const row of result.rows) {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log("\nTABLE: " + currentTable);
      }

      console.log("  " + row.column_name + " (" + row.data_type + ")");
    }
  } catch (error) {
    console.error("Database error:", error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
