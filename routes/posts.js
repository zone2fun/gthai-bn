const express = require('express');
const router = express.Router();
const { getPosts, createPost, likePost, deletePost, addComment } = require('../controllers/postController');
const { protect } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

router.get('/', protect, getPosts);
router.post('/', protect, upload.single('image'), createPost);
router.put('/:id/like', protect, likePost);
router.post('/:id/comment', protect, addComment);
router.delete('/:id', protect, deletePost);

module.exports = router;
