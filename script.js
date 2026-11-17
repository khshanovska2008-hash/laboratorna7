
"use strict";

// Координати коледжу 
const collegeCoords = {
    latitude: 48.94321,
    longitude: 24.73380
};

const geoOptions = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0
};

// Глобальні змінні
let map = null;
let currentMarker = null;
let accuracyCircle = null;
let destinationMarker = null;
let watchId = null;
let currentPosition = null;
let lastSavedCoords = null;

const historyMarkers = [];

const element = (selector) => document.querySelector(selector);

// Виведення результатів
function showLines(containerId, lines, isError = false) {
    const container = element(`#${containerId}`);

    if (!container) return;

    container.replaceChildren();

    lines.forEach(line => {
        const p = document.createElement("p");
        p.textContent = line;

        if (isError) {
            p.classList.add("error");
        }

        container.appendChild(p);
    });
}

// Переведення градусів у радіани
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}

// Формула гаверсинусів для обчислення відстані
function computeDistance(startCoords, destCoords) {
    const radius = 6371;

    const lat1 = degreesToRadians(startCoords.latitude);
    const lat2 = degreesToRadians(destCoords.latitude);

    const deltaLat = degreesToRadians(
        destCoords.latitude - startCoords.latitude
    );

    const deltaLng = degreesToRadians(
        destCoords.longitude - startCoords.longitude
    );

    const a =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) ** 2;

    const safeA = Math.min(1, Math.max(0, a));

    return 2 * radius * Math.atan2(
        Math.sqrt(safeA),
        Math.sqrt(1 - safeA)
    );
}

// Форматування координат
function formatCoords(coords) {
    return `Широта: ${coords.latitude.toFixed(6)}, довгота: ${coords.longitude.toFixed(6)}`;
}

// Форматування часу
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString("uk-UA");
}

// Інформаційне вікно маркера
function createPopup(title, coords, timestamp, accuracy = null) {
    return `<strong>${title}</strong><br>` +
        `Широта: ${coords.latitude.toFixed(6)}<br>` +
        `Довгота: ${coords.longitude.toFixed(6)}<br>` +
        `Час: ${formatTime(timestamp)}` +
        (accuracy === null
            ? ""
            : `<br>Точність: ${accuracy.toFixed(1)} м`);
}

// Створення карти Esri World Street Map
function initMap() {
    if (typeof L === "undefined") {
        showLines("out6", [
            "Не вдалося завантажити Leaflet. Перевір інтернет-з’єднання."
        ], true);

        element("#centerCollege").disabled = true;
        element("#clearHistory").disabled = true;

        return;
    }

    map = L.map("map").setView(
        [
            collegeCoords.latitude,
            collegeCoords.longitude
        ],
        13
    );

    // Картографічна підкладка Esri
    const tiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        {
            maxZoom: 19,
            attribution:
                'Tiles &copy; <a href="https://www.arcgis.com/home/item.html?id=3b93337983e9436f8db950e38a8629af">Esri</a> &mdash; Esri and GIS User Community'
        }
    ).addTo(map);

    // Обробка помилок завантаження карти
    tiles.on("tileerror", function () {
        showLines("out6", [
            "Не вдалося завантажити карту Esri. Перевір інтернет-з’єднання."
        ], true);
    });

    // Маркер коледжу
    L.circleMarker(
        [
            collegeCoords.latitude,
            collegeCoords.longitude
        ],
        {
            radius: 8,
            color: "#b62f36",
            fillColor: "#ed5059",
            fillOpacity: 1
        }
    )
        .addTo(map)
        .bindPopup(
            `<strong>Коледж (орієнтовна точка)</strong><br>` +
            `Широта: ${collegeCoords.latitude}<br>` +
            `Довгота: ${collegeCoords.longitude}`
        );
}

