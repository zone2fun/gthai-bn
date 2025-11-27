const mongoose = require('mongoose');

function arrayLimit(val) {
    return val.length <= 3;
}

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
    isPublic: {
        type: Boolean,
        default: true
    },
    lat: {
        type: Number,
        default: 13.7563 // Default to Bangkok
    },
    lng: {
        type: Number,
        default: 100.5018
    },
    locationLastUpdated: {
        type: Date,
        default: null
    },
    favorites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    blockedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    privateAlbum: {
        type: [String],
        default: [],
        validate: [arrayLimit, 'Private album can only have 3 photos']
    },
    albumAccessGranted: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    isFake: {
        type: Boolean,
        default: false
    },
    registrationIp: {
        type: String,
        default: ''
    },
    lastLoginIp: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
