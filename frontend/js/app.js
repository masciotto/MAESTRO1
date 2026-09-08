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

    // Marker temporaneo del punto scelto
    if (window.tempMarker) {
        map.removeLayer(window.tempMarker);
    }
    window.tempMarker = L.marker([lat, lng], {
        opacity: 0.8
    }).addTo(map).bindPopup("Punto selezionato").openPopup();

    selectedLocationElementUpdate(lat, lng);
});

// ==========================================
// ELEMENTI UI
// ==========================================
const locateButton = document.getElementById("locate-btn");
const gpsStatus = document.getElementById("gps-status");
const locationInfo = document.getElementById("location-info");
const artworksList = document.getElementById("artworks-list");
const artworkCount = document.getElementById("artwork-count");
const contentForm = document.getElementById("content-form");
const contentType = document.getElementById("content-type");
const contentInputArea = document.getElementById("content-input-area");
const publishStatus = document.getElementById("publish-status");

// ==========================================
// POSIZIONE SELEZIONATA
// ==========================================
function selectedLocationElementUpdate(lat, lng) {
    const box = document.getElementById("selected-location");
    if (box) {
        box.innerHTML = `
            <strong>Punto selezionato</strong><br><br>
            Latitudine: ${lat.toFixed(6)}<br>
            Longitudine: ${lng.toFixed(6)}
        `;
    }
}

// ==========================================
// TIPO CONTENUTO (form dinamico)
// ==========================================
contentType.addEventListener("change", updateContentInput);

