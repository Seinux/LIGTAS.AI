const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const state = {
    users: new Map(),
    verification: null,
    sentCodes: [],
    nextUserId: 1
};

const fakePool = {
    connect: async () => ({
        query: async (sql, values = []) => {
            const query = sql.replace(/\s+/g, ' ').trim();

            if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(query)) {
                return { rows: [], rowCount: 0 };
            }

            if (query.startsWith('SELECT * FROM phone_verifications')) {
                return {
                    rows: state.verification ? [{ ...state.verification }] : [],
                    rowCount: state.verification ? 1 : 0
                };
            }

            if (query.startsWith('UPDATE phone_verifications')) {
                state.verification.attempts += 1;
                return { rows: [], rowCount: 1 };
            }

            if (query.startsWith('UPDATE users SET phone_verified = TRUE')) {
                const user = state.users.get(String(values[0]));
                if (!user) return { rows: [], rowCount: 0 };

                user.phone_verified = true;
                return { rows: [{
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    phone_number: user.phone_number,
                    phone_verified: user.phone_verified
                }], rowCount: 1 };
            }

            if (query.startsWith('DELETE FROM phone_verifications')) {
                state.verification = null;
                return { rows: [], rowCount: 1 };
            }

            throw new Error(`Unexpected SQL in auth controller test: ${query}`);
        },
        release: () => {}
    })
};

const userModel = {
    findByEmail: async (email) => [...state.users.values()].find(
        (user) => user.email.toLowerCase() === email.toLowerCase()
    ) || null,
    findByPhone: async (phoneNumber) => {
        const user = [...state.users.values()].find(
            (entry) => entry.phone_number === phoneNumber
        );
        return user ? { id: user.id } : null;
    },
    findById: async (id) => state.users.get(String(id)) || null,
    createUser: async (username, email, phoneNumber, password) => {
        const id = String(state.nextUserId++);
        const user = {
            id,
            username,
            email,
            phone_number: phoneNumber,
            password,
            phone_verified: false
        };
        state.users.set(id, user);
        return { ...user, password: undefined };
    }
};

const phoneVerificationModel = {
    createOrUpdateOTP: async (userId, otpHash) => {
        state.verification = {
            id: '1',
            user_id: userId,
            otp_hash: otpHash,
            expires_at: new Date(Date.now() + 5 * 60 * 1000),
            attempts: 0,
            resend_count: 0,
            last_sent_at: new Date()
        };
        return state.verification;
    },
    findOTPByUserId: async () => state.verification
        ? { ...state.verification }
        : null,
    resendOTP: async (userId, otpHash) => {
        const record = state.verification;
        if (!record
            || String(record.user_id) !== String(userId)
            || Date.now() - new Date(record.last_sent_at).getTime() < 60000
            || record.resend_count >= 5) {
            return null;
        }

        record.otp_hash = otpHash;
        record.expires_at = new Date(Date.now() + 5 * 60 * 1000);
        record.attempts = 0;
        record.resend_count += 1;
        record.last_sent_at = new Date();
        return { ...record };
    }
};

const smsService = {
    sendVerificationCode: async (phoneNumber, otp) => {
        state.sentCodes.push({ phoneNumber, otp });
    }
};

const mockedModules = [
    [require.resolve('../config/database'), fakePool],
    [require.resolve('../model/User'), userModel],
    [require.resolve('../model/PhoneVerification'), phoneVerificationModel],
    [require.resolve('../services/smsService'), smsService]
];

const previousModules = new Map();
for (const [filename, exports] of mockedModules) {
    previousModules.set(filename, require.cache[filename]);
    const mockedModule = new Module(filename);
    mockedModule.filename = filename;
    mockedModule.loaded = true;
    mockedModule.exports = exports;
    require.cache[filename] = mockedModule;
}

const controllerPath = require.resolve('../controller/authController');
delete require.cache[controllerPath];
const authController = require('../controller/authController');

test.beforeEach(() => {
    state.users.clear();
    state.verification = null;
    state.sentCodes.length = 0;
    state.nextUserId = 1;
});

test.after(() => {
    delete require.cache[controllerPath];
    for (const [filename, previousModule] of previousModules) {
        if (previousModule) require.cache[filename] = previousModule;
        else delete require.cache[filename];
    }
});

const makeRequest = (body = {}, session = {}) => ({
    body,
    session: {
        ...session,
        save(callback) {
            callback(null);
        },
        regenerate(callback) {
            delete this.userId;
            delete this.pendingVerificationUserId;
            callback(null);
        }
    }
});

const makeResponse = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    }
});

const registration = {
    username: 'test_user',
    email: 'test@example.com',
    phoneNumber: '09171234567',
    password: 'a-strong-password'
};

test('registers, verifies, and logs in an account', async () => {
    const registerRequest = makeRequest(registration);
    const registerResponse = makeResponse();

    await authController.register(registerRequest, registerResponse);

    assert.equal(registerResponse.statusCode, 201);
    assert.equal(state.users.get('1').phone_number, '+639171234567');
    assert.equal(registerRequest.session.pendingVerificationUserId, '1');
    assert.equal(state.sentCodes.length, 1);

    const wrongCodeResponse = makeResponse();
    await authController.verifyOTP(
        makeRequest({ otp: '000000' }, registerRequest.session),
        wrongCodeResponse
    );
    assert.equal(wrongCodeResponse.statusCode, 400);
    assert.equal(state.verification.attempts, 1);

    const verifyResponse = makeResponse();
    await authController.verifyOTP(
        makeRequest({ otp: state.sentCodes[0].otp }, registerRequest.session),
        verifyResponse
    );
    assert.equal(verifyResponse.statusCode, 200);
    assert.equal(state.users.get('1').phone_verified, true);
    assert.equal(state.verification, null);

    const loginRequest = makeRequest({
        email: registration.email,
        password: registration.password
    });
    const loginResponse = makeResponse();
    await authController.login(loginRequest, loginResponse);

    assert.equal(loginResponse.statusCode, 200);
    assert.equal(loginRequest.session.userId, '1');
});

test('resumes an unverified registration and resends after expiry', async () => {
    const firstRegistrationResponse = makeResponse();
    await authController.register(
        makeRequest(registration),
        firstRegistrationResponse
    );
    state.verification.expires_at = new Date(Date.now() - 1000);
    state.verification.last_sent_at = new Date(Date.now() - 61000);

    const resumeRequest = makeRequest(registration);
    const resumeResponse = makeResponse();
    await authController.register(resumeRequest, resumeResponse);
    assert.equal(resumeResponse.statusCode, 200);

    const resendResponse = makeResponse();
    await authController.resendOTP(
        makeRequest({}, resumeRequest.session),
        resendResponse
    );
    assert.equal(resendResponse.statusCode, 200);
    assert.equal(state.sentCodes.length, 2);

    const verifyResponse = makeResponse();
    await authController.verifyOTP(
        makeRequest({ otp: state.sentCodes[1].otp }, resumeRequest.session),
        verifyResponse
    );
    assert.equal(verifyResponse.statusCode, 200);
});

test('repairs an unverified account with no pending OTP record', async () => {
    const initialResponse = makeResponse();
    await authController.register(makeRequest(registration), initialResponse);
    state.verification = null;

    const resumeRequest = makeRequest(registration);
    const resumeResponse = makeResponse();
    await authController.register(resumeRequest, resumeResponse);

    assert.equal(resumeResponse.statusCode, 200);
    assert.ok(state.verification);
    assert.equal(state.sentCodes.length, 2);

    const verifyResponse = makeResponse();
    await authController.verifyOTP(
        makeRequest({ otp: state.sentCodes[1].otp }, resumeRequest.session),
        verifyResponse
    );
    assert.equal(verifyResponse.statusCode, 200);
});

test('rejects login before phone verification', async () => {
    const registerResponse = makeResponse();
    await authController.register(
        makeRequest(registration),
        registerResponse
    );

    const loginResponse = makeResponse();
    await authController.login(
        makeRequest({
            email: registration.email,
            password: registration.password
        }),
        loginResponse
    );

    assert.equal(loginResponse.statusCode, 403);
});

test('allows resend after OTP attempt lockout', async () => {
    const registerResponse = makeResponse();
    const registerRequest = makeRequest(registration);
    await authController.register(registerRequest, registerResponse);

    for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = makeResponse();
        await authController.verifyOTP(
            makeRequest({ otp: '000000' }, registerRequest.session),
            response
        );
        assert.equal(response.statusCode, 400);
    }

    const lockedResponse = makeResponse();
    await authController.verifyOTP(
        makeRequest({ otp: '000000' }, registerRequest.session),
        lockedResponse
    );
    assert.equal(lockedResponse.statusCode, 429);
    assert.equal(state.verification.attempts, 5);

    state.verification.last_sent_at = new Date(Date.now() - 61000);
    const resendResponse = makeResponse();
    await authController.resendOTP(
        makeRequest({}, registerRequest.session),
        resendResponse
    );
    assert.equal(resendResponse.statusCode, 200);
    assert.equal(state.verification.attempts, 0);
});
