import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

// Initialize SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized');
}

// Determine which email service to use
const USE_SENDGRID = process.env.SENDGRID_API_KEY && process.env.NODE_ENV === 'production';

// Create reusable transporter for Gmail (fallback for local development)
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required');
  }

  return nodemailer.createTransporter({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });
};

/**
 * Send OTP email to user
 */
export const sendOTPEmail = async (email, otp, name = 'User') => {
  try {
    console.log('📧 Attempting to send OTP email...');
    console.log('Using:', USE_SENDGRID ? 'SendGrid' : 'Gmail SMTP');
    console.log('Recipient:', email);
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            padding: 30px;
            text-align: center;
          }
          .content {
            background: white;
            border-radius: 8px;
            padding: 30px;
            margin-top: 20px;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 8px;
            margin: 20px 0;
            padding: 15px;
            background: #f7f7f7;
            border-radius: 8px;
            display: inline-block;
          }
          .header {
            color: white;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .warning {
            color: #e74c3c;
            font-size: 14px;
            margin-top: 20px;
          }
          .footer {
            color: white;
            font-size: 12px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">🔐 Partner App Verification</div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Thank you for registering with Partner App. Please use the OTP code below to verify your email address:</p>
            
            <div class="otp-code">${otp}</div>
            
            <p>This OTP is valid for <strong>10 minutes</strong>.</p>
            
            <p class="warning">⚠️ If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Partner App. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const emailText = `
Hello ${name}!

Thank you for registering with Partner App.

Your OTP code is: ${otp}

This OTP is valid for 10 minutes.

If you didn't request this code, please ignore this email.

© ${new Date().getFullYear()} Partner App. All rights reserved.
    `;

    // Use SendGrid in production, Gmail for local development
    if (USE_SENDGRID) {
      const msg = {
        to: email,
        from: process.env.EMAIL_USER || 'partnermyapp2025@gmail.com',
        subject: '🔐 Your OTP Code - Partner App',
        text: emailText,
        html: emailHtml,
      };

      const response = await sgMail.send(msg);
      console.log('✅ Email sent via SendGrid:', response[0].statusCode);
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
      };
    } else {
      // Gmail fallback for local development
      const transporter = createTransporter();
      const mailOptions = {
        from: `"Partner App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 Your OTP Code - Partner App',
        html: emailHtml,
        text: emailText,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent via Gmail:', info.messageId);
      return {
        success: true,
        messageId: info.messageId,
      };
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
};

/**
 * Send welcome email after successful verification
 */
export const sendWelcomeEmail = async (email, name) => {
  try {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 10px;
            padding: 30px;
            text-align: center;
          }
          .content {
            background: white;
            border-radius: 8px;
            padding: 30px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div style="color: white; font-size: 24px; font-weight: bold; margin-bottom: 10px;">
            🎉 Welcome to Partner App!
          </div>
          <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Your account has been successfully verified! 🎊</p>
            <p>You can now enjoy all the features of Partner App.</p>
            <p>If you have any questions, feel free to reach out to our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (USE_SENDGRID) {
      const msg = {
        to: email,
        from: process.env.EMAIL_USER || 'partnermyapp2025@gmail.com',
        subject: '🎉 Welcome to Partner App!',
        html: emailHtml,
      };

      const response = await sgMail.send(msg);
      console.log('✅ Welcome email sent via SendGrid');
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
      };
    } else {
      const transporter = createTransporter();
      const mailOptions = {
        from: `"Partner App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Welcome to Partner App!',
        html: emailHtml,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Welcome email sent via Gmail');
      return {
        success: true,
        messageId: info.messageId,
      };
    }
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    throw error;
  }
};
