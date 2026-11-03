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


app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const connectionString =
    process.env.MONGO_URI || process.env.ATLAS_MONGO_URI || "";

const dbRun = async () => {
    try {
        if (connectionString) {
            await mongoose.connect(connectionString);
            console.log("MongoDB Connected");
        } else {
            console.log("MongoDB connection string is empty. Please set MONGO_URI in .env or connectionString in server.js");
        }
    } catch (err) {
        console.log(err);
    }
};

dbRun();

app.use("/api/v1/users", userRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/cart", cartRouter);

app.listen(PORT, (err) => {
    if (err) {
        console.log(err);
    }
    console.log(`server is Running on ${PORT}`);
});
