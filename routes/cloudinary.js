const express = require('express');
const router = express.Router();
const { getCloudinarySignature } = require('../controllers/cloudinaryController');
const { protect } = require('../middleware/auth');

router.get('/signature', protect, getCloudinarySignature);

module.exports = router;
