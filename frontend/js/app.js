const API_URL = window.location.origin;

let map;
let userMarker;
let userCircle;
let contentMarkers = [];
let currentPosition = null;
let selectedLocation = null;

// ==========================================
// MAPPA
// ==========================================
map = L.map("map").setView([41.9028, 12.4964], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

// Click sulla mappa → seleziona punto
map.on("click", function (event) {
    const lat = event.latlng.lat;
    const lng = event.latlng.lng;

    selectedLocation = { lat, lng };

    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
    }

    window.tempMarker = L.marker([lat, lng], { opacity: 0.85 })
        .addTo(map)
        .bindPopup("Punto selezionato")
        .openPopup();

    selectedLocationElementUpdate(lat, lng);

    // Apri automaticamente la sezione creazione se è chiusa
    const createSection = document.getElementById("create-section");
    if (createSection && !createSection.classList.contains("open")) {
        createSection.classList.add("open");
        const toggle = document.getElementById("create-toggle");
        if (toggle) toggle.textContent = "− Chiudi creazione";
    }
});

// ==========================================
// ELEMENTI UI
// ==========================================
const locateButton = document.getElementById("locate-btn");
const gpsStatus = document.getElementById("gps-status");
const gpsBanner = document.getElementById("gps-banner");
const artworksList = document.getElementById("artworks-list");
const artworkCount = document.getElementById("artwork-count");
const contentForm = document.getElementById("content-form");
const contentType = document.getElementById("content-type");
const contentInputArea = document.getElementById("content-input-area");
const publishStatus = document.getElementById("publish-status");
const createToggle = document.getElementById("create-toggle");
const createSection = document.getElementById("create-section");

// Toggle sezione creazione
if (createToggle) {
    createToggle.addEventListener("click", function () {
        if (createSection) {
            createSection.classList.toggle("open");
            this.textContent = createSection.classList.contains("open")
                ? "− Chiudi creazione"
                : "+ Crea un nuovo contenuto";
        }
    });
}

// ==========================================
// POSIZIONE SELEZIONATA
// ==========================================
function selectedLocationElementUpdate(lat, lng) {
    const box = document.getElementById("selected-location");
    if (box) {
        box.innerHTML = `
            <strong>Punto selezionato</strong><br>
            ${lat.toFixed(6)}, ${lng.toFixed(6)}
        `;
    }
}

// ==========================================
// TIPO CONTENUTO (form dinamico)
// ==========================================
if (contentType) {
    contentType.addEventListener("change", updateContentInput);
}

function updateContentInput() {
    if (!contentInputArea || !contentType) return;

    const type = contentType.value;

    if (type === "youtube") {
        contentInputArea.innerHTML = `
            <label>URL YouTube</label>
            <input id="content-url" type="url" placeholder="https://youtube.com/watch?v=..." required>
        `;
        return;
    }

    if (type === "poetry" || type === "text") {
        contentInputArea.innerHTML = `
            <label>Testo</label>
            <textarea id="content-text" placeholder="Scrivi il contenuto..." rows="5" required></textarea>
        `;
        return;
    }

    if (type === "link") {
        contentInputArea.innerHTML = `
            <label>URL</label>
            <input id="content-url" type="url" placeholder="https://..." required>
        `;
        return;
    }

    if (type === "ar") {
        contentInputArea.innerHTML = `
            <label>Modello 3D (USDZ o GLB)</label>
            <input id="content-file" type="file" accept=".usdz,.glb,.gltf" required>
            <small style="display:block;margin-top:6px;opacity:0.7">
                • USDZ → migliore su iPhone<br>
                • GLB → funziona su Android e browser<br>
                Consigliato: file sotto i 5-6 MB
            </small>
        `;
        return;
    }

    if (type === "pdf" || type === "image" || type === "video") {
        let accept = "";
        if (type === "image") accept = "image/jpeg,image/png,image/webp";
        if (type === "video") accept = "video/mp4,video/webm";
        if (type === "pdf") accept = "application/pdf";

        contentInputArea.innerHTML = `
            <label>File</label>
            <input id="content-file" type="file" accept="${accept}" required>
            <small style="display:block;margin-top:6px;opacity:0.7">Dimensione massima consigliata: 6 MB</small>
        `;
        return;
    }
}

// ==========================================
// PUBBLICAZIONE CONTENUTO
// ==========================================
if (contentForm) {
    contentForm.addEventListener("submit", createContent);
}

