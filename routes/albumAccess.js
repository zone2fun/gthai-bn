const express = require('express');
const router = express.Router();
const {
    requestAlbumAccess,
    getAlbumAccessRequests,
    updateAlbumAccessRequest,
    checkAlbumAccess
} = require('../controllers/albumAccessController');
const { protect } = require('../middleware/auth');

router.post('/request/:userId', protect, requestAlbumAccess);
router.get('/requests', protect, getAlbumAccessRequests);
router.put('/requests/:requestId', protect, updateAlbumAccessRequest);
router.get('/check/:userId', protect, checkAlbumAccess);

module.exports = router;
