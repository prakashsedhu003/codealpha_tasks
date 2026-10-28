
require('dotenv').config();

const pool = require('./config/db');

async function clearData() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Delete existing social media data.
        // Keep the database tables and their structure.
        await client.query(`
            TRUNCATE TABLE
                comments,
                likes,
                posts,
                follows,
                users
            RESTART IDENTITY CASCADE
        `);

        await client.query('COMMIT');

        console.log('All existing sample data has been deleted.');
        console.log('Database tables are preserved.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Cleanup failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

clearData();
