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
        lng
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

    // Check for user email
    const user = await User.findOne({ username });

    if (user && (await bcrypt.compare(password, user.password))) {
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

        if (user) {
            // User exists, log them in
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

            // Random location around Bangkok
            const lat = 13.7563 + (Math.random() - 0.5) * 0.1;
            const lng = 100.5018 + (Math.random() - 0.5) * 0.1;

            user = await User.create({
                username,
                password: hashedPassword,
                email,
                name,
                img: picture,
                lat,
                lng,
                isOnline: true
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

module.exports = {
    registerUser,
    loginUser,
    getMe,
    googleLogin
};
