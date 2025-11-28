const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Get all pending photos
// @route   GET /api/admin/photos/pending
// @access  Private/Admin
const getPendingPhotos = async (req, res) => {
    try {
        // Find users with pending photos
        const usersWithPendingPhotos = await User.find({
            $or: [
                { pendingImg: { $ne: null } },
                { pendingCover: { $ne: null } },
                { pendingGallery: { $exists: true, $ne: [] } }
            ]
        }).select('_id username name img pendingImg pendingCover pendingGallery');

        // Transform data to flat list of pending photos
        const pendingPhotos = [];

        usersWithPendingPhotos.forEach(user => {
            // Add pending avatar
            if (user.pendingImg) {
                pendingPhotos.push({
                    _id: `${user._id}_img`,
                    userId: user._id,
                    username: user.username,
                    name: user.name,
                    photoUrl: user.pendingImg,
                    photoType: 'avatar',
                    uploadedAt: user.updatedAt
                });
            }

            // Add pending cover
            if (user.pendingCover) {
                pendingPhotos.push({
                    _id: `${user._id}_cover`,
                    userId: user._id,
                    username: user.username,
                    name: user.name,
                    photoUrl: user.pendingCover,
                    photoType: 'cover',
                    uploadedAt: user.updatedAt
                });
            }

            // Add pending gallery photos
            if (user.pendingGallery && user.pendingGallery.length > 0) {
                user.pendingGallery.forEach((photoUrl, index) => {
                    pendingPhotos.push({
                        _id: `${user._id}_gallery_${index}`,
                        userId: user._id,
                        username: user.username,
                        name: user.name,
                        photoUrl: photoUrl,
                        photoType: 'gallery',
                        uploadedAt: user.updatedAt
                    });
                });
            }
        });

        // Sort by most recent
        pendingPhotos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

        res.json(pendingPhotos);
    } catch (error) {
        console.error('Error fetching pending photos:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Approve a photo
// @route   POST /api/admin/photos/approve
// @access  Private/Admin
const approvePhoto = async (req, res) => {
    try {
        const { userId, photoType, photoUrl } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let photoTypeLabel = '';
        if (photoType === 'avatar' && user.pendingImg === photoUrl) {
            user.img = user.pendingImg;
            user.pendingImg = null;
            photoTypeLabel = 'Avatar';
        } else if (photoType === 'cover' && user.pendingCover === photoUrl) {
            user.cover = user.pendingCover;
            user.pendingCover = null;
            photoTypeLabel = 'Cover Photo';
        } else if (photoType === 'gallery') {
            // Find the photo in pending gallery
            const photoIndex = user.pendingGallery.indexOf(photoUrl);
            if (photoIndex !== -1) {
                // Add to approved gallery
                user.gallery.push(photoUrl);
                // Remove from pending
                user.pendingGallery.splice(photoIndex, 1);
                photoTypeLabel = 'Gallery Photo';
            }
        }

        await user.save();

        // Create Notification
        const notification = await Notification.create({
            recipient: userId,
            type: 'photo_approved',
            message: `Your ${photoTypeLabel} has been approved!`
        });

        // Send real-time notification to user via socket.io
        if (req.io) {
            // Emit to specific user for notification
            req.io.to(userId.toString()).emit('new notification', notification);

            // Broadcast photo approved event so everyone sees the new avatar immediately
            req.io.emit('photo approved', {
                userId: userId,
                photoType: photoTypeLabel,
                photoUrl: photoUrl,
                message: `Your ${photoTypeLabel} has been approved!`
            });
        }

        res.json({ message: 'Photo approved successfully' });
    } catch (error) {
        console.error('Error approving photo:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Deny a photo
// @route   POST /api/admin/photos/deny
// @access  Private/Admin
const denyPhoto = async (req, res) => {
    try {
        const { userId, photoType, photoUrl } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        let photoTypeLabel = '';
        if (photoType === 'avatar' && user.pendingImg === photoUrl) {
            user.pendingImg = null;
            photoTypeLabel = 'Avatar';
        } else if (photoType === 'cover' && user.pendingCover === photoUrl) {
            user.pendingCover = null;
            photoTypeLabel = 'Cover Photo';
        } else if (photoType === 'gallery') {
            // Find and remove the photo from pending gallery
            const photoIndex = user.pendingGallery.indexOf(photoUrl);
            if (photoIndex !== -1) {
                user.pendingGallery.splice(photoIndex, 1);
                photoTypeLabel = 'Gallery Photo';
            }
        }

        await user.save();

        // Create Notification
        const notification = await Notification.create({
            recipient: userId,
            type: 'photo_denied',
            message: `Your ${photoTypeLabel} was not approved.`
        });

        // Send real-time notification to user via socket.io
        if (req.io) {
            req.io.to(userId.toString()).emit('new notification', notification);
            // Also emit photo denied event for profile refresh
            req.io.to(userId.toString()).emit('photo denied', {
                photoType: photoTypeLabel,
                photoUrl: photoUrl,
                message: `Your ${photoTypeLabel} was not approved.`
            });
        }

        res.json({ message: 'Photo denied successfully' });
    } catch (error) {
        console.error('Error denying photo:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getPendingPhotos,
    approvePhoto,
    denyPhoto
};
