const express = require('express');
const router = express.Router();
const { createReport, getReports, updateReportStatus } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const { protectAdmin, requireEditor } = require('../middleware/adminAuth');

// User routes
router.post('/', protect, createReport);

// Admin routes
router.get('/', protectAdmin, requireEditor, getReports);
router.put('/:id', protectAdmin, requireEditor, updateReportStatus);

module.exports = router;
