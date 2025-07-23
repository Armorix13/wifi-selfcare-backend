import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Response } from 'express';
import "dotenv/config";
import twilio from "twilio";
import nodemailer from "nodemailer";

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromPhoneNumber = process.env.TWILIO_FROM_PHONE_NUMBER;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

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
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '2d' });
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
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: smtpUser,
        pass: smtpPass,
    },
});

const sendEmail = async ({ userEmail, subject, text, html }: EmailParams): Promise<unknown> => {
    const mailOptions = {
        from: process.env.SMTP_EMAIL,
        to: userEmail,
        subject: subject,
        text: text,
        html: html,
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

export const sendMessage =  {
    sendEmail,
    sendSms
}