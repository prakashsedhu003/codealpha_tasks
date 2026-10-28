
require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('./config/db');

const demoUsers = [
    { username: 'prakash', full_name: 'Prakash', email: 'prakash@connectsphere.demo' },
    { username: 'niranjan', full_name: 'Niranjan', email: 'niranjan@connectsphere.demo' },
    { username: 'sanjay', full_name: 'Sanjay', email: 'sanjay@connectsphere.demo' },
    { username: 'roshan', full_name: 'Roshan', email: 'roshan@connectsphere.demo' },
    { username: 'prasanna', full_name: 'Prasanna', email: 'prasanna@connectsphere.demo' },
];

async function resetSocialData() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Find every public table except users.
        const result = await client.query(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename <> 'users'
        `);

        // Clear posts, comments, likes, follows, messages,
        // stories, notifications, and other application tables.
        if (result.rows.length > 0) {
            const tableNames = result.rows.map(({ tablename }) =>
                '"' + tablename.replace(/"/g, '""') + '"'
            );

            await client.query(
                `TRUNCATE TABLE ${tableNames.join(', ')}
                 RESTART IDENTITY CASCADE`
            );
        }

        const emails = demoUsers.map(user => user.email);

        // Remove every account except the five demo emails.
        await client.query(
            'DELETE FROM users WHERE NOT (email = ANY($1::text[]))',
            [emails]
        );

        const passwordHash = await bcrypt.hash('Demo@12345', 12);

        // Ensure all five demo accounts exist.
        for (const user of demoUsers) {
            await client.query(
                `INSERT INTO users
                    (username, full_name, email, password_hash)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (username)
                 DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    password_hash = EXCLUDED.password_hash`,
                [
                    user.username,
                    user.full_name,
                    user.email,
                    passwordHash
                ]
            );
        }

        await client.query('COMMIT');

        console.log('Social data reset successfully!');
        console.log('Only the five demo accounts are retained.');
        console.log('Posts, likes, comments, follows, messages,');
        console.log('stories, notifications, and other public-table data cleared.');
        console.log('Demo password: Demo@12345');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Reset failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

resetSocialData();