function updateContentInput() {
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
            <small>
                • <strong>USDZ</strong> → migliore su iPhone<br>
                • <strong>GLB</strong> → funziona su Android e nel browser
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
            <small>Dimensione massima: 100 MB</small>
        `;
        return;
    }
}

// ==========================================
// PUBBLICAZIONE CONTENUTO
// ==========================================
contentForm.addEventListener("submit", createContent);

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

    if (!title) {
        showPublishStatus("Inserisci un titolo.", true);
        return;
    }

    try {
        showPublishStatus("Pubblicazione in corso...");

        let contentUrl = null;
        let contentText = null;

        // Contenuti testuali / link / youtube
        if (type === "youtube" || type === "link") {
            const input = document.getElementById("content-url");
            if (!input || !input.value.trim()) {
                throw new Error("Inserisci un URL valido.");
            }
            contentUrl = input.value.trim();
        }

        if (type === "poetry" || type === "text") {
            const input = document.getElementById("content-text");
            if (!input || !input.value.trim()) {
                throw new Error("Inserisci il testo.");
            }
            contentText = input.value.trim();
        }

        // Upload file
        if (type === "ar" || type === "image" || type === "video" || type === "pdf") {
            const fileInput = document.getElementById("content-file");
            if (!fileInput || !fileInput.files || !fileInput.files.length) {
                throw new Error("Seleziona un file.");
            }

            const file = fileInput.files[0];
            if (file.size > 100 * 1024 * 1024) {
                throw new Error("Il file supera il limite di 100 MB.");
            }

            showPublishStatus("Caricamento del file...");

            const formData = new FormData();
            formData.append("type", type);
            formData.append("file", file);

            const uploadResponse = await fetch(`${API_URL}/api/upload`, {
                method: "POST",
                body: formData
            });

            const uploadData = await uploadResponse.json();

            if (!uploadResponse.ok) {
                throw new Error(uploadData.error || "Errore durante il caricamento del file.");
            }

            contentUrl = uploadData.url;
        }

        // Creazione record
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
            nickname: nickname,
            is_map_visible: isMapVisible,
            activation_radius: 80
        };

        const response = await fetch(`${API_URL}/api/contents`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(contentData)
        });

        // Controllo se la risposta è JSON
        const contentTypeHeader = response.headers.get("content-type") || "";
        if (!contentTypeHeader.includes("application/json")) {
            const text = await response.text();
            console.error("Risposta non JSON ricevuta:", text.substring(0, 200));
            throw new Error("Il server ha restituito HTML invece di JSON. Controlla che il backend sia avviato correttamente.");
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Errore durante la creazione del contenuto.");
        }

        // Successo
        showPublishStatus("✓ Contenuto pubblicato con successo!");

        addContentMarker(data);
        loadContents();

        // Reset form
        contentForm.reset();
        selectedLocation = null;
        document.getElementById("selected-location").innerHTML = "Nessun punto selezionato.";
        if (window.tempMarker) {
            map.removeLayer(window.tempMarker);
            window.tempMarker = null;
        }
        updateContentInput();

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
        gpsStatus.textContent = "GPS non supportato.";
        return;
    }

    gpsStatus.textContent = "Ricerca posizione...";

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            currentPosition = { lat, lng, accuracy };

            // Rimuovi marker precedenti
            if (userMarker) map.removeLayer(userMarker);
            if (userCircle) map.removeLayer(userCircle);

            // Nuovo marker + cerchio precisione
            userMarker = L.marker([lat, lng]).addTo(map)
                .bindPopup("La tua posizione")
                .openPopup();

            userCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: "#3388ff",
                fillColor: "#3388ff",
                fillOpacity: 0.15
            }).addTo(map);

            // Centra immediatamente la mappa
            map.setView([lat, lng], 17);
            map.invalidateSize();          // forza il ridisegno

            gpsStatus.textContent = `Posizione trovata · precisione ±${Math.round(accuracy)} m`;

            if (locationInfo) {
                locationInfo.innerHTML = `
                    <strong>La tua posizione</strong><br>
                    ${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
                    Precisione: ±${Math.round(accuracy)} m
                `;
            }

            // Ricarica i contenuti vicini
            loadContents();
        },
        function (error) {
            console.error(error);
            let msg = "Impossibile ottenere la posizione.";
            if (error.code === 1) msg = "Permesso di geolocalizzazione negato.";
            if (error.code === 2) msg = "Posizione non disponibile.";
            if (error.code === 3) msg = "Timeout nella ricerca della posizione.";
            gpsStatus.textContent = msg;
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
        let url = `${API_URL}/api/contents`;

        if (currentPosition) {
            url = `${API_URL}/api/contents/nearby?lat=${currentPosition.lat}&lng=${currentPosition.lng}&radius=3000`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Errore caricamento contenuti.");
        }

        // Gestisce sia array semplice che risposta nearby
        const contents = Array.isArray(data) ? data : (data.contents || []);

        clearContentMarkers();

        // Mostra sulla mappa solo quelli visibili
        contents
            .filter(c => c.is_map_visible !== 0)
            .forEach(addContentMarker);

        renderContentList(contents);

    } catch (error) {
        console.error("Errore contenuti:", error);
    }
}

function clearContentMarkers() {
    contentMarkers.forEach(marker => map.removeLayer(marker));
    contentMarkers = [];
}

function addContentMarker(content) {
    if (!content || !content.latitude || !content.longitude) return;

    const marker = L.marker([content.latitude, content.longitude]).addTo(map);

    marker.bindPopup(`
        <div class="marker-popup">
            <strong>${getContentIcon(content.type)} ${escapeHtml(content.title)}</strong><br>
            <small>${escapeHtml(content.type)} · ${escapeHtml(content.nickname || "Anonimo")}</small><br><br>
            <button onclick="openContentViewerById(${content.id})">Apri contenuto</button>
        </div>
    `);

    marker.on("click", function () {
        openContentViewer(content);
    });

    contentMarkers.push(marker);
}

function renderContentList(contents) {
    if (!artworksList) return;

    artworksList.innerHTML = "";

    if (!contents.length) {
        artworksList.innerHTML = `<p>Nessun contenuto nelle vicinanze.</p>`;
        if (artworkCount) artworkCount.textContent = "0";
        return;
    }

    contents.forEach(content => {
        const card = document.createElement("div");
        card.className = "content-card";
        card.style.cursor = "pointer";
        card.style.padding = "14px";
        card.style.marginBottom = "10px";
        card.style.background = "#1a1a1a";
        card.style.borderRadius = "10px";
        card.style.border = "1px solid #2a2a2a";

        // Calcola se è sbloccato
        let statusIcon = "🔒";
        let statusText = "Bloccato";
        let distanceText = "";

        if (content.distance_meters !== undefined) {
            distanceText = `${content.distance_meters} m`;
            const radius = content.activation_radius || 80;
            if (content.distance_meters <= radius) {
                statusIcon = "🔓";
                statusText = "Sbloccato";
            }
        } else {
            distanceText = "—";
        }

        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                    <strong style="font-size:15px;">${getContentIcon(content.type)} ${escapeHtml(content.title)}</strong><br>
                    <small style="opacity:0.75;">${escapeHtml(content.nickname || "Anonimo")} · ${escapeHtml(content.type)}</small>
                </div>
                <div style="text-align:right;font-size:13px;">
                    <div>${statusIcon} ${statusText}</div>
                    <div style="opacity:0.7;margin-top:3px;">${distanceText}</div>
                </div>
            </div>
        `;

        card.addEventListener("click", function () {
            map.setView([content.latitude, content.longitude], 17);
            openContentViewer(content);
        });

        artworksList.appendChild(card);
    });

    if (artworkCount) {
        artworkCount.textContent = contents.length;
    }
}

