// Authentication middleware

function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session || !req.session.userId || !req.session.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

function optionalAuth(req, res, next) {
    // Always proceed, but req.session.userId may be null
    next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth };
