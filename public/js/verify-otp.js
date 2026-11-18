
const otpForm = document.getElementById('otpForm');
const otpInput = document.getElementById('otp');
const otpMessage = document.getElementById('otpMessage');
const verifyButton = document.getElementById('verifyButton');
const resendButton = document.getElementById('resendButton');
const countdown = document.getElementById('countdown');

let countdownInterval;

function showMessage(message, type) {
    otpMessage.textContent = message;
    otpMessage.className = `message ${type}`;
}

function startCountdown(seconds = 60) {
    clearInterval(countdownInterval);

    resendButton.disabled = true;

    let remaining = seconds;

    countdown.textContent = `Resend available in ${remaining}s`;

    countdownInterval = setInterval(() => {
        remaining--;

        if (remaining <= 0) {
            clearInterval(countdownInterval);
            countdown.textContent = '';
            resendButton.disabled = false;
            return;
        }

        countdown.textContent = `Resend available in ${remaining}s`;
    }, 1000);
}

// Verify OTP
otpForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const otp = otpInput.value.trim();

    if (!/^\d{6}$/.test(otp)) {
        showMessage('Please enter a valid 6-digit OTP.', 'error');
        return;
    }

    verifyButton.disabled = true;
    verifyButton.textContent = 'Verifying...';

    try {
        const response = await fetch('/auth/verify-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ otp })
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.message, 'error');
            return;
        }

        showMessage(data.message, 'success');

        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);

    } catch (error) {
        console.error('OTP verification error:', error);
        showMessage('Something went wrong. Please try again.', 'error');

    } finally {
        verifyButton.disabled = false;
        verifyButton.textContent = 'Verify Phone Number';
    }
});

// Resend OTP
resendButton.addEventListener('click', async () => {
    resendButton.disabled = true;

    try {
        const response = await fetch('/auth/resend-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({})
        });

        const data = await response.json();

        if (!response.ok) {
            showMessage(data.message, 'error');

            if (response.status === 429) {
                startCountdown(60);
            } else {
                resendButton.disabled = false;
            }

            return;
        }

        showMessage(data.message, 'success');
        startCountdown(60);

    } catch (error) {
        console.error('Resend OTP error:', error);
        showMessage('Could not resend OTP. Please try again.', 'error');
        resendButton.disabled = false;
    }
});

// Initial resend cooldown
startCountdown(60);
