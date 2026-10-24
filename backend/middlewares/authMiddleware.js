const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Authentication required"
            });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        let user;
        try {
            user = await User.findById(decoded.userId).select("deleting");
        } catch {
            return res.status(503).json({ error: "Could not verify your account. Please try again." });
        }
        if (!user || (user.deleting && !(req.method === "DELETE" && req.originalUrl.split("?")[0] === "/api/auth/account"))) {
            return res.status(401).json({ error: "This account is no longer active. Please sign in again." });
        }
        req.user = {
            userId: decoded.userId
        };

        next();
    } catch (error) {
        console.error("Authentication error:", error);

        return res.status(401).json({
            error: "Invalid or expired token"
        });
    }
}

module.exports = protect;
