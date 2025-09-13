import nodemailer, {Transporter} from 'nodemailer';
import {Attachment} from '../core/types.js';
import {Chunker} from '../utils/Chunker.js';
import SMTPTransport from "nodemailer/lib/smtp-transport";

/**
 * Сервис отправки писем через SMTP.
 * Умеет отправлять произвольные наборы файлов, автоматически разбивая их на несколько писем.
 *
 * @example
 * const mail = new MailService({ host, port, secure, user, pass, from, maxEmailBytes: 20e6, emailOverhead: 1.33 });
 * await mail.verify();
 * await mail.sendFiles('to@example.com', 'Subject', 'Text', [{ filename: 'a.txt', content: Buffer.from('hi') }]);
 */
export class MailService {
    private transporter: Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options>;

    /**
     * @param {{host:string, port:number, secure:boolean, user:string, pass:string, from:string, maxEmailBytes:number, emailOverhead:number}} cfg Конфигурация SMTP и лимитов.
     */
    constructor(
        private readonly cfg: {
            host: string; port: number; secure: boolean;
            user: string; pass: string; from: string;
            maxEmailBytes: number; emailOverhead: number;
        }
    ) {
    this.transporter = nodemailer.createTransport({
            host: this.cfg.host,
            port: this.cfg.port,
            secure: this.cfg.secure,
            auth: {user: this.cfg.user, pass: this.cfg.pass},
        })
    }

    /**
     * Проверка SMTP-соединения и аутентификации.
     * @returns {Promise<true>} Результат verify (вернёт true или бросит исключение).
     */
    async verify() {
        return this.transporter.verify();
    }

    /**
     * Отправить произвольные файлы.
     * @param {string} to Адрес получателя.
     * @param {string} subjectBase Базовая тема письма (для multipart добавится Part X/N).
     * @param {string} textBase Базовый текст письма.
     * @param {Attachment[]} attachments Вложения (path или content).
     * @returns {Promise<number>} Количество отправленных писем (частей).
     * @throws {Error} Если какое-то вложение больше лимита письма.
     */
    async sendFiles(to: string, subjectBase: string, textBase: string, attachments: Attachment[]): Promise<number> {
        const chunker = new Chunker(this.cfg.maxEmailBytes, this.cfg.emailOverhead);
        const parts = chunker.split(attachments);
        const total = parts.length;

        for (let i = 0; i < total; i++) {
            const subject = total > 1 ? `${subjectBase} (Part ${i + 1}/${total})` : subjectBase;
            const text = total > 1 ? `${textBase}\nЧасть ${i + 1} из ${total}.` : textBase;
            await this.transporter.sendMail({
                from: this.cfg.from,
                to,
                subject,
                text,
                attachments: parts[i] as any,
            });
        }
        return total;
    }
}
