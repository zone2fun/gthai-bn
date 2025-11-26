const Report = require('../models/Report');
const Post = require('../models/Post');

// @desc    Create a report
// @route   POST /api/reports
// @access  Private
const createReport = async (req, res) => {
    try {
        const { postId, reason, additionalInfo } = req.body;

        // Check if post exists
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if user already reported this post
        const existingReport = await Report.findOne({
            reporter: req.user._id,
            post: postId
        });

        if (existingReport) {
            return res.status(400).json({ message: 'You have already reported this post' });
        }

        const report = await Report.create({
            reporter: req.user._id,
            post: postId,
            reason,
            additionalInfo: additionalInfo || ''
        });

        const populatedReport = await Report.findById(report._id)
            .populate('reporter', 'name img')
            .populate('post', 'content image user');

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

        report.status = status;
        await report.save();

        const populatedReport = await Report.findById(report._id)
            .populate('reporter', 'name img')
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
