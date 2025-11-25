const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { getMessages, sendMessage, getConversations, deleteMessage } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getConversations);
router.get('/:userId', protect, getMessages);
router.post('/', protect, upload.single('image'), sendMessage);
router.put('/read', protect, require('../controllers/chatController').markAsRead);
router.delete('/:messageId', protect, deleteMessage);

module.exports = router;
