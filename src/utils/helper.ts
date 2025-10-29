import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Response } from 'express';
import "dotenv/config";
import twilio from "twilio";
import nodemailer from "nodemailer";

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromPhoneNumber = process.env.TWILIO_FROM_PHONE_NUMBER;

// SMTP Configuration - Hostinger
const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
const smtpPort = parseInt(process.env.SMTP_PORT || '465');
const smtpSecure = process.env.SMTP_SECURE !== 'false'; // Default to true for SSL
const smtpUser = process.env.SMTP_USER || 'support@clovantitsolutions.com';
const smtpPass = process.env.SMTP_PASS;
const smtpEmail = process.env.SMTP_EMAIL || 'support@clovantitsolutions.com';
const smtpFooterMessage = process.env.SMTP_FOOTER_MESSAGE || 'Clovant IT Solutions';

export interface JwtUserPayload {

  userId: string;
  role: string;
  jti?: string;
}

/**
 * Hash a plain text password using bcryptjs.
 * @param plainPassword - The password to hash.
 * @returns Promise<string> - The hashed password.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

/**
 * Compare a plain text password with a hashed password.
 * @param plainPassword - The plain password to check.
 * @param hashedPassword - The hashed password to compare against.
 * @returns Promise<boolean> - True if match, false otherwise.
 */
export async function comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Generate a JWT access token (valid for 2 days).
 */
export function generateAccessToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '30d' });
}

/**
 * Generate a JWT refresh token (valid for 30 days).
 */
export function generateRefreshToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '30d' });
}

/**
 * Verify a JWT token (access or refresh).
 * @throws if invalid or expired
 */
export function verifyToken(token: string, isRefresh: boolean = false): JwtPayload | string {
  const secret = isRefresh ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
  return jwt.verify(token, secret as string);
}

/**
 * Generate a numeric OTP of the specified length.
 * @param length - The length of the OTP to generate.
 * @returns string - The generated OTP as a string.
 */
export function generateOtp(length: number): string {
  if (length <= 0) throw new Error('OTP length must be positive');
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  return otp.toString().padStart(length, '0');
}

/**
 * Send a standardized success response.
 * @param res Express Response object
 * @param data Response data (any type)
 * @param message Optional message string
 * @param status HTTP status code (default 200)
 * @param meta Optional meta information (e.g., pagination)
 */
export function sendSuccess<T>(res: Response, data: T, message = 'Success', status = 200, meta?: any): Response {
  const response: any = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(status).json(response);
}

/**
 * Send a standardized error response.
 * @param res Express Response object
 * @param message Error message
 * @param status HTTP status code (default 400)
 * @param error Optional error details (never send stack in production)
 */
export function sendError(res: Response, message = 'Error', status = 400, error?: any): Response {
  let errorDetail = error;
  if (error && typeof error === 'object' && error.stack) {
    // Only include stack in non-production
    errorDetail = process.env.NODE_ENV === 'production' ? undefined : error.message || error.toString();
  }
  return res.status(status).json({ success: false, message, error: errorDetail });
}

/**
 * Generate a random JTI (JSON Web Token Identifier)
 * @param length - The length of the JTI to generate.
 * @returns string - The generated JTI as a string.
 */

export const generateRandomJti = (length = 8) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let jti = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    jti += characters[randomIndex];
  }
  return jti;
};


// Add types for SMS and Email parameters
interface SmsParams {
    to: string;
    body: string;
}

interface EmailParams {
    userEmail: string;
    subject: string;
    text: string;
    html?: string;
}

const sendSms = async ({ to, body }: SmsParams): Promise<void> => {
    if (!twilioAccountSid || !twilioAuthToken || !twilioFromPhoneNumber) {
        throw new Error("Missing Twilio credentials");
    }
    const client = twilio(twilioAccountSid, twilioAuthToken);
    try {
        const message = await client.messages.create({
            body,
            to,
            from: twilioFromPhoneNumber,
        });
        console.log(`Message sent with SID: ${message.sid}`);
    } catch (error) {
        console.error("Error sending SMS:", error);
        throw error;
    }
};

let transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure, // true for 465, false for other ports
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
});

const sendEmail = async ({ userEmail, subject, text, html }: EmailParams): Promise<unknown> => {
    // Add footer message to HTML emails
    let finalHtml = html;
    if (html && smtpFooterMessage) {
        const footerHtml = `
            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; text-align: center;">
                ${smtpFooterMessage}
            </div>
        `;
        finalHtml = html + footerHtml;
    }

    // Add footer message to text emails
    let finalText = text;
    if (text && smtpFooterMessage) {
        finalText = text + `\n\n---\n${smtpFooterMessage}`;
    }

    const mailOptions = {
        from: `"${smtpFooterMessage}" <${smtpEmail}>`,
        to: userEmail,
        subject: subject,
        text: finalText,
        html: finalHtml,
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error: Error | null, info: any) => {
            if (error) {
                console.error(`Error sending email: ${error}`);
                reject(error);
            } else {
                console.log(`Email sent: ${info.response}`);
                resolve(info.response);
            }
        });
    });
};

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

/**
 * Generate a random password with specified length
 * @param length - The length of the password to generate
 * @returns string - The generated password
 */
export const generateRandomPassword = (length = 12): string => {
  const charset = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  };

  let password = '';
  
  // Ensure at least one character from each category
  password += charset.uppercase[Math.floor(Math.random() * charset.uppercase.length)];
  password += charset.lowercase[Math.floor(Math.random() * charset.lowercase.length)];
  password += charset.numbers[Math.floor(Math.random() * charset.numbers.length)];
  password += charset.symbols[Math.floor(Math.random() * charset.symbols.length)];
  
  // Fill the rest randomly
  const allChars = charset.uppercase + charset.lowercase + charset.numbers + charset.symbols;
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Generate beautiful HTML email template for client registration
 * @param email - User's email
 * @param password - Generated password
 * @param otp - OTP code
 * @param firstName - User's first name
 * @returns string - HTML email content
 */
