const Message = require('../models/Message');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/pushNotification');

// @desc    Get messages between two users
// @route   GET /api/chat/:userId
// @access  Private
const getMessages = async (req, res) => {
    const { userId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
        $or: [
            { sender: myId, recipient: userId },
            { sender: userId, recipient: myId }
        ]
    }).sort({ createdAt: 1 }).populate('relatedId');

    res.json(messages);
};

// @desc    Send a message
// @route   POST /api/chat
// @access  Private
const sendMessage = async (req, res) => {
    const { recipientId, text } = req.body;
    const senderId = req.user._id;

    let imageUrl = null;
    if (req.file) {
        imageUrl = req.file.path; // Cloudinary URL
    } else if (req.body.image) {
        imageUrl = req.body.image; // Image URL sent from client
    }

    if (!recipientId || (!text && !imageUrl)) {
        return res.status(400).json({ message: 'Invalid message data' });
    }

    const message = await Message.create({
        sender: senderId,
        recipient: recipientId,
        text,
        image: imageUrl,
        ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    });

    const fullMessage = await Message.findOne({ _id: message._id })
        .populate('sender', 'name img')
        .populate('recipient', 'name img');

    // Emit to recipient's room (convert ObjectId to string)
    const recipientRoomId = typeof recipientId === 'string' ? recipientId : recipientId.toString();
    if (req.io) {
        req.io.to(recipientRoomId).emit('message received', fullMessage);
    }

    // Send Push Notification
    await sendPushNotification(
        recipientId,
        req.user.name,
        text || 'Sent an image',
        { type: 'message', conversationId: senderId.toString(), senderId: senderId.toString() }
    );

    res.status(201).json(fullMessage);
};

// @desc    Get all conversations for current user
// ... (rest of getConversations, no change) ...

// ... (markAsRead, deleteMessage, no change) ...

module.exports = {
    getMessages,
    sendMessage,
    getConversations,
    deleteMessage,
    markAsRead
};