async function createContent(event) {
    event.preventDefault();

    if (!selectedLocation) {
        showPublishStatus("Prima seleziona un punto sulla mappa.", true);
        return;
    }

    const title = document.getElementById("content-title")?.value.trim();
    const description = document.getElementById("content-description")?.value.trim();
    const type = contentType.value;
    const nickname = document.getElementById("content-nickname")?.value.trim() || "Anonimo";
    const isMapVisible = document.getElementById("content-map-visible")?.checked !== false;
    const isLocked = document.getElementById("content-locked")?.checked !== false;

    if (!title) {
        showPublishStatus("Inserisci un titolo.", true);
        return;
    }

    if (!type) {
        showPublishStatus("Select the file type.", true);
        return;
    }

    try {
        showPublishStatus("Pubblicazione in corso...");

        let contentUrl = null;
        let contentText = null;

        if (type === "youtube" || type === "link") {
            const input = document.getElementById("content-url");
            if (!input || !input.value.trim()) throw new Error("Inserisci un URL valido.");
            contentUrl = input.value.trim();
        }

        if (type === "poetry" || type === "text") {
            const input = document.getElementById("content-text");
            if (!input || !input.value.trim()) throw new Error("Inserisci il testo.");
            contentText = input.value.trim();
        }

        if (type === "ar" || type === "image" || type === "video" || type === "pdf") {
            const fileInput = document.getElementById("content-file");
            if (!fileInput || !fileInput.files || !fileInput.files.length) {
                throw new Error("Seleziona un file.");
            }

            const file = fileInput.files[0];
            if (file.size > 100 * 1024 * 1024) {
                throw new Error("Il file supera il limite di 100 MB.");
            }

            showPublishStatus("Caricamento del file in corso...");

            const formData = new FormData();
            formData.append("type", type);
            formData.append("file", file);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            let uploadResponse;
            try {
                uploadResponse = await fetch(`${API_URL}/api/upload`, {
                    method: "POST",
                    body: formData,
                    signal: controller.signal
                });
            } catch (err) {
                clearTimeout(timeoutId);
                if (err.name === "AbortError") {
                    throw new Error("Timeout: prova con un file sotto i 6 MB.");
                }
                throw new Error("Errore di rete durante l'upload.");
            }
            clearTimeout(timeoutId);

            const ct = uploadResponse.headers.get("content-type") || "";
            if (!ct.includes("application/json")) {
                throw new Error("Il server non ha risposto correttamente (file troppo grande?).");
            }

            const uploadData = await uploadResponse.json();
            if (!uploadResponse.ok) {
                throw new Error(uploadData.error || "Errore durante il caricamento.");
            }

            contentUrl = uploadData.url;
        }

        showPublishStatus("Salvataggio del contenuto...");

        const contentData = {
            title,
            description,
            type,
            latitude: selectedLocation.lat,
            longitude: selectedLocation.lng,
            altitude: 0,
            content_url: contentUrl,
            content_text: contentText,
            thumbnail_url: type === "image" ? contentUrl : null,
            nickname,
            is_map_visible: isMapVisible,
            activation_radius: isLocked ? 80 : 999999,
            anchor_type: "gps"
        };

        const response = await fetch(`${API_URL}/api/contents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(contentData)
        });

        const headerCT = response.headers.get("content-type") || "";
        if (!headerCT.includes("application/json")) {
            throw new Error("Risposta non valida dal server.");
        }

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Errore durante la creazione.");
        }

        showPublishStatus("✓ Contenuto pubblicato!");

        addContentMarker(data);
        loadContents();

        // Reset
        contentForm.reset();
        selectedLocation = null;
        document.getElementById("selected-location").innerHTML = "Nessun punto selezionato. Clicca sulla mappa.";
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
            window.tempMarker = null;
        }
        updateContentInput();

        // Chiudi il form dopo la pubblicazione
        if (createSection) createSection.classList.remove("open");
        if (createToggle) createToggle.textContent = "+ Crea un nuovo contenuto";

    } catch (error) {
        console.error(error);
        showPublishStatus(error.message || "Errore durante la pubblicazione.", true);
    }
}

function showPublishStatus(message, error = false) {
    if (!publishStatus) return;
    publishStatus.textContent = message;
    publishStatus.classList.toggle("error", error);
}

// ==========================================
// GPS
// ==========================================
if (locateButton) {
    locateButton.addEventListener("click", locateUser);
}

function locateUser() {
    if (!navigator.geolocation) {
        if (gpsStatus) gpsStatus.textContent = "GPS non supportato";
        return;
    }

    if (gpsStatus) gpsStatus.textContent = "Ricerca...";
    if (locateButton) locateButton.textContent = "Ricerca in corso...";

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            currentPosition = { lat, lng, accuracy };

            if (userMarker) map.removeLayer(userMarker);
            if (userCircle) map.removeLayer(userCircle);

            userMarker = L.marker([lat, lng]).addTo(map)
                .bindPopup("La tua posizione")
                .openPopup();

            userCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: "#3388ff",
                fillColor: "#3388ff",
                fillOpacity: 0.15
            }).addTo(map);

            map.setView([lat, lng], 17);
            map.invalidateSize();

            if (gpsStatus) {
                gpsStatus.textContent = `±${Math.round(accuracy)} m`;
            }

            // Nascondi il banner GPS
            if (gpsBanner) gpsBanner.classList.add("hidden");

            if (locateButton) locateButton.textContent = "📍 Aggiorna posizione";

            loadContents();
        },
        function (error) {
            console.error(error);
            let msg = "Posizione non disponibile";
            if (error.code === 1) msg = "Permesso negato";
            if (error.code === 2) msg = "Posizione non disponibile";
            if (error.code === 3) msg = "Timeout";

            if (gpsStatus) gpsStatus.textContent = msg;
            if (locateButton) locateButton.textContent = "📍 Attiva la mia posizione";
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }
    );
}

// ==========================================
// CARICA CONTENUTI
// ==========================================
async function loadContents() {
    try {
        // Carichiamo SEMPRE tutti i contenuti
        const responseAll = await fetch(`${API_URL}/api/contents`);
        const allContents = await responseAll.json();

        if (!responseAll.ok) {
            throw new Error(allContents.error || "Errore caricamento");
        }

        // Distanze (se abbiamo GPS)
        let distanceMap = {};
        if (currentPosition) {
            const responseNearby = await fetch(
                `${API_URL}/api/contents/nearby?lat=${currentPosition.lat}&lng=${currentPosition.lng}&radius=50000`
            );
            const nearbyData = await responseNearby.json();
            if (responseNearby.ok && nearbyData.contents) {
                nearbyData.contents.forEach(c => {
                    distanceMap[c.id] = c.distance_meters;
                });
            }
        }

        const enriched = allContents.map(c => ({
            ...c,
            distance_meters: distanceMap[c.id] !== undefined ? distanceMap[c.id] : null
        }));

        // Aggiorna i marker SENZA cancellarli tutti se non necessario
        clearContentMarkers();

        enriched
            .filter(c => c.is_map_visible !== 0)
            .forEach(addContentMarker);

        // Lista ordinata per distanza
        const listContents = currentPosition
            ? enriched
                .filter(c => c.distance_meters !== null)
                .sort((a, b) => a.distance_meters - b.distance_meters)
            : enriched;

        renderContentList(listContents);

    } catch (error) {
        console.error("Errore contenuti:", error);
    }
}

function clearContentMarkers() {
    contentMarkers.forEach(m => map.removeLayer(m));
    contentMarkers = [];
}

function getMarkerIcon(type) {
    const colors = {
        text:    "#4CAF50",
        poetry:  "#9C27B0",
        image:   "#2196F3",
        video:   "#F44336",
        pdf:     "#FF9800",
        youtube: "#E91E63",
        link:    "#00BCD4",
        ar:      "#FFEB3B"
    };

    const icons = {
        text:    "T",
        poetry:  "✎",
        image:   "🖼",
        video:   "▶",
        pdf:     "📄",
        youtube: "▶",
        link:    "🔗",
        ar:      "◇"
    };

    const color = colors[type] || "#888";
    const icon  = icons[type]  || "●";

    return L.divIcon({
        className: "maestro-marker",
        html: `<div style="
            background: ${color};
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: #111;
            font-weight: bold;
        ">${icon}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
}

function addContentMarker(content) {
    if (!content || content.latitude == null || content.longitude == null) return;

    const marker = L.marker(
        [content.latitude, content.longitude],
        { icon: getMarkerIcon(content.type) }
    ).addTo(map);

    marker.bindPopup(`
        <div style="min-width:160px">
            <strong>${getContentIcon(content.type)} ${escapeHtml(content.title)}</strong><br>
            <small>${escapeHtml(content.nickname || "Anonimo")}</small><br><br>
            <button onclick="openContentViewerById(${content.id})" style="padding:6px 12px;cursor:pointer;">
                Open
            </button>
        </div>
    `);

    marker.on("click", () => openContentViewer(content));
    contentMarkers.push(marker);
}

function renderContentList(contents) {
    if (!artworksList) return;

    artworksList.innerHTML = "";

    if (!contents.length) {
        artworksList.innerHTML = `<p style="opacity:0.6">Nessun contenuto trovato.</p>`;
        if (artworkCount) artworkCount.textContent = "0";
        return;
    }

    contents.forEach(content => {
        const card = document.createElement("div");
        card.className = "content-card";

        let statusIcon = "🔒";
        let statusText = "Bloccato";
        let distanceText = "—";

        if (content.distance_meters != null) {
            distanceText = `${content.distance_meters} m`;
            const radius = content.activation_radius || 80;
            if (content.distance_meters <= radius) {
                statusIcon = "🔓";
                statusText = "Sbloccato";
            }
        }

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <div>
                    <strong>${getContentIcon(content.type)} ${escapeHtml(content.title)}</strong><br>
                    <small style="opacity:0.7">${escapeHtml(content.nickname || "Anonimo")} · ${escapeHtml(content.type)}</small>
                </div>
                <div style="text-align:right;font-size:13px;white-space:nowrap;">
                    <div>${statusIcon} ${statusText}</div>
                    <div style="opacity:0.65;margin-top:2px">${distanceText}</div>
                </div>
            </div>
        `;

        card.addEventListener("click", () => {
            map.setView([content.latitude, content.longitude], 17);
            openContentViewer(content);
        });

        artworksList.appendChild(card);
    });

    if (artworkCount) artworkCount.textContent = contents.length;
}

// ==========================================
// VISUALIZZATORE
// ==========================================
function openContentViewer(content) {
    if (!content) return;

    const activationRadius = content.activation_radius || 80;
    let isNear = false;
    let distance = null;

    if (currentPosition) {
        distance = calculateDistance(
            currentPosition.lat, currentPosition.lng,
            content.latitude, content.longitude
        );
        isNear = distance <= activationRadius;
    }

    let viewer = document.getElementById("content-viewer");
    if (!viewer) {
        viewer = document.createElement("div");
        viewer.id = "content-viewer";
        viewer.innerHTML = `
            <div class="content-viewer-backdrop" onclick="closeContentViewer(event)">
                <div class="content-viewer-panel" onclick="event.stopPropagation()">
                    <button class="content-viewer-close" onclick="closeContentViewer()">×</button>
                    <div id="content-viewer-body"></div>
                </div>
            </div>
        `;
        document.body.appendChild(viewer);
        addViewerStyles();
    }

    const body = document.getElementById("content-viewer-body");

    if (!currentPosition) {
        body.innerHTML = `
            <h2>${escapeHtml(content.title)}</h2>
            <p style="opacity:0.7">di ${escapeHtml(content.nickname || "Anonimo")}</p>
            <div style="margin-top:30px;padding:24px;background:#1a1a1a;border-radius:12px;text-align:center;border:1px solid #333;">
                <p style="font-size:16px;">📍 Attiva la posizione per sbloccare i contenuti</p>
                <button onclick="locateUser()" style="margin-top:16px;padding:12px 24px;background:#2a7a3a;color:white;border:none;border-radius:8px;font-size:15px;cursor:pointer;">
                    Attiva posizione
                </button>
            </div>
        `;
    } else if (!isNear) {
        body.innerHTML = `
            <h2>${escapeHtml(content.title)}</h2>
            <p style="opacity:0.7">di ${escapeHtml(content.nickname || "Anonimo")}</p>
            <div style="margin-top:30px;padding:28px;background:#1a1a1a;border-radius:12px;text-align:center;border:1px solid #333;">
                <div style="font-size:42px;margin-bottom:12px;">🔒</div>
                <h3 style="margin:0 0 8px 0;">Contenuto bloccato</h3>
                <p>Devi avvicinarti di più.</p>
                <p style="margin-top:14px;font-size:17px;">
                    Distanza: <strong>${Math.round(distance)} m</strong><br>
                    Raggio: <strong>${activationRadius} m</strong>
                </p>
            </div>
        `;
    } else {
        body.innerHTML = renderContent(content);
    }

    viewer.classList.add("visible");
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2)**2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function renderContent(content) {
    const title = escapeHtml(content.title || "");
    const description = escapeHtml(content.description || "");
    const nick = escapeHtml(content.nickname || "Anonimo");

    if (content.type === "youtube") {
        const videoId = getYouTubeId(content.content_url);
        if (videoId) {
            return `
                <h2>${title}</h2>
                <p style="opacity:0.7">di ${nick}</p>
                ${description ? `<p>${description}</p>` : ""}
                <div class="youtube-container">
                    <iframe src="https://www.youtube.com/embed/${videoId}" title="${title}"
                        frameborder="0" allowfullscreen
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
                    </iframe>
                </div>
            `;
        }
        return genericLinkContent(content, "Apri YouTube");
    }

    if (content.type === "image") {
        return `
            <h2>${title}</h2>
            <p style="opacity:0.7">di ${nick}</p>
            ${description ? `<p>${description}</p>` : ""}
            <img class="viewer-image" src="${absoluteUrl(content.content_url)}" alt="${title}">
        `;
    }

    if (content.type === "video") {
        return `
            <h2>${title}</h2>
            <p style="opacity:0.7">di ${nick}</p>
            ${description ? `<p>${description}</p>` : ""}
            <video class="viewer-video" controls playsinline>
                <source src="${absoluteUrl(content.content_url)}">
            </video>
        `;
    }

    if (content.type === "pdf") {
        return `
            <h2>${title}</h2>
            <p style="opacity:0.7">di ${nick}</p>
            ${description ? `<p>${description}</p>` : ""}
            <iframe class="viewer-pdf" src="${absoluteUrl(content.content_url)}"></iframe>
            <br>
            <a href="${absoluteUrl(content.content_url)}" target="_blank" rel="noopener">Apri PDF</a>
        `;
    }

    if (content.type === "poetry" || content.type === "text") {
        return `
            <h2>${title}</h2>
            <p style="opacity:0.7">di ${nick}</p>
            ${description ? `<p>${description}</p>` : ""}
            <div class="viewer-text">${escapeHtml(content.content_text || "")}</div>
        `;
    }

    if (content.type === "ar") {
        const url = absoluteUrl(content.content_url);
        const isUsdz = url.toLowerCase().endsWith(".usdz");

        return `
            <h2>${title}</h2>
            <p style="opacity:0.7">di ${nick}</p>
            ${description ? `<p>${description}</p>` : ""}
            <div style="margin-top:16px;">
                <model-viewer
                    src="${url}"
                    alt="${title}"
                    auto-rotate
                    camera-controls
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    style="width:100%; height:340px; background:#111; border-radius:12px;">
                </model-viewer>
            </div>
            <div style="margin-top:16px; text-align:center;">
                ${isUsdz ? `<a class="ar-button" href="${url}" rel="ar">Apri in AR (iPhone)</a>` : ""}
                <p style="margin-top:10px;font-size:13px;opacity:0.65;">
                    Su Android usa il pulsante AR del visualizzatore.
                </p>
            </div>
        `;
    }

    if (content.type === "link") {
        return genericLinkContent(content, "Apri collegamento");
    }

    return `<h2>${title}</h2><p>Contenuto non supportato.</p>`;
}

function genericLinkContent(content, label) {
    return `
        <h2>${escapeHtml(content.title || "")}</h2>
        <p style="opacity:0.7">di ${escapeHtml(content.nickname || "Anonimo")}</p>
        ${content.description ? `<p>${escapeHtml(content.description)}</p>` : ""}
        <a class="viewer-link" href="${absoluteUrl(content.content_url)}" target="_blank" rel="noopener">
            ${label}
        </a>
    `;
}

function getYouTubeId(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "");
        if (parsed.hostname.includes("youtube.com")) {
            return parsed.searchParams.get("v") || parsed.pathname.split("/").pop();
        }
    } catch (e) {}
    return null;
}

function absoluteUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return API_URL + url;
}

function getContentIcon(type) {
    const icons = {
        ar: "◇", youtube: "▶", poetry: "✒", pdf: "▤",
        image: "▧", video: "▶", link: "↗", text: "T"
    };
    return icons[type] || "●";
}

function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function openContentViewerById(id) {
    try {
        const response = await fetch(`${API_URL}/api/contents/${id}`);
        const content = await response.json();
        if (!response.ok) throw new Error(content.error || "Non trovato");
        openContentViewer(content);
    } catch (err) {
        console.error(err);
        alert("Impossibile aprire il contenuto.");
    }
}

function closeContentViewer(event) {
    if (event && event.target && !event.target.classList.contains("content-viewer-backdrop")) return;
    const viewer = document.getElementById("content-viewer");
    if (viewer) viewer.classList.remove("visible");
}

function addViewerStyles() {
    if (document.getElementById("content-viewer-styles")) return;

    const style = document.createElement("style");
    style.id = "content-viewer-styles";
    style.textContent = `
        #content-viewer { position: fixed; inset: 0; z-index: 99999; display: none; }
        #content-viewer.visible { display: block; }
        .content-viewer-backdrop {
            position: absolute; inset: 0;
            background: rgba(0,0,0,0.87);
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
        }
        .content-viewer-panel {
            position: relative;
            width: min(960px, 96vw);
            max-height: 92vh;
            overflow: auto;
            background: #111;
            border: 1px solid #333;
            border-radius: 16px;
            padding: 24px;
            color: white;
        }
        .content-viewer-close {
            position: absolute; top: 8px; right: 12px;
            border: 0; background: none; color: white;
            font-size: 30px; cursor: pointer;
        }
        .viewer-image { display: block; max-width: 100%; max-height: 65vh; margin: 16px auto; border-radius: 8px; }
        .viewer-video { display: block; width: 100%; max-height: 65vh; margin: 16px auto; }
        .viewer-pdf { width: 100%; height: 65vh; border: 0; background: #fff; }
        .youtube-container { position: relative; width: 100%; padding-bottom: 56.25%; height: 0; margin-top: 16px; }
        .youtube-container iframe { position: absolute; inset: 0; width: 100%; height: 100%; }
        .viewer-text { white-space: pre-wrap; font-size: 17px; line-height: 1.75; margin-top: 20px; padding: 20px; border-left: 2px solid #666; }
        .viewer-link, .ar-button {
            display: inline-block; margin-top: 16px; padding: 11px 18px;
            border: 1px solid #666; border-radius: 8px; color: white; text-decoration: none;
        }
    `;
    document.head.appendChild(style);
}

// ==========================================
// RICERCA LUOGO
// ==========================================
const searchInput = document.getElementById("place-search");

if (searchInput) {
    searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            searchPlace();
        }
    });
}

async function searchPlace() {
    const query = searchInput?.value.trim();
    if (!query) return;

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
        const response = await fetch(url, { headers: { "Accept-Language": "it" } });
        const results = await response.json();

        if (!results.length) {
            alert("Nessun risultato trovato.");
            return;
        }

        // Prendi il primo risultato
        const r = results[0];
        goToSearchResult(r.lat, r.lon, r.display_name);

    } catch (err) {
        console.error(err);
        alert("Errore durante la ricerca.");
    }
}

function goToSearchResult(lat, lon, name) {
    map.setView([lat, lon], 17);

    if (window.searchMarker) map.removeLayer(window.searchMarker);

    window.searchMarker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(name)
        .openPopup();

    selectedLocation = { lat: parseFloat(lat), lng: parseFloat(lon) };
    selectedLocationElementUpdate(parseFloat(lat), parseFloat(lon));

    if (searchInput) searchInput.value = "";
}

// ==========================================
// INIZIALIZZAZIONE
// ==========================================
updateContentInput();
loadContents();

// Nickname salvato
const savedNick = localStorage.getItem("maestro_nickname");
if (savedNick) {
    const nickInput = document.getElementById("content-nickname");
    if (nickInput) nickInput.value = savedNick;
}

const nickInput = document.getElementById("content-nickname");
if (nickInput) {
    nickInput.addEventListener("change", function () {
        const val = this.value.trim();
        if (val) localStorage.setItem("maestro_nickname", val);
    });
}

// Chiedi la posizione dopo un breve ritardo (migliore UX)
setTimeout(() => {
    if (!currentPosition && locateButton) {
        // Non forziamo il popup del browser subito, ma rendiamo il banner molto visibile
    }
}, 800);

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeContentViewer();
});
