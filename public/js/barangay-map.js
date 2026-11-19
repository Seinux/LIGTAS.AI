
// ==========================================
// LIGTAS.AI - BARANGAY DISASTER MAP
// ==========================================

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

let barangayMap = null;
let savedMapLocation = null;
let is3DEnabled = true;

let reportRefreshTimeout = null;


// ==========================================
// DOM ELEMENTS
// ==========================================

const mapElement = document.getElementById('barangayMap');
const mapLocationName = document.getElementById('mapLocationName');
const selectedStreet = document.getElementById('selectedStreet');
const mapStatus = document.getElementById('mapStatus');
const mapReset = document.getElementById('mapReset');
const map3D = document.getElementById('map3D');

// Incident filters
const incidentFilters = document.querySelectorAll(
    '.filter-option input[type="checkbox"]'
);

let communityReports = [];

const reportModal = document.getElementById('reportModal');
const closeReportModal = document.getElementById('closeReportModal');
const closeReportBackdrop = document.getElementById('closeReportBackdrop');
const cancelReport = document.getElementById('cancelReport');

const reportStreetName = document.getElementById('reportStreetName');
const reportAddress = document.getElementById('reportAddress');
const reportForm = document.getElementById('incidentReportForm');
const reportFormMessage = document.getElementById('reportFormMessage');



// ==========================================
// INCIDENT REPORT MODAL
// ==========================================

function openReportModal() {
    const location = window.selectedIncidentLocation;

    if (!location) {
        alert('Please select a street on the map first.');
        return;
    }

    reportStreetName.textContent = location.streetName;
    reportAddress.textContent = location.address;

    reportFormMessage.textContent = '';
    reportFormMessage.className = 'report-message hidden';

    reportModal.classList.remove('hidden');

    document.body.style.overflow = 'hidden';
}


function closeIncidentModal() {
    reportModal.classList.add('hidden');
    document.body.style.overflow = '';
}


if (closeReportModal) {
    closeReportModal.addEventListener('click', closeIncidentModal);
}

if (closeReportBackdrop) {
    closeReportBackdrop.addEventListener('click', closeIncidentModal);
}

if (cancelReport) {
    cancelReport.addEventListener('click', closeIncidentModal);
}


document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && reportModal && !reportModal.classList.contains('hidden')) {
        closeIncidentModal();
    }
});


// ==========================================
// SUBMIT INCIDENT REPORT
// ==========================================

if (reportForm) {
    reportForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const selectedLocation = window.selectedIncidentLocation;

        if (!selectedLocation) {
            showReportMessage(
                'Please select a location on the map first.',
                'error'
            );
            return;
        }

        const submitButton = document.getElementById('submitReport');

        const reportData = {
            report_type: document.getElementById('reportType').value,
            title: document.getElementById('reportTitle').value.trim(),
            description: document.getElementById('reportDescription').value.trim(),
            severity: document.getElementById('reportSeverity').value,

            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            address: selectedLocation.address
        };

        try {
            submitButton.disabled = true;
            submitButton.textContent = 'Submitting...';

            const response = await fetch('/api/reports', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reportData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || 'Unable to submit incident report.'
                );
            }

            showReportMessage(
                'Your incident report has been submitted successfully!',
                'success'
            );

            console.log('Submitted report:', data.report);

            reportForm.reset();

            // Keep the success message visible before closing.
            submitButton.textContent = 'Submitted';

            setTimeout(() => {
                closeIncidentModal();

                submitButton.disabled = false;
                submitButton.textContent = 'Submit Report';

                // Remove the selected location after submission.
                window.selectedIncidentLocation = null;

                selectedStreet.textContent =
                    'Select a street on the map to report an incident.';

                mapStatus.textContent = 'Report submitted successfully.';

            }, 1500);

        } catch (error) {
            console.error('Report submission error:', error);

            showReportMessage(error.message, 'error');

            submitButton.disabled = false;
            submitButton.textContent = 'Submit Report';
        }
    });
}


