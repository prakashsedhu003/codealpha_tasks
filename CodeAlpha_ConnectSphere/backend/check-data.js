
require('dotenv').config();

const pool = require('./config/db');

async function checkData() {
    try {
        const result = await pool.query(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);

        for (const row of result.rows) {
            const table = row.tablename.replace(/"/g, '""');

            const count = await pool.query(
                `SELECT COUNT(*)::int AS total FROM public."${table}"`
            );

            console.log(`${table}: ${count.rows[0].total} rows`);
        }
    } catch (error) {
        console.error('Database check failed:', error.message);
    } finally {
        await pool.end();
    }
}

checkData();
