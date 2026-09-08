const latitudeEl = document.getElementById("latitude");
const longitudeEl = document.getElementById("longitude");
const accuracyEl = document.getElementById("accuracy");
const distanceEl = document.getElementById("distance");
const statusEl = document.getElementById("status");
const button = document.getElementById("locationButton");
const arButton = document.getElementById("arButton");

let map = null;
let userMarker = null;
let operaMarker = null;

// ============================================
//  OPERA FISSA – metti qui le coordinate reali
// ============================================
const opera = {
    id: "opera-001",
    nome: "Drago Volante",
    descrizione: "La prima opera di MAESTRO",
    lat: 40.758843,          // ← 40.758843
    lng: 8.597402,          // ← 8.597402
    modello: "Dragon_Animation_Flying.usdz",
    raggioAttivazione: 25   // metri – quando sei più vicino di così appare il pulsante AR
};

// Calcolo distanza in metri (formula di Haversine)
function calcolaDistanza(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function getLocation() {
    if (!navigator.geolocation) {
        statusEl.textContent = "Geolocalizzazione non supportata.";
        return;
    }

    statusEl.textContent = "Aggiornamento posizione...";

    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            latitudeEl.textContent = lat.toFixed(6);
            longitudeEl.textContent = lng.toFixed(6);
            accuracyEl.textContent = Math.round(accuracy) + " m";

            // Calcola distanza dall’opera
            const dist = calcolaDistanza(lat, lng, opera.lat, opera.lng);
            distanceEl.textContent = Math.round(dist) + " metri";

            // Mostra / nasconde il pulsante AR
            if (dist <= opera.raggioAttivazione) {
                arButton.style.display = "block";
                statusEl.textContent = "Sei vicino all’opera! Puoi aprirla in AR.";
            } else {
                arButton.style.display = "none";
                statusEl.textContent = "Posizione aggiornata. Avvicinati all’opera.";
            }

            // Crea o aggiorna la mappa
            if (!map) {
                map = L.map('map').setView([lat, lng], 17);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap'
                }).addTo(map);

                // Marker utente
                userMarker = L.marker([lat, lng])
                    .addTo(map)
                    .bindPopup("<b>Tu sei qui</b>");

                // Marker opera
                const operaIcon = L.divIcon({
                    className: 'opera-marker',
                    html: '🐉',
                    iconSize: [42, 42],
                    iconAnchor: [21, 21]
                });

                operaMarker = L.marker([opera.lat, opera.lng], {
                    icon: operaIcon
                })
                .addTo(map)
                .bindPopup(`<b>${opera.nome}</b><br>${opera.descrizione}`);

                // Adatta la vista per vedere entrambi
                const bounds = L.latLngBounds([[lat, lng], [opera.lat, opera.lng]]);
                map.fitBounds(bounds, { padding: [40, 40] });

            } else {
                userMarker.setLatLng([lat, lng]);
                map.setView([lat, lng], map.getZoom());
            }
        },
        function(error) {
            console.error(error);
            statusEl.textContent = "Errore nel ottenere la posizione.";
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }
    );
}

button.addEventListener("click", getLocation);
