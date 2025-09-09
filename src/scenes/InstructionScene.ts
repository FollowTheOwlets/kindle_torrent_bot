import { Scenes } from 'telegraf';
import { UserRepo } from '../repo/UserRepo.js';

/**
 * Сцена «Инструкция»: запрос и сохранение email пользователя.
 * Если email некорректен — просит повторить ввод.
 *
 * @param {UserRepo} users Репозиторий пользователей.
 * @returns {Scenes.BaseScene<Scenes.SceneContext>} Инстанс сцены.
 */
export const InstructionScene = (users: UserRepo) => {
    const sc = new Scenes.BaseScene<Scenes.SceneContext>('instruction');

    sc.enter(async (ctx) => {
        await ctx.reply('📧 Введите email, на который слать файлы:');
    });

    sc.on('text', async (ctx) => {
        const email = String(ctx.message.text).trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            await ctx.reply('❌ Неверный email. Попробуйте ещё раз.');
            return;
        }
        users.setEmail(ctx.from!.id, email);
        await ctx.reply(`✅ Email сохранён: ${email}\nДоступные команды: /epub, /torrent, /help`);
        await ctx.scene.leave();
    });

    sc.command('cancel', async (ctx) => { await ctx.reply('Отменено'); await ctx.scene.leave(); });
    return sc;
};
