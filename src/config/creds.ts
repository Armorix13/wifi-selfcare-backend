// Twilio credentials
export const twilioAccountSid: string = process.env.TWILIO_ACCOUNT_SID || '';
export const twilioAuthToken: string = process.env.TWILIO_AUTH_TOKEN || '';
export const twilioFromPhoneNumber: string = process.env.TWILIO_FROM_PHONE_NUMBER || '';

// SMTP credentials - Hostinger Configuration
export const smtpHost: string = process.env.SMTP_HOST || 'smtp.hostinger.com';
export const smtpPort: number = parseInt(process.env.SMTP_PORT || '465');
export const smtpSecure: boolean = process.env.SMTP_SECURE !== 'false'; // Default to true for SSL
export const smtpUser: string = process.env.SMTP_USER || 'support@clovantitsolutions.com';
export const smtpPass: string = process.env.SMTP_PASS || '';
export const smtpEmail: string = process.env.SMTP_EMAIL || 'support@clovantitsolutions.com';
export const smtpFooterMessage: string = process.env.SMTP_FOOTER_MESSAGE || 'Clovant IT Solutions'; 