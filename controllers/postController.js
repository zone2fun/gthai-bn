const Post = require('../models/Post');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');

// @desc    Get all posts
// @route   GET /api/posts
// @access  Private
const getPosts = async (req, res) => {
    try {
        const { hashtag, unapproved } = req.query;
        let query = {};

        // Get current user and their blocked relationships
        const currentUser = await User.findById(req.user._id);

        // Check if requesting unapproved posts (admin only)
        if (unapproved === 'true') {
            // Return all posts without filtering by approval status
            const posts = await Post.find({})
                .sort({ createdAt: -1 })
                .populate('user', 'name img isOnline')
                .populate('likes', 'name img')
                .populate('comments.user', 'name img');
            return res.json(posts);
        }

        // Find users who have blocked the current user
        const usersWhoBlockedMe = await User.find({
            blockedUsers: currentUser._id
        }).select('_id');

        const blockedMeIds = usersWhoBlockedMe.map(u => u._id);

        // Find banned users
        const bannedUsers = await User.find({ isBanned: true }).select('_id');
        const bannedUserIds = bannedUsers.map(u => u._id);

        // Combine all excluded user IDs (users I blocked + users who blocked me + banned users)
        // Convert all to string for easier comparison later
        const allExcludedUserIds = [
            ...currentUser.blockedUsers.map(id => id.toString()),
            ...blockedMeIds.map(id => id.toString()),
            ...bannedUserIds.map(id => id.toString())
        ];

        // Base conditions: exclude blocked/banned users
        const baseConditions = {
            user: { $nin: allExcludedUserIds }
        };

        if (hashtag) {
            const tags = hashtag.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tags.length > 0) {
                const regexConditions = tags.map(tag => ({ content: { $regex: tag, $options: 'i' } }));
                query = {
                    $and: [
                        { $or: regexConditions }, // Hashtag filter
                        baseConditions // Apply base conditions
                    ]
                };
            }
        } else {
            // No hashtag filter, just apply base conditions
            query = baseConditions;
        }

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .populate('user', 'name img isOnline')
            .populate('likes', 'name img isBanned')
            .populate('comments.user', 'name img isBanned');

        // Filter out comments and likes from excluded users (blocked/banned)
        const filteredPosts = posts.map(post => {
            // Convert to object to avoid modifying the actual document if we were to save it (though we aren't)
            // and to allow easier manipulation
            const postObj = post.toObject();

            if (postObj.comments) {
                postObj.comments = postObj.comments.filter(comment => {
                    // Check if comment user exists (might be deleted)
                    if (!comment.user) return false;

                    // Check if user is banned
                    if (comment.user.isBanned) return false;

                    // Check if user is in excluded list (blocked/banned)
                    if (allExcludedUserIds.includes(comment.user._id.toString())) return false;

                    return true;
                });
            }

            // Filter out likes from excluded users (blocked/banned)
            if (postObj.likes) {
                postObj.likes = postObj.likes.filter(like => {
                    // Check if like user exists
                    if (!like) return false;

                    // Check if user is banned
                    if (like.isBanned) return false;

                    // Check if user is in excluded list
                    if (allExcludedUserIds.includes(like._id.toString())) return false;

                    return true;
                });
            }

            return postObj;
        });

        res.json(filteredPosts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get single post by ID
// @route   GET /api/posts/:id
// @access  Private
const getPostById = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('user', 'name img isOnline isBanned')
            .populate('likes', 'name img isBanned')
            .populate('comments.user', 'name img isBanned');

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if post author is banned
        if (post.user && post.user.isBanned) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Filter comments from banned users
        const postObj = post.toObject();
        if (postObj.comments) {
            postObj.comments = postObj.comments.filter(comment =>
                comment.user && !comment.user.isBanned
            );
        }

        // Filter likes from banned users
        if (postObj.likes) {
            postObj.likes = postObj.likes.filter(like =>
                like && !like.isBanned
            );
        }

        res.json(postObj);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res) => {
    try {
        const { content } = req.body;
        let imageUrl = null;

        if (req.file) {
            imageUrl = req.file.path;
        }

        if (!content && !imageUrl) {
            return res.status(400).json({ message: 'Post must have content or image' });
        }

        // Posts with images need admin approval
        const isApproved = imageUrl ? false : true;

        const newPost = await Post.create({
            user: req.user._id,
            content,
            image: imageUrl,
            isApproved: isApproved
        });

        const fullPost = await Post.findById(newPost._id).populate('user', 'name img isOnline');

        res.status(201).json(fullPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

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

                    req.io.to(post.user.toString()).emit('new notification', populatedNotification);
                }
            }
        }

        await post.save();

        // Populate likes with user data before returning
        await post.populate('likes', 'name img isBanned');

        // Filter likes from banned users
        const filteredLikes = post.likes.filter(like => like && !like.isBanned);

        res.json(filteredLikes);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check user
        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'User not authorized' });
        }

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

        res.json({ message: 'Post removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

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

        const updatedPost = await Post.findById(req.params.id).populate('comments.user', 'name img isBanned');

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

            req.io.to(post.user.toString()).emit('new notification', populatedNotification);
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

// @desc    Delete a comment from a post
// @route   DELETE /api/posts/:id/comment/:commentId
// @access  Private (Post owner only)
const deleteComment = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if user is the post owner
        if (post.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({ message: 'Only post owner can delete comments' });
        }

        // Find comment index
        const commentIndex = post.comments.findIndex(
            comment => comment._id.toString() === req.params.commentId
        );

        if (commentIndex === -1) {
            return res.status(404).json({ message: 'Comment not found' });
        }

        // Remove comment
        post.comments.splice(commentIndex, 1);

        await post.save();

        const updatedPost = await Post.findById(req.params.id).populate('comments.user', 'name img isBanned');

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
            .populate('user', 'name img isOnline')
            .populate('likes', 'name img')
            .populate('comments.user', 'name img');

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
            // Notify user about approval
            req.io.to(post.user.toString()).emit('post_approved', fullPost);

            // Send notification
            const populatedNotification = await Notification.findById(notification._id)
                .populate('post', 'content image');
            req.io.to(post.user.toString()).emit('new notification', populatedNotification);
        }

        res.json(fullPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get pending posts (Admin only)
// @route   GET /api/admin/posts/pending
// @access  Private/Admin
const getPendingPosts = async (req, res) => {
    try {
        const posts = await Post.find({ isApproved: false, image: { $ne: null } })
            .sort({ createdAt: -1 })
            .populate('user', 'name img isOnline')
            .populate('likes', 'name img')
            .populate('comments.user', 'name img');
        res.json(posts);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

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
            // Notify user about rejection
            req.io.to(userId.toString()).emit('post_rejected', { postId: req.params.id });

            // Send notification
            req.io.to(userId.toString()).emit('new notification', notification);
        }

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
