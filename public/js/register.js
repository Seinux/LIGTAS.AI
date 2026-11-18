
const registerForm = document.getElementById('registerForm');

if (registerForm) {
    const registerButton = document.getElementById('registerButton');
    const registerMessage = document.getElementById('registerMessage');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const phoneNumber = document.getElementById('phoneNumber').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        registerMessage.textContent = '';
        registerMessage.className = 'message';

        if (password !== confirmPassword) {
            registerMessage.textContent = 'Passwords do not match.';
            registerMessage.classList.add('error');
            return;
        }

        registerButton.disabled = true;
        registerButton.textContent = 'Creating account...';

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    username,
                    email,
                    phoneNumber,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                registerMessage.textContent =
                    data.message || 'Registration failed.';

                registerMessage.classList.add('error');
                return;
            }

            sessionStorage.setItem('pendingUserId', data.user.id);

            window.location.href = '/verify-otp';

        } catch (error) {
            console.error('Registration error:', error);

            registerMessage.textContent =
                'Unable to connect to the server. Please try again.';

            registerMessage.classList.add('error');

        } finally {
            registerButton.disabled = false;
            registerButton.textContent = 'Create account';
        }
    });
}
