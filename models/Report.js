const mongoose = require('mongoose');

const reportSchema = mongoose.Schema({
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reportType: {
        type: String,
        enum: ['post', 'user'],
        required: true
    },
    reason: {
        type: String,
        enum: [
            'Inappropriate content',
            'Harassment or bullying',
            'Spam or scam',
            'Fake profile',
            'Underage user',
            'Other',
            // Keep old values for backward compatibility
            'Spam',
            'Harassment',
            'Inappropriate Content',
            'False Information',
            'Impersonation',
            'Scam/Fraud',
            'Fake Profile',
            'Rule Violation'
        ],
        required: true
    },
    additionalInfo: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
        default: 'pending'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);
