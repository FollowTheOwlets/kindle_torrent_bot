import {Scenes, session, Telegraf} from 'telegraf';
import {UserRepo} from '../repo/UserRepo.js';
import {TorrentSeenRepo} from '../repo/TorrentSeenRepo.js';
import {MailService} from '../services/MailService.js';
import {TorrentService} from '../services/TorrentService.js';
import {InstructionScene} from '../scenes/InstructionScene.js';
import {EpubScene} from '../scenes/EpubScene.js';
import {TorrentScene} from '../scenes/TorrentScene.js';
import {ILogger} from '../core/types.js';

/**
 * BotStarter — точка сборки Telegram-бота: подключает сцены, команды
 * и навешивает обработчики (обсерверы) на события Telegraf.
 *
 * @example
 * const starter = new BotStarter(token, users, seen, mail, torrent, logger);
 * starter.attachObservers();
 * await starter.launch();
 */
export class BotStarter {
    private bot: Telegraf<Scenes.SceneContext>;

    /**
     * @param {string} token Токен Telegram-бота.
     * @param {UserRepo} users Репозиторий пользователей (tgId → email).
     * @param {TorrentSeenRepo} seen Учет повторных торрентов.
     * @param {MailService} mail Почтовый сервис.
     * @param {TorrentService} torrent Торрент-сервис.
     * @param {ILogger} logger Логгер.
     */
    constructor(
        token: string,
        private readonly users: UserRepo,
        private readonly seen: TorrentSeenRepo,
        private readonly mail: MailService,
        private readonly torrent: TorrentService,
        private readonly logger: ILogger
    ) {
        this.bot = new Telegraf<Scenes.SceneContext>(token, {
            handlerTimeout: Infinity,
        });
    }

    /**
     * Подключает сцены, команды и обработчики событий Telegraf.
     * Вызывать один раз при инициализации.
     */
    attachObservers() {
        const stage = new Scenes.Stage<Scenes.SceneContext>([
            InstructionScene(this.users),
            EpubScene(this.users, this.mail),
            TorrentScene(this.users, this.seen, this.mail, this.torrent),
        ]);

        this.bot.use(session());
        this.bot.use(stage.middleware());

        this.bot.start(async (ctx) => {
            const hasEmail = !!this.users.getEmail(ctx.from!.id);
            if (!hasEmail) return ctx.scene.enter('instruction');
            await ctx.reply('👋 Привет! Команды: /epub, /torrent, /help');
        });

        this.bot.command('help', async (ctx) => {
            await ctx.reply('Доступные команды:\n/epub — режим отправки .epub\n/torrent — режим обработки .torrent\n/instruction — задать или сменить email\n/cancel — выйти из текущей сцены');
        });

        this.bot.command('instruction', (ctx) => ctx.scene.enter('instruction'));
        this.bot.command('epub', (ctx) => ctx.scene.enter('epub'));
        this.bot.command('torrent', (ctx) => ctx.scene.enter('torrent'));

        // Подстраховка: если email не задан — отправляем в инструкцию при любом документе
        this.bot.on('document', async (ctx) => {
            if (!this.users.getEmail(ctx.from!.id)) {
                await ctx.scene.enter('instruction');
            }
        });
    }

    /**
     * Запускает бота и проверяет SMTP (мягко).
     * @returns {Promise<void>}
     */
    async launch() {
        await this.mail.verify().catch((e) => {
            this.logger.error('SMTP verify failed (продолжим попытку при отправке)', e);
        });
        await this.bot.launch();
    }

    /**
     * Остановить бота с причиной.
     * @param {string} reason Причина остановки (лог).
     */
    stop(reason: string) {
        this.bot.stop(reason);
    }

    /**
     * Доступ к «сырому» инстансу Telegraf (например, для тестов/расширений).
     */
    get raw() {
        return this.bot;
    }
}
