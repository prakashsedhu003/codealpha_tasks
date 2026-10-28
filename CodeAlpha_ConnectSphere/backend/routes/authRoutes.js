const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');

const router = express.Router();

// Validate request data
function validate(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            status: 'error',
            message: 'Please correct the following errors.',
            errors: errors.array().map((error) => error.msg),
        });
    }

    next();
}

// Create JWT token
function createToken(user) {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is missing from .env');
    }

    return jwt.sign(
        { id: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
}

// REGISTER: POST /api/auth/register
router.post(
    '/register',
    [
        body('username')
            .trim()
            .isLength({ min: 3, max: 30 })
            .withMessage('Username must be 3–30 characters.')
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage('Username can contain letters, numbers and underscores.'),

        body('full_name')
            .trim()
            .notEmpty()
            .withMessage('Full name is required.')
            .isLength({ max: 100 })
            .withMessage('Full name cannot exceed 100 characters.'),

        body('email')
            .trim()
            .isEmail()
            .withMessage('Enter a valid email address.')
            .normalizeEmail(),

        body('password')
            .isString()
            .isLength({ min: 8, max: 72 })
            .withMessage('Password must be 8–72 characters long.'),
    ],
    validate,
    async (req, res) => {
        try {
            const { username, full_name, email, password } = req.body;
            const passwordHash = await bcrypt.hash(password, 12);

            const result = await pool.query(
                `INSERT INTO users
                    (username, full_name, email, password_hash)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, username, full_name, email, bio, created_at`,
                [username, full_name, email.toLowerCase(), passwordHash]
            );

            const user = result.rows[0];
            const token = createToken(user);

            return res.status(201).json({
                status: 'success',
                message: 'Account created successfully.',
                user,
                token,
            });
        } catch (error) {
            if (error && error.code === '23505') {
                return res.status(409).json({
                    status: 'error',
                    message: 'That username or email is already registered.',
                });
            }

            console.error('Registration error:', error);
            console.error('Error code:', error?.code);
            console.error('Error message:', error?.message);

            return res.status(500).json({
                status: 'error',
                message: 'Could not create account. Please try again.',
            });
        }
    }
);

// LOGIN: POST /api/auth/login
router.post(
    '/login',
    [
        body('email')
            .trim()
            .isEmail()
            .withMessage('Enter a valid email address.')
            .normalizeEmail(),

        body('password')
            .isString()
            .notEmpty()
            .withMessage('Password is required.'),
    ],
    validate,
    async (req, res) => {
        try {
            const { email, password } = req.body;

            const result = await pool.query(
                `SELECT id, username, full_name, email, password_hash, bio, created_at
                 FROM users
                 WHERE email = $1`,
                [email.toLowerCase()]
            );

            const user = result.rows[0];

            if (!user || !(await bcrypt.compare(password, user.password_hash))) {
                return res.status(401).json({
                    status: 'error',
                    message: 'Invalid email or password.',
                });
            }

            const token = createToken(user);
            delete user.password_hash;

            return res.status(200).json({
                status: 'success',
                message: 'Login successful.',
                user,
                token,
            });
        } catch (error) {
            console.error('Login error:', error);
            console.error('Error code:', error?.code);
            console.error('Error message:', error?.message);

            return res.status(500).json({
                status: 'error',
                message: 'Could not log in. Please try again.',
            });
        }
    }
);

module.exports = router;