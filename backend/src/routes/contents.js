const express = require("express");
const db = require("../db/database");

const router = express.Router();

const allowedTypes = [
    "ar", "youtube", "poetry", "pdf",
    "image", "video", "link", "text"
];

// =====================================================
// GET /api/contents
// =====================================================
router.get("/", (req, res) => {
    const contents = db
        .prepare(`
            SELECT id, title, description, type, latitude, longitude,
                   altitude, content_url, content_text, thumbnail_url,
                   nickname, is_map_visible, activation_radius,
                   created_at, updated_at
            FROM contents
            ORDER BY created_at DESC
        `)
        .all();

    res.json(contents);
});

// =====================================================
// GET /api/contents/nearby
// DEVE stare PRIMA di /:id
// =====================================================
router.get("/nearby", (req, res) => {
    const { lat, lng, radius = 5000 } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMeters = parseFloat(radius);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radiusMeters)) {
        return res.status(400).json({
            error: "lat, lng e radius devono essere numeri validi"
        });
    }

    if (latitude < -90 || latitude > 90) {
        return res.status(400).json({ error: "Latitudine non valida" });
    }

    if (longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: "Longitudine non valida" });
    }

    if (radiusMeters <= 0) {
        return res.status(400).json({ error: "Il raggio deve essere maggiore di zero" });
    }

    const contents = db.prepare("SELECT * FROM contents").all();
    const earthRadius = 6371000;

    const nearby = contents
        .map((content) => {
            const lat1 = latitude * Math.PI / 180;
            const lat2 = content.latitude * Math.PI / 180;
            const deltaLat = (content.latitude - latitude) * Math.PI / 180;
            const deltaLng = (content.longitude - longitude) * Math.PI / 180;

            const a = Math.sin(deltaLat / 2) ** 2 +
                      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = earthRadius * c;

            return {
                ...content,
                distance_meters: Math.round(distance),
                is_active: distance <= (content.activation_radius || 80)
            };
        })
        .filter(content => content.distance_meters <= radiusMeters)
        .sort((a, b) => a.distance_meters - b.distance_meters);

    res.json({
        user_location: { latitude, longitude },
        radius_meters: radiusMeters,
        count: nearby.length,
        contents: nearby
    });
});

// =====================================================
// GET /api/contents/:id
// =====================================================
router.get("/:id", (req, res) => {
    const content = db
        .prepare("SELECT * FROM contents WHERE id = ?")
        .get(req.params.id);

    if (!content) {
        return res.status(404).json({ error: "Content not found" });
    }

    res.json(content);
});

// =====================================================
// POST /api/contents
// =====================================================
router.post("/", (req, res) => {
    const {
        title,
        description,
        type,
        latitude,
        longitude,
        altitude,
        content_url,
        content_text,
        thumbnail_url,
        nickname,
        is_map_visible,
        activation_radius
    } = req.body;

    if (typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({ error: "Il titolo è obbligatorio" });
    }

    if (typeof type !== "string" || !allowedTypes.includes(type)) {
        return res.status(400).json({
            error: `Tipo non valido. Tipi consentiti: ${allowedTypes.join(", ")}`
        });
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({
            error: "latitude e longitude devono essere numeri"
        });
    }

    if (latitude < -90 || latitude > 90) {
        return res.status(400).json({ error: "Latitudine non valida" });
    }

    if (longitude < -180 || longitude > 180) {
        return res.status(400).json({ error: "Longitudine non valida" });
    }

    const result = db.prepare(`
        INSERT INTO contents (
            title, description, type,
            latitude, longitude, altitude,
            content_url, content_text, thumbnail_url,
            nickname, is_map_visible, activation_radius
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        title.trim(),
        description || "",
        type,
        latitude,
        longitude,
        typeof altitude === "number" ? altitude : 0,
        content_url || null,
        content_text || null,
        thumbnail_url || null,
        (nickname && nickname.trim()) || "Anonimo",
        is_map_visible === false || is_map_visible === 0 ? 0 : 1,
        typeof activation_radius === "number" ? activation_radius : 80
    );

    const content = db
        .prepare("SELECT * FROM contents WHERE id = ?")
        .get(result.lastInsertRowid);

    res.status(201).json(content);
});

module.exports = router;