export const generateClientRegistrationEmail = (email: string, password: string, otp: string, firstName: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to WiFi SelfCare</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-align: center;
                padding: 40px 20px;
            }
            
            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
                font-weight: 600;
            }
            
            .header p {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .welcome-message {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .welcome-message h2 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 24px;
            }
            
            .welcome-message p {
                color: #7f8c8d;
                font-size: 16px;
            }
            
            .credentials-box {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .credentials-box h3 {
                margin-bottom: 20px;
                font-size: 20px;
            }
            
            .credential-item {
                background: rgba(255, 255, 255, 0.2);
                padding: 15px;
                margin: 10px 0;
                border-radius: 5px;
                backdrop-filter: blur(10px);
            }
            
            .credential-label {
                font-weight: 600;
                margin-bottom: 5px;
                opacity: 0.9;
            }
            
            .credential-value {
                font-size: 18px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
            }
            
            .otp-section {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .otp-code {
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 3px;
                margin: 15px 0;
                font-family: 'Courier New', monospace;
            }
            
            .instructions {
                background-color: #f8f9fa;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                border-left: 4px solid #667eea;
            }
            
            .instructions h3 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 18px;
            }
            
            .instructions ol {
                padding-left: 20px;
            }
            
            .instructions li {
                margin-bottom: 10px;
                color: #555;
            }
            
            .footer {
                background-color: #2c3e50;
                color: white;
                text-align: center;
                padding: 30px 20px;
            }
            
            .footer p {
                margin-bottom: 10px;
                opacity: 0.8;
            }
            
            .social-links {
                margin-top: 20px;
            }
            
            .social-links a {
                color: white;
                text-decoration: none;
                margin: 0 10px;
                opacity: 0.8;
                transition: opacity 0.3s;
            }
            
            .social-links a:hover {
                opacity: 1;
            }
            
            .highlight {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                text-align: center;
            }
            
            @media (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 5px;
                }
                
                .content {
                    padding: 20px 15px;
                }
                
                .header {
                    padding: 30px 15px;
                }
                
                .header h1 {
                    font-size: 24px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 WiFi SelfCare</h1>
                <p>Your Digital Connectivity Partner</p>
            </div>
            
            <div class="content">
                <div class="welcome-message">
                    <h2>Welcome, ${firstName}! 👋</h2>
                    <p>Your account has been successfully created. Here are your login credentials:</p>
                </div>
                
                <div class="credentials-box">
                    <h3>🔐 Your Account Credentials</h3>
                    <div class="credential-item">
                        <div class="credential-label">Email Address</div>
                        <div class="credential-value">${email}</div>
                    </div>
                    <div class="credential-item">
                        <div class="credential-label">Password</div>
                        <div class="credential-value">${password}</div>
                    </div>
                </div>
                
                <div class="otp-section">
                    <h3>🔢 Verification Code</h3>
                    <p>Use this OTP to verify your account:</p>
                    <div class="otp-code">${otp}</div>
                    <p><strong>Valid for 10 minutes</strong></p>
                </div>
                
                <div class="highlight">
                    <strong>⚠️ Important:</strong> Please save your password securely. You can change it after logging in.
                </div>
                
                <div class="instructions">
                    <h3>📋 Next Steps</h3>
                    <ol>
                        <li>Copy the OTP code above</li>
                        <li>Go to the WiFi SelfCare app or website</li>
                        <li>Enter your email and password to login</li>
                        <li>Enter the OTP code when prompted</li>
                        <li>Complete your profile setup</li>
                    </ol>
                </div>
                
                <div class="instructions">
                    <h3>🔒 Security Tips</h3>
                    <ol>
                        <li>Never share your password with anyone</li>
                        <li>Use a strong, unique password</li>
                        <li>Enable two-factor authentication if available</li>
                        <li>Log out from shared devices</li>
                        <li>Report suspicious activities immediately</li>
                    </ol>
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for choosing WiFi SelfCare!</p>
                <p>If you have any questions, contact our support team</p>
                <div class="social-links">
                    <a href="#">📧 Support</a>
                    <a href="#">🌐 Website</a>
                    <a href="#">📱 App</a>
                </div>
                <p style="margin-top: 20px; font-size: 12px; opacity: 0.6;">
                    This is an automated email. Please do not reply.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Generate beautiful HTML email template for engineer registration
 * @param email - Engineer's email
 * @param password - Generated password
 * @param otp - OTP code
 * @param firstName - Engineer's first name
 * @returns string - HTML email content
 */
export const generateEngineerRegistrationEmail = (email: string, password: string, otp: string, firstName: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to WiFi SelfCare - Engineer Account</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                color: white;
                text-align: center;
                padding: 40px 20px;
            }
            
            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
                font-weight: 600;
            }
            
            .header p {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .welcome-message {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .welcome-message h2 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 24px;
            }
            
            .welcome-message p {
                color: #7f8c8d;
                font-size: 16px;
            }
            
            .credentials-box {
                background: linear-gradient(135deg, #ff9ff3 0%, #f368e0 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .credentials-box h3 {
                margin-bottom: 20px;
                font-size: 20px;
            }
            
            .credential-item {
                background: rgba(255, 255, 255, 0.2);
                padding: 15px;
                margin: 10px 0;
                border-radius: 5px;
                backdrop-filter: blur(10px);
            }
            
            .credential-label {
                font-weight: 600;
                margin-bottom: 5px;
                opacity: 0.9;
            }
            
            .credential-value {
                font-size: 18px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
            }
            
            .otp-section {
                background: linear-gradient(135deg, #ff9ff3 0%, #f368e0 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .otp-code {
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 3px;
                margin: 15px 0;
                font-family: 'Courier New', monospace;
            }
            
            .instructions {
                background-color: #f8f9fa;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                border-left: 4px solid #ff6b6b;
            }
            
            .instructions h3 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 18px;
            }
            
            .instructions ol {
                padding-left: 20px;
            }
            
            .instructions li {
                margin-bottom: 10px;
                color: #555;
            }
            
            .footer {
                background-color: #2c3e50;
                color: white;
                text-align: center;
                padding: 30px 20px;
            }
            
            .footer p {
                margin-bottom: 10px;
                opacity: 0.8;
            }
            
            .social-links {
                margin-top: 20px;
            }
            
            .social-links a {
                color: white;
                text-decoration: none;
                margin: 0 10px;
                opacity: 0.8;
                transition: opacity 0.3s;
            }
            
            .social-links a:hover {
                opacity: 1;
            }
            
            .highlight {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                text-align: center;
            }
            
            .engineer-badge {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                display: inline-block;
                margin: 10px 0;
                font-weight: bold;
            }
            
            @media (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 5px;
                }
                
                .content {
                    padding: 20px 15px;
                }
                
                .header {
                    padding: 30px 15px;
                }
                
                .header h1 {
                    font-size: 24px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔧 WiFi SelfCare</h1>
                <p>Engineer Portal Access</p>
            </div>
            
            <div class="content">
                <div class="welcome-message">
                    <h2>Welcome, ${firstName}! 👋</h2>
                    <div class="engineer-badge">🔧 ENGINEER ACCOUNT</div>
                    <p>Your engineer account has been successfully created. Here are your login credentials:</p>
                </div>
                
                <div class="credentials-box">
                    <h3>🔐 Your Engineer Account Credentials</h3>
                    <div class="credential-item">
                        <div class="credential-label">Email Address</div>
                        <div class="credential-value">${email}</div>
                    </div>
                    <div class="credential-item">
                        <div class="credential-label">Password</div>
                        <div class="credential-value">${password}</div>
                    </div>
                </div>
                
                <div class="otp-section">
                    <h3>🔢 Verification Code</h3>
                    <p>Use this OTP to verify your engineer account:</p>
                    <div class="otp-code">${otp}</div>
                    <p><strong>Valid for 10 minutes</strong></p>
                </div>
                
                <div class="highlight">
                    <strong>⚠️ Important:</strong> Please save your password securely. You can change it after logging in.
                </div>
                
                <div class="instructions">
                    <h3>📋 Next Steps</h3>
                    <ol>
                        <li>Copy the OTP code above</li>
                        <li>Go to the WiFi SelfCare Engineer Portal</li>
                        <li>Enter your email and password to login</li>
                        <li>Enter the OTP code when prompted</li>
                        <li>Complete your engineer profile setup</li>
                        <li>Start managing installation requests</li>
                    </ol>
                </div>
                
                <div class="instructions">
                    <h3>🔒 Security Tips</h3>
                    <ol>
                        <li>Never share your password with anyone</li>
                        <li>Use a strong, unique password</li>
                        <li>Enable two-factor authentication if available</li>
                        <li>Log out from shared devices</li>
                        <li>Report suspicious activities immediately</li>
                        <li>Keep your engineer credentials confidential</li>
                    </ol>
                </div>
                
                <div class="instructions">
                    <h3>🛠️ Engineer Features</h3>
                    <ol>
                        <li>View and manage installation requests</li>
                        <li>Update request status and progress</li>
                        <li>Communicate with customers</li>
                        <li>Access technical documentation</li>
                        <li>Track your work assignments</li>
                    </ol>
                </div>
            </div>
            
            <div class="footer">
                <p>Welcome to the WiFi SelfCare Engineering Team!</p>
                <p>If you have any questions, contact our support team</p>
                <div class="social-links">
                    <a href="#">📧 Support</a>
                    <a href="#">🌐 Engineer Portal</a>
                    <a href="#">📱 Mobile App</a>
                </div>
                <p style="margin-top: 20px; font-size: 12px; opacity: 0.6;">
                    This is an automated email. Please do not reply.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Generate beautiful HTML email template for engineer credentials (admin-created accounts)
 * @param email - Engineer's email
 * @param password - Generated password
 * @param firstName - Engineer's first name
 * @returns string - HTML email content
 */
export const generateEngineerCredentialsEmail = (email: string, password: string, firstName: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to WiFi SelfCare - Engineer Account</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                color: white;
                text-align: center;
                padding: 40px 20px;
            }
            
            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
                font-weight: 600;
            }
            
            .header p {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .welcome-message {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .welcome-message h2 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 24px;
            }
            
            .welcome-message p {
                color: #7f8c8d;
                font-size: 16px;
            }
            
            .credentials-box {
                background: linear-gradient(135deg, #ff9ff3 0%, #f368e0 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .credentials-box h3 {
                margin-bottom: 20px;
                font-size: 20px;
            }
            
            .credential-item {
                background: rgba(255, 255, 255, 0.2);
                padding: 15px;
                margin: 10px 0;
                border-radius: 5px;
                backdrop-filter: blur(10px);
            }
            
            .credential-label {
                font-weight: 600;
                margin-bottom: 5px;
                opacity: 0.9;
            }
            
            .credential-value {
                font-size: 18px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
            }
            
            .status-section {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .status-section h3 {
                margin-bottom: 20px;
                font-size: 20px;
            }
            
            .status-badge {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                padding: 15px 25px;
                border-radius: 25px;
                display: inline-block;
                margin: 15px 0;
                font-weight: bold;
                font-size: 18px;
                border: 2px solid rgba(255, 255, 255, 0.3);
            }
            
            .instructions {
                background-color: #f8f9fa;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                border-left: 4px solid #ff6b6b;
            }
            
            .instructions h3 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 18px;
            }
            
            .instructions ol {
                padding-left: 20px;
            }
            
            .instructions li {
                margin-bottom: 10px;
                color: #555;
            }
            
            .footer {
                background-color: #2c3e50;
                color: white;
                text-align: center;
                padding: 30px 20px;
            }
            
            .footer p {
                margin-bottom: 10px;
                opacity: 0.8;
            }
            
            .social-links {
                margin-top: 20px;
            }
            
            .social-links a {
                color: white;
                text-decoration: none;
                margin: 0 10px;
                opacity: 0.8;
                transition: opacity 0.3s;
            }
            
            .social-links a:hover {
                opacity: 1;
            }
            
            .highlight {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                text-align: center;
            }
            
            .engineer-badge {
                background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                display: inline-block;
                margin: 10px 0;
                font-weight: bold;
            }
            
            @media (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 5px;
                }
                
                .content {
                    padding: 20px 15px;
                }
                
                .header {
                    padding: 30px 15px;
                }
                
                .header h1 {
                    font-size: 24px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔧 WiFi SelfCare</h1>
                <p>Engineer Portal Access</p>
            </div>
            
            <div class="content">
                <div class="welcome-message">
                    <h2>Welcome, ${firstName}! 👋</h2>
                    <div class="engineer-badge">🔧 ENGINEER ACCOUNT</div>
                    <p>Your engineer account has been successfully created by our admin team. Here are your login credentials:</p>
                </div>
                
                <div class="credentials-box">
                    <h3>🔐 Your Engineer Account Credentials</h3>
                    <div class="credential-item">
                        <div class="credential-label">Email Address</div>
                        <div class="credential-value">${email}</div>
                    </div>
                    <div class="credential-item">
                        <div class="credential-label">Password</div>
                        <div class="credential-value">${password}</div>
                    </div>
                </div>
                
                <div class="status-section">
                    <h3>✅ Account Status</h3>
                    <div class="status-badge">ACCOUNT VERIFIED & READY</div>
                    <p>Your account is already verified and ready to use immediately!</p>
                </div>
                
                <div class="highlight">
                    <strong>⚠️ Important:</strong> Please save your password securely. You can change it after logging in.
                </div>
                
                <div class="instructions">
                    <h3>📋 Next Steps</h3>
                    <ol>
                        <li>Go to the WiFi SelfCare Engineer Portal</li>
                        <li>Enter your email and password to login</li>
                        <li>Complete your engineer profile setup</li>
                        <li>Start managing installation requests</li>
                    </ol>
                </div>
                
                <div class="instructions">
                    <h3>🔒 Security Tips</h3>
                    <ol>
                        <li>Never share your password with anyone</li>
                        <li>Use a strong, unique password</li>
                        <li>Enable two-factor authentication if available</li>
                        <li>Log out from shared devices</li>
                        <li>Report suspicious activities immediately</li>
                        <li>Keep your engineer credentials confidential</li>
                    </ol>
                </div>
                
                <div class="instructions">
                    <h3>🛠️ Engineer Features</h3>
                    <ol>
                        <li>View and manage installation requests</li>
                        <li>Update request status and progress</li>
                        <li>Communicate with customers</li>
                        <li>Access technical documentation</li>
                        <li>Track your work assignments</li>
                    </ol>
                </div>
            </div>
            
            <div class="footer">
                <p>Welcome to the WiFi SelfCare Engineering Team!</p>
                <p>If you have any questions, contact our support team</p>
                <div class="social-links">
                    <a href="#">📧 Support</a>
                    <a href="#">🌐 Engineer Portal</a>
                    <a href="#">📱 Mobile App</a>
                </div>
                <p style="margin-top: 20px; font-size: 12px; opacity: 0.6;">
                    This is an automated email. Please do not reply.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
};

/**
 * Generate beautiful HTML email template for user credentials (admin-created accounts)
 * @param email - User's email
 * @param password - Generated password
 * @param firstName - User's first name
 * @returns string - HTML email content
 */
export const generateUserCredentialsEmail = (email: string, password: string, firstName: string): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to WiFi SelfCare - User Account</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-align: center;
                padding: 40px 20px;
            }
            
            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
                font-weight: 600;
            }
            
            .header p {
                font-size: 16px;
                opacity: 0.9;
            }
            
            .content {
                padding: 40px 30px;
            }
            
            .welcome-message {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .welcome-message h2 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 24px;
            }
            
            .welcome-message p {
                color: #7f8c8d;
                font-size: 16px;
            }
            
            .credentials-box {
                background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
                color: #2c3e50;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .credentials-box h3 {
                margin-bottom: 20px;
                font-size: 20px;
            }
            
            .credential-item {
                background: rgba(255, 255, 255, 0.7);
                padding: 15px;
                margin: 10px 0;
                border-radius: 5px;
                backdrop-filter: blur(10px);
            }
            
            .credential-label {
                font-weight: 600;
                margin-bottom: 5px;
                opacity: 0.9;
            }
            
            .credential-value {
                font-size: 18px;
                font-family: 'Courier New', monospace;
                letter-spacing: 1px;
            }
            
            .status-section {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                text-align: center;
            }
            
            .status-section h3 {
                margin-bottom: 20px;
                font-size: 20px;
            }
            
            .status-badge {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                padding: 15px 25px;
                border-radius: 25px;
                display: inline-block;
                margin: 15px 0;
                font-weight: bold;
                font-size: 18px;
                border: 2px solid rgba(255, 255, 255, 0.3);
            }
            
            .instructions {
                background-color: #f8f9fa;
                padding: 25px;
                border-radius: 8px;
                margin: 30px 0;
                border-left: 4px solid #667eea;
            }
            
            .instructions h3 {
                color: #2c3e50;
                margin-bottom: 15px;
                font-size: 18px;
            }
            
            .instructions ol {
                padding-left: 20px;
            }
            
            .instructions li {
                margin-bottom: 10px;
                color: #555;
            }
            
            .footer {
                background-color: #2c3e50;
                color: white;
                text-align: center;
                padding: 30px 20px;
            }
            
            .footer p {
                margin-bottom: 10px;
                opacity: 0.8;
            }
            
            .social-links {
                margin-top: 20px;
            }
            
            .social-links a {
                color: white;
                text-decoration: none;
                margin: 0 10px;
                opacity: 0.8;
                transition: opacity 0.3s;
            }
            
            .social-links a:hover {
                opacity: 1;
            }
            
            .highlight {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                text-align: center;
            }
            
            .user-badge {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                display: inline-block;
                margin: 10px 0;
                font-weight: bold;
            }
            
            @media (max-width: 600px) {
                .container {
                    margin: 10px;
                    border-radius: 5px;
                }
                
                .content {
                    padding: 20px 15px;
                }
                
                .header {
                    padding: 30px 15px;
                }
                
                .header h1 {
                    font-size: 24px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🌐 WiFi SelfCare</h1>
                <p>Customer Portal Access</p>
            </div>
            
            <div class="content">
                <div class="welcome-message">
                    <h2>Welcome, ${firstName}! 👋</h2>
                    <div class="user-badge">👤 USER ACCOUNT</div>
                    <p>Your customer account has been successfully created by our admin team. Here are your login credentials:</p>
                </div>
                
                <div class="credentials-box">
                    <h3>🔐 Your Account Credentials</h3>
                    <div class="credential-item">
                        <div class="credential-label">Email Address</div>
                        <div class="credential-value">${email}</div>
                    </div>
                    <div class="credential-item">
                        <div class="credential-label">Password</div>
                        <div class="credential-value">${password}</div>
                    </div>
                </div>
                
                <div class="status-section">
                    <h3>✅ Account Status</h3>
                    <div class="status-badge">ACCOUNT VERIFIED & READY</div>
                    <p>Your account is already verified and ready to use immediately!</p>
                </div>
                
                <div class="highlight">
                    <strong>⚠️ Important:</strong> Please save your password securely. You can change it after logging in.
                </div>
                
                <div class="instructions">
                    <h3>📋 Next Steps</h3>
                    <ol>
                        <li>Go to the WiFi SelfCare Customer Portal</li>
                        <li>Enter your email and password to login</li>
                        <li>Complete your profile setup</li>
                        <li>Start managing your WiFi services</li>
                    </ol>
                </div>
                
                <div class="instructions">
                    <h3>🔒 Security Tips</h3>
                    <ol>
                        <li>Never share your password with anyone</li>
                        <li>Use a strong, unique password</li>
                        <li>Enable two-factor authentication if available</li>
                        <li>Log out from shared devices</li>
                        <li>Report suspicious activities immediately</li>
                        <li>Keep your account credentials confidential</li>
                    </ol>
                </div>
                
                <div class="instructions">
                    <h3>🎯 Customer Features</h3>
                    <ol>
                        <li>View your WiFi connection status</li>
                        <li>Submit installation requests</li>
                        <li>Track service requests and complaints</li>
                        <li>Manage your account settings</li>
                        <li>Access billing information</li>
                        <li>Contact customer support</li>
                    </ol>
                </div>
            </div>
            
            <div class="footer">
                <p>Welcome to WiFi SelfCare!</p>
                <p>If you have any questions, contact our support team</p>
                <div class="social-links">
                    <a href="#">📧 Support</a>
                    <a href="#">🌐 Customer Portal</a>
                    <a href="#">📱 Mobile App</a>
                </div>
                <p style="margin-top: 20px; font-size: 12px; opacity: 0.6;">
                    This is an automated email. Please do not reply.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
};

export const sendMessage =  {
    sendEmail,
    sendSms
}