const Post = require('../models/Post');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');

// @desc    Get all posts
// @route   GET /api/posts
// @access  Private
const getPosts = async (req, res) => {
    try {
        const { hashtag } = req.query;
        let query = {};

        if (hashtag) {
            const tags = hashtag.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tags.length > 0) {
                const regexConditions = tags.map(tag => ({ content: { $regex: tag, $options: 'i' } }));
                query = { $or: regexConditions };
            }
        }

        const posts = await Post.find(query)
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

        const newPost = await Post.create({
            user: req.user._id,
            content,
            image: imageUrl
        });

        const fullPost = await Post.findById(newPost._id).populate('user', 'name img isOnline');

        res.status(201).json(fullPost);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Like/Unlike a post
// @route   PUT /api/posts/:id/like
// @access  Private
const likePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);

        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if post has already been liked
        if (post.likes.includes(req.user._id)) {
            // Unlike
            post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
        } else {
            // Like
            post.likes.push(req.user._id);
        }

        await post.save();

        // Populate likes with user data before returning
        await post.populate('likes', 'name img');

        res.json(post.likes);
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

        const updatedPost = await Post.findById(req.params.id).populate('comments.user', 'name img');

        res.json(updatedPost.comments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getPosts,
    createPost,
    likePost,
    deletePost,
    addComment
};
