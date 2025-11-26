const express = require('express');
const router = express.Router();
const { createReport, getReports, updateReportStatus } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createReport);
router.get('/', protect, getReports); // TODO: Add admin middleware
router.put('/:id', protect, updateReportStatus); // TODO: Add admin middleware

module.exports = router;
