const nodemailer = require('nodemailer');

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, userName) => {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Check if SendGrid API key is available (use Web API instead of SMTP)
    if (process.env.SENDGRID_API_KEY) {
        console.log('📧 Using SendGrid Web API for email service');

        try {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);

            const msg = {
                to: email,
                from: process.env.EMAIL_USER || 'noreply@gthai.com',
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

            await sgMail.send(msg);
            console.log('✅ Password reset email sent successfully to:', email);
            return { success: true };
        } catch (error) {
            console.error('❌ SendGrid API Error:', error.response?.body || error);
            return { success: false, error: error.message };
        }
    }

    // Fall back to Gmail SMTP (for local development)
    console.log('📧 Using Gmail SMTP for email service');

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
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
        console.error('❌ Gmail SMTP Error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendPasswordResetEmail
};
