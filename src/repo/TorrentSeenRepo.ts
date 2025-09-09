/**
 * Учет «повторности» одного и того же торрента для конкретного пользователя.
 * Ключ = `${tgId}:${infoHash}` → число попыток (1 — первая отправка, 2+ — повтор).
 *
 * @example
 * const seen = new TorrentSeenRepo();
 * const attempt = seen.inc(123, 'abcdef...'); // 1
 * const attempt2 = seen.inc(123, 'abcdef...'); // 2
 */
export class TorrentSeenRepo {
    private seen = new Map<string, number>();

    /**
     * Увеличить счетчик для пары (пользователь, торрент).
     * @param {number} tgId Telegram ID пользователя.
     * @param {string} hash infoHash торрента.
     * @returns {number} Текущее значение (после инкремента).
     */
    inc(tgId: number, hash: string): number {
        const key = `${tgId}:${hash}`;
        const n = (this.seen.get(key) ?? 0) + 1;
        this.seen.set(key, n);
        return n;
    }
}
