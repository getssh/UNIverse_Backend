const nodemailer = require('nodemailer');

/**
 * Sends an email using Nodemailer.
 * @param {object} options - Email options.
 * @param {string} options.to - Recipient's email address.
 * @param {string} options.subject - Email subject line.
 * @param {string} [options.text] - Plain text body of the email.
 * @param {string} options.html - HTML body of the email.
 */

const sendEmail = async (options) => {

    const transporter = nodemailer.createTransport({
        // host: process.env.EMAIL_HOST,
        // port: parseInt(process.env.EMAIL_PORT || '587', 10),
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER, 
            pass: process.env.EMAIL_PASS,
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${options.to}: ${info.messageId}`);
    } catch (error) {
        console.error(`Error sending email to ${options.to}:`, error);
        throw new Error(`Email could not be sent. Reason: ${error.message}`);
    }
};

module.exports = sendEmail;