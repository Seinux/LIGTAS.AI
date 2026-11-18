const getDeliveryMode = () => process.env.OTP_DELIVERY_MODE
    || (process.env.NODE_ENV === 'production' ? 'semaphore' : 'console');

const sendVerificationCode = async (phoneNumber, otp) => {
    const mode = getDeliveryMode();

    if (mode === 'console') {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Console OTP delivery is not allowed in production.');
        }

        console.info(`[OTP development only] ${phoneNumber}: ${otp}`);
        return;
    }

    if (mode !== 'semaphore') {
        throw new Error(`Unsupported OTP_DELIVERY_MODE: ${mode}`);
    }

    const apiKey = process.env.SEMAPHORE_API_KEY;

    if (!apiKey) {
        throw new Error('SEMAPHORE_API_KEY is required for Semaphore OTP delivery.');
    }

    const payload = new URLSearchParams({
        apikey: apiKey,
        number: phoneNumber.replace(/^\+/, ''),
        message: `LIGTAS.AI verification code: ${otp}. It expires in 5 minutes.`
    });

    if (process.env.SEMAPHORE_SENDER_NAME) {
        payload.set('sendername', process.env.SEMAPHORE_SENDER_NAME);
    }

    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: payload,
        signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
        throw new Error(`Semaphore rejected the OTP request (HTTP ${response.status}).`);
    }

    const messages = await response.json();

    if (!Array.isArray(messages)
        || messages.length === 0
        || messages.some((message) => message.status?.toLowerCase() === 'failed')) {
        throw new Error('Semaphore did not accept the OTP message.');
    }
};

module.exports = {
    getDeliveryMode,
    sendVerificationCode
};
