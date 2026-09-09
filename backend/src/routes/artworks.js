const express = require("express");
const db = require("../db/database");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM artworks ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nel recuperare le opere" });
  }
});

router.get("/nearby", async (req, res) => {
  try {
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

    const result = await db.query("SELECT * FROM artworks");
    const artworks = result.rows;
    const earthRadius = 6371000;

    const nearby = artworks
      .map((artwork) => {
        const lat1 = latitude * Math.PI / 180;
        const lat2 = artwork.latitude * Math.PI / 180;
        const deltaLat = (artwork.latitude - latitude) * Math.PI / 180;
        const deltaLng = (artwork.longitude - longitude) * Math.PI / 180;

        const a =
          Math.sin(deltaLat / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = earthRadius * c;

        return {
          ...artwork,
          distance_meters: Math.round(distance)
        };
      })
      .filter((artwork) => artwork.distance_meters <= radiusMeters)
      .sort((a, b) => a.distance_meters - b.distance_meters);

    res.json({
      user_location: { latitude, longitude },
      radius_meters: radiusMeters,
      count: nearby.length,
      artworks: nearby
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nella ricerca nearby" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM artworks WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Artwork not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, latitude, longitude, altitude, model_url } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Il nome dell'opera è obbligatorio" });
    }

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({
        error: "latitude e longitude devono essere numeri"
      });
    }

    const result = await db.query(`
      INSERT INTO artworks (name, description, latitude, longitude, altitude, model_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      name,
      description || "",
      latitude,
      longitude,
      typeof altitude === "number" ? altitude : 0,
      model_url || null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nella creazione" });
  }
});

module.exports = router;
