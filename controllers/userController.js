const User = require('../models/User');
const Post = require('../models/Post');
const { cloudinary } = require('../config/cloudinary');

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
            // Find users who have blocked the current user
            const usersWhoBlockedMe = await User.find({
                blockedUsers: currentUser._id
            }).select('_id');

            const blockedMeIds = usersWhoBlockedMe.map(u => u._id);

            // Filter out:
            // 1. Current user
            // 2. Users I blocked
            // 3. Users who blocked me
            query = {
                _id: {
                    $ne: currentUser._id,
                    $nin: [...currentUser.blockedUsers, ...blockedMeIds]
                }
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
        let currentUser = null;
        if (req.user) {
            currentUser = await User.findById(req.user._id);
        }

        let query = {};
        if (currentUser) {
            // Find users who have blocked the current user
            const usersWhoBlockedMe = await User.find({
                blockedUsers: currentUser._id
            }).select('_id');

            const blockedMeIds = usersWhoBlockedMe.map(u => u._id);

            // Filter out blocked users bidirectionally
            query = {
                _id: {
                    $ne: currentUser._id,
                    $nin: [...currentUser.blockedUsers, ...blockedMeIds]
                }
            };
        }

        const users = await User.find(query)
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
const bcrypt = require('bcryptjs');

// ... (existing imports and functions) ...

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

            if (req.body.isPublic !== undefined) {
                user.isPublic = req.body.isPublic === 'true' || req.body.isPublic === true;
            }

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

            // Handle private album updates
            let privateAlbumUrls = [];
            if (req.body.existingPrivateAlbum) {
                privateAlbumUrls = typeof req.body.existingPrivateAlbum === 'string'
                    ? req.body.existingPrivateAlbum.split(',').filter(url => url.trim())
                    : req.body.existingPrivateAlbum;
            }

            // Add new private album images (max 3 total)
            if (req.files && req.files.privateAlbum) {
                const newPrivateUrls = req.files.privateAlbum.map(file => file.path);
                privateAlbumUrls = [...privateAlbumUrls, ...newPrivateUrls];

                // Ensure max 3 photos
                if (privateAlbumUrls.length > 3) {
                    privateAlbumUrls = privateAlbumUrls.slice(0, 3);
                }
            }

            // Update user private album
            user.privateAlbum = privateAlbumUrls;

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
                privateAlbum: updatedUser.privateAlbum,
                isPublic: updatedUser.isPublic,
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

// @desc    Change user password
// @route   PUT /api/users/password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id);

        if (user && (await bcrypt.compare(currentPassword, user.password))) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
            await user.save();
            res.json({ message: 'Password updated successfully' });
        } else {
            res.status(401).json({ message: 'Invalid current password' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete user account
// @route   DELETE /api/users/profile
// @access  Private
const deleteAccount = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            // Helper function to extract public ID from Cloudinary URL
            const getPublicIdFromUrl = (url) => {
                if (!url) return null;
                try {
                    // Example: https://res.cloudinary.com/demo/image/upload/v1570979139/folder/sample.jpg
                    const parts = url.split('/');
                    const filename = parts[parts.length - 1];
                    const publicId = filename.split('.')[0];
                    // If there's a folder, we might need to include it.
                    // However, with multer-storage-cloudinary, the filename usually includes the folder if configured that way,
                    // OR we need to parse it more carefully.
                    // Let's assume standard Cloudinary URL structure where the public ID is after 'upload/v<version>/'

                    // Better approach: split by 'upload/' and take the second part
                    const splitUrl = url.split('upload/');
                    if (splitUrl.length < 2) return null;

                    const pathWithVersion = splitUrl[1];
                    // Remove version (e.g., v1234567890/)
                    const pathWithoutVersion = pathWithVersion.replace(/^v\d+\//, '');

                    // Remove extension
                    const publicIdWithFolder = pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf('.'));

                    return publicIdWithFolder;
                } catch (err) {
                    console.error('Error parsing public ID:', err);
                    return null;
                }
            };

            const publicIdsToDelete = [];

            // 1. User Profile Images
            if (user.img && !user.img.includes('user_avatar.png')) {
                const pid = getPublicIdFromUrl(user.img);
                if (pid) publicIdsToDelete.push(pid);
            }
            if (user.cover && !user.cover.includes('cover_default.png')) {
                const pid = getPublicIdFromUrl(user.cover);
                if (pid) publicIdsToDelete.push(pid);
            }
            if (user.gallery && user.gallery.length > 0) {
                user.gallery.forEach(imgUrl => {
                    const pid = getPublicIdFromUrl(imgUrl);
                    if (pid) publicIdsToDelete.push(pid);
                });
            }

            // 2. User Posts Images
            const userPosts = await Post.find({ user: user._id });
            userPosts.forEach(post => {
                if (post.image) {
                    const pid = getPublicIdFromUrl(post.image);
                    if (pid) publicIdsToDelete.push(pid);
                }
            });

            // 3. Delete from Cloudinary
            if (publicIdsToDelete.length > 0) {
                try {
                    // Cloudinary supports deleting multiple resources
                    await cloudinary.api.delete_resources(publicIdsToDelete);
                    console.log('Deleted images from Cloudinary:', publicIdsToDelete);
                } catch (cloudinaryErr) {
                    console.error('Error deleting images from Cloudinary:', cloudinaryErr);
                    // Continue with account deletion even if image deletion fails
                }
            }

            // 4. Delete User Posts
            await Post.deleteMany({ user: user._id });

            // 5. Delete User
            await User.deleteOne({ _id: user._id });

            res.json({ message: 'User and associated data removed' });
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
    updateUserProfile,
    changePassword,
    deleteAccount
};
