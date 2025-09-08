import WebTorrent from 'webtorrent';
import { dir as tmpDir, DirectoryResult } from 'tmp-promise';

export type DownloadResult = {
    downloadDir: DirectoryResult;
    torrentName: string;
    filesCount: number; // в торрентах всего, не только выбранных
};

export type SelectRules = {
    /** Какие файлы оставить: строка как подстрока пути или RegExp по относительному пути в торренте */
    include?: Array<string | RegExp>;
    /** Какие файлы исключить */
    exclude?: Array<string | RegExp>;
    /** Произвольная логика: вернуть true — файл качаем */
    filter?: (relPath: string, size: number) => boolean;
};

export class TorrentService {
    async downloadFromBuffer(
        torrentBuf: Buffer,
        opts: {
            timeoutMs: number;
            onProgress?: (percent: number) => void;
            /** Правила выбора файлов. Если не заданы — качаем всё, как раньше. */
            select?: SelectRules;
        }
    ): Promise<DownloadResult> {
        const downloadDir = await tmpDir({ unsafeCleanup: true, prefix: 'torrent-dl-' });

        const client = new WebTorrent();
        let finished = false;

        const timeout = setTimeout(() => {
            if (!finished) client.destroy();
        }, opts.timeoutMs);

        const torrent = client.add(torrentBuf, { path: downloadDir.path });

        // Ждём, пока будут известны файлы
        await new Promise<void>((resolve, reject) => {
            torrent.on('ready', () => resolve());
            torrent.on('error', (e) => {
                clearTimeout(timeout);
                reject(e);
            });
        });

        // Если заданы правила — выбираем конкретные файлы
        let selected: any[] = [];
        if (opts.select) {
            // 1) Отключаем всё
            try {
                torrent.deselect(0, Math.max(0, torrent.pieces.length - 1), 0);
            } catch {
                // на некоторых версиях можно сделать через file.deselect()
            }
            torrent.files.forEach((f: any) => { if (typeof f.deselect === 'function') f.deselect(); });

            // 2) Определяем подходящие
            const matches = (rel: string, pat: string | RegExp) =>
                typeof pat === 'string' ? rel.toLowerCase().includes(pat.toLowerCase()) : pat.test(rel);

            const keep = (f: any) => {
                const relPath = normalizeRelPath(f.path, torrent.name);
                const size = Number(f.length ?? f._length ?? 0);

                if (opts.select?.include && !opts.select.include.some(p => matches(relPath, p))) {
                    return false;
                }
                if (opts.select?.exclude && opts.select.exclude.some(p => matches(relPath, p))) {
                    return false;
                }
                return !(opts.select?.filter && !opts.select.filter(relPath, size));

            };

            selected = torrent.files.filter(keep);

            if (selected.length === 0) {
                await new Promise<void>((r) => client.destroy(() => r()));
                clearTimeout(timeout);
                throw new Error('Не найдено ни одного файла, подходящего под правила выбора.');
            }

            // 3) Включаем только выбранные
            selected.forEach((f: any) => {
                if (typeof f.select === 'function') f.select();
            });
        } else {
            // Старая логика: сразу качаем всё
            selected = torrent.files.slice();
        }

        // Прогресс: если выбор задали — считаем по числу догруженных файлов; иначе — как раньше
        if (opts.onProgress) {
            if (opts.select) {
                let doneCount = 0;
                let lastPct = -1;
                selected.forEach((f: any) => {
                    f.once?.('done', () => {
                        doneCount++;
                        const pct = Math.floor((doneCount / selected.length) * 100);
                        if (pct >= lastPct + 5) {
                            lastPct = pct;
                            opts.onProgress!(pct);
                        }
                    });
                });
            } else {
                let lastPct = -1;
                torrent.on('download', () => {
                    const pct = Math.floor(torrent.progress * 100);
                    if (pct >= lastPct + 10) {
                        lastPct = pct;
                        opts.onProgress!(pct);
                    }
                });
            }
        }

        // Ждём завершения именно выбранных файлов
        await waitSelectedComplete(torrent, selected, timeout);

        // Останавливаем клиента
        await new Promise<void>((resolve) => client.destroy(() => resolve()));
        finished = true;
        clearTimeout(timeout);

        return {
            downloadDir,
            torrentName: torrent.name,
            filesCount: torrent.files.length,
        };
    }
}

/** У WebTorrent `file.path` обычно имеет вид `Торрент/путь/внутри`. Оставим часть внутри. */
function normalizeRelPath(filePath: string, torrentName: string): string {
    // Нормализуем слэши и отрезаем ведущую папку (имя торрента)
    const norm = filePath.replace(/\\/g, '/');
    const prefix = `${torrentName.replace(/\\/g, '/')}/`;
    return norm.startsWith(prefix) ? norm.slice(prefix.length) : norm;
}

/** Ждём, пока все выбранные файлы станут done (у торрента общий 'done' не подойдёт при частичной загрузке). */
function waitSelectedComplete(torrent: any, selected: any[], timeoutHandle: NodeJS.Timeout): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let remaining = selected.length;

        const onFileDone = () => {
            remaining--;
            if (remaining <= 0) {
                resolve();
            }
        };

        // Если файл уже догружен (например, мелкий) — уменьшаем сразу
        selected.forEach((f) => {
            if (f.done) {
                remaining--;
            } else {
                f.once?.('done', onFileDone);
            }
        });

        if (remaining <= 0) return resolve();

        torrent.on('error', (e: unknown) => {
            clearTimeout(timeoutHandle);
            reject(e);
        });
    });
}
