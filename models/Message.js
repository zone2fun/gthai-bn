const mongoose = require('mongoose');

const messageSchema = mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String
    },
    image: {
        type: String
    },
    read: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        enum: ['text', 'image', 'request_album_access', 'album_access_response'],
        default: 'text'
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'relatedModel'
    },
    relatedModel: {
        type: String,
        enum: ['AlbumAccessRequest']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);
