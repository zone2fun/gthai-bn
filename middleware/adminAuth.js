const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const protectAdmin = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Check if it's an admin token
            if (!decoded.isAdmin) {
                return res.status(403).json({ message: 'Not authorized as admin' });
            }

            // Get admin from token
            req.user = await Admin.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Admin not found' });
            }

            if (!req.user.isActive) {
                return res.status(403).json({ message: 'Admin account is deactivated' });
            }

            // Add role to request
            req.user.role = decoded.role;

            next();
        } catch (error) {
            console.error('Admin auth error:', error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// Middleware to check if user is super admin
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
};

// Middleware to check if user is admin or editor
const requireEditor = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'editor')) {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Editor or Admin role required.' });
    }
};

module.exports = { protectAdmin, requireAdmin, requireEditor };
