import {cfg} from './config/Config.js';
import {UserRepo} from './repo/UserRepo.js';
import {TorrentSeenRepo} from './repo/TorrentSeenRepo.js';
import {MailService} from './services/MailService.js';
import {TorrentService} from './services/TorrentService.js';
import {BotStarter} from './bot/BotStarter.js';

/**
 * Точка входа приложения: собирает зависимости, запускает бота и настраивает graceful shutdown.
 *
 * @example
 * // npm run dev
 */
const logger = {
    debug: (m: string) => console.log('[DEBUG]', m),
    info: (m: string) => console.log('[INFO ]', m),
    warn: (m: string) => console.warn('[WARN ]', m),
    error: (m: string, e?: unknown) => console.error('[ERROR]', m, e ?? ''),
};

async function main() {
    const users = new UserRepo();
    const seen = new TorrentSeenRepo();

    const mail = new MailService({
        host: cfg.smtp.host,
        port: cfg.smtp.port,
        secure: cfg.smtp.secure,
        user: cfg.smtp.user,
        pass: cfg.smtp.pass,
        from: cfg.smtp.from,
        maxEmailBytes: cfg.limits.maxEmailBytes,
        emailOverhead: cfg.limits.emailOverhead,
    });

    const torrent = new TorrentService(cfg.limits.torrentTimeoutMs);

    const app = new BotStarter(cfg.botToken, users, seen, mail, torrent, logger);
    app.attachObservers();
    await app.launch();

    logger.info('Bot started');
    process.once('SIGINT', () => {
        logger.warn('SIGINT');
        app.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
        logger.warn('SIGTERM');
        app.stop('SIGTERM');
    });
}

main().catch((e) => {
    console.error('Fatal:', e);
    process.exit(1);
});
