const User = require('../models/User');

// @desc    Get all users
// @route   GET /api/users
// @access  Private
// Helper to calculate distance in meters
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return Math.floor(d * 1000); // Return in meters
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

const getAllUsers = async (req, res) => {
    try {
        let currentUser = null;
        if (req.user) {
            currentUser = await User.findById(req.user._id);
        }

        let query = {};
        if (currentUser) {
            // Filter out blocked users and the current user
            query = {
                _id: { $ne: currentUser._id, $nin: currentUser.blockedUsers }
            };
        }

        const allUsers = await User.find(query).select('-password');

        if (!currentUser) {
            // If guest, just return all users (maybe shuffle or limit?)
            // For now, just return them
            return res.json(allUsers);
        }

        // Calculate distance for each user
        const usersWithDistance = allUsers.map(user => {
            const userObj = user.toObject();
            if (user._id.equals(currentUser._id)) {
                userObj.distance = 0;
            } else {
                if (currentUser.lat && currentUser.lng && user.lat && user.lng) {
                    userObj.distance = getDistanceFromLatLonInM(
                        currentUser.lat, currentUser.lng,
                        user.lat, user.lng
                    );
                } else {
                    userObj.distance = null;
                }
            }
            return userObj;
        });

        // Sort: Current user first, then by distance
        usersWithDistance.sort((a, b) => {
            if (a._id.toString() === currentUser._id.toString()) return -1;
            if (b._id.toString() === currentUser._id.toString()) return 1;
            // Put users with null distance at the end
            if (a.distance === null) return 1;
            if (b.distance === null) return -1;
            return a.distance - b.distance;
        });

        res.json(usersWithDistance);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get fresh faces (newest users)
// @route   GET /api/users/fresh-faces
// @access  Private
const getFreshFaces = async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password')
            .sort({ createdAt: -1 })
            .limit(20);
        res.json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
    try {
        if (!req.params.id || req.params.id === 'undefined') {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const user = await User.findById(req.params.id).select('-password');

        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Toggle favorite user
// @route   PUT /api/users/:id/favorite
// @access  Private
const toggleFavorite = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const targetUserId = req.params.id;

        if (user.favorites.includes(targetUserId)) {
            user.favorites = user.favorites.filter(id => id.toString() !== targetUserId);
            await user.save();
            res.json({ message: 'Removed from favorites', isFavorite: false });
        } else {
            user.favorites.push(targetUserId);
            await user.save();
            res.json({ message: 'Added to favorites', isFavorite: true });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Block user
// @route   PUT /api/users/:id/block
// @access  Private
const blockUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const targetUserId = req.params.id;

        if (!user.blockedUsers.includes(targetUserId)) {
            user.blockedUsers.push(targetUserId);
            // Also remove from favorites if blocked
            user.favorites = user.favorites.filter(id => id.toString() !== targetUserId);
            await user.save();
        }

        res.json({ message: 'User blocked' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Unblock user
// @route   PUT /api/users/:id/unblock
// @access  Private
const unblockUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const targetUserId = req.params.id;

        if (user.blockedUsers.includes(targetUserId)) {
            user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetUserId);
            await user.save();
        }

        res.json({ message: 'User unblocked' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get blocked users
// @route   GET /api/users/blocked
// @access  Private
const getBlockedUsers = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('blockedUsers', 'name username img');
        res.json(user.blockedUsers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.age = req.body.age || user.age;
            user.height = req.body.height || user.height;
            user.weight = req.body.weight || user.weight;
            user.country = req.body.country || user.country;

            if (req.body.lookingFor) {
                // Handle lookingFor as array (it might come as string from form data)
                user.lookingFor = Array.isArray(req.body.lookingFor)
                    ? req.body.lookingFor
                    : req.body.lookingFor.split(',').map(item => item.trim());
            }

            if (req.body.bio !== undefined) {
                user.bio = req.body.bio;
            }

            // Handle img and cover uploads
            if (req.files) {
                if (req.files.img) {
                    user.img = req.files.img[0].path;
                }
                if (req.files.cover) {
                    user.cover = req.files.cover[0].path;
                }
            }

            // Handle gallery updates
            // Start with existing gallery URLs (if provided)
            let galleryUrls = [];
            if (req.body.existingGallery) {
                galleryUrls = typeof req.body.existingGallery === 'string'
                    ? req.body.existingGallery.split(',').filter(url => url.trim())
                    : req.body.existingGallery;
            }

            // Add new gallery images
            if (req.files && req.files.gallery) {
                const newGalleryUrls = req.files.gallery.map(file => file.path);
                galleryUrls = [...galleryUrls, ...newGalleryUrls];
            }

            // Update user gallery
            user.gallery = galleryUrls;

            const updatedUser = await user.save();

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                username: updatedUser.username,
                img: updatedUser.img,
                cover: updatedUser.cover,
                age: updatedUser.age,
                height: updatedUser.height,
                weight: updatedUser.weight,
                country: updatedUser.country,
                lookingFor: updatedUser.lookingFor,
                bio: updatedUser.bio,
                gallery: updatedUser.gallery,
                token: req.headers.authorization.split(' ')[1] // Return same token
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    getFreshFaces,
    toggleFavorite,
    blockUser,
    unblockUser,
    getBlockedUsers,
    updateUserProfile
};
