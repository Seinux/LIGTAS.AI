const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePhilippineMobileNumber } = require('../utils/phoneNumber');
const {
    getDeliveryMode,
    sendVerificationCode
} = require('../services/smsService');

test('normalizes Philippine mobile numbers to E.164', () => {
    assert.equal(
        normalizePhilippineMobileNumber('09171234567'),
        '+639171234567'
    );
    assert.equal(
        normalizePhilippineMobileNumber('+639171234567'),
        '+639171234567'
    );
});

test('rejects invalid Philippine mobile numbers', () => {
    assert.throws(
        () => normalizePhilippineMobileNumber('0212345678'),
        /valid Philippine mobile number/
    );
});

test('defaults to console delivery in development and Semaphore in production', () => {
    const previousMode = process.env.OTP_DELIVERY_MODE;
    const previousEnvironment = process.env.NODE_ENV;

    try {
        delete process.env.OTP_DELIVERY_MODE;
        process.env.NODE_ENV = 'development';
        assert.equal(getDeliveryMode(), 'console');

        process.env.NODE_ENV = 'production';
        assert.equal(getDeliveryMode(), 'semaphore');
    } finally {
        if (previousMode === undefined) delete process.env.OTP_DELIVERY_MODE;
        else process.env.OTP_DELIVERY_MODE = previousMode;

        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
    }
});

test('prevents console OTP delivery in production', async () => {
    const previousMode = process.env.OTP_DELIVERY_MODE;
    const previousEnvironment = process.env.NODE_ENV;

    try {
        process.env.OTP_DELIVERY_MODE = 'console';
        process.env.NODE_ENV = 'production';

        await assert.rejects(
            sendVerificationCode('+639171234567', '123456'),
            /not allowed in production/
        );
    } finally {
        if (previousMode === undefined) delete process.env.OTP_DELIVERY_MODE;
        else process.env.OTP_DELIVERY_MODE = previousMode;

        if (previousEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousEnvironment;
    }
});

test('requires a Semaphore API key before sending', async () => {
    const previousMode = process.env.OTP_DELIVERY_MODE;
    const previousApiKey = process.env.SEMAPHORE_API_KEY;

    try {
        process.env.OTP_DELIVERY_MODE = 'semaphore';
        delete process.env.SEMAPHORE_API_KEY;

        await assert.rejects(
            sendVerificationCode('+639171234567', '123456'),
            /SEMAPHORE_API_KEY is required/
        );
    } finally {
        if (previousMode === undefined) delete process.env.OTP_DELIVERY_MODE;
        else process.env.OTP_DELIVERY_MODE = previousMode;

        if (previousApiKey === undefined) delete process.env.SEMAPHORE_API_KEY;
        else process.env.SEMAPHORE_API_KEY = previousApiKey;
    }
});

test('sends Semaphore requests with the normalized recipient and OTP message', async () => {
    const previousMode = process.env.OTP_DELIVERY_MODE;
    const previousApiKey = process.env.SEMAPHORE_API_KEY;
    const previousSenderName = process.env.SEMAPHORE_SENDER_NAME;
    const previousFetch = global.fetch;

    try {
        process.env.OTP_DELIVERY_MODE = 'semaphore';
        process.env.SEMAPHORE_API_KEY = 'test-api-key';
        process.env.SEMAPHORE_SENDER_NAME = 'LIGTAS';
        global.fetch = async (url, options) => {
            assert.equal(url, 'https://api.semaphore.co/api/v4/messages');
            assert.equal(options.method, 'POST');

            const payload = new URLSearchParams(options.body);
            assert.equal(payload.get('apikey'), 'test-api-key');
            assert.equal(payload.get('number'), '639171234567');
            assert.equal(payload.get('sendername'), 'LIGTAS');
            assert.match(payload.get('message'), /123456/);

            return {
                ok: true,
                json: async () => [{ status: 'Pending' }]
            };
        };

        await sendVerificationCode('+639171234567', '123456');
    } finally {
        if (previousMode === undefined) delete process.env.OTP_DELIVERY_MODE;
        else process.env.OTP_DELIVERY_MODE = previousMode;

        if (previousApiKey === undefined) delete process.env.SEMAPHORE_API_KEY;
        else process.env.SEMAPHORE_API_KEY = previousApiKey;

        if (previousSenderName === undefined) delete process.env.SEMAPHORE_SENDER_NAME;
        else process.env.SEMAPHORE_SENDER_NAME = previousSenderName;

        global.fetch = previousFetch;
    }
});

test('reports Semaphore delivery failures', async () => {
    const previousMode = process.env.OTP_DELIVERY_MODE;
    const previousApiKey = process.env.SEMAPHORE_API_KEY;
    const previousFetch = global.fetch;

    try {
        process.env.OTP_DELIVERY_MODE = 'semaphore';
        process.env.SEMAPHORE_API_KEY = 'test-api-key';
        global.fetch = async () => ({
            ok: true,
            json: async () => [{ status: 'Failed' }]
        });

        await assert.rejects(
            sendVerificationCode('+639171234567', '123456'),
            /did not accept the OTP message/
        );
    } finally {
        if (previousMode === undefined) delete process.env.OTP_DELIVERY_MODE;
        else process.env.OTP_DELIVERY_MODE = previousMode;

        if (previousApiKey === undefined) delete process.env.SEMAPHORE_API_KEY;
        else process.env.SEMAPHORE_API_KEY = previousApiKey;

        global.fetch = previousFetch;
    }
});
