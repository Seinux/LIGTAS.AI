
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    const loginButton = document.getElementById('loginButton');
    const loginMessage = document.getElementById('loginMessage');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        loginMessage.textContent = '';
        loginMessage.className = 'message';

        loginButton.disabled = true;
        loginButton.textContent = 'Signing in...';

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                loginMessage.textContent = data.message || 'Login failed.';
                loginMessage.classList.add('error');
                return;
            }

            loginMessage.textContent = 'Login successful!';
            loginMessage.classList.add('success');

            window.location.href = '/dashboard';

        } catch (error) {
            console.error('Login error:', error);

            loginMessage.textContent =
                'Unable to connect to the server. Please try again.';

            loginMessage.classList.add('error');

        } finally {
            loginButton.disabled = false;
            loginButton.textContent = 'Sign in';
        }
    });
}
