const express = require("express");
const cors = require("cors");
const path = require("path");

const db = require("./db/database");
const artworksRouter = require("./routes/artworks");
const contentsRouter = require("./routes/contents");
const uploadRouter = require("./routes/upload");

const app = express();
const PORT = process.env.PORT || 3000;

// Percorsi robusti
const frontendPath = path.join(__dirname, "../../frontend");
const uploadsPath = path.join(__dirname, "../uploads");

app.use(cors());
app.use(express.json());

// Frontend
app.use(express.static(frontendPath));

// File caricati
app.use("/uploads", express.static(uploadsPath));

// API
app.use("/api/artworks", artworksRouter);
app.use("/api/contents", contentsRouter);
app.use("/api/upload", uploadRouter);

// Health + debug database
app.get("/api/health", async (req, res) => {
    try {
        const db = require("./db/database");
        const result = await db.query(`
            SELECT 
                current_database() AS database,
                current_user AS utente,
                current_schema() AS schema,
                (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') AS numero_tabelle,
                (SELECT string_agg(table_name, ', ') FROM information_schema.tables WHERE table_schema = 'public') AS tabelle
        `);
        res.json({
            status: "ok",
            version: "1.0.0-prima-era",
            database_info: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({
            status: "error",
            message: err.message,
            code: err.code
        });
    }
});

// Fallback per SPA
app.get("*", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`MAESTRO running on port ${PORT}`);
});
