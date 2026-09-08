const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "../../maestro.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

// =====================================================
// TABELLA ARTWORKS (legacy - la lasciamo)
// =====================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS artworks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL DEFAULT 0,
        model_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// =====================================================
// TABELLA CONTENTS (versione Prima Era)
// =====================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS contents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude REAL DEFAULT 0,
        content_url TEXT,
        content_text TEXT,
        thumbnail_url TEXT,
        nickname TEXT DEFAULT 'Anonimo',
        is_map_visible INTEGER DEFAULT 1,
        activation_radius REAL DEFAULT 80,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

module.exports = db;
