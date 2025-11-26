const AlbumAccessRequest = require('../models/AlbumAccessRequest');
const User = require('../models/User');

// @desc    Request access to user's private album
// @route   POST /api/album-access/request/:userId
// @access  Private
const requestAlbumAccess = async (req, res) => {
    try {
        const ownerId = req.params.userId;
        const requesterId = req.user._id;

        if (ownerId === requesterId.toString()) {
            return res.status(400).json({ message: 'Cannot request access to your own album' });
        }

        // Check if owner exists
        const owner = await User.findById(ownerId);
        if (!owner) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if already has access
        if (owner.albumAccessGranted && owner.albumAccessGranted.includes(requesterId)) {
            return res.status(400).json({ message: 'You already have access to this album' });
        }

        // Check if request already exists
        let request = await AlbumAccessRequest.findOne({
            requester: requesterId,
            owner: ownerId
        });

        if (request) {
            if (request.status === 'pending') {
                return res.status(400).json({ message: 'Request already pending' });
            } else if (request.status === 'rejected') {
                // Update existing rejected request to pending
                request.status = 'pending';
                await request.save();
            }
        } else {
            // Create new request
            request = await AlbumAccessRequest.create({
                requester: requesterId,
                owner: ownerId
            });
        }

        const populatedRequest = await AlbumAccessRequest.findById(request._id)
            .populate('requester', 'name img')
            .populate('owner', 'name img');

        // Create chat message
        const Message = require('../models/Message');
        const message = await Message.create({
            sender: requesterId,
            recipient: ownerId,
            type: 'request_album_access',
            relatedId: request._id,
            relatedModel: 'AlbumAccessRequest',
            text: 'ขอสิทธิ์เข้าถึงอัลบั้มส่วนตัว'
        });

        // Emit socket event for new message
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'name img')
            .populate('recipient', 'name img');

        req.io.to(ownerId).emit('new message', populatedMessage);
        req.io.to(requesterId.toString()).emit('new message', populatedMessage);

        // Emit socket event to owner for request
        req.io.to(ownerId).emit('album access request', populatedRequest);

        res.status(201).json(populatedRequest);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get album access requests for current user
// @route   GET /api/album-access/requests
// @access  Private
const getAlbumAccessRequests = async (req, res) => {
    try {
        const requests = await AlbumAccessRequest.find({
            owner: req.user._id,
            status: 'pending'
        })
            .populate('requester', 'name img')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Approve or reject album access request
// @route   PUT /api/album-access/requests/:requestId
// @access  Private
const updateAlbumAccessRequest = async (req, res) => {
    try {
        const { status } = req.body; // 'approved' or 'rejected'

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const request = await AlbumAccessRequest.findById(req.params.requestId);

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        // Check if current user is the owner
        if (request.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        request.status = status;
        await request.save();

        // If approved, add requester to albumAccessGranted
        if (status === 'approved') {
            await User.findByIdAndUpdate(req.user._id, {
                $addToSet: { albumAccessGranted: request.requester }
            });
        }

        const populatedRequest = await AlbumAccessRequest.findById(request._id)
            .populate('requester', 'name img')
            .populate('owner', 'name img');

        // Create chat message for response
        const Message = require('../models/Message');
        const message = await Message.create({
            sender: req.user._id,
            recipient: request.requester,
            type: 'album_access_response',
            relatedId: request._id,
            relatedModel: 'AlbumAccessRequest',
            text: status === 'approved' ? 'อนุมัติคำขอเข้าถึงอัลบั้มแล้ว' : 'ปฏิเสธคำขอเข้าถึงอัลบั้ม'
        });

        // Emit socket event for new message
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'name img')
            .populate('recipient', 'name img');

        req.io.to(request.requester.toString()).emit('new message', populatedMessage);
        req.io.to(req.user._id.toString()).emit('new message', populatedMessage);

        // Emit socket event to requester
        req.io.to(request.requester.toString()).emit('album access response', populatedRequest);

        res.json(populatedRequest);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Check if user has access to album
// @route   GET /api/album-access/check/:userId
// @access  Private
const checkAlbumAccess = async (req, res) => {
    try {
        const ownerId = req.params.userId;
        const requesterId = req.user._id;

        // Owner always has access to their own album
        if (ownerId === requesterId.toString()) {
            return res.json({ hasAccess: true, isOwner: true });
        }

        const owner = await User.findById(ownerId);
        if (!owner) {
            return res.status(404).json({ message: 'User not found' });
        }

        const hasAccess = owner.albumAccessGranted && owner.albumAccessGranted.includes(requesterId);

        // Check if there's a pending request
        const pendingRequest = await AlbumAccessRequest.findOne({
            requester: requesterId,
            owner: ownerId,
            status: 'pending'
        });

        res.json({
            hasAccess,
            isOwner: false,
            hasPendingRequest: !!pendingRequest
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    requestAlbumAccess,
    getAlbumAccessRequests,
    updateAlbumAccessRequest,
    checkAlbumAccess
};