// ==========================================
// REPORT FORM MESSAGE
// ==========================================

function showReportMessage(message, type) {
    if (!reportFormMessage) return;

    reportFormMessage.textContent = message;
    reportFormMessage.className = `report-message ${type}`;
}



// ==========================================
// LOCATION HELPERS
// ==========================================

function isValidCoordinates(latitude, longitude) {
    return (
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180
    );
}


function findLocationCoordinates(data, depth = 0) {
    if (!data || typeof data !== 'object' || depth > 5) {
        return null;
    }

    const latitude = Number(data.latitude ?? data.lat);
    const longitude = Number(
        data.longitude ?? data.lon ?? data.lng
    );

    if (isValidCoordinates(latitude, longitude)) {
        return data;
    }

    for (const value of Object.values(data)) {
        if (value && typeof value === 'object') {
            const result = findLocationCoordinates(value, depth + 1);

            if (result) {
                return result;
            }
        }
    }

    return null;
}


function getLocationName(location) {
    const parts = [
        location.barangay,
        location.city,
        location.province
    ].filter(Boolean);

    return parts.length
        ? parts.join(', ')
        : 'Your saved location';
}


// ==========================================
// LOAD SAVED USER LOCATION
// ==========================================

async function loadMapLocation() {
    try {
        const response = await fetch('/api/dashboard/location', {
            credentials: 'same-origin'
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return null;
        }

        if (!response.ok) {
            throw new Error('Unable to retrieve saved location.');
        }

        const data = await response.json();

        const location = findLocationCoordinates(data);

        if (!location) {
            throw new Error('Saved location coordinates were not found.');
        }

        const latitude = Number(location.latitude ?? location.lat);
        const longitude = Number(
            location.longitude ?? location.lon ?? location.lng
        );

        savedMapLocation = {
            latitude,
            longitude,
            barangay: location.barangay || null,
            city: location.city || null,
            province: location.province || null
        };

        return savedMapLocation;

    } catch (error) {
        console.error('Map location error:', error);
        mapStatus.textContent = error.message;
        return null;
    }
}


// ==========================================
// INITIALIZE MAP
// ==========================================

async function initializeBarangayMap() {
    if (!mapElement || typeof maplibregl === 'undefined') {
        console.error('MapLibre or map container is unavailable.');
        return;
    }

    const location = await loadMapLocation();

    if (!location) {
        mapElement.innerHTML = `
            <div class="map-loading">
                Unable to load your saved location.
            </div>
        `;

        return;
    }

    const center = [
        location.longitude,
        location.latitude
    ];

    const locationName = getLocationName(location);

    mapLocationName.textContent = locationName;

    mapElement.innerHTML = '';

    barangayMap = new maplibregl.Map({
        container: 'barangayMap',
        style: MAP_STYLE,
        center: center,
        zoom: 16,
        pitch: 55,
        bearing: -17,
        antialias: true
    });

    barangayMap.addControl(
        new maplibregl.NavigationControl({
            visualizePitch: true
        }),
        'top-right'
    );

    barangayMap.addControl(
        new maplibregl.ScaleControl({
            maxWidth: 100,
            unit: 'metric'
        }),
        'bottom-left'
    );

    barangayMap.on('load', async () => {
        mapStatus.textContent = 'Map loaded successfully.';

        add3DBuildings();

        mapElement.querySelector('.map-loading')?.remove();

        console.log('LIGTAS.AI map initialized.');

        await loadCommunityReports();
    });

    barangayMap.on('error', (event) => {
        console.error('MapLibre error:', event.error);
    });

    barangayMap.on('click', handleMapClick);

    barangayMap.on('mousemove', handleMapHover);

    barangayMap.on('moveend', () => {
        clearTimeout(reportRefreshTimeout);

        reportRefreshTimeout = setTimeout(() => {
            loadCommunityReports();
        }, 400);
    });
}


// ==========================================
// 3D BUILDINGS
// ==========================================

function add3DBuildings() {
    if (!barangayMap) return;

    const style = barangayMap.getStyle();

    // Find the building layer in the loaded map style.
    const buildingLayer = style.layers.find(layer =>
        layer.type === 'fill' &&
        layer['source-layer'] === 'building'
    );

    if (!buildingLayer) {
        console.warn('Building data layer was not found.');
        mapStatus.textContent =
            'Map loaded. 3D building data is unavailable in this area.';
        return;
    }

    // Prevent adding the layer more than once.
    if (barangayMap.getLayer('ligtas-3d-buildings')) {
        return;
    }

    // Place 3D buildings below map labels.
    const firstSymbolLayer = style.layers.find(layer =>
        layer.type === 'symbol'
    );

    barangayMap.addLayer({
        id: 'ligtas-3d-buildings',
        source: buildingLayer.source,
        'source-layer': buildingLayer['source-layer'],
        type: 'fill-extrusion',
        minzoom: 14,

        paint: {
            'fill-extrusion-color': '#64748b',

            'fill-extrusion-height': [
                'interpolate',
                ['linear'],
                ['zoom'],
                14,
                0,
                16,
                [
                    'to-number',
                    ['get', 'render_height'],
                    ['to-number', ['get', 'height'], 10]
                ]
            ],

            'fill-extrusion-base': [
                'to-number',
                ['get', 'render_min_height'],
                ['to-number', ['get', 'min_height'], 0]
            ],

            'fill-extrusion-opacity': 0.85
        }

    }, firstSymbolLayer?.id);

    mapStatus.textContent = '3D buildings enabled.';
}



// ==========================================
// STREET SELECTION
// ==========================================

// Find road features near the user's click.
// This allows clicking the road itself instead
// of needing to click its text label.

function findRoadFeature(point) {
    if (!barangayMap) return null;

    const clickTolerance = 18;

    const nearbyFeatures = barangayMap.queryRenderedFeatures(
        [
            [point.x - clickTolerance, point.y - clickTolerance],
            [point.x + clickTolerance, point.y + clickTolerance]
        ]
    );

    const roadFeatures = nearbyFeatures.filter(feature => {
        const layerId = (feature.layer.id || '').toLowerCase();

        const sourceLayer = (
            feature.layer['source-layer'] || ''
        ).toLowerCase();

        return (
            sourceLayer.includes('transportation') ||
            sourceLayer.includes('road') ||
            layerId.includes('road') ||
            layerId.includes('transportation')
        );
    });

    if (roadFeatures.length === 0) {
        return null;
    }

    // Prefer a road that already has a name.
    const namedRoad = roadFeatures.find(feature => {
        const properties = feature.properties || {};

        return (
            properties.name ||
            properties['name:en'] ||
            properties['name:latin'] ||
            properties.ref
        );
    });

    return namedRoad || roadFeatures[0];
}


// Get street information using reverse geocoding.

async function getStreetInformation(latitude, longitude) {
    try {
        const response = await fetch(
            `/api/geocoding/reverse?latitude=${latitude}&longitude=${longitude}`,
            {
                credentials: 'same-origin'
            }
        );

        if (!response.ok) {
            throw new Error('Reverse geocoding failed.');
        }

        const data = await response.json();

        return data.location || null;

    } catch (error) {
        console.error('Street lookup error:', error);
        return null;
    }
}


// Handle road selection.

async function handleMapClick(event) {
    if (!barangayMap) return;

    const roadFeature = findRoadFeature(event.point);

    if (!roadFeature) {
        selectedStreet.textContent =
            'No road detected. Try clicking closer to a street.';

        return;
    }

    const properties = roadFeature.properties || {};

    // First, try the name provided by the map data.
    let streetName =
        properties.name ||
        properties['name:en'] ||
        properties['name:latin'] ||
        properties.ref ||
        null;

    const latitude = event.lngLat.lat;
    const longitude = event.lngLat.lng;

    // Show immediate feedback while retrieving the address.
    selectedStreet.textContent = 'Identifying selected street...';
    mapStatus.textContent = 'Looking up street information...';

    const popupContent = document.createElement('div');

    const title = document.createElement('strong');
    title.textContent = 'Identifying street...';

    const description = document.createElement('p');
    description.textContent = 'Please wait...';

    const reportButton = document.createElement('button');

    reportButton.type = 'button';
    reportButton.textContent = 'Report an Incident';

    reportButton.style.cssText = `
        margin-top: 10px;
        padding: 9px 13px;
        width: 100%;
        border: none;
        border-radius: 7px;
        background: #2563eb;
        color: white;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
    `;

    reportButton.addEventListener('click', () => {
        openReportModal();
        popup.remove();
    });

    popupContent.append(title, description, reportButton);

    const popup = new maplibregl.Popup()
        .setLngLat(event.lngLat)
        .setDOMContent(popupContent)
        .addTo(barangayMap);

    // If the map has no street name, use reverse geocoding.
    if (!streetName) {
        const location = await getStreetInformation(
            latitude,
            longitude
        );

        if (location && location.name) {
            streetName = location.name;
        }
    }

    // Fallback when neither source provides a street name.
    if (!streetName) {
        streetName = 'Unnamed road near your selected location';
    }

    const locationDetails = await getStreetInformation(
        latitude,
        longitude
    );

    const barangay =
        locationDetails?.barangay ||
        savedMapLocation?.barangay ||
        '';

    const city =
        locationDetails?.city ||
        savedMapLocation?.city ||
        '';

    const addressParts = [
        streetName,
        barangay,
        city
    ].filter(Boolean);

    const address = [...new Set(addressParts)].join(', ');

    selectedStreet.textContent = `Selected: ${address}`;

    mapStatus.textContent =
        `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

    title.textContent = streetName;

    description.textContent =
        `${address}\nCoordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

    // Store the selected location for the future report form.
    window.selectedIncidentLocation = {
        streetName,
        address,
        latitude,
        longitude,
        barangay,
        city
    };

    console.log(
        'Selected incident location:',
        window.selectedIncidentLocation
    );
}


function getSeverityStyle(severity) {
    const styles = {
        low: {
            color: '#22c55e',
            shadow: 'rgba(34, 197, 94, 0.3)'
        },
        moderate: {
            color: '#eab308',
            shadow: 'rgba(234, 179, 8, 0.3)'
        },
        high: {
            color: '#f97316',
            shadow: 'rgba(249, 115, 22, 0.3)'
        },
        critical: {
            color: '#ef4444',
            shadow: 'rgba(239, 68, 68, 0.3)'
        }
    };

    return styles[String(severity).toLowerCase()] || {
        color: '#64748b',
        shadow: 'rgba(100, 116, 139, 0.3)'
    };
}

// ==========================================
// INCIDENT TYPE FILTERS
// ==========================================

function getSelectedIncidentTypes() {
    return Array.from(incidentFilters)
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value);
}


