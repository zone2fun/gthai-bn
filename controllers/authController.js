const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { username, password, email, name, age, height, weight, country } = req.body;

    if (!username || !password || !email || !name) {
        return res.status(400).json({ message: 'Please add all required fields' });
    }

    // Validation
    if (username.length < 8) {
        return res.status(400).json({ message: 'Username must be at least 8 characters' });
    }
    if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }
    if (name.length < 3) {
        return res.status(400).json({ message: 'Display name must be at least 3 characters' });
    }
    if (!email.includes('@')) {
        return res.status(400).json({ message: 'Please enter a valid email' });
    }

    // Check if user exists
    const userExists = await User.findOne({ $or: [{ username }, { email }] });

    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Use provided location or randomize around Bangkok
    let lat = req.body.lat;
    let lng = req.body.lng;

    if (!lat || !lng) {
        // +/- 0.05 degrees is roughly 5-6 km
        lat = 13.7563 + (Math.random() - 0.5) * 0.1;
        lng = 100.5018 + (Math.random() - 0.5) * 0.1;
    }

    // Get IP address
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Create user
    const user = await User.create({
        username,
        password: hashedPassword,
        email,
        name,
        age,
        height,
        weight,
        country,
        lat,
        lng,
        registrationIp: ip,
        lastLoginIp: ip
    });

    if (user) {
        res.status(201).json({
            _id: user.id,
            name: user.name,
            username: user.username,
            img: user.img,
            token: generateToken(user._id)
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { username, password } = req.body;

    // Check for user by username OR email
    const user = await User.findOne({
        $or: [
            { username: username },
            { email: username } // Allow login with email in username field
        ]
    });

    if (user && (await bcrypt.compare(password, user.password))) {
        // Update last login IP
        user.lastLoginIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await user.save();

        res.json({
            _id: user.id,
            name: user.name,
            username: user.username,
            img: user.img,
            token: generateToken(user._id)
        });
    } else {
        res.status(400).json({ message: 'Invalid credentials' });
    }
};

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    res.status(200).json(req.user);
};

// @desc    Google Login
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
    const { token } = req.body;

    try {
        // Verify access token and get user info using fetch
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API Error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const { name, email, picture } = data;

        // Check if user exists
        let user = await User.findOne({ email });

        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (user) {
            // User exists, log them in
            user.lastLoginIp = ip;
            await user.save();

            res.json({
                _id: user.id,
                name: user.name,
                username: user.username,
                img: user.img,
                token: generateToken(user._id)
            });
        } else {
            // User doesn't exist, create new user
            // Generate random password
            const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            // Generate unique username
            let username = email.split('@')[0];
            const checkUsername = await User.findOne({ username });
            if (checkUsername) {
                username += Math.floor(Math.random() * 1000);
            }
            if (username.length < 8) {
                username += Math.floor(Math.random() * 10000); // Ensure min length
            }

            // Use provided location or random location around Bangkok
            let lat, lng;
            if (req.body.lat && req.body.lng) {
                lat = req.body.lat;
                lng = req.body.lng;
            } else {
                // Random location around Bangkok as fallback
                lat = 13.7563 + (Math.random() - 0.5) * 0.1;
                lng = 100.5018 + (Math.random() - 0.5) * 0.1;
            }

            user = await User.create({
                username,
                password: hashedPassword,
                email,
                name,
                img: picture,
                lat,
                lng,
                isOnline: true,
                registrationIp: ip,
                lastLoginIp: ip
            });

            res.status(201).json({
                _id: user.id,
                name: user.name,
                username: user.username,
                img: user.img,
                token: generateToken(user._id)
            });
        }
    } catch (error) {
        console.error('Google Login Error:', error);
        res.status(400).json({ message: 'Google Login Failed', error: error.message });
    }
};

// @desc    Request password reset
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'No account with that email exists' });
        }

        // Generate reset token (random string)
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash token and save to user
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send email (you'll need to set up email service)
        const { sendPasswordResetEmail } = require('../services/emailService');
        const emailResult = await sendPasswordResetEmail(user.email, resetToken, user.name);

        if (emailResult.success) {
            res.json({ message: 'Password reset email sent' });
        } else {
            res.status(500).json({ message: 'Error sending email. Please try again later.' });
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        if (!password || password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters' });
        }

        // Hash the token from URL
        const crypto = require('crypto');
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // Clear reset token fields
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    getMe,
    googleLogin,
    forgotPassword,
    resetPassword
};
