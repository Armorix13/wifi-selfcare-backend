// Twilio credentials
export const twilioAccountSid: string = process.env.TWILIO_ACCOUNT_SID || '';
export const twilioAuthToken: string = process.env.TWILIO_AUTH_TOKEN || '';
export const twilioFromPhoneNumber: string = process.env.TWILIO_FROM_PHONE_NUMBER || '';

// SMTP credentials
export const smtpUser: string = process.env.SMTP_USER || '';
export const smtpPass: string = process.env.SMTP_PASS || ''; 