// ==========================================
// VISUALIZZATORE CONTENUTI
// ==========================================
function openContentViewer(content) {
    if (!content) return;

    // Controllo prossimità (cuore di MAESTRO)
    const activationRadius = content.activation_radius || 80;
    let isNear = false;
    let distance = null;

    if (currentPosition) {
        distance = calculateDistance(
            currentPosition.lat,
            currentPosition.lng,
            content.latitude,
            content.longitude
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
            <div style="margin-top:30px;padding:20px;background:#222;border-radius:12px;text-align:center;">
                <p>📍 Attiva il GPS per verificare se sei abbastanza vicino</p>
                <button onclick="locateUser()" style="margin-top:15px;padding:10px 20px;background:#2a7a3a;color:white;border:none;border-radius:8px;cursor:pointer;">
                    Attiva posizione
                </button>
            </div>
        `;
    } else if (!isNear) {
        body.innerHTML = `
            <h2>${escapeHtml(content.title)}</h2>
            <p style="opacity:0.7">di ${escapeHtml(content.nickname || "Anonimo")}</p>
            <div style="margin-top:30px;padding:25px;background:#1a1a1a;border-radius:12px;text-align:center;border:1px solid #333;">
                <div style="font-size:40px;margin-bottom:15px;">🔒</div>
                <h3>Contenuto bloccato</h3>
                <p>Devi avvicinarti di più per sbloccarlo.</p>
                <p style="margin-top:12px;font-size:18px;">
                    Distanza attuale: <strong>${Math.round(distance)} m</strong><br>
                    Raggio di attivazione: <strong>${activationRadius} m</strong>
                </p>
            </div>
        `;
    } else {
        // Sei abbastanza vicino → mostra il contenuto completo
        body.innerHTML = renderContent(content);
    }

    viewer.classList.add("visible");
}

// Calcolo distanza (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // raggio Terra in metri
    const toRad = (deg) => deg * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
                    <iframe src="https://www.youtube.com/embed/${videoId}"
                        title="${title}" frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen></iframe>
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
                Il tuo browser non supporta la riproduzione video.
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
            <a href="${absoluteUrl(content.content_url)}" target="_blank" rel="noopener">Apri PDF in una nuova finestra</a>
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

            <div style="margin-top:20px;">
                <model-viewer
                    src="${url}"
                    alt="${title}"
                    auto-rotate
                    camera-controls
                    ar
                    ar-modes="webxr scene-viewer quick-look"
                    style="width:100%; height:360px; background:#111; border-radius:12px;"
                >
                    <div slot="poster" style="color:white; text-align:center; padding-top:140px;">
                        Caricamento modello 3D...
                    </div>
                </model-viewer>
            </div>

            <div style="margin-top:18px; text-align:center;">
                ${isUsdz ? `
                    <a class="ar-button" href="${url}" rel="ar" style="display:inline-block; margin:6px;">
                        Apri in AR (iPhone)
                    </a>
                ` : ""}
                <p style="margin-top:12px; font-size:13px; opacity:0.7;">
                    Su Android usa il pulsante AR del visualizzatore 3D.<br>
                    Su iPhone puoi usare anche il pulsante dedicato.
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
        <a class="viewer-link" href="${absoluteUrl(content.content_url)}" target="_blank" rel="noopener noreferrer">
            ${label}
        </a>
    `;
}

function getYouTubeId(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.hostname.includes("youtu.be")) {
            return parsed.pathname.replace("/", "");
        }
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
    if (value === null || value === undefined) return "";
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
        if (!response.ok) throw new Error(content.error || "Contenuto non trovato.");
        openContentViewer(content);
    } catch (error) {
        console.error(error);
        alert("Impossibile aprire il contenuto.");
    }
}

