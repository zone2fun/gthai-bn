const Report = require('../models/Report');
const Post = require('../models/Post');
const Notification = require('../models/Notification');

const createReport = async (req, res) => {
    try {
        const { postId, userId, reason, additionalInfo, reportType } = req.body;

        if (!reportType || !['post', 'user'].includes(reportType)) {
            return res.status(400).json({ message: 'Invalid report type' });
        }

        let reportData = {
            reporter: req.user._id,
            reportType,
            reason,
            additionalInfo: additionalInfo || ''
        };

        if (reportType === 'post') {
            // Check if post exists
            const post = await Post.findById(postId);
            if (!post) {
                return res.status(404).json({ message: 'Post not found' });
            }

            // Check if user already reported this post
            const existingReport = await Report.findOne({
                reporter: req.user._id,
                post: postId,
                reportType: 'post',
                status: 'pending'
            });

            if (existingReport) {
                return res.status(400).json({ message: 'You have already reported this post' });
            }

            reportData.post = postId;

            // Send notification to post owner
            const notification = await Notification.create({
                recipient: post.user,
                sender: req.user._id,
                type: 'report',
                message: 'Your post has been reported and is under review by our team.'
            });

            // Populate notification for socket emit
            const populatedNotification = await Notification.findById(notification._id)
                .populate('sender', 'name img')
                .populate('recipient', 'name img');

            // Emit realtime notification via Socket.IO
            if (req.io) {
                req.io.to(post.user.toString()).emit('new notification', populatedNotification);
            }
        } else if (reportType === 'user') {
            const User = require('../models/User');
            // Check if user exists
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Check if user already reported this user
            const existingReport = await Report.findOne({
                reporter: req.user._id,
                reportedUser: userId,
                reportType: 'user',
                status: 'pending'
            });

            if (existingReport) {
                return res.status(400).json({ message: 'You have already reported this user' });
            }

            reportData.reportedUser = userId;

            // Send notification to reported user
            const notification = await Notification.create({
                recipient: userId,
                sender: req.user._id,
                type: 'report',
                message: 'Your profile has been reported and is under review by our team.'
            });

            // Populate notification for socket emit
            const populatedNotification = await Notification.findById(notification._id)
                .populate('sender', 'name img')
                .populate('recipient', 'name img');

            // Emit realtime notification via Socket.IO
            if (req.io) {
                req.io.to(userId.toString()).emit('new notification', populatedNotification);
            }
        }

        const report = await Report.create(reportData);

        const populatedReport = await Report.findById(report._id)
            .populate('reporter', 'name img')
            .populate('post', 'content image user')
            .populate('reportedUser', 'name img');

        res.status(201).json(populatedReport);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get all reports (Admin only)
// @route   GET /api/reports
// @access  Private/Admin
const getReports = async (req, res) => {
    try {
        const { status } = req.query;
        let query = {};

        if (status) {
            query.status = status;
        }

        const reports = await Report.find(query)
            .sort({ createdAt: -1 })
            .populate('reporter', 'name img')
            .populate('reportedUser', 'name img username email bio age country lookingFor createdAt gallery')
            .populate({
                path: 'post',
                populate: {
                    path: 'user',
                    select: 'name img'
                }
            });

        res.json(reports);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Update report status (Admin only)
// @route   PUT /api/reports/:id
// @access  Private/Admin
const updateReportStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const report = await Report.findById(req.params.id);

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        // If resolving a post report, delete the post and notify the user
        if (status === 'resolved' && report.reportType === 'post' && report.post) {
            const post = await Post.findById(report.post);

            if (post) {
                // Create notification for post owner
                const notification = await Notification.create({
                    recipient: post.user,
                    sender: req.user._id,
                    type: 'admin_notification',
                    message: 'Your post has been removed due to violation of our community guidelines.'
                });

                // Populate notification for socket emit
                const populatedNotification = await Notification.findById(notification._id)
                    .populate('sender', 'name img')
                    .populate('recipient', 'name img');

                // Emit realtime notification via Socket.IO
                req.io.to(post.user.toString()).emit('new notification', populatedNotification);

                // Delete the post
                await Post.findByIdAndDelete(report.post);
            }
        }

        // If resolving a user report, warn the user and auto-ban if warnings >= 3
        if (status === 'resolved' && report.reportType === 'user' && report.reportedUser) {
            const User = require('../models/User');
            const reportedUser = await User.findById(report.reportedUser);

            if (reportedUser) {
                // Increment warning count
                reportedUser.warningCount = (reportedUser.warningCount || 0) + 1;

                let notificationMessage = '';

                // Check if user should be banned (3 or more warnings)
                if (reportedUser.warningCount >= 3) {
                    reportedUser.isBanned = true;
                    notificationMessage = 'Your account has been banned due to multiple violations of our community guidelines.';
                } else {
                    notificationMessage = `Warning ${reportedUser.warningCount}/3: Your profile may violate our community guidelines. Please review and update your profile to comply with our rules.`;
                }

                // Create notification
                const notification = await Notification.create({
                    recipient: reportedUser._id,
                    sender: req.user._id,
                    type: 'admin_notification',
                    message: notificationMessage
                });

                // Populate notification for socket emit
                const populatedNotification = await Notification.findById(notification._id)
                    .populate('sender', 'name img')
                    .populate('recipient', 'name img');

                // Emit realtime notification via Socket.IO
                req.io.to(reportedUser._id.toString()).emit('new notification', populatedNotification);

                // If user is banned, emit specific event to force logout
                if (reportedUser.isBanned) {
                    req.io.to(reportedUser._id.toString()).emit('account_banned', {
                        message: 'Your account has been banned.'
                    });
                }

                await reportedUser.save();
            }
        }

        report.status = status;
        await report.save();

        const populatedReport = await Report.findById(report._id)
            .populate('reporter', 'name img')
            .populate('reportedUser', 'name img username email bio age country lookingFor createdAt gallery warningCount')
            .populate({
                path: 'post',
                populate: {
                    path: 'user',
                    select: 'name img'
                }
            });

        res.json(populatedReport);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    createReport,
    getReports,
    updateReportStatus
};
