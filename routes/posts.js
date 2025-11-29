const express = require('express');
const router = express.Router();
const { getPosts, getPostById, createPost, likePost, deletePost, addComment, deleteComment, approvePost } = require('../controllers/postController');
const { protect } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

router.get('/', protect, getPosts);
router.get('/:id', protect, getPostById);
router.post('/', protect, upload.single('image'), createPost);
router.put('/:id/like', protect, likePost);
router.put('/:id/approve', protect, approvePost); // Admin approve post
router.post('/:id/comment', protect, addComment);
router.delete('/:id/comment/:commentId', protect, deleteComment);
router.delete('/:id', protect, deletePost);

module.exports = router;
