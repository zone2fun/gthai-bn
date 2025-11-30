const express = require('express');
const router = express.Router();
const { loginAdmin, getAdminProfile, createAdmin, getPendingCounts, getPendingVerifications, approveVerification, denyVerification } = require('../controllers/adminController');
const {
    getAllUsers,
    getUserById,
    updateUser,
    toggleBanUser,
    deleteUser,
    getUserStats
} = require('../controllers/adminUserController');
const { getPendingPosts, approvePost, deletePostAdmin } = require('../controllers/postController');
const multer = require('multer');
const {
    getSettings,
    updateSetting,
    backupDatabase,
    restoreDatabase
} = require('../controllers/adminSettingsController');
const { protectAdmin, requireAdmin, requireEditor } = require('../middleware/adminAuth');

// Multer config for file upload
const upload = multer({ dest: 'uploads/' });

// Public routes
router.post('/login', loginAdmin);

// Protected routes - Admin Profile
router.get('/me', protectAdmin, getAdminProfile);
router.get('/pending-counts', protectAdmin, requireEditor, getPendingCounts);
router.post('/create', protectAdmin, requireAdmin, createAdmin);

// Protected routes - User Management (Admin & Editor)
router.get('/users/stats', protectAdmin, requireEditor, getUserStats);
router.get('/users', protectAdmin, requireEditor, getAllUsers);
router.get('/users/:id', protectAdmin, requireEditor, getUserById);
router.put('/users/:id', protectAdmin, requireEditor, updateUser);
router.put('/users/:id/ban', protectAdmin, requireEditor, toggleBanUser);
router.delete('/users/:id', protectAdmin, requireAdmin, deleteUser); // Only admin can delete

// Protected routes - Post Management (Admin & Editor)
router.get('/posts/pending', protectAdmin, requireEditor, getPendingPosts);
router.put('/posts/:id/approve', protectAdmin, requireEditor, approvePost);
router.delete('/posts/:id', protectAdmin, requireAdmin, deletePostAdmin);

// Protected routes - Verification Requests (Admin & Editor)
router.get('/verifications/pending', protectAdmin, requireEditor, getPendingVerifications);
router.put('/verifications/:id/approve', protectAdmin, requireEditor, approveVerification);
router.put('/verifications/:id/deny', protectAdmin, requireEditor, denyVerification);

// Protected routes - System Settings (Admin Only)
router.get('/settings', protectAdmin, requireAdmin, getSettings);
router.put('/settings', protectAdmin, requireAdmin, updateSetting);
router.get('/backup', protectAdmin, requireAdmin, backupDatabase);
router.post('/restore', protectAdmin, requireAdmin, upload.single('backup'), restoreDatabase);

module.exports = router;