function closeContentViewer(event) {
    if (event && event.target && !event.target.classList.contains("content-viewer-backdrop")) {
        return;
    }
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
            background: rgba(0,0,0,0.85);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        }
        .content-viewer-panel {
            position: relative;
            width: min(1000px, 95vw);
            max-height: 92vh;
            overflow: auto;
            background: #111;
            border: 1px solid #333;
            border-radius: 16px;
            padding: 28px;
            color: white;
            box-shadow: 0 20px 80px rgba(0,0,0,0.6);
        }
        .content-viewer-close {
            position: absolute; top: 10px; right: 14px;
            border: 0; background: none; color: white;
            font-size: 32px; cursor: pointer; z-index: 2;
        }
        .viewer-image { display: block; max-width: 100%; max-height: 70vh; margin: 20px auto; border-radius: 8px; }
        .viewer-video { display: block; width: 100%; max-height: 70vh; margin: 20px auto; }
        .viewer-pdf { width: 100%; height: 70vh; border: 0; background: white; }
        .youtube-container { position: relative; width: 100%; padding-bottom: 56.25%; height: 0; overflow: hidden; margin-top: 20px; }
        .youtube-container iframe { position: absolute; inset: 0; width: 100%; height: 100%; }
        .viewer-text { white-space: pre-wrap; font-size: 18px; line-height: 1.8; margin-top: 25px; padding: 25px; border-left: 2px solid #888; }
        .viewer-link, .ar-button {
            display: inline-block; margin-top: 20px; padding: 12px 20px;
            border: 1px solid #777; border-radius: 8px; color: white; text-decoration: none;
        }
        .ar-placeholder { text-align: center; padding: 50px 20px; }
        .ar-icon { font-size: 70px; }
    `;
    document.head.appendChild(style);
}


// ==========================================
// RICERCA LUOGO (Nominatim)
// ==========================================
const searchInput = document.getElementById("place-search");
const searchBtn = document.getElementById("search-btn");
const searchResults = document.getElementById("search-results");

if (searchBtn) {
    searchBtn.addEventListener("click", searchPlace);
}

if (searchInput) {
    searchInput.addEventListener("keydown", function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            searchPlace();
        }
    });
}

async function searchPlace() {
    const query = searchInput.value.trim();
    if (!query) return;

    searchResults.innerHTML = `<p style="opacity:0.7;">Ricerca in corso...</p>`;

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
        
        const response = await fetch(url, {
            headers: {
                "Accept-Language": "it"
            }
        });
        
        const results = await response.json();

        if (!results.length) {
            searchResults.innerHTML = `<p style="opacity:0.7;">Nessun risultato trovato.</p>`;
            return;
        }

        searchResults.innerHTML = results.map((r, i) => `
            <div 
                class="search-result-item"
                style="padding:10px; margin-bottom:6px; background:#1a1a1a; border-radius:8px; cursor:pointer; border:1px solid #333;"
                onclick="goToSearchResult(${r.lat}, ${r.lon}, '${escapeHtml(r.display_name).replace(/'/g, "\'")}')"
            >
                <strong style="font-size:14px;">${escapeHtml(r.display_name)}</strong>
            </div>
        `).join("");

    } catch (err) {
        console.error(err);
        searchResults.innerHTML = `<p style="color:#ff6b6b;">Errore durante la ricerca.</p>`;
    }
}

function goToSearchResult(lat, lon, name) {
    map.setView([lat, lon], 17);
    
    // Marker temporaneo del risultato
    if (window.searchMarker) {
        map.removeLayer(window.searchMarker);
    }
    
    window.searchMarker = L.marker([lat, lon])
        .addTo(map)
        .bindPopup(name)
        .openPopup();

    // Imposta anche come punto selezionato per creare contenuto
    selectedLocation = { lat: parseFloat(lat), lng: parseFloat(lon) };
    selectedLocationElementUpdate(parseFloat(lat), parseFloat(lon));

    searchResults.innerHTML = "";
    searchInput.value = "";
}


// ==========================================
// INIZIALIZZAZIONE
// ==========================================
updateContentInput();
loadContents();

// Ripristina nickname salvato
const savedNick = localStorage.getItem("maestro_nickname");
if (savedNick) {
    const nickInput = document.getElementById("content-nickname");
    if (nickInput) nickInput.value = savedNick;
}

// Salva nickname quando cambia
const nickInput = document.getElementById("content-nickname");
if (nickInput) {
    nickInput.addEventListener("change", function() {
        const val = this.value.trim();
        if (val) localStorage.setItem("maestro_nickname", val);
    });
}

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeContentViewer();
});
