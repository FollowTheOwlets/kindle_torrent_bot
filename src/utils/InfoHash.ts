import parseTorrent from 'parse-torrent';
import crypto from 'node:crypto';

/**
 * Извлечь infoHash/имя/файлы из .torrent буфера.
 * Если парсинг не удался, вернёт хэш от буфера.
 *
 * @param {Buffer} buf Содержимое файла .torrent.
 * @returns {{infoHash: string, name?: string, files?: {path: string, length?: number}[]}}
 *
 * @example
 * const meta = getTorrentId(fs.readFileSync('file.torrent'));
 * console.log(meta.infoHash, meta.name);
 */
export async function getTorrentId(
    buf: Buffer
): Promise<{ infoHash: string; name?: string; files?: { path: string; length?: number }[] }> {
    try {
        const pt = await parseTorrent(buf);
        const infoHash = (pt as any).infoHash as string;
        const name = (pt as any).name as string | undefined;
        const files = (pt as any).files as { path: string; length?: number }[] | undefined;
        return { infoHash, name, files };
    } catch {
        return { infoHash: crypto.createHash('sha1').update(buf).digest('hex') };
    }
}
