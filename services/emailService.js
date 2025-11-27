const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
    // Check if SendGrid API key is available (for production/Render)
    if (process.env.SENDGRID_API_KEY) {
        console.log('📧 Using SendGrid for email service');
        return nodemailer.createTransport({
            host: 'smtp.sendgrid.net',
            port: 587,
            secure: false,
            auth: {
                user: 'apikey',
                pass: process.env.SENDGRID_API_KEY
            }
        });
    }

    // Fall back to Gmail (for local development)
    console.log('📧 Using Gmail for email service');
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, userName) => {
    const transporter = createTransporter();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@gthai.com',
        to: email,
        subject: 'Password Reset Request - GThai Mobile',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #a607d6;">Password Reset Request</h2>
                <p>Hi ${userName},</p>
                <p>You requested to reset your password. Click the button below to reset it:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetUrl}" 
                       style="background-color: #a607d6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="color: #666; word-break: break-all;">${resetUrl}</p>
                <p style="color: #999; font-size: 12px; margin-top: 30px;">
                    This link will expire in 1 hour.<br>
                    If you didn't request this, please ignore this email.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Password reset email sent successfully to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendPasswordResetEmail
};
