import { Context } from 'telegraf';

/**
 * Утилита для «анимированного» обновления одного статусного сообщения
 * вместо отправки множества новых сообщений.
 *
 * @example
 * const ui = new MessageUpdater();
 * await ui.start(ctx, 'Начинаю...');
 * await ui.update(ctx, '50%');
 * await ui.update(ctx, 'Готово!');
 */
export class MessageUpdater {
    private msgId: number | null = null;

    /**
     * Отправить первое сообщение и запомнить message_id для дальнейших обновлений.
     * @param {Context} ctx Telegraf контекст.
     * @param {string} text Текст сообщения.
     */
    async start(ctx: Context, text: string) {
        const m: any = await ctx.reply(text, { disable_notification: true });
        this.msgId = m.message_id;
    }

    /**
     * Обновить текст статусного сообщения.
     * Если start() ещё не был вызван — отправит новое сообщение.
     * @param {Context} ctx Telegraf контекст.
     * @param {string} text Новый текст.
     */
    async update(ctx: Context, text: string) {
        if (!this.msgId) return this.start(ctx, text);
        const chatId = ctx.chat!.id;
        await ctx.telegram.editMessageText(chatId, this.msgId, undefined, text);
    }
}
