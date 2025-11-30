const User = require('../models/User');

// @desc    Get all users with pagination and filters
// @route   GET /api/admin/users
// @access  Private (Admin/Editor)
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status = 'all', verified = 'all', hideFake = 'false' } = req.query;

        // Build query
        let query = {};

        // Filter fake users
        if (hideFake === 'true') {
            query.isFake = { $ne: true };
        }

        // Search by name, username, or email
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by status
        if (status !== 'all') {
            if (status === 'banned') {
                query.isBanned = true;
            } else if (status === 'online') {
                query.isOnline = true;
            } else if (status === 'active') {
                // Active users are those who are explicitly not banned OR where isBanned field doesn't exist/is false
                query.$or = [
                    { isBanned: false },
                    { isBanned: { $exists: false } },
                    { isBanned: null }
                ];
            }
        }

        // Filter by verified status
        if (verified !== 'all') {
            query.isVerified = verified === 'true';
        }

        // Filter by country
        if (req.query.country && req.query.country !== 'all') {
            if (req.query.country === 'United States') {
                query.country = { $regex: /^(United States|USA)$/i };
            } else {
                query.country = { $regex: new RegExp(`^${req.query.country}$`, 'i') };
            }
        }

        // Get total count
        const total = await User.countDocuments(query);

        // Get users with pagination
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user by ID
// @route   GET /api/admin/users/:id
// @access  Private (Admin/Editor)
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private (Admin/Editor)
const updateUser = async (req, res) => {
    try {
        const { name, email, bio, isVerified } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (bio !== undefined) user.bio = bio;
        if (isVerified !== undefined) user.isVerified = isVerified;

        await user.save();

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Ban/Unban user
// @route   PUT /api/admin/users/:id/ban
// @access  Private (Admin/Editor)
const toggleBanUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.isBanned = !user.isBanned;
        await user.save();

        res.json({
            message: user.isBanned ? 'User banned successfully' : 'User unbanned successfully',
            isBanned: user.isBanned
        });
    } catch (error) {
        console.error('Toggle ban user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await user.deleteOne();

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Private (Admin/Editor)
const getUserStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();

        // Active users = Not banned (false, null, or missing)
        const activeUsers = await User.countDocuments({
            $or: [
                { isBanned: false },
                { isBanned: { $exists: false } },
                { isBanned: null }
            ]
        });

        const bannedUsers = await User.countDocuments({ isBanned: true });
        const verifiedUsers = await User.countDocuments({ isVerified: true });
        const onlineUsers = await User.countDocuments({ isOnline: true });
        const fakeUsers = await User.countDocuments({ isFake: true });

        res.json({
            totalUsers,
            activeUsers,
            bannedUsers,
            verifiedUsers,
            onlineUsers,
            fakeUsers
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    toggleBanUser,
    deleteUser,
    getUserStats
};
