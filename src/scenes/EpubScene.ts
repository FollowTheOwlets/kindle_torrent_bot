import { Scenes } from 'telegraf';
import { UserRepo } from '../repo/UserRepo.js';
import { MailService } from '../services/MailService.js';
import { MessageUpdater } from '../utils/MessageUpdater.js';
import path from 'node:path';
import axios from 'axios';
import {cfg} from "../config/Config";

/**
 * Сцена «EPUB»: принимает .epub документ и пересылает его на email пользователя.
 *
 * @param {UserRepo} users Репозиторий email-адресов.
 * @param {MailService} mail Почтовый сервис.
 * @returns {Scenes.BaseScene<Scenes.SceneContext>}
 */
export const EpubScene = (users: UserRepo, mail: MailService) => {
    const sc = new Scenes.BaseScene<Scenes.SceneContext>('epub');

    sc.enter(async (ctx) => {
        await ctx.reply('📚 Пришлите .epub файл — я перешлю его на ваш email.');
    });

    sc.on('document', async (ctx) => {
        const email = users.getEmail(ctx.from!.id);
        if (!email) return ctx.scene.enter('instruction');

        const doc = ctx.message.document;
        const name = (doc.file_name || '').toLowerCase();
        if (!name.endsWith('.epub')) {
            await ctx.reply('❌ Это не .epub. Пришлите .epub или перейдите в /torrent.');
            return;
        }

        const ui = new MessageUpdater();
        await ui.start(ctx, `⏳ Получаю ${doc.file_name}...`);

        try {
            const f = await ctx.telegram.getFile(doc.file_id);
            const url = `https://api.telegram.org/file/bot${cfg.botToken}/${f.file_path}`;
            const resp = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' });
            const buf = Buffer.from(resp.data);

            await ui.update(ctx, '✉️ Отправляю на почту...');
            const subject = `Kindle delivery: ${doc.file_name}`;
            await mail.sendFiles(
                email,
                subject,
                'Отправка .epub',
                [{ filename: path.basename(doc.file_name!), content: buf }],
            );

            await ui.update(ctx, `✅ Отправлено на ${email}`);
        } catch (e: any) {
            console.log(e)
            await ui.update(ctx, `❌ Ошибка: ${e?.message ?? e}`);
        }
    });

    sc.command('cancel', async (ctx) => { await ctx.reply('Выход из сцены EPUB'); await ctx.scene.leave(); });
    return sc;
};