function applyIncidentFilters() {
    const selectedTypes = getSelectedIncidentTypes();

    const filteredReports = communityReports.filter(report =>
        selectedTypes.includes(report.report_type)
    );

    displayCommunityReports(filteredReports);

    mapStatus.textContent =
        `${filteredReports.length} of ${communityReports.length} verified incident(s) displayed.`;
}


incidentFilters.forEach(checkbox => {
    checkbox.addEventListener('change', applyIncidentFilters);
});



async function loadCommunityReports() {
    if (!barangayMap) {
        return;
    }

    try {
        const center = barangayMap.getCenter();

        const response = await fetch(
            `/api/reports/nearby?lat=${center.lat}&lon=${center.lng}&radius=5`,
            {
                credentials: 'same-origin'
            }
        );

        if (!response.ok) {
            throw new Error('Failed to load community reports.');
        }

        const data = await response.json();

        // Store all reports before applying filters.
        communityReports = data.reports || [];

        // Display only the selected incident categories.
        applyIncidentFilters();

        console.log(
            `Retrieved ${communityReports.length} verified community reports.`
        );

    } catch (error) {
        console.error('Community reports error:', error);
        mapStatus.textContent = 'Unable to load community reports.';
    }
}


function displayCommunityReports(reports) {

    // Remove previously displayed markers.
    if (window.communityReportMarkers) {
        window.communityReportMarkers.forEach(marker => {
            marker.remove();
        });
    }

    window.communityReportMarkers = [];

    reports.forEach(report => {
        const latitude = Number(report.latitude);
        const longitude = Number(report.longitude);

        if (!isValidCoordinates(latitude, longitude)) {
            return;
        }

        const markerElement = document.createElement('div');

        const severityStyle = getSeverityStyle(report.severity);

        markerElement.className = 'community-report-marker';
        markerElement.title = `${report.title} - ${report.severity}`;

        markerElement.style.backgroundColor = severityStyle.color;

        markerElement.style.boxShadow =
            `0 0 0 5px ${severityStyle.shadow}`;

        const popupContent = document.createElement('div');

        const title = document.createElement('strong');
        title.textContent = report.title;

        const description = document.createElement('p');
        description.textContent = report.description || '';

        const type = document.createElement('p');
        type.textContent = `Type: ${report.report_type}`;

        const severity = document.createElement('p');
        severity.textContent = `Severity: ${report.severity}`;

        const address = document.createElement('p');
        address.textContent = report.address || 'Address unavailable';

        popupContent.append(
            title,
            description,
            type,
            severity,
            address
        );

        const marker = new maplibregl.Marker({
            element: markerElement
        })
            .setLngLat([longitude, latitude])
            .setPopup(
                new maplibregl.Popup({ offset: 25 })
                    .setDOMContent(popupContent)
            )
            .addTo(barangayMap);

        window.communityReportMarkers.push(marker);
    });
}


function escapeReportHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}




// ==========================================
// MAP HOVER
// ==========================================

function handleMapHover(event) {
    if (!barangayMap) return;

    const features = barangayMap.queryRenderedFeatures(event.point);

    const isRoad = features.some(feature => {
        const layerId = feature.layer.id.toLowerCase();

        const sourceLayer = (
            feature.layer['source-layer'] || ''
        ).toLowerCase();

        return (
            layerId.includes('road') ||
            layerId.includes('transportation') ||
            sourceLayer.includes('transportation')
        );
    });

    barangayMap.getCanvas().style.cursor =
        isRoad ? 'pointer' : '';
}


// ==========================================
// RESET MAP VIEW
// ==========================================

if (mapReset) {
    mapReset.addEventListener('click', () => {
        if (!barangayMap || !savedMapLocation) return;

        barangayMap.flyTo({
            center: [
                savedMapLocation.longitude,
                savedMapLocation.latitude
            ],
            zoom: 16,
            pitch: is3DEnabled ? 55 : 0,
            bearing: is3DEnabled ? -17 : 0,
            essential: true
        });
    });
}


// ==========================================
// TOGGLE 3D VIEW
// ==========================================

if (map3D) {
    map3D.addEventListener('click', () => {
        if (!barangayMap) return;

        is3DEnabled = !is3DEnabled;

        barangayMap.easeTo({
            pitch: is3DEnabled ? 55 : 0,
            bearing: is3DEnabled ? -17 : 0,
            duration: 800
        });

        map3D.textContent = is3DEnabled
            ? '3D View'
            : '2D View';

        map3D.classList.toggle('active', is3DEnabled);
    });
}


// ==========================================
// START MAP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeBarangayMap();
});
