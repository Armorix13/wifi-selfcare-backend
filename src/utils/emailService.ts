import nodemailer from 'nodemailer';

export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        // Validate required environment variables
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
            throw new Error('EMAIL_USER and EMAIL_PASSWORD environment variables are required');
        }

        // Configure your email service here
        // For development, you can use Gmail, SendGrid, or any other service
        this.transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail', // or 'sendgrid', 'outlook', etc.
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : undefined,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async sendOTP(toEmail: string, otp: string, complaintId: string): Promise<boolean> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: toEmail,
                subject: `Complaint Resolution OTP - ${complaintId}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #007bff;">Complaint Resolution OTP</h2>
                        <p>Dear Customer,</p>
                        <p>Your complaint <strong>${complaintId}</strong> has been resolved by our engineer.</p>
                        <p>To confirm the resolution and close the complaint, please use the following OTP:</p>
                        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                            <h1 style="color: #28a745; font-size: 32px; margin: 0; letter-spacing: 5px;">${otp}</h1>
                        </div>
                        <p><strong>Important:</strong></p>
                        <ul>
                            <li>This OTP is valid for 24 hours</li>
                            <li>Please verify the resolution before using this OTP</li>
                            <li>If you have any concerns, please contact our support team</li>
                        </ul>
                        <p>Thank you for choosing our service!</p>
                        <p>Best regards,<br>Support Team</p>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('OTP email sent successfully:', result.messageId);
            return true;
        } catch (error) {
            console.error('Failed to send OTP email:', error);
            return false;
        }
    }

    async sendComplaintStatusUpdate(toEmail: string, complaintId: string, status: string, message: string): Promise<boolean> {
        try {
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: toEmail,
                subject: `Complaint Status Update - ${complaintId}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #007bff;">Complaint Status Update</h2>
                        <p>Dear Customer,</p>
                        <p>Your complaint <strong>${complaintId}</strong> status has been updated to: <strong>${status}</strong></p>
                        <p><strong>Message:</strong> ${message}</p>
                        <p>You can track your complaint status through our portal.</p>
                        <p>Thank you for your patience!</p>
                        <p>Best regards,<br>Support Team</p>
                    </div>
                `
            };

            const result = await this.transporter.sendMail(mailOptions);
            console.log('Status update email sent successfully:', result.messageId);
            return true;
        } catch (error) {
            console.error('Failed to send status update email:', error);
            return false;
        }
    }

    // Test email configuration
    async testConnection(): Promise<boolean> {
        try {
            await this.transporter.verify();
            console.log('Email service connection verified successfully');
            return true;
        } catch (error) {
            console.error('Email service connection failed:', error);
            return false;
        }
    }

    // Get email service configuration info (without sensitive data)
    getConfigInfo(): { service: string; host?: string; port?: number; secure?: boolean; user: string } {
        return {
            service: process.env.EMAIL_SERVICE || 'gmail',
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : undefined,
            secure: process.env.EMAIL_SECURE === 'true',
            user: process.env.EMAIL_USER || 'not-set'
        };
    }
}
