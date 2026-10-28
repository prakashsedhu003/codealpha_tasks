const express = require("express");
const pool = require("../db");

const router = express.Router();

// Get all products
router.get("/products", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                product_id,
                name,
                description,
                price,
                image,
                category,
                stock,
                gender
            FROM products
            ORDER BY product_id
        `);

        const products = result.rows.map(row => ({
            id: row.product_id,
            name: row.name,
            description: row.description,
            price: row.price,
            image: row.image,
            category: row.category,
            stock: row.stock,
            gender: row.gender
        }));

        res.json(products);

    } catch (error) {
        console.error("Error loading products:", error);

        res.status(500).json({
            message: "Failed to load products"
        });
    }
});

// Get one product
router.get("/products/:id", async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                product_id,
                name,
                description,
                price,
                image,
                category,
                stock,
                gender
            FROM products
            WHERE product_id = $1
            `,
            [Number(req.params.id)]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        const row = result.rows[0];

        res.json({
            id: row.product_id,
            name: row.name,
            description: row.description,
            price: row.price,
            image: row.image,
            category: row.category,
            stock: row.stock,
            gender: row.gender
        });

    } catch (error) {
        console.error("Error loading product:", error);

        res.status(500).json({
            message: "Failed to load product"
        });
    }
});

module.exports = router;