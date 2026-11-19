
const searchInput = document.getElementById('locationSearch');
const searchResults = document.getElementById('searchResults');
const selectedLocation = document.getElementById('selectedLocation');
const locationDetails = document.getElementById('locationDetails');
const locationMessage = document.getElementById('locationMessage');
const gpsButton = document.getElementById('gpsButton');
const saveButton = document.getElementById('saveButton');

let selectedLocationData = null;
let searchTimeout = null;

searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);

    const query = searchInput.value.trim();

    selectedLocationData = null;
    selectedLocation.classList.add('hidden');
    searchResults.innerHTML = '';

    if (query.length < 2) return;

    searchTimeout = setTimeout(() => {
        searchLocations(query);
    }, 400);
});

async function searchLocations(query) {
    try {
        const response = await fetch(
            `/api/geocoding/search?q=${encodeURIComponent(query)}`,
            { credentials: 'same-origin' }
        );

        const data = await response.json();

        searchResults.innerHTML = '';

        if (!response.ok) {
            throw new Error(data.message || 'Search failed.');
        }

        if (!data.locations || data.locations.length === 0) {
            searchResults.innerHTML =
                '<div class="result-item">No locations found.</div>';
            return;
        }

        data.locations.forEach(location => {
            const item = document.createElement('div');
            item.className = 'result-item';

            const name = document.createElement('strong');
            name.textContent = location.name;

            const details = document.createElement('small');
            details.textContent = [
                location.city,
                location.province,
                location.country
            ].filter(Boolean).join(', ');

            item.append(name, details);

            item.addEventListener('click', () => {
                selectLocation(location);
            });

            searchResults.appendChild(item);
        });

    } catch (error) {
        locationMessage.textContent = error.message;
    }
}

function selectLocation(location) {
    selectedLocationData = {
        ...location,
        locationSource: 'manual'
    };

    locationDetails.textContent = [
        location.name,
        location.city,
        location.province,
        location.country
    ].filter(Boolean).join(', ');

    selectedLocation.classList.remove('hidden');
    searchResults.innerHTML = '';
    locationMessage.textContent = '';
}


gpsButton.addEventListener('click', getCurrentLocation);

function getCurrentLocation() {
    if (!navigator.geolocation) {
        locationMessage.textContent =
            'Your browser does not support GPS location.';
        return;
    }

    gpsButton.disabled = true;
    locationMessage.textContent = 'Detecting your location...';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            try {
                const response = await fetch(
                    `/api/geocoding/reverse?latitude=${latitude}&longitude=${longitude}`,
                    { credentials: 'same-origin' }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message || 'Unable to identify your address.'
                    );
                }

                selectedLocationData = {
                    ...data.location,
                    latitude,
                    longitude,
                    locationSource: 'gps'
                };

                locationDetails.textContent = [
                    data.location.name,
                    data.location.city,
                    data.location.province,
                    data.location.country
                ].filter(Boolean).join(', ');

                selectedLocation.classList.remove('hidden');
                locationMessage.textContent =
                    'Location detected! Review it and save.';

            } catch (error) {
                locationMessage.textContent = error.message;
            } finally {
                gpsButton.disabled = false;
            }
        },

        (error) => {
            let message = 'Unable to detect your location.';

            if (error.code === error.PERMISSION_DENIED) {
                message = 'Location permission was denied. Please allow location access.';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                message = 'Your current location is unavailable.';
            } else if (error.code === error.TIMEOUT) {
                message = 'Location request timed out. Please try again.';
            }

            locationMessage.textContent = message;
            gpsButton.disabled = false;
        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }
    );
}


saveButton.addEventListener('click', saveLocation);

async function saveLocation() {
    if (!selectedLocationData) return;

    try {
        saveButton.disabled = true;
        locationMessage.textContent = 'Saving location...';

        const response = await fetch('/api/profile/location', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                barangay: selectedLocationData.barangay,
                city: selectedLocationData.city,
                province: selectedLocationData.province,
                region: selectedLocationData.region,
                latitude: selectedLocationData.latitude,
                longitude: selectedLocationData.longitude,
                locationSource: 'manual'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to save location.');
        }

        locationMessage.textContent = 'Location saved successfully!';

    } catch (error) {
        locationMessage.textContent = error.message;
    } finally {
        saveButton.disabled = false;
    }
}
