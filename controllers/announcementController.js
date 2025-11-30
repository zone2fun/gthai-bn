const Announcement = require('../models/Announcement');
const { cloudinary } = require('../config/cloudinary');

// @desc    Get all announcements (Admin)
// @route   GET /api/announcements
// @access  Private/Admin
const getAnnouncements = async (req, res) => {
    try {
        const announcements = await Announcement.find({}).sort({ createdAt: -1 });
        res.json(announcements);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get active announcements (Public/User)
// @route   GET /api/announcements/active
// @access  Private
const getActiveAnnouncements = async (req, res) => {
    try {
        const now = new Date();
        const announcements = await Announcement.find({
            isActive: true,
            startTime: { $lte: now }
        }).sort({ startTime: -1 });
        res.json(announcements);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create announcement
// @route   POST /api/announcements
// @access  Private/Admin
const createAnnouncement = async (req, res) => {
    try {
        const { title, content, link, startTime, isActive } = req.body;
        let imageUrl = null;

        if (req.file) {
            imageUrl = req.file.path;
        }

        if (!imageUrl) {
            return res.status(400).json({ message: 'Image is required for background' });
        }

        const announcement = await Announcement.create({
            title,
            content,
            image: imageUrl,
            link,
            startTime: startTime || new Date(),
            isActive: isActive === 'true' || isActive === true
        });

        res.status(201).json(announcement);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update announcement
// @route   PUT /api/announcements/:id
// @access  Private/Admin
const updateAnnouncement = async (req, res) => {
    try {
        const { title, content, link, startTime, isActive } = req.body;
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        let imageUrl = announcement.image;

        if (req.file) {
            // Delete old image
            if (announcement.image) {
                try {
                    const urlParts = announcement.image.split('/');
                    const fileWithExt = urlParts[urlParts.length - 1];
                    const publicId = `gthai-mobile/${fileWithExt.split('.')[0]}`;
                    await cloudinary.uploader.destroy(publicId);
                } catch (err) {
                    console.error('Error deleting old image', err);
                }
            }
            imageUrl = req.file.path;
        }

        announcement.title = title || announcement.title;
        announcement.content = content || announcement.content;
        announcement.image = imageUrl;
        announcement.link = link !== undefined ? link : announcement.link;
        announcement.startTime = startTime || announcement.startTime;
        if (isActive !== undefined) {
            announcement.isActive = isActive === 'true' || isActive === true;
        }

        const updatedAnnouncement = await announcement.save();
        res.json(updatedAnnouncement);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private/Admin
const deleteAnnouncement = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        // Delete image from cloudinary
        if (announcement.image) {
            try {
                const urlParts = announcement.image.split('/');
                const fileWithExt = urlParts[urlParts.length - 1];
                const publicId = `gthai-mobile/${fileWithExt.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error('Error deleting image from Cloudinary', err);
            }
        }

        await announcement.deleteOne();
        res.json({ message: 'Announcement removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Track click
// @route   POST /api/announcements/:id/click
// @access  Private
const trackClick = async (req, res) => {
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        announcement.clickCount += 1;
        await announcement.save();

        res.json({ clickCount: announcement.clickCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getAnnouncements,
    getActiveAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    trackClick
};
