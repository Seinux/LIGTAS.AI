
const authMiddleware = (req, res, next) => {
    if (!req.session || !req.session.userId) {

        // Redirect browser page requests to login.
        if (req.accepts('html')) {
            return res.redirect('/login');
        }

        // Return JSON for API requests.
        return res.status(401).json({
            message: 'Unauthorized. Please log in first.'
        });
    }

    next();
};

module.exports = authMiddleware;
