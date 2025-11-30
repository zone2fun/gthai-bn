const express = require('express');
const router = express.Router();
const { getPublicSettings } = require('../controllers/adminSettingsController');

// Public routes
router.get('/public', getPublicSettings);

module.exports = router;
