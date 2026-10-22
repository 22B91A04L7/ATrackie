const express = require("express");
const { signup, login } = require("../controllers/authController");

const router = express.Router();
const protect = require("../middlewares/authMiddleware");
const { loginLimit } = require("../middlewares/rateLimits");
const { validateInput } = require("../middlewares/validateInput");

// Verify an extension connection without returning application data.
router.get("/session", protect, (req, res) => res.json({ userId: req.user.userId }));

//route to signup controller
router.post("/signup", validateInput, signup);

//route to login controller
router.post("/login", loginLimit, validateInput, login);

module.exports = router;
