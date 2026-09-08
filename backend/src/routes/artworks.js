const express = require("express");
const db = require("../db/database");

const router = express.Router();


// GET /api/artworks
// Restituisce tutte le opere
router.get("/", (req, res) => {
    const artworks = db
        .prepare("SELECT * FROM artworks ORDER BY created_at DESC")
        .all();

    res.json(artworks);
});


// GET /api/artworks/nearby
// Cerca opere entro un determinato raggio
router.get("/nearby", (req, res) => {
    const { lat, lng, radius = 1000 } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMeters = parseFloat(radius);

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(radiusMeters)
    ) {
        return res.status(400).json({
            error: "lat, lng e radius devono essere numeri validi"
        });
    }

    if (latitude < -90 || latitude > 90) {
        return res.status(400).json({
            error: "Latitudine non valida"
        });
    }

    if (longitude < -180 || longitude > 180) {
        return res.status(400).json({
            error: "Longitudine non valida"
        });
    }

    if (radiusMeters <= 0) {
        return res.status(400).json({
            error: "Il raggio deve essere maggiore di zero"
        });
    }

    const artworks = db
        .prepare("SELECT * FROM artworks")
        .all();

    const earthRadius = 6371000;

    const nearby = artworks
        .map((artwork) => {

            const lat1 = latitude * Math.PI / 180;
            const lat2 = artwork.latitude * Math.PI / 180;

            const deltaLat =
                (artwork.latitude - latitude) * Math.PI / 180;

            const deltaLng =
                (artwork.longitude - longitude) * Math.PI / 180;

            const a =
                Math.sin(deltaLat / 2) ** 2 +
                Math.cos(lat1) *
                Math.cos(lat2) *
                Math.sin(deltaLng / 2) ** 2;

            const c =
                2 * Math.atan2(
                    Math.sqrt(a),
                    Math.sqrt(1 - a)
                );

            const distance = earthRadius * c;

            return {
                ...artwork,
                distance_meters: Math.round(distance)
            };
        })
        .filter((artwork) => artwork.distance_meters <= radiusMeters)
        .sort((a, b) =>
            a.distance_meters - b.distance_meters
        );

    res.json({
        user_location: {
            latitude,
            longitude
        },
        radius_meters: radiusMeters,
        count: nearby.length,
        artworks: nearby
    });
});


// GET /api/artworks/:id
// Restituisce una singola opera
router.get("/:id", (req, res) => {

    const artwork = db
        .prepare("SELECT * FROM artworks WHERE id = ?")
        .get(req.params.id);

    if (!artwork) {
        return res.status(404).json({
            error: "Artwork not found"
        });
    }

    res.json(artwork);
});


// POST /api/artworks
// Crea una nuova opera
router.post("/", (req, res) => {

    const {
        name,
        description,
        latitude,
        longitude,
        altitude,
        model_url
    } = req.body;

    if (!name) {
        return res.status(400).json({
            error: "Il nome dell'opera è obbligatorio"
        });
    }

    if (
        typeof latitude !== "number" ||
        typeof longitude !== "number"
    ) {
        return res.status(400).json({
            error: "latitude e longitude devono essere numeri"
        });
    }

    if (latitude < -90 || latitude > 90) {
        return res.status(400).json({
            error: "Latitudine non valida"
        });
    }

    if (longitude < -180 || longitude > 180) {
        return res.status(400).json({
            error: "Longitudine non valida"
        });
    }

    const result = db.prepare(`
        INSERT INTO artworks
        (
            name,
            description,
            latitude,
            longitude,
            altitude,
            model_url
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        name,
        description || "",
        latitude,
        longitude,
        typeof altitude === "number" ? altitude : 0,
        model_url || null
    );

    const artwork = db
        .prepare("SELECT * FROM artworks WHERE id = ?")
        .get(result.lastInsertRowid);

    res.status(201).json(artwork);
});


module.exports = router;
