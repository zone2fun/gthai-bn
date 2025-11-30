const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { getAllUsers, getUserById, getFreshFaces, toggleFavorite, blockUser, unblockUser, getBlockedUsers, updateUserProfile, changePassword, deleteAccount } = require('../controllers/userController');
const { protect, optionalProtect } = require('../middleware/auth');

router.get('/', optionalProtect, getAllUsers);
router.get('/fresh-faces', optionalProtect, getFreshFaces);
router.put('/profile', protect, upload.fields([
    { name: 'img', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'gallery', maxCount: 5 },
    { name: 'privateAlbum', maxCount: 3 }
]), updateUserProfile);
router.put('/password', protect, changePassword);
router.delete('/profile', protect, deleteAccount);
router.post('/verification-request', protect, upload.single('verificationImage'), require('../controllers/userController').submitVerificationRequest);
router.get('/blocked', protect, getBlockedUsers);
router.put('/location', protect, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const User = require('../models/User');

        // Validate coordinates
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({ message: 'Invalid coordinates' });
        }

        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ message: 'Coordinates out of range' });
        }

        // Update user location
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                lat: latitude,
                lng: longitude,
                locationLastUpdated: new Date()
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'Location updated successfully',
            location: {
                lat: user.lat,
                lng: user.lng,
                lastUpdated: user.locationLastUpdated
            }
        });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
router.get('/nearby', protect, async (req, res) => {
    try {
        const { radius = 10 } = req.query; // Default 10km radius
        const User = require('../models/User');
        const { calculateDistance } = require('../utils/distance');

        const currentUser = await User.findById(req.user._id);

        if (!currentUser.lat || !currentUser.lng) {
            return res.status(400).json({ message: 'Location not set. Please enable location tracking.' });
        }

        // Find users who have blocked the current user
        const usersWhoBlockedMe = await User.find({
            blockedUsers: currentUser._id
        }).select('_id');

        const blockedMeIds = usersWhoBlockedMe.map(u => u._id);

        // Find all users with location data (excluding current user, blocked users, and users who blocked me)
        const users = await User.find({
            _id: {
                $ne: req.user._id,
                $nin: [...currentUser.blockedUsers, ...blockedMeIds]
            },
            lat: { $exists: true, $ne: null },
            lng: { $exists: true, $ne: null }
        }).select('-password');

        // Calculate distance and filter by radius
        const nearbyUsers = users
            .map(user => {
                const distance = calculateDistance(
                    currentUser.lat,
                    currentUser.lng,
                    user.lat,
                    user.lng
                );
                return {
                    ...user.toObject(),
                    distance: parseFloat(distance.toFixed(2))
                };
            })
            .filter(user => user.distance <= parseFloat(radius))
            .sort((a, b) => a.distance - b.distance); // Sort by distance (nearest first)

        res.json({
            count: nearbyUsers.length,
            radius: parseFloat(radius),
            users: nearbyUsers
        });
    } catch (error) {
        console.error('Error finding nearby users:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
router.put('/:id/favorite', protect, toggleFavorite);
router.put('/:id/block', protect, blockUser);
router.put('/:id/unblock', protect, unblockUser);
router.get('/:id', optionalProtect, getUserById);

module.exports = router;
