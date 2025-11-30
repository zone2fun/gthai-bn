const mongoose = require('mongoose');

const announcementSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String
    },
    image: {
        type: String,
        required: true // User specified image is used as background, so it should be required or have a default
    },
    link: {
        type: String,
        default: ''
    },
    startTime: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    clickCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Announcement', announcementSchema);
