const mongoose = require('mongoose');

const albumAccessRequestSchema = mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    }
}, {
    timestamps: true
});

// Compound index to prevent duplicate requests
albumAccessRequestSchema.index({ requester: 1, owner: 1 }, { unique: true });

module.exports = mongoose.model('AlbumAccessRequest', albumAccessRequestSchema);
