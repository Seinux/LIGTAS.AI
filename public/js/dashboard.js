
const usernameElement = document.getElementById('username');
const accountUsername = document.getElementById('accountUsername');
const accountEmail = document.getElementById('accountEmail');
const accountPhone = document.getElementById('accountPhone');
const phoneStatus = document.getElementById('phoneStatus');
const logoutButton = document.getElementById('logoutButton');

// Get authenticated user.
async function loadDashboard() {
    try {
        const response = await fetch('/auth/me', {
            method: 'GET',
            credentials: 'same-origin'
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Unable to load account.');
        }
        const user = data.user;

        usernameElement.textContent = user.username;
        accountUsername.textContent = user.username;
        accountEmail.textContent = user.email;
        accountPhone.textContent = user.phone_number || 'Not provided';

        const verified = user.phone_verified === true;

        phoneStatus.textContent = verified ? 'Verified' : 'Not verified';
        phoneStatus.style.color = verified ? '#80d6a0' : '#ff7777';

    } catch (error) {
        console.error('Dashboard error:', error);

        usernameElement.textContent = 'Unavailable';
        accountUsername.textContent = 'Unavailable';
        accountEmail.textContent = 'Unavailable';
        accountPhone.textContent = 'Unavailable';
        phoneStatus.textContent = 'Unavailable';
    }
}

// Log out.
logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = 'Logging out...';

    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Logout failed.');
        }

        window.location.href = '/login';

    } catch (error) {
        console.error('Logout error:', error);

        alert('Unable to log out. Please try again.');

        logoutButton.disabled = false;
        logoutButton.textContent = 'Log out';
    }
});

loadDashboard();
