// Quick email test script for debugging deployment issues
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

async function testEmailSetup() {
  console.log('🔍 Testing Email Configuration...\n');
  
  // Check environment variables
  console.log('1. Environment Variables:');
  console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set - ' + process.env.EMAIL_USER : '❌ NOT SET');
  console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Set - ' + process.env.EMAIL_PASS.substring(0, 4) + '***' : '❌ NOT SET');
  console.log('');

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Missing EMAIL_USER or EMAIL_PASS environment variables');
    process.exit(1);
  }

  // Create transporter
  console.log('2. Creating SMTP Transporter...');
  const transporter = nodemailer.createTransport({
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

  // Verify connection
  console.log('3. Verifying SMTP Connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP Connection Verified Successfully!');
  } catch (error) {
    console.error('❌ SMTP Connection Failed:', error.message);
    process.exit(1);
  }

  // Send test email
  console.log('4. Sending Test Email...');
  try {
    const info = await transporter.sendMail({
      from: `"Partner App Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: '🧪 Test Email - Partner App',
      html: `
        <div style="font-family: Arial; padding: 20px; background: #f0f0f0;">
          <div style="background: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #667eea;">✅ Email Configuration Working!</h2>
            <p>If you received this email, your email service is configured correctly.</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Timestamp: ${new Date().toISOString()}</li>
              <li>From: ${process.env.EMAIL_USER}</li>
            </ul>
          </div>
        </div>
      `,
    });

    console.log('✅ Test Email Sent Successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response:', info.response);
    console.log('');
    console.log('🎉 All tests passed! Email service is working correctly.');
    console.log('📬 Check your inbox at:', process.env.EMAIL_USER);
  } catch (error) {
    console.error('❌ Failed to Send Test Email:', error.message);
    console.error('   Full Error:', error);
    process.exit(1);
  }
}

testEmailSetup();
