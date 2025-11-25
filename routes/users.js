const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { getAllUsers, getUserById, getFreshFaces, toggleFavorite, blockUser, unblockUser, getBlockedUsers, updateUserProfile } = require('../controllers/userController');
const { protect, optionalProtect } = require('../middleware/auth');

router.get('/', optionalProtect, getAllUsers);
router.get('/fresh-faces', optionalProtect, getFreshFaces);
router.put('/profile', protect, upload.fields([
    { name: 'img', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
    { name: 'gallery', maxCount: 5 }
]), updateUserProfile);
router.get('/blocked', protect, getBlockedUsers);
router.put('/:id/favorite', protect, toggleFavorite);
router.put('/:id/block', protect, blockUser);
router.put('/:id/unblock', protect, unblockUser);
router.get('/:id', protect, getUserById);

module.exports = router;
