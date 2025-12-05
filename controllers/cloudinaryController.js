const { cloudinary } = require('../config/cloudinary');

// Generate Cloudinary signature for signed uploads
exports.getCloudinarySignature = async (req, res) => {
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = 'gthai-mobile';

        // Generate signature
        const signature = cloudinary.utils.api_sign_request(
            {
                timestamp: timestamp,
                folder: folder,
            },
            process.env.CLOUDINARY_API_SECRET
        );

        res.json({
            signature,
            timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
            folder,
        });
    } catch (error) {
        console.error('Error generating Cloudinary signature:', error);
        res.status(500).json({ message: 'Failed to generate signature' });
    }
};
