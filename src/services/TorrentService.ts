import WebTorrent from 'webtorrent';
import {dir as tmpDir, DirectoryResult} from 'tmp-promise';
import * as path from 'node:path';
import {FileStatus} from '../utils/EmojiDownloadTable.js';
import {clearInterval} from "node:timers"; // <-- добавить импорт

export class TorrentService {
    constructor(private readonly timeoutMs: number) {}

    /**
     * @param torrentBuf .torrent содержимое
     * @param filter предикат по относительному пути
     * @param onProgress общий прогресс (0..100) по количеству выбранных файлов
     * @param onSnapshot колбэк со «снэпшотом» всех файлов (для отрисовки таблицы)
     */
    async downloadByFilter(
        torrentBuf: Buffer,
        filter: (relPath: string) => boolean,
        onProgress?: (p: number) => void,
        onSnapshot?: (files: FileStatus[]) => void
    ): Promise<{ downloadDir: DirectoryResult; torrentName: string; files: { absPath: string; relPath: string }[] }> {
        const downloadDir = await tmpDir({unsafeCleanup: true, prefix: 'torrent-dl-'});
        const client = new WebTorrent();
        let finished = false;

        const timeout = setTimeout(() => { if (!finished) client.destroy(); }, this.timeoutMs);
        const torrent = client.add(torrentBuf, {path: downloadDir.path});

        await once(torrent, 'ready');

        // выключаем всё и включаем только нужные
        try { torrent.deselect(0, Math.max(0, torrent.pieces.length - 1), 0); } catch {}
        torrent.files.forEach((f: any) => f.deselect?.());

        // строим список и статусы
        const selected = torrent.files.filter((f: any) => {
            const rel = normalizeRel(f.path, torrent.name);
            return filter(rel);
        });
        if (selected.length === 0) {
            await destroy(client); clearTimeout(timeout);
            throw new Error('Подходящих файлов не найдено.');
        }

        // Снапшот статусов: сразу все «downloading»
        let snapshot: FileStatus[] = selected.map((f: any) => ({
            relPath: normalizeRel(f.path, torrent.name),
            state: 'downloading' as const,
        }));
        onSnapshot?.(snapshot);

        // Включаем выбранные
        selected.forEach((f: any) => f.select?.());

        // таймер для периодического пересчёта пер-файлового прогресса
        const tickMs = 700; // частота пересчёта внутренних процентов
        const timer = setInterval(() => {
            snapshot = selected.map((f: any, idx: number) => {
                const relPath = normalizeRel(f.path, torrent.name);
                const done = !!f.done;
                const pct = done ? 100 : computePctByPieces(torrent, f);
                const state: FileStatus['state'] =
                    done ? 'done' : (pct > 0 ? 'downloading' : 'queued');
                return { relPath, state, pct };
            });
            onSnapshot?.(snapshot);
        }, tickMs);

        if (onProgress) {
            let done = 0, lastPct = -1;
            selected.forEach((f: any) => f.once?.('done', () => {
                done++;
                const pct = Math.floor((done / selected.length) * 100);
                if (pct > lastPct) { lastPct = pct; onProgress(pct); }
            }));
        }

        try {
            await waitFiles(selected);
        } catch (e) {
            await destroy(client);
            finished = true;
            clearTimeout(timeout);
            clearInterval(timer);
        }
        return {
            downloadDir,
            torrentName: torrent.name,
            files: selected.map((f: any) => {
                const rel = normalizeRel(f.path, torrent.name);
                const abs = path.join(downloadDir.path, rel);
                return { absPath: abs, relPath: rel };
            }),
        };
    }
}

/** Прогресс файла по доле загруженных pieces в его диапазоне (грубая, но стабильная оценка). */
function computePctByPieces(torrent: any, file: any): number {
    const start = file._startPiece ?? Math.floor(file.offset / torrent.pieceLength);
    const end = file._endPiece ?? start;
    const total = Math.max(1, end - start + 1);
    let have = 0;
    for (let i = start; i <= end; i++) {
        if (torrent.bitfield?.get?.(i)) have++;
    }
    return Math.floor((have / total) * 100);
}

/** убираем ведущую папку (имя торрента) и нормализуем слеши */
function normalizeRel(filePath: string, torrentName: string): string {
    return filePath.replace(/\\/g, '/');
}

function once(emitter: any, event: string) {
    return new Promise<void>((res, rej) => { emitter.once('error', rej); emitter.once(event, () => res()); });
}
function waitFiles(files: any[]) {
    return new Promise<void>((res) => {
        let left = files.length;
        files.forEach((f: any) => f.done ? (--left || res()) : f.once('done', () => (--left || res())));
    });
}
function destroy(client: any) { return new Promise<void>((res) => client.destroy(() => res())); }
