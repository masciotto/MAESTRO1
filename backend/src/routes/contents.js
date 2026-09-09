const express = require("express");
const db = require("../db/database");

const router = express.Router();

const allowedTypes = [
  "ar", "youtube", "poetry", "pdf",
  "image", "video", "link", "text"
];

router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, title, description, type, latitude, longitude,
             altitude, content_url, content_text, thumbnail_url,
             nickname, is_map_visible, activation_radius,
             heading, accuracy, anchor_type, scale,
             rotation_x, rotation_y, rotation_z, anchor_data,
             created_at, updated_at
      FROM contents
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nel recuperare i contenuti" });
  }
});

router.get("/nearby", async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMeters = parseFloat(radius);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radiusMeters)) {
      return res.status(400).json({
        error: "lat, lng e radius devono essere numeri validi"
      });
    }

    const result = await db.query("SELECT * FROM contents");
    const contents = result.rows;
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
          distance_meters: Math.round(distance)
        };
      })
      .filter((content) => content.distance_meters <= radiusMeters)
      .sort((a, b) => a.distance_meters - b.distance_meters);

    res.json({
      user_location: { latitude, longitude },
      radius_meters: radiusMeters,
      count: nearby.length,
      contents: nearby
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nella ricerca nearby" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM contents WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Content not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nel recuperare il contenuto" });
  }
});

router.post("/", async (req, res) => {
  try {
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
      activation_radius,
      heading,
      accuracy,
      anchor_type,
      scale,
      rotation_x,
      rotation_y,
      rotation_z,
      anchor_data
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

    const result = await db.query(`
      INSERT INTO contents (
        title, description, type,
        latitude, longitude, altitude,
        content_url, content_text, thumbnail_url,
        nickname, is_map_visible, activation_radius,
        heading, accuracy, anchor_type, scale,
        rotation_x, rotation_y, rotation_z, anchor_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20
      )
      RETURNING *
    `, [
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
      is_map_visible === false || is_map_visible === 0 ? false : true,
      typeof activation_radius === "number" ? activation_radius : 80,
      typeof heading === "number" ? heading : null,
      typeof accuracy === "number" ? accuracy : null,
      anchor_type || "gps",
      typeof scale === "number" ? scale : 1.0,
      typeof rotation_x === "number" ? rotation_x : 0,
      typeof rotation_y === "number" ? rotation_y : 0,
      typeof rotation_z === "number" ? rotation_z : 0,
      anchor_data ? JSON.stringify(anchor_data) : null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore nella creazione del contenuto" });
  }
});

module.exports = router;
