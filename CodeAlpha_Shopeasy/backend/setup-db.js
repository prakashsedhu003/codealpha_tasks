const pool = require("./db");

const products = [
    {
        name: "Classic Leather Watch",
        description: "A timeless leather watch designed for everyday elegance.",
        price: 2499,
        image: "classic-leather-watch.png",
        category: "Watches",
        stock: 20,
        gender: "men"
    },
    {
        name: "Premium Leather Wallet",
        description: "A premium leather wallet with a sleek and practical design.",
        price: 1499,
        image: "premium-leather-wallet.png",
        category: "Wallets",
        stock: 25,
        gender: "men"
    },
    {
        name: "Classic Chain",
        description: "A stylish classic chain that adds a refined touch to any outfit.",
        price: 2999,
        image: "classic-chain.png",
        category: "Chains",
        stock: 15,
        gender: "men"
    },
    {
        name: "Aviator Sunglasses",
        description: "Classic aviator sunglasses with a premium modern look.",
        price: 1799,
        image: "aviator-sunglasses.png",
        category: "Sunglasses",
        stock: 18,
        gender: "men"
    },
    {
        name: "Elegant Women Handbag",
        description: "An elegant handbag designed for a sophisticated everyday look.",
        price: 1999,
        image: "elegant-women-handbag.png",
        category: "Bags",
        stock: 15,
        gender: "women"
    },
    {
        name: "Rose Gold Watch",
        description: "A beautiful rose gold watch with a luxurious feminine finish.",
        price: 2799,
        image: "rose-gold-watch.png",
        category: "Watches",
        stock: 12,
        gender: "women"
    },
    {
        name: "Pearl Necklace",
        description: "A graceful pearl necklace perfect for elegant occasions.",
        price: 2299,
        image: "pearl-necklace.png",
        category: "Necklaces",
        stock: 10,
        gender: "women"
    },
    {
        name: "Classic Women Sunglasses",
        description: "Stylish sunglasses designed for a classic and elegant appearance.",
        price: 1599,
        image: "classic-women-sunglasses.png",
        category: "Sunglasses",
        stock: 20,
        gender: "women"
    },
    {
        name: "Premium Leather Belt",
        description: "A premium leather belt with a clean and versatile design.",
        price: 1299,
        image: "premium-leather-belt.png",
        category: "Belts",
        stock: 25,
        gender: "unisex"
    },
    {
        name: "Minimalist Bracelet",
        description: "A simple minimalist bracelet that complements any style.",
        price: 899,
        image: "minimalist-bracelet.png",
        category: "Bracelets",
        stock: 30,
        gender: "unisex"
    }
];

async function setupDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                product_id SERIAL PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                description VARCHAR(500),
                price NUMERIC(10,2) NOT NULL,
                image VARCHAR(500),
                category VARCHAR(100),
                stock INTEGER DEFAULT 0,
                gender VARCHAR(20)
            )
        `);

        console.log("Products table created successfully.");

        for (const product of products) {
            await pool.query(
                `
                INSERT INTO products
                (name, description, price, image, category, stock, gender)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                `,
                [
                    product.name,
                    product.description,
                    product.price,
                    product.image,
                    product.category,
                    product.stock,
                    product.gender
                ]
            );
        }

        console.log("10 products inserted successfully.");

        await pool.end();

    } catch (error) {
        console.error("Database setup failed:", error);
        await pool.end();
        process.exit(1);
    }
}

setupDatabase();