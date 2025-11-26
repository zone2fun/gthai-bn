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
        enum: ['spam', 'อนาจาร', 'กล่าวร้ายผู้อื่น', 'แอบอ้าง', 'หลอกลวง', 'โปรไฟล์ปลอม', 'การล่วงละเมิด'],
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
