const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./db/database");
const artworksRouter = require("./routes/artworks");
const contentsRouter = require("./routes/contents");
const uploadRouter = require("./routes/upload");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Frontend statico
app.use(express.static(path.join(__dirname, "../../frontend")));

// File caricati
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// API
app.use("/api/artworks", artworksRouter);
app.use("/api/contents", contentsRouter);
app.use("/api/upload", uploadRouter);

// Health check
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        database: "connected",
        version: "1.0.0-prima-era"
    });
});

// Root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../../frontend/index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`MAESTRO backend running on port ${PORT}`);
});
