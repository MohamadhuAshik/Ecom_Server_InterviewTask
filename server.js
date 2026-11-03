require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const userRouter = require("./Router/userRouter");
const productRouter = require("./Router/productRouter");
const cartRouter = require("./Router/cartRouter");

const app = express();

const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically if local uploads exist
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const connectionString =
    process.env.MONGO_URI || process.env.ATLAS_MONGO_URI || "";

let cachedConnection = null;


const connectDB = async () => {
    // If already connected, return immediately
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    // If a connection attempt is currently in progress, await it
    if (cachedConnection) {
        try {
            await cachedConnection;
            return mongoose.connection;
        } catch {
            cachedConnection = null;
        }
    }

    if (!connectionString) {
        throw new Error(
            "MongoDB connection string is missing. Please set MONGO_URI in .env or your hosting environment variables."
        );
    }

    try {
        cachedConnection = mongoose.connect(connectionString, {
            serverSelectionTimeoutMS: 5000, // Timeout fast after 5s instead of hanging 10s
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
        });

        await cachedConnection;
        console.log("MongoDB Connected Successfully");
        return mongoose.connection;
    } catch (err) {
        cachedConnection = null;
        console.error("MongoDB Connection Failed:", err.message);
        throw err;
    }
};

// Initial connection attempt on boot
connectDB().catch((err) => {
    console.warn("Initial DB connection warning (will retry on incoming request):", err.message);
});

// Middleware: Ensure MongoDB is connected BEFORE any API route executes
app.use(async (req, res, next) => {
    // Skip non-API paths and health checks
    if (
        req.path === "/" ||
        req.path === "/health" ||
        req.path === "/api/v1/health" ||
        req.path.startsWith("/uploads")
    ) {
        return next();
    }

    try {
        if (mongoose.connection.readyState !== 1) {
            await connectDB();
        }
        next();
    } catch (err) {
        console.error("Database Connection Middleware Error:", err.message);
        return res.status(503).json({
            success: false,
            message: "Database connection failed. Please check MongoDB Atlas network access (ensure 0.0.0.0/0 is whitelisted).",
            error: err.message,
        });
    }
});

// Health Check Endpoints
const healthCheckHandler = (req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    return res.status(isDbConnected ? 200 : 503).json({
        status: isDbConnected ? "OK" : "DEGRADED",
        message: isDbConnected
            ? "Server and Database are healthy"
            : "Database not connected",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
            connected: isDbConnected,
            readyState: mongoose.connection.readyState,
        },
    });
};

app.get("/", healthCheckHandler);
app.get("/health", healthCheckHandler);
app.get("/api/v1/health", healthCheckHandler);

// API Routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/cart", cartRouter);

// Start server if not running in serverless export
if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, (err) => {
        if (err) {
            console.log(err);
        }
        console.log(`server is Running on ${PORT}`);
    });
}

module.exports = app;
