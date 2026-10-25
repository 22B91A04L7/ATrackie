require("dotenv").config(); // to process env variables
const express = require("express");
const app = express();
const cors = require("cors");

const mongoose = require("mongoose");
const jobRoutes = require("./routes/JobRoutes")
const authRoutes = require("./routes/authRoutes")
const { ensureJobIndexes } = require("./utils/jobIndexes");


// Middleware
app.use(cors());
app.use(express.json());
app.use(require("./middlewares/validateInput").inputError);

// Lightweight readiness response: no query, AI call, or account data.
app.get('/api/health', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.set('Cache-Control', 'no-store');
    res.status(ready ? 200 : 503).json({ status: ready ? 'ok' : 'starting' });
});

// API routes
app.use("/api", jobRoutes);
app.use("/api/auth", authRoutes);

// Root route
app.get("/", (req, res) => {
    res.send("Job Tracker Backend is running");
});


//mongodb connection
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        await ensureJobIndexes();
        console.log("MONGO DB connected!");
        // Start server
        const PORT = process.env.PORT || 5000;

        app.listen(PORT, () => {
            console.log(`SERVER running on PORT ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Database startup failed:", error);
        process.exit(1);
    })

