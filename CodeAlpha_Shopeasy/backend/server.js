require("dotenv").config();

const express = require("express");
const cors = require("cors");

const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "https://shopeasy-frontend-9gcg.onrender.com"
    ]
}));

app.use(express.json());

app.use("/api", productRoutes);
app.use("/api", authRoutes);
app.use("/api", orderRoutes);

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});