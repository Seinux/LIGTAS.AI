const PHILIPPINE_MOBILE_NUMBER = /^(09\d{9}|\+639\d{9})$/;

const normalizePhilippineMobileNumber = (phoneNumber) => {
    const value = String(phoneNumber).trim();

    if (!PHILIPPINE_MOBILE_NUMBER.test(value)) {
        throw new Error('Enter a valid Philippine mobile number.');
    }

    return value.startsWith('09')
        ? `+63${value.slice(1)}`
        : value;
};

module.exports = {
    normalizePhilippineMobileNumber
};
