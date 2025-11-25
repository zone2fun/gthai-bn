const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: false, // Changed to false to support existing users
        unique: true,
        sparse: true // Allows multiple null values
    },
    name: {
        type: String,
        required: true
    },
    img: {
        type: String,
        default: '/user_avatar.png'
    },
    cover: {
        type: String,
        default: '/cover_default.png'
    },
    age: Number,
    height: Number,
    weight: Number,
    country: String,
    lookingFor: [String],
    bio: {
        type: String,
        maxlength: 200,
        default: ''
    },
    gallery: [String],
    isOnline: {
        type: Boolean,
        default: false
    },
    lat: {
        type: Number,
        default: 13.7563 // Default to Bangkok
    },
    lng: {
        type: Number,
        default: 100.5018
    },
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
