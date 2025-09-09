/**
 * Байт (число).
 * @typedef {number} Bytes
 */
export type Bytes = number;

/**
 * Универсальное вложение к письму: либо путь до файла, либо бинарное содержимое.
 * @typedef Attachment
 * @property {string} filename Имя файла, которое увидит получатель.
 * @property {string} [path] Абсолютный путь к файлу на диске (альтернатива content).
 * @property {Buffer} [content] Буфер содержимого (альтернатива path).
 * @example
 * { filename: 'book.epub', path: '/tmp/book.epub' }
 * { filename: 'book.epub', content: Buffer.from(...) }
 */
export type Attachment = {
    filename: string;
    path?: string;
    content?: Buffer;
};

/**
 * Простейший интерфейс логгера (можно подменить на pino/winston).
 * @interface ILogger
 */
export interface ILogger {
    /** Отладочные сообщения. */
    debug(msg: string): void;
    /** Информационные сообщения. */
    info(msg: string): void;
    /** Предупреждения. */
    warn(msg: string): void;
    /** Ошибки. */
    error(msg: string, err?: unknown): void;
}
