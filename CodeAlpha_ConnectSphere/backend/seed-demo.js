require('dotenv').config();

const bcrypt = require('bcrypt');
const pool = require('./config/db');

const demoUsers = [
    {
        username: 'prakash',
        full_name: 'Prakash',
        email: 'prakash@connectsphere.demo',
    },
    {
        username: 'niranjan',
        full_name: 'Niranjan',
        email: 'niranjan@connectsphere.demo',
    },
    {
        username: 'sanjay',
        full_name: 'Sanjay',
        email: 'sanjay@connectsphere.demo',
    },
    {
        username: 'roshan',
        full_name: 'Roshan',
        email: 'roshan@connectsphere.demo',
    },
    {
        username: 'prasanna',
        full_name: 'Prasanna',
        email: 'prasanna@connectsphere.demo',
    },
];

async function seedDemoUsers() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const passwordHash = await bcrypt.hash('Demo@12345', 12);
        const userIds = [];

        for (const user of demoUsers) {
            const result = await client.query(
                `INSERT INTO users
                    (username, full_name, email, password_hash)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (username)
                 DO UPDATE SET
                    full_name = EXCLUDED.full_name,
                    email = EXCLUDED.email,
                    password_hash = EXCLUDED.password_hash
                 RETURNING id, username`,
                [
                    user.username,
                    user.full_name,
                    user.email,
                    passwordHash,
                ]
            );

            userIds.push(result.rows[0]);
            console.log(`Ready: ${user.email}`);
        }

        // Make every demo user follow the other four users.
        for (const follower of userIds) {
            for (const following of userIds) {
                if (follower.id === following.id) continue;

                await client.query(
                    `INSERT INTO follows (follower_id, following_id)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [follower.id, following.id]
                );
            }
        }

        await client.query('COMMIT');

        console.log('\nDemo accounts are ready!');
        console.log('Password for all five accounts: Demo@12345');
        console.log('Each demo account follows the other four.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Demo setup failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

seedDemoUsers();