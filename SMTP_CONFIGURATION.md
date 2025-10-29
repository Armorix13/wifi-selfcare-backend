# SMTP Email Configuration - Hostinger

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# SMTP Email Configuration - Hostinger
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=support@clovantitsolutions.com
SMTP_PASS=Admin@support9963
SMTP_EMAIL=support@clovantitsolutions.com
SMTP_FOOTER_MESSAGE=Clovant IT Solutions
```

## Configuration Details

| Variable | Value | Description |
|----------|-------|-------------|
| `SMTP_HOST` | `smtp.hostinger.com` | Hostinger SMTP server hostname |
| `SMTP_PORT` | `465` | SMTP port for SSL encryption |
| `SMTP_SECURE` | `true` | Enable SSL encryption (required for port 465) |
| `SMTP_USER` | `support@clovantitsolutions.com` | SMTP username/email |
| `SMTP_PASS` | `Admin@support9963` | SMTP password |
| `SMTP_EMAIL` | `support@clovantitsolutions.com` | Sender email address |
| `SMTP_FOOTER_MESSAGE` | `Clovant IT Solutions` | Footer message added to all emails |

## Default Values

If environment variables are not set, the following defaults are used:

- `SMTP_HOST`: `smtp.hostinger.com`
- `SMTP_PORT`: `465`
- `SMTP_SECURE`: `true`
- `SMTP_USER`: `support@clovantitsolutions.com`
- `SMTP_EMAIL`: `support@clovantitsolutions.com`
- `SMTP_FOOTER_MESSAGE`: `Clovant IT Solutions`

**Note:** `SMTP_PASS` has no default and must be set in your `.env` file.

## Email Footer

The footer message (`Clovant IT Solutions`) is automatically added to all emails sent through the system:

- **HTML emails**: Footer is added with styled div at the bottom
- **Text emails**: Footer is added as plain text with separator line

## Usage

The SMTP configuration is automatically used throughout the project. All emails sent via the `sendEmail` function will:

1. Use Hostinger SMTP server
2. Send from `support@clovantitsolutions.com`
3. Include the footer message "Clovant IT Solutions"

## Files Updated

1. **`src/utils/helper.ts`** - Updated email transporter and sendEmail function
2. **`src/config/creds.ts`** - Added SMTP configuration exports

## Testing

To test the email configuration, ensure:
1. All environment variables are set correctly
2. SMTP credentials are valid
3. Port 465 is not blocked by firewall
4. SSL/TLS is enabled

## Security Notes

- Never commit your `.env` file to version control
- Keep `SMTP_PASS` secure and change it periodically
- Use environment-specific configurations for production

