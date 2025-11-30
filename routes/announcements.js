const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { protectAdmin } = require('../middleware/adminAuth');
const { upload } = require('../config/cloudinary');
const {
    getAnnouncements,
    getActiveAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    trackClick
} = require('../controllers/announcementController');

// Public/User routes
router.get('/active', protect, getActiveAnnouncements);
router.post('/:id/click', protect, trackClick);

// Admin routes
router.get('/', protectAdmin, getAnnouncements);
router.post('/', protectAdmin, upload.single('image'), createAnnouncement);
router.put('/:id', protectAdmin, upload.single('image'), updateAnnouncement);
router.delete('/:id', protectAdmin, deleteAnnouncement);

module.exports = router;
