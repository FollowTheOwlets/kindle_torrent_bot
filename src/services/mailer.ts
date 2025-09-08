import nodemailer from 'nodemailer';
import * as path from 'node:path';
import {chunkBySize, listFilesRecursive} from './fileService.js';

export type MailConfig = {
    host: string; port: number; secure: boolean;
    user: string; pass: string; from: string; to: string;
};

export function createTransporter(cfg: MailConfig) {
    return nodemailer.createTransport({
        host: cfg.host, port: cfg.port, secure: cfg.secure,
        auth: {user: cfg.user, pass: cfg.pass},
    });
}

// Было: sendTorrentZip(...)

// Новая версия: отправить ВСЕ файлы как вложения (без ZIP), возможно несколькими письмами
export async function sendTorrentFiles(
    cfg: MailConfig,
    params: {
        rootDir: string;
        torrentName: string;
        filesCount: number;
        filenameForTorrent: string;
        torrentBuf: Buffer;
        maxEmailBytes: number;
    }
): Promise<{ partsSent: number; totalFiles: number }> {
    const transporter = createTransporter(cfg);

    const files = (await listFilesRecursive(params.rootDir)).filter(e => e.relPath.endsWith('.epub'));
    if (files.length === 0) {
        // Можно отправить только .torrent, но логичнее предупредить
        throw new Error('Папка пуста: нечего отправлять.');
    }

    const batches = chunkBySize(files, params.maxEmailBytes);

    for (let i = 0; i < batches.length; i++) {
        const part = i + 1;
        const total = batches.length;

        const atts = batches[i].map(f => ({
            filename: f.relPath.replaceAll(path.sep, '/'),
            path: f.absPath,
        }));

        const subjectBase = `Bot delivery: ${params.torrentName}`;
        const subject = total > 1 ? `${subjectBase} (Part ${part}/${total})` : subjectBase;

        const textLines = [
            `Имя торрента: ${params.torrentName}`,
            total > 1 ? `Это часть ${part} из ${total}.` : 'Все файлы поместились в одно письмо.',
        ];

        await transporter.sendMail({
            from: cfg.from,
            to: cfg.to,
            subject,
            text: textLines.join('\n'),
            attachments: atts,
        });
    }

    return {partsSent: batches.length, totalFiles: files.length};
}
