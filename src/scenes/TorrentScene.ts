import {Scenes} from 'telegraf';
import {UserRepo} from '../repo/UserRepo.js';
import {TorrentSeenRepo} from '../repo/TorrentSeenRepo.js';
import {MailService} from '../services/MailService.js';
import {TorrentService} from '../services/TorrentService.js';
import {MessageUpdater} from '../utils/MessageUpdater.js';
import {getTorrentId} from '../utils/InfoHash.js';
import path from 'node:path';
import axios from 'axios';
import * as fs from 'node:fs';
import {cfg} from "../config/Config";
import {throttle} from "../utils/Throttle";
import {renderEmojiTable} from "../utils/EmojiDownloadTable";

/**
 * Сцена «TORRENT»: принимает .torrent.
 * - Первая отправка того же infoHash: скачивает только .epub (не более 5 шт).
 * - Если .epub больше 5 — предупреждение, ничего не отправляем.
 * - Повторная отправка того же .torrent: скачиваем и отправляем всё содержимое (почта сама разобьёт на несколько писем).
 *
 * @param {UserRepo} users Репозиторий email-адресов.
 * @param {TorrentSeenRepo} seen Учет числа отправок одного торрента.
 * @param {MailService} mail Почтовый сервис.
 * @param {TorrentService} torrentSvc Торрент-сервис.
 * @returns {Scenes.BaseScene<Scenes.SceneContext>}
 */
export const TorrentScene = (
    users: UserRepo,
    seen: TorrentSeenRepo,
    mail: MailService,
    torrentSvc: TorrentService
) => {
    const sc = new Scenes.BaseScene<Scenes.SceneContext>('torrent');

    sc.enter(async (ctx) => {
        await ctx.reply('🧲 Пришлите .torrent — я скачаю из него .epub и перешлю. Повторная отправка того же .torrent пришлёт **всё** содержимое.');
    });

    sc.on('document', async (ctx) => {
        const email = users.getEmail(ctx.from!.id);
        if (!email) return ctx.scene.enter('instruction');

        const doc = ctx.message.document;
        const filename = (doc.file_name || '').toLowerCase();
        const isTorrent = filename.endsWith('.torrent') || (doc.mime_type || '').includes('bittorrent');
        if (!isTorrent) {
            await ctx.reply('❌ Это не .torrent. Пришлите .torrent или перейдите в /epub.');
            return;
        }

        const ui = new MessageUpdater();
        await ui.start(ctx, `⏳ Получаю ${doc.file_name}...`);

        try {
            // скачиваем .torrent как буфер
            const f = await ctx.telegram.getFile(doc.file_id);
            const url = `https://api.telegram.org/file/bot${cfg.botToken}/${f.file_path}`;
            const resp = await axios.get<ArrayBuffer>(url, {responseType: 'arraybuffer'});
            const tbuf = Buffer.from(resp.data);

            // получаем infoHash и список файлов из метаданных
            const meta = await getTorrentId(tbuf);
            const hash = meta.infoHash;
            const attempt = seen.inc(ctx.from!.id, hash);

            const epubList = (meta.files ?? [])
                .map(x => x.path?.toLowerCase?.() ?? '')
                .filter(p => p.endsWith('.epub'));

            if (attempt === 1) {
                // 1-я отправка: только .epub и не более 5
                if (epubList.length === 0) {
                    await ui.update(ctx, '⚠️ В торренте нет .epub файлов.');
                    return;
                }
                if (epubList.length > 5) {
                    await ui.update(ctx, `⚠️ Слишком много .epub (${epubList.length}). Повторно пришлите тот же .torrent — тогда отправлю **всё** содержимое по старой логике.`);
                    return;
                }

                const throttledUpdate = throttle((snapshot) => {
                    const title = attempt === 1
                        ? '⏬ Скачивание .epub'
                        : '⏬ Скачивание всех файлов';
                    const text = renderEmojiTable(title, snapshot, { maxLines: 25, maxNameLen: 80 });
                    ui.update(ctx, text).catch(() => {});
                }, 1000); // не чаще раза в секунду

                const dl = await torrentSvc.downloadByFilter(
                    tbuf,
                    attempt === 1
                        ? (rel) => rel.toLowerCase().endsWith('.epub')
                        : (_rel) => true,
                    // общий числовой прогресс (можно не показывать отдельно, таблица достаточна)
                    undefined,
                    // ⬅️ снимок статусов для таблицы
                    throttledUpdate
                );

                throttledUpdate.cancel()
                throttledUpdate.flush()
                await ui.update(ctx, '✉️ Отправляю на почту...');
                const attachments = await Promise.all(
                    dl.files.map(async (f) => ({
                        filename: f.relPath.replaceAll(path.sep, '/'),
                        content: await fs.promises.readFile(f.absPath), // <= берём Buffer
                    }))
                );
                const subject = `TG EPUB: ${dl.torrentName || doc.file_name}`;
                const sent = await mail.sendFiles(email, subject, `Отправка ${attachments.length} .epub`, attachments);
                await ui.update(ctx, `✅ Отправлено на ${email}. Писем: ${sent}`);
                await dl.downloadDir.cleanup().catch(() => {
                });
            } else {

                throw new Error("А вот это мы пока не умеем");

                // // повтор: отправляем всё
                // await ui.update(ctx, '⏬ Скачиваю все файлы из торрента...');
                // const dl = await torrentSvc.downloadByFilter(
                //     tbuf,
                //     _ => true,
                //     p => ui.update(ctx, `⏬ Скачивание: ${p}%`)
                // );
                //
                // await ui.update(ctx, '✉️ Отправляю на почту (возможно несколько писем)...');
                // const attachments = dl.files.map(f => ({
                //     filename: f.relPath.replaceAll(path.sep, '/'),
                //     path: f.absPath
                // }));
                // const subject = `Torrent ALL: ${dl.torrentName || doc.file_name}`;
                // const sent = await mail.sendFiles(email, subject, `Отправка всех файлов (${attachments.length})`, attachments);
                //
                // await ui.update(ctx, `✅ Отправлено на ${email}. Писем: ${sent}`);
                // await dl.downloadDir.cleanup().catch(() => {
                // });
            }
        } catch (e: any) {
            await ui.update(ctx, `❌ Ошибка: ${e?.message ?? e}`);
        }
    });

    sc.command('cancel', async (ctx) => {
        await ctx.reply('Выход из сцены TORRENT');
        await ctx.scene.leave();
    });
    return sc;
};
