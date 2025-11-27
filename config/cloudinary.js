const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const baseParams = {
            folder: 'gthai-mobile',
            allowed_formats: ['jpg', 'png', 'jpeg', 'gif'],
            transformation: [{ width: 500, height: 500, crop: 'limit' }]
        };

        // Apply moderation to all uploads EXCEPT private album
        // NOTE: This requires the "AWS Rekognition AI Moderation" add-on to be enabled in your Cloudinary Dashboard.
        // Go to Add-ons > AWS Rekognition AI Moderation > Free Plan (or higher) to enable it.
        // TEMPORARILY DISABLED - Enable this after activating the Cloudinary add-on
        // if (file.fieldname !== 'privateAlbum') {
        //     baseParams.moderation = 'aws_rekognition_moderation';
        // }

        return baseParams;
    }
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };
