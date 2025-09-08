import 'dotenv/config';

const {
    BOT_TOKEN,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM,
    MAIL_TO,
    MAX_EMAIL_BYTES = '20000000',
    DOWNLOAD_TIMEOUT_MIN = '10',
} = process.env;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');
if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM || !MAIL_TO) {
    throw new Error('SMTP_* and MAIL_FROM, MAIL_TO are required');
}

export const config = {
    telegram: {
        token: BOT_TOKEN,
    },
    mail: {
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: String(SMTP_SECURE).toLowerCase() === 'true' || Number(SMTP_PORT) === 465,
        user: SMTP_USER,
        pass: SMTP_PASS,
        from: MAIL_FROM,
        to: MAIL_TO,
    },
    limits: {
        maxEmailBytes: Number(MAX_EMAIL_BYTES),
        downloadTimeoutMs: Number(DOWNLOAD_TIMEOUT_MIN) * 60_000,
    },
};
