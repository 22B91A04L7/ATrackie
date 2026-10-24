const express = require("express");
const { signup, login } = require("../controllers/authController");

const router = express.Router();
const protect = require("../middlewares/authMiddleware");
const { loginLimit } = require("../middlewares/rateLimits");
const { validateInput } = require("../middlewares/validateInput");
const { getProfile, deleteAccount } = require("../controllers/accountController");
const { createLimiter } = require("../middlewares/rateLimits");
const deletionLimit = createLimiter({ windowMs: 15 * 60000, limit: 10, key: req => req.user.userId, failedLoginsOnly: true });
router.get("/profile", protect, getProfile);
router.delete("/account", protect, deletionLimit, validateInput, deleteAccount);

// Verify an extension connection without returning application data.
router.get("/session", protect, (req, res) => res.json({ userId: req.user.userId }));

//route to signup controller
router.post("/signup", validateInput, signup);

//route to login controller
router.post("/login", loginLimit, validateInput, login);

module.exports = router;
