const Post = require('../models/Post');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const { sendPushNotification } = require('../utils/pushNotification');

// @desc    Get all posts
// ... (rest of getPosts, no change) ...

// ... (getPostById, createPost, no change) ...

// @desc    Like a post
// @route   PUT /api/posts/:id/like
// @access  Private
const likePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if the post has already been liked
        if (post.likes.includes(req.user._id)) {
            // Unlike
            post.likes = post.likes.filter(
                like => like.toString() !== req.user._id.toString()
            );
        } else {
            // Like
            post.likes.push(req.user._id);

            // Create Notification if not liking own post
            if (post.user.toString() !== req.user._id.toString()) {
                const Notification = require('../models/Notification');

                // Check if notification already exists
                const existingNotification = await Notification.findOne({
                    recipient: post.user,
                    sender: req.user._id,
                    type: 'like_post',
                    post: post._id
                });

                if (!existingNotification) {
                    const notification = await Notification.create({
                        recipient: post.user,
                        sender: req.user._id,
                        type: 'like_post',
                        post: post._id
                    });

                    // Emit socket event to recipient
                    const populatedNotification = await Notification.findById(notification._id)
                        .populate('sender', 'name img')
                        .populate('post', 'content image');

                    if (req.io) {
                        req.io.to(post.user.toString()).emit('new notification', populatedNotification);
                    }

                    // Send Push Notification
                    await sendPushNotification(
                        post.user,
                        'New Like',
                        `${req.user.name} liked your post`,
                        { type: 'like_post', postId: post._id, senderId: req.user._id }
                    );
                }
            }
        }

        await post.save();

        // Populate likes with user data before returning
        await post.populate('likes', 'name img isBanned isVerified');

        // Filter likes from banned users
        const filteredLikes = post.likes.filter(like => like && !like.isBanned);

        res.json(filteredLikes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ... (deletePost, no change) ...

// @desc    Add a comment to a post
// @route   POST /api/posts/:id/comment
// @access  Private
const addComment = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const comment = {
            user: req.user._id,
            text: req.body.text,
            createdAt: Date.now()
        };

        post.comments.push(comment);

        await post.save();

        const updatedPost = await Post.findById(req.params.id).populate('comments.user', 'name img isBanned isVerified');

        // Create Notification if not commenting on own post
        if (post.user.toString() !== req.user._id.toString()) {
            const Notification = require('../models/Notification');

            // Get the newly created comment (last one in the array)
            const newComment = updatedPost.comments[updatedPost.comments.length - 1];

            const notification = await Notification.create({
                recipient: post.user,
                sender: req.user._id,
                type: 'comment_post',
                post: post._id,
                comment: newComment._id
            });

            // Emit socket event to recipient
            const populatedNotification = await Notification.findById(notification._id)
                .populate('sender', 'name img')
                .populate('post', 'content image');

            if (req.io) {
                req.io.to(post.user.toString()).emit('new notification', populatedNotification);
            }

            // Send Push Notification
            await sendPushNotification(
                post.user,
                'New Comment',
                `${req.user.name} commented on your post`,
                { type: 'comment_post', postId: post._id, senderId: req.user._id }
            );
        }

        // Filter comments from banned users
        const comments = updatedPost.comments.filter(comment =>
            comment.user && !comment.user.isBanned
        );

        res.json(comments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ... (deleteComment, no change) ...

// @desc    Approve a post (Admin only)
// @route   PUT /api/posts/:id/approve
// @access  Private/Admin
const approvePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        post.isApproved = true;
        await post.save();

        const fullPost = await Post.findById(post._id)
            .populate('user', 'name img isOnline isVerified')
            .populate('likes', 'name img isVerified')
            .populate('comments.user', 'name img isVerified');

        // Create Notification
        const Notification = require('../models/Notification');
        const notification = await Notification.create({
            recipient: post.user,
            type: 'post_approved',
            post: post._id,
            message: 'Your post has been approved and is now visible.'
        });

        // Emit socket events
        if (req.io) {
            // Broadcast approved post to ALL users so it appears in their feed
            req.io.emit('post_approved', fullPost);

            // Send notification to post owner
            const populatedNotification = await Notification.findById(notification._id)
                .populate('post', 'content image');
            req.io.to(post.user.toString()).emit('new notification', populatedNotification);
        }

        // Send Push Notification
        await sendPushNotification(
            post.user,
            'Post Approved',
            'Your post has been approved and is now visible.',
            { type: 'post_approved', postId: post._id }
        );

        res.json(fullPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// ... (getPendingPosts, no change) ...

// @desc    Delete a post (Admin only)
// @route   DELETE /api/admin/posts/:id
// @access  Private/Admin
const deletePostAdmin = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const userId = post.user;
        const postContent = post.content ? post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '') : 'Image post';

        // Delete image from cloudinary
        if (post.image) {
            try {
                const urlParts = post.image.split('/');
                const fileWithExt = urlParts[urlParts.length - 1];
                const publicId = `gthai-mobile/${fileWithExt.split('.')[0]}`;
                await cloudinary.uploader.destroy(publicId);
            } catch (err) {
                console.error('Error deleting image from Cloudinary', err);
            }
        }
        // Delete gallery images from cloudinary
        if (post.gallery && post.gallery.length > 0) {
            for (const imgUrl of post.gallery) {
                try {
                    const urlParts = imgUrl.split('/');
                    const fileWithExt = urlParts[urlParts.length - 1];
                    const publicId = `gthai-mobile/${fileWithExt.split('.')[0]}`;
                    await cloudinary.uploader.destroy(publicId);
                } catch (err) {
                    console.error('Error deleting gallery image from Cloudinary', err);
                }
            }
        }

        await post.deleteOne();

        // Create Notification for rejection
        const Notification = require('../models/Notification');
        const notification = await Notification.create({
            recipient: userId,
            type: 'post_rejected',
            message: `Your post "${postContent}" was rejected by admin.`
        });

        // Emit socket events
        if (req.io) {
            // Broadcast to all users to remove from their feed (if cached)
            req.io.emit('post_rejected', { postId: req.params.id });

            // Send notification to post owner
            req.io.to(userId.toString()).emit('new notification', notification);
        }

        // Send Push Notification
        await sendPushNotification(
            userId,
            'Post Rejected',
            `Your post "${postContent}" was rejected by admin.`,
            { type: 'post_rejected' }
        );

        res.json({ message: 'Post removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getPosts,
    getPostById,
    createPost,
    likePost,
    deletePost,
    addComment,
    deleteComment,
    approvePost,
    getPendingPosts,
    deletePostAdmin
};
