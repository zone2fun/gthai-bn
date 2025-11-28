const express = require('express');
const router = express.Router();
const { loginAdmin, getAdminProfile, createAdmin } = require('../controllers/adminController');
const {
    getAllUsers,
    getUserById,
    updateUser,
    toggleBanUser,
    deleteUser,
    getUserStats
} = require('../controllers/adminUserController');
const { protectAdmin, requireAdmin, requireEditor } = require('../middleware/adminAuth');

// Public routes
router.post('/login', loginAdmin);

// Protected routes - Admin Profile
router.get('/me', protectAdmin, getAdminProfile);
router.post('/create', protectAdmin, requireAdmin, createAdmin);

// Protected routes - User Management (Admin & Editor)
router.get('/users/stats', protectAdmin, requireEditor, getUserStats);
router.get('/users', protectAdmin, requireEditor, getAllUsers);
router.get('/users/:id', protectAdmin, requireEditor, getUserById);
router.put('/users/:id', protectAdmin, requireEditor, updateUser);
router.put('/users/:id/ban', protectAdmin, requireEditor, toggleBanUser);
router.delete('/users/:id', protectAdmin, requireAdmin, deleteUser); // Only admin can delete

module.exports = router;
