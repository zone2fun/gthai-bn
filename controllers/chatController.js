const Message = require('../models/Message');
const User = require('../models/User');

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
    }).sort({ createdAt: 1 });

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
    }

    if (!recipientId || (!text && !imageUrl)) {
        return res.status(400).json({ message: 'Invalid message data' });
    }

    const message = await Message.create({
        sender: senderId,
        recipient: recipientId,
        text,
        image: imageUrl
    });

    const fullMessage = await Message.findOne({ _id: message._id })
        .populate('sender', 'name img')
        .populate('recipient', 'name img');

    // Emit to recipient's room (convert ObjectId to string)
    const recipientRoomId = typeof recipientId === 'string' ? recipientId : recipientId.toString();
    req.io.to(recipientRoomId).emit('message received', fullMessage);

    res.status(201).json(fullMessage);
};

// @desc    Get all conversations for current user
// @route   GET /api/chat
// @access  Private
const getConversations = async (req, res) => {
    const myId = req.user._id;

    // Find all messages where user is sender or recipient
    const messages = await Message.find({
        $or: [{ sender: myId }, { recipient: myId }]
    }).sort({ createdAt: -1 }).populate('sender', 'name img isOnline').populate('recipient', 'name img isOnline');

    // Get unread counts
    const unreadMessages = await Message.find({
        recipient: myId,
        read: false
    });

    const unreadCounts = {};
    unreadMessages.forEach(msg => {
        const senderId = msg.sender.toString();
        unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
    });

    const conversations = [];
    const seenUsers = new Set();

    messages.forEach(msg => {
        const otherUser = msg.sender._id.toString() === myId.toString() ? msg.recipient : msg.sender;

        if (!seenUsers.has(otherUser._id.toString())) {
            seenUsers.add(otherUser._id.toString());
            conversations.push({
                user: otherUser,
                lastMessage: msg,
                unreadCount: unreadCounts[otherUser._id.toString()] || 0
            });
        }
    });

    res.json(conversations);
};

// @desc    Mark messages as read
// @route   PUT /api/chat/read
// @access  Private
const markAsRead = async (req, res) => {
    try {
        const { senderId } = req.body;
        const myId = req.user._id;

        await Message.updateMany(
            { sender: senderId, recipient: myId, read: false },
            { $set: { read: true } }
        );

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete a message
// @route   DELETE /api/chat/:messageId
// @access  Private
const deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Check if user is the sender
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        // Delete image from Cloudinary if exists
        if (message.image) {
            try {
                const { cloudinary } = require('../config/cloudinary');
                // Extract public_id from Cloudinary URL
                // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
                const urlParts = message.image.split('/');
                const fileWithExt = urlParts[urlParts.length - 1];
                const publicId = `gthai-mobile/${fileWithExt.split('.')[0]}`;

                await cloudinary.uploader.destroy(publicId);
            } catch (cloudinaryError) {
                console.error('Error deleting image from Cloudinary:', cloudinaryError);
                // Continue with message deletion even if Cloudinary deletion fails
            }
        }

        await Message.deleteOne({ _id: messageId });

        // Emit socket event to notify recipient
        req.io.to(message.recipient.toString()).emit('message deleted', { messageId });

        res.json({ message: 'Message deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getMessages,
    sendMessage,
    getConversations,
    deleteMessage,
    markAsRead
};
