import {Telegraf} from 'telegraf';
import axios from 'axios';
import * as path from 'node:path';
import {DirectoryResult} from 'tmp-promise';
import {config} from './config.js';
import {TorrentService} from './services/torrentService.js';
import {sendTorrentFiles} from './services/mailer.js';
import {throttle} from './utils/throttle.js';

export function createBot() {
    const bot = new Telegraf(config.telegram.token);
    const torrentSvc = new TorrentService();

    bot.start((ctx) =>
        ctx.reply(
            '👋 Пришли мне *.torrent* файлом, я скачаю содержимое, упакую в ZIP и отправлю на почту.\n' +
            `Лимит письма: ~${Math.floor(config.limits.maxEmailBytes / 1024 / 1024)} MB.`
        )
    );

    bot.on('document', async (ctx) => {
        const doc = ctx.message.document;
        const filename = (doc.file_name || '').toLowerCase();
        const isTorrent = filename.endsWith('.torrent') || (doc.mime_type || '').includes('bittorrent');

        if (!isTorrent) {
            await ctx.reply('📎 Пришли, пожалуйста, файл с расширением .torrent');
            return;
        }

        await ctx.reply('📥 Получил .torrent. Начинаю загрузку…');

        let downloadDir: DirectoryResult | null = null;

        try {
            // 1) Скачиваем .torrent из TG
            const file = await ctx.telegram.getFile(doc.file_id);
            if (!file.file_path) throw new Error('No file_path from Telegram');

            const fileUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${file.file_path}`;
            const torrentResp = await axios.get<ArrayBuffer>(fileUrl, {responseType: 'arraybuffer'});
            const torrentBuf = Buffer.from(torrentResp.data);

            await ctx.reply(`⏬ Загрузка: ${0}%`);
            // 2) Качаем по торренту
            const progressReply = throttle((pct: number) => {
                ctx.reply(`⏬ Загрузка: ${pct}%`).catch(() => {
                });
            }, 1000); // не чаще раза в 5 секунд

            const {downloadDir: dir, torrentName, filesCount} = await torrentSvc.downloadFromBuffer(torrentBuf, {
                timeoutMs: config.limits.downloadTimeoutMs,
                select: {
                    filter: (rel) => rel.endsWith('.epub')
                },
                onProgress: (p) => progressReply(p),
            });

            downloadDir = dir;

            // ➜ отправляем все файлы как вложения (пачками по лимиту)
            const {partsSent, totalFiles} = await sendTorrentFiles(
                {
                    host: config.mail.host,
                    port: config.mail.port,
                    secure: config.mail.secure,
                    user: config.mail.user,
                    pass: config.mail.pass,
                    from: config.mail.from,
                    to: config.mail.to,
                },
                {
                    rootDir: downloadDir.path,
                    torrentName: torrentName || filename,
                    filesCount,
                    filenameForTorrent: path.basename(filename || 'source.torrent'),
                    torrentBuf,
                    maxEmailBytes: config.limits.maxEmailBytes,
                }
            );

            await ctx.reply(
                partsSent > 1
                    ? `✅ Отправлено ${partsSent} писем на ${config.mail.to}. Всего файлов: ${totalFiles}.`
                    : `✅ Отправлено письмо на ${config.mail.to}. Файлов: ${totalFiles}.`
            );
        } catch (e: any) {
            console.error(e);
            await ctx.reply(`❌ Ошибка: ${e?.message || e}`);
        } finally {
            try {
                await downloadDir?.cleanup();
            } catch {
            }
        }
    });

    return bot;
}