// Відображення поточного місцезнаходження
function displayLocation(position) {
    const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
    };

    const accuracy = position.coords.accuracy;
    const time = position.timestamp;

    currentPosition = {
        coords,
        accuracy,
        time
    };

    // Координати
    showLines("out1", [
        formatCoords(coords),
        `Час визначення: ${formatTime(time)}`
    ]);

    // Відстань до коледжу
    showLines("out3", [
        `Відстань до коледжу: ${computeDistance(coords, collegeCoords).toFixed(3)} км`,
        "Відстань по прямій, а не довжина автомобільного маршруту."
    ]);

    // Точність геолокації
    showLines("out4", [
        `Точність визначення: ±${accuracy.toFixed(1)} м (оцінений радіус).`
    ]);

    // Відстеження місцезнаходження
    if (watchId !== null) {
        showLines("out5", [
            "Відстеження активне.",
            formatCoords(coords),
            `Останнє оновлення: ${formatTime(time)}`
        ]);
    }

    if (!map) return;

    const latLng = [
        coords.latitude,
        coords.longitude
    ];

    // Маркер поточної позиції
    if (!currentMarker) {
        currentMarker = L.circleMarker(latLng, {
            radius: 9,
            color: "#2455bb",
            fillColor: "#4f86eb",
            fillOpacity: 1
        }).addTo(map);
    } else {
        currentMarker.setLatLng(latLng);
    }

    currentMarker.bindPopup(
        createPopup(
            "Моя поточна позиція",
            coords,
            time,
            accuracy
        )
    );

    // Коло точності геолокації
    if (!accuracyCircle) {
        accuracyCircle = L.circle(latLng, {
            radius: accuracy,
            color: "#3462cf",
            weight: 1,
            fillColor: "#3462cf",
            fillOpacity: 0.08
        }).addTo(map);
    } else {
        accuracyCircle
            .setLatLng(latLng)
            .setRadius(accuracy);
    }

    // Історія місцезнаходжень
    if (
        lastSavedCoords === null ||
        coords.latitude !== lastSavedCoords.latitude ||
        coords.longitude !== lastSavedCoords.longitude
    ) {
        const historyMarker = L.circleMarker(latLng, {
            radius: 5,
            color: "#267c51",
            fillColor: "#45b57a",
            fillOpacity: 0.9
        }).addTo(map);

        historyMarker.bindPopup(
            createPopup(
                "Історія позицій",
                coords,
                time,
                accuracy
            )
        );

        historyMarkers.push(historyMarker);

        lastSavedCoords = { ...coords };
    }

    showLines("out6", [
        `Кількість маркерів історії: ${historyMarkers.length}`,
        `Остання позиція: ${formatCoords(coords)}`
    ]);

    element("#centerMe").disabled = false;

    if (
        watchId === null ||
        historyMarkers.length === 1
    ) {
        map.setView(latLng, 16);
    }
}

// Обробка помилок геолокації
function displayError(error) {
    const errors = {
        1: "Доступ до геолокації заборонено. Дозволь його в налаштуваннях браузера.",
        2: "Не вдалося визначити місцезнаходження. Перевір геолокацію пристрою.",
        3: "Час очікування координат вичерпано. Спробуй ще раз."
    };

    const message =
        errors[error.code] ||
        `Помилка геолокації: ${error.message || "невідома причина"}`;

    showLines("out2", [message], true);

    if (watchId !== null) {
        showLines("out5", [message], true);
    }
}

// Одноразове визначення місцезнаходження
function getMyLocation() {
    if (!navigator.geolocation) {
        showLines("out2", [
            "Браузер не підтримує Geolocation API."
        ], true);

        return;
    }

    showLines("out1", [
        "Очікування координат і дозволу браузера..."
    ]);

    navigator.geolocation.getCurrentPosition(
        displayLocation,
        displayError,
        geoOptions
    );
}

// Перевірка підтримки Geolocation API
function checkGeolocationSupport() {
    showLines("out2", [
        navigator.geolocation
            ? "Geolocation API підтримується браузером. Для визначення координат потрібен дозвіл."
            : "Geolocation API недоступний у цьому браузері або контексті сторінки."
    ], !navigator.geolocation);
}

// Виведення відстані до коледжу
function showDistance() {
    if (!currentPosition) {
        showLines("out3", [
            "Спочатку натисни «Визначити місцезнаходження»."
        ], true);

        return;
    }

    showLines("out3", [
        `Відстань до коледжу: ${computeDistance(currentPosition.coords, collegeCoords).toFixed(3)} км`,
        "Обчислено за формулою гаверсинусів."
    ]);
}

// Виведення точності геолокації
function showAccuracy() {
    if (!currentPosition) {
        showLines("out4", [
            "Спочатку визнач місцезнаходження."
        ], true);

        return;
    }

    showLines("out4", [
        `Точність визначення: ±${currentPosition.accuracy.toFixed(1)} м.`
    ]);
}

