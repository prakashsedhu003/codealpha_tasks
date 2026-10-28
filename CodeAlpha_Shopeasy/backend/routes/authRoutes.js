const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const oracledb = require("oracledb");
const getConnection  = require("../db");

const router = express.Router();

const JWT_SECRET = "shopeasy-secret-key";

// Register
router.post("/register", async (req, res) => {
    let connection;

    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        connection = await getConnection();

        const existingUser = await connection.execute(
            `
            SELECT user_id
            FROM users
            WHERE LOWER(email) = LOWER(:email)
            `,
            { email }
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await connection.execute(
            `
            INSERT INTO users
                (name, email, password)
            VALUES
                (:name, :email, :password)
            RETURNING user_id INTO :userId
            `,
            {
                name,
                email,
                password: hashedPassword,
                userId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            },
            {
                autoCommit: true
            }
        );

        const userId = result.outBinds.userId[0];

        const token = jwt.sign(
            {
                userId,
                email
            },
            JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.status(201).json({
            message: "Registration successful",
            token,
            user: {
                id: userId,
                name,
                email
            }
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            message: "Registration failed"
        });

    } finally {
        if (connection) {
            await connection.close();
        }
    }
});


// Login
router.post("/login", async (req, res) => {
    let connection;

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        connection = await getConnection();

        const result = await connection.execute(
            `
            SELECT
                user_id,
                name,
                email,
                password
            FROM users
            WHERE LOWER(email) = LOWER(:email)
            `,
            { email }
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const row = result.rows[0];

        const passwordMatch = await bcrypt.compare(
            password,
            row[3]
        );

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                userId: row[0],
                email: row[2]
            },
            JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: row[0],
                name: row[1],
                email: row[2]
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Login failed"
        });

    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

module.exports = router;