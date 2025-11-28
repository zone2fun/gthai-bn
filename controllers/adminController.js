const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id, role) => {
    return jwt.sign({ id, role, isAdmin: true }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Admin Login
// @route   POST /api/admin/login
// @access  Public
const loginAdmin = async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find admin by username
        const admin = await Admin.findOne({ username });

        if (!admin) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(403).json({ message: 'Account is deactivated' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, admin.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        // Return admin data with token
        res.json({
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            token: generateToken(admin._id, admin.role)
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Admin Profile
// @route   GET /api/admin/me
// @access  Private (Admin only)
const getAdminProfile = async (req, res) => {
    try {
        const admin = await Admin.findById(req.user.id).select('-password');

        if (!admin) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        res.json(admin);
    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Create Admin (Super Admin only)
// @route   POST /api/admin/create
// @access  Private (Admin only)
const createAdmin = async (req, res) => {
    const { username, password, email, name, role } = req.body;

    try {
        // Check if requester is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Only admins can create new admin users' });
        }

        // Check if admin already exists
        const adminExists = await Admin.findOne({ $or: [{ username }, { email }] });

        if (adminExists) {
            return res.status(400).json({ message: 'Admin with this username or email already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create admin
        const admin = await Admin.create({
            username,
            password: hashedPassword,
            email,
            name,
            role: role || 'editor'
        });

        res.status(201).json({
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            name: admin.name,
            role: admin.role
        });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    loginAdmin,
    getAdminProfile,
    createAdmin
};
