const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/adminAuth');
const {
    getPendingPhotos,
    approvePhoto,
    denyPhoto
} = require('../controllers/photoApprovalController');

// All routes require admin authentication
router.get('/pending', protectAdmin, getPendingPhotos);
router.post('/approve', protectAdmin, approvePhoto);
router.post('/deny', protectAdmin, denyPhoto);

module.exports = router;
