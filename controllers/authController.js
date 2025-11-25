const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

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

module.exports = {
    registerUser,
    loginUser,
    getMe,
};