// Початок відстеження місцезнаходження
function watchLocation() {
    if (!navigator.geolocation) {
        showLines("out5", [
            "Geolocation API недоступний."
        ], true);

        return;
    }

    if (watchId !== null) return;

    watchId = navigator.geolocation.watchPosition(
        displayLocation,
        displayError,
        geoOptions
    );

    element("#watch").disabled = true;
    element("#clearWatch").disabled = false;

    showLines("out5", [
        "Відстеження ввімкнено. Очікування координат..."
    ]);
}

// Зупинення відстеження місцезнаходження
function clearWatch() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    element("#watch").disabled = false;
    element("#clearWatch").disabled = true;

    showLines("out5", [
        "Відстеження зупинено. Останні координати залишилися на карті."
    ]);
}

// Очищення історії маркерів
function clearHistory() {
    if (!map) return;

    historyMarkers.forEach(marker => {
        map.removeLayer(marker);
    });

    historyMarkers.length = 0;
    lastSavedCoords = null;

    showLines("out6", [
        "Історію маркерів очищено. Поточна позиція залишилася на карті."
    ]);
}

// Перевірка правильності введених координат
function parseCoordinate(value, minimum, maximum) {
    const normalized = value.trim().replace(",", ".");

    if (
        !normalized ||
        !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)
    ) {
        return null;
    }

    const number = Number(normalized);

    return (
        Number.isFinite(number) &&
        number >= minimum &&
        number <= maximum
    )
        ? number
        : null;
}

// Перехід до пункту призначення
function goToDestination(event) {
    event.preventDefault();

    const latitude = parseCoordinate(
        element("#destLat").value,
        -90,
        90
    );

    const longitude = parseCoordinate(
        element("#destLng").value,
        -180,
        180
    );

    if (
        latitude === null ||
        longitude === null
    ) {
        showLines("out7", [
            "Некоректні координати. Широта: −90…90; довгота: −180…180."
        ], true);

        return;
    }

    if (!map) {
        showLines("out7", [
            "Карта недоступна. Перевір підключення до інтернету."
        ], true);

        return;
    }

    const coords = {
        latitude,
        longitude
    };

    const latLng = [
        latitude,
        longitude
    ];

    // Маркер пункту призначення
    if (!destinationMarker) {
        destinationMarker = L.circleMarker(latLng, {
            radius: 8,
            color: "#803db5",
            fillColor: "#b27add",
            fillOpacity: 1
        }).addTo(map);
    } else {
        destinationMarker.setLatLng(latLng);
    }

    destinationMarker
        .bindPopup(
            createPopup(
                "Пункт призначення",
                coords,
                Date.now()
            )
        )
        .openPopup();

    map.flyTo(latLng, 15);

    element("#map").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    showLines("out7", [
        "Карту переміщено до заданої точки.",
        formatCoords(coords)
    ]);
}

// Підключення обробників подій
document.addEventListener("DOMContentLoaded", () => {

    // Ініціалізація карти
    initMap();

    element("#getLocation").addEventListener(
        "click",
        getMyLocation
    );

    element("#checkGeo").addEventListener(
        "click",
        checkGeolocationSupport
    );

    element("#showDistance").addEventListener(
        "click",
        showDistance
    );

    element("#showAccuracy").addEventListener(
        "click",
        showAccuracy
    );

    element("#watch").addEventListener(
        "click",
        watchLocation
    );

    element("#clearWatch").addEventListener(
        "click",
        clearWatch
    );

    // Індивідуальне завдання
    element("#clearHistory").addEventListener(
        "click",
        clearHistory
    );

    element("#centerMe").addEventListener(
        "click",
        () => {
            if (map && currentPosition) {
                const {
                    latitude,
                    longitude
                } = currentPosition.coords;

                map.flyTo(
                    [latitude, longitude],
                    16
                );

                currentMarker.openPopup();
            }
        }
    );

    element("#centerCollege").addEventListener(
        "click",
        () => {
            if (map) {
                map.flyTo(
                    [
                        collegeCoords.latitude,
                        collegeCoords.longitude
                    ],
                    15
                );
            }
        }
    );

    element("#destinationForm").addEventListener(
        "submit",
        goToDestination
    );

    // Зупинення відстеження при закритті сторінки
    window.addEventListener("beforeunload", () => {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
        }
    });
});
