const express = require("express");
const jwt = require("jsonwebtoken");
const oracledb = require("oracledb");
const getConnection = require("../db");

const router = express.Router();

const JWT_SECRET = "shopeasy-secret-key";

// Place order
router.post("/orders", async (req, res) => {
    let connection;

    try {
        const {
            name,
            email,
            phone,
            address,
            city,
            state,
            postalCode,
            items,
            total
        } = req.body;

        // Check required customer details
        if (
            !name ||
            !email ||
            !phone ||
            !address ||
            !city ||
            !state ||
            !postalCode
        ) {
            return res.status(400).json({
                message: "Please provide all required customer details"
            });
        }

        // Check items
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Order must contain at least one item"
            });
        }

        if (total === undefined || total === null) {
            return res.status(400).json({
                message: "Order total is required"
            });
        }

        // Check JWT
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const token = authHeader.split(" ")[1];

        let decoded;

        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return res.status(401).json({
                message: "Invalid or expired token"
            });
        }

        const userId = decoded.userId;

        connection = await getConnection();

        
        // Verify user exists
        const userResult = await connection.execute(
            `
            SELECT user_id
            FROM users
            WHERE user_id = :userId
            `,
            { userId }
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        // Check products and stock
        for (const item of items) {
            const productId = Number(item.id);
            const quantity = Number(item.quantity);

            if (!productId || !quantity || quantity <= 0) {
                await connection.rollback();

                return res.status(400).json({
                    message: "Invalid product or quantity"
                });
            }

            const productResult = await connection.execute(
                `
                SELECT
                    product_id,
                    price,
                    stock
                FROM products
                WHERE product_id = :productId
                FOR UPDATE
                `,
                { productId }
            );

            if (productResult.rows.length === 0) {
                await connection.rollback();

                return res.status(400).json({
                    message: `Product ${productId} not found`
                });
            }

            const stock = Number(productResult.rows[0][2]);

            if (stock < quantity) {
                await connection.rollback();

                return res.status(400).json({
                    message: `Insufficient stock for product ${productId}`
                });
            }
        }

        // Create order
        const orderResult = await connection.execute(
            `
            INSERT INTO orders
                (user_id, total_amount, status)
            VALUES
                (:userId, :total, 'PLACED')
            RETURNING order_id INTO :orderId
            `,
            {
                userId,
                total: Number(total),
                orderId: {
                    dir: oracledb.BIND_OUT,
                    type: oracledb.NUMBER
                }
            }
        );

        const orderId = orderResult.outBinds.orderId[0];

        // Insert order items and reduce stock
        for (const item of items) {
            const productId = Number(item.id);
            const quantity = Number(item.quantity);

            const productResult = await connection.execute(
                `
                SELECT price
                FROM products
                WHERE product_id = :productId
                `,
                { productId }
            );

            const price = Number(productResult.rows[0][0]);

            await connection.execute(
                `
                INSERT INTO order_items
                    (order_id, product_id, quantity, price)
                VALUES
                    (:orderId, :productId, :quantity, :price)
                `,
                {
                    orderId,
                    productId,
                    quantity,
                    price
                }
            );

            await connection.execute(
                `
                UPDATE products
                SET stock = stock - :quantity
                WHERE product_id = :productId
                `,
                {
                    quantity,
                    productId
                }
            );
        }

        // Save everything
        await connection.commit();

        res.status(201).json({
            message: "Order placed successfully",
            orderId
        });

    } catch (error) {
        console.error("Order error:", error);

        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Rollback error:", rollbackError);
            }
        }

        res.status(500).json({
            message: "Failed to place order"
        });

    } finally {
        if (connection) {
            await connection.close();
        }
    }
});

module.exports = router;