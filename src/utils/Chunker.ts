import {Attachment} from '../core/types.js';
import {statSync} from 'node:fs'

/**
 * Разбивает массив вложений на части так, чтобы каждая часть
 * не превышала maxBytes (с учетом base64-overhead).
 *
 * @example
 * const ch = new Chunker(20 * 1024 * 1024, 1.33);
 * const parts = ch.split([{ filename: 'a.bin', path: '/tmp/a' }]);
 */
export class Chunker {
    /**
     * @param {number} maxBytes Лимит на размер одного письма (в байтах).
     * @param {number} [overhead=1.33] Множитель на overhead (например, base64 ~33%).
     */
    constructor(private readonly maxBytes: number, private readonly overhead = 1.33) {
    }

    /**
     * Оценить «эффективный» размер вложения (с учетом overhead).
     * @private
     */
    private sizeOf(a: Attachment): number {
        if (a.content) return a.content.byteLength;
        if (a.path) {
            return statSync(a.path).size;
        }
        return 0;
    }

    /**
     * Разбить вложения на части.
     * @param {Attachment[]} attachments Список вложений.
     * @returns {Attachment[][]} Части, готовые к отправке.
     * @throws {Error} Если какое-то вложение больше лимита maxBytes.
     */
    split(attachments: Attachment[]): Attachment[][] {
        const batches: Attachment[][] = [];
        let cur: Attachment[] = [];
        let curSize = 0;

        for (const a of attachments) {
            const s = Math.ceil(this.sizeOf(a) * this.overhead);
            if (s > this.maxBytes) {
                throw new Error(`Вложение "${a.filename}" превышает лимит письма.`);
            }
            if (cur.length > 0 && curSize + s > this.maxBytes) {
                batches.push(cur);
                cur = [];
                curSize = 0;
            }
            cur.push(a);
            curSize += s;
        }
        if (cur.length) batches.push(cur);
        return batches;
    }
}
