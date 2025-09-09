import 'dotenv/config';

/**
 * Глобальная конфигурация приложения, читаемая из ENV.
 * Бросает исключение, если обязательная переменная не задана.
 *
 * @example
 * const cfg = new Config();
 * console.log(cfg.botToken, cfg.smtp.host);
 */
class Config {
    /** Токен Telegram-бота. */
    readonly botToken = this.req('BOT_TOKEN');

    /** Параметры SMTP подключения. */
    readonly smtp = {
        host: this.req('SMTP_HOST'),
        port: Number(this.req('SMTP_PORT')),
        secure:
            (process.env.SMTP_SECURE ?? 'false').toLowerCase() === 'true' ||
            Number(this.req('SMTP_PORT')) === 465,
        user: this.req('SMTP_USER'),
        pass: this.req('SMTP_PASS'),
        from: this.req('MAIL_FROM'),
    };

    /** Лимиты и таймауты. */
    readonly limits = {
        /** Максимальный размер одного письма (байты). */
        maxEmailBytes: Number(process.env.MAX_EMAIL_BYTES ?? '20000000'),
        /** Коэффициент на overhead base64 (~33%). */
        emailOverhead: Number(process.env.EMAIL_B64_OVERHEAD ?? '1.33'),
        /** Таймаут скачивания торрента в миллисекундах. */
        torrentTimeoutMs: Number(process.env.DOWNLOAD_TIMEOUT_MIN ?? '10') * 60_000,
    };

    /**
     * Читает обязательную переменную окружения.
     * @private
     * @throws {Error} Если переменная не задана или пустая.
     */
    private req(key: string): string {
        const v = process.env[key];
        if (!v || !v.trim()) throw new Error(`ENV ${key} is required`);
        return v;
    }
}

export const cfg = new Config();
