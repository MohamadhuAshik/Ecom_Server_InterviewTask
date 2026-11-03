const JWT = require("jsonwebtoken");

const authentication = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                message: "Access denied. No token provided."
            });
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                message: "Invalid token format"
            });
        }
        const decoded = JWT.verify(token, process.env.JWT_SECRET || "JWT_SECRET");
        req.user = decoded;
        next();

    } catch (err) {
        console.log(err);
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired. Please login again."
            });
        }
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({
                message: "Invalid token"
            });
        }
        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
};

module.exports = authentication